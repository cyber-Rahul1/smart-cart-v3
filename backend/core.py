"""Shared kernel: DB handle, auth deps, helpers. Each service module owns its own collections."""
import hashlib
import hmac
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from dotenv import load_dotenv
from fastapi import Depends, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
APP_ENV = os.environ["APP_ENV"]
ACCESS_MINUTES = 60
# Orders that can be fulfilled: paid online, or cash on delivery (collected at the door).
FULFILLABLE = ["paid", "cod"]
REFRESH_DAYS = 30


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def parse_iso(s: str) -> datetime:
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


def short_code(prefix: str = "") -> str:
    return prefix + uuid.uuid4().hex[:6].upper()


def digest(value: str) -> str:
    return hmac.new(JWT_SECRET.encode(), value.encode(), hashlib.sha256).hexdigest()


def make_access(user_id: str, role: str) -> str:
    return jwt.encode(
        {"sub": user_id, "role": role, "typ": "access", "iat": now(), "exp": now() + timedelta(minutes=ACCESS_MINUTES)},
        JWT_SECRET,
        algorithm=JWT_ALG,
    )


def clean(doc):
    """Strip Mongo _id before returning to clients."""
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


async def current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Bearer token required")
    try:
        payload = jwt.decode(authorization[7:], JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("typ") != "access":
            raise ValueError()
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(401, "Invalid or expired access token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    if user.get("restricted"):
        raise HTTPException(403, "Account restricted")
    return user


def require(*roles):
    async def check(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Forbidden for your role")
        return user

    return check


async def notify(user_ids, title: str, body: str, ntype: str, ref: str | None = None):
    """Notification service entrypoint: durable in-app record (push/SMS adapters plug in later)."""
    docs = [
        {"id": new_id(), "user_id": uid, "title": title, "body": body, "type": ntype, "ref": ref, "read": False, "created_at": iso(now())}
        for uid in set(user_ids)
    ]
    if docs:
        await db.notifications.insert_many(docs)


async def get_config() -> dict:
    cfg = await db.platform_config.find_one({"id": "fees"}, {"_id": 0})
    return cfg

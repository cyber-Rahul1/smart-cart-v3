"""Identity Service: OTP auth, JWT access + rotating refresh tokens, sessions."""
import re
import secrets
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from core import APP_ENV, REFRESH_DAYS, clean, current_user, db, digest, iso, make_access, new_id, now, parse_iso, short_code

router = APIRouter(prefix="/api/auth", tags=["identity"])
PHONE_RE = re.compile(r"^\+[1-9]\d{7,14}$")


class PhoneIn(BaseModel):
    phone: str
    role: Literal["customer", "seller"] = "customer"  # self-registration only; rider/admin are granted server-side


class VerifyIn(PhoneIn):
    code: str = Field(pattern=r"^\d{6}$")


class RefreshIn(BaseModel):
    refresh_token: str


class DevOtpProvider:
    """Swap with TwilioVerifyProvider (send/check) in production; endpoints stay unchanged."""

    async def send(self, phone: str, code: str) -> dict:
        return {"dev_code": code} if APP_ENV == "dev" else {}


provider = DevOtpProvider()


def norm_phone(phone: str) -> str:
    phone = phone.replace(" ", "")
    if not PHONE_RE.match(phone):
        raise HTTPException(422, "Enter a valid mobile number")
    return phone


async def issue_pair(user: dict, family: str | None = None) -> dict:
    raw = secrets.token_urlsafe(48)
    await db.refresh_sessions.insert_one(
        {
            "user_id": user["id"],
            "family": family or new_id(),
            "token_hash": digest(raw),
            "expires_at": iso(now() + timedelta(days=REFRESH_DAYS)),
            "revoked_at": None,
            "created_at": iso(now()),
        }
    )
    return {"access_token": make_access(user["id"], user["role"]), "refresh_token": raw, "token_type": "bearer"}


@router.post("/otp/request")
async def request_otp(body: PhoneIn):
    phone = norm_phone(body.phone)
    recent = await db.otp_challenges.find_one({"phone": phone})
    if recent and (now() - parse_iso(recent["created_at"])).total_seconds() < 10:
        raise HTTPException(429, "Please wait a few seconds before requesting another OTP")
    code = f"{secrets.randbelow(1_000_000):06d}"
    await db.otp_challenges.delete_many({"phone": phone})
    await db.otp_challenges.insert_one(
        {"phone": phone, "role": body.role, "code_hash": digest(code), "attempts": 0,
         "expires_at": iso(now() + timedelta(minutes=5)), "created_at": iso(now())}
    )
    return {"message": "OTP sent", **await provider.send(phone, code)}


@router.post("/otp/verify")
async def verify_otp(body: VerifyIn):
    phone = norm_phone(body.phone)
    c = await db.otp_challenges.find_one({"phone": phone})
    if not c or parse_iso(c["expires_at"]) <= now() or c["attempts"] >= 5:
        raise HTTPException(400, "Invalid or expired OTP")
    await db.otp_challenges.update_one({"phone": phone}, {"$inc": {"attempts": 1}})
    if not secrets.compare_digest(c["code_hash"], digest(body.code)):
        raise HTTPException(400, "Invalid or expired OTP")
    await db.otp_challenges.delete_one({"phone": phone})
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    is_new = user is None
    if is_new:
        # Role is write-once at first verification; it never changes through login.
        user = {"id": new_id(), "phone": phone, "role": body.role, "name": "", "referral_code": short_code("GC"),
                "referred_by": None, "delivery_credits": 0, "restricted": False, "created_at": iso(now())}
        try:
            await db.users.insert_one(dict(user))
        except DuplicateKeyError:
            user = await db.users.find_one({"phone": phone}, {"_id": 0})
            is_new = False
    if user["role"] != body.role:
        kind = "business partner" if user["role"] == "seller" else user["role"]
        raise HTTPException(409, f"This number is registered as a {kind} account. Use a different number here.")
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login_at": iso(now())}})
    pair = await issue_pair(user)
    return {**pair, "user": user, "is_new": is_new or not user.get("name")}


@router.post("/refresh")
async def refresh(body: RefreshIn):
    h = digest(body.refresh_token)
    old = await db.refresh_sessions.find_one_and_update(
        {"token_hash": h, "revoked_at": None}, {"$set": {"revoked_at": iso(now())}}, return_document=ReturnDocument.AFTER
    )
    if not old:
        reused = await db.refresh_sessions.find_one({"token_hash": h})
        if reused:  # replay detected: revoke whole family
            await db.refresh_sessions.update_many({"family": reused["family"]}, {"$set": {"revoked_at": iso(now())}})
        raise HTTPException(401, "Invalid refresh token")
    if parse_iso(old["expires_at"]) <= now():
        raise HTTPException(401, "Refresh token expired")
    user = await db.users.find_one({"id": old["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return await issue_pair(user, old["family"])


@router.post("/logout")
async def logout(body: RefreshIn):
    s = await db.refresh_sessions.find_one({"token_hash": digest(body.refresh_token)})
    if s:
        await db.refresh_sessions.update_many({"family": s["family"]}, {"$set": {"revoked_at": iso(now())}})
    return {"ok": True}


@router.get("/me")
async def me(user=Depends(current_user)):
    return clean(user)

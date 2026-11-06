import asyncio
import logging
import uuid
from contextlib import suppress
from datetime import timedelta

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pymongo import ASCENDING, DESCENDING, IndexModel
from starlette.middleware.cors import CORSMiddleware

from core import client, db, iso, notify, now
from seed import seed
from services import cart, catalog, community, customer, delivery, group_ordering, identity, orders, payments, seller

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("gathrcart")

INDEXES: dict[str, list[IndexModel]] = {
    "users": [IndexModel([("id", ASCENDING)], unique=True, name="id"), IndexModel([("phone", ASCENDING)], unique=True, name="phone"),
              IndexModel([("referral_code", ASCENDING)], unique=True, name="ref")],
    "otp_challenges": [IndexModel([("phone", ASCENDING)], name="phone")],
    "refresh_sessions": [IndexModel([("token_hash", ASCENDING)], unique=True, name="th"), IndexModel([("family", ASCENDING)], name="fam")],
    "addresses": [IndexModel([("user_id", ASCENDING)], name="uid")],
    "sellers": [IndexModel([("id", ASCENDING)], unique=True, name="id"), IndexModel([("category", ASCENDING), ("distance_km", ASCENDING)], name="cat"),
                IndexModel([("location", "2dsphere")], name="geo"), IndexModel([("owner_id", ASCENDING)], name="owner", unique=True,
                                                                             partialFilterExpression={"owner_id": {"$type": "string"}})],
    "products": [IndexModel([("id", ASCENDING)], unique=True, name="id"), IndexModel([("seller_id", ASCENDING)], name="sid")],
    "orders": [IndexModel([("id", ASCENDING)], unique=True, name="id"), IndexModel([("member_ids", ASCENDING), ("created_at", DESCENDING)], name="mem"),
               IndexModel([("seller_id", ASCENDING), ("status", ASCENDING)], name="seller_status")],
    "carts": [IndexModel([("user_id", ASCENDING)], unique=True, name="uid")],
    "groups": [IndexModel([("id", ASCENDING)], unique=True, name="id"), IndexModel([("invite_code", ASCENDING)], unique=True, name="code"),
               IndexModel([("members.user_id", ASCENDING)], name="mem")],
    "group_carts": [IndexModel([("id", ASCENDING)], unique=True, name="id"), IndexModel([("status", ASCENDING), ("closes_at", ASCENDING)], name="sched")],
    "communities": [IndexModel([("id", ASCENDING)], unique=True, name="id"), IndexModel([("invite_code", ASCENDING)], unique=True, name="code")],
    "residents": [IndexModel([("community_id", ASCENDING), ("user_id", ASCENDING)], unique=True, name="cu")],
    "baskets": [IndexModel([("id", ASCENDING)], unique=True, name="id"), IndexModel([("status", ASCENDING), ("closes_at", ASCENDING)], name="sched")],
    "payments": [IndexModel([("id", ASCENDING)], unique=True, name="id"), IndexModel([("provider_order_id", ASCENDING)], unique=True, name="poid")],
    "webhook_events": [IndexModel([("event_id", ASCENDING)], unique=True, name="eid")],
    "notifications": [IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="uc")],
}


async def ensure_indexes():
    for col, models in INDEXES.items():
        for m in models:
            try:
                await db[col].create_indexes([m])
            except Exception as exc:
                logger.error("ensure_indexes(%s.%s): %s", col, m.document["name"], exc)


async def scheduler():
    """Background jobs: closing-soon reminders, auto-close group carts & community baskets at deadline."""
    while True:
        try:
            soon = iso(now() + timedelta(minutes=10))
            async for c in db.group_carts.find({"status": "open", "reminded": False, "closes_at": {"$lte": soon}}, {"_id": 0}):
                g = await db.groups.find_one({"id": c["group_id"]}, {"_id": 0})
                await db.group_carts.update_one({"id": c["id"]}, {"$set": {"reminded": True}})
                await notify([m["user_id"] for m in g["members"]], "Cart closing soon", f"{c['name']} closes in under 10 minutes", "group_cart", c["id"])
            async for c in db.group_carts.find({"status": "open", "closes_at": {"$lte": iso(now())}}, {"_id": 0}):
                g = await db.groups.find_one({"id": c["group_id"]}, {"_id": 0})
                await group_ordering.close_cart_doc(c, [m["user_id"] for m in g["members"]])
            async for b in db.baskets.find({"status": "open", "closes_at": {"$lte": iso(now())}}, {"_id": 0}):
                if b["items"]:
                    await community.close_basket_doc(b)
                else:
                    await db.baskets.update_one({"id": b["id"]}, {"$set": {"status": "expired"}})
        except Exception as exc:
            logger.exception("scheduler error: %s", exc)
        await asyncio.sleep(20)


app = FastAPI(title="GathrCart API", version="0.1.0")


@app.middleware("http")
async def correlation(request: Request, call_next):
    cid = request.headers.get("x-correlation-id") or str(uuid.uuid4())
    try:
        resp = await call_next(request)
    except Exception:
        logger.exception("unhandled error cid=%s", cid)
        resp = JSONResponse({"detail": "Something went wrong"}, status_code=500)
    resp.headers["x-correlation-id"] = cid
    return resp


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


@app.get("/api/health")
async def api_health():
    return {"status": "ok", "services": ["identity", "customer", "catalog", "cart", "group-ordering", "community", "orders",
                                         "payments", "delivery", "notifications", "promotions", "referral"]}


for module in (identity, customer, catalog, cart, orders, payments, delivery, group_ordering, community, seller):
    app.include_router(module.router)

app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await seed()
    app.state.index_task = asyncio.create_task(ensure_indexes())
    app.state.scheduler = asyncio.create_task(scheduler())


@app.on_event("shutdown")
async def shutdown():
    for t in (app.state.index_task, app.state.scheduler):
        t.cancel()
        with suppress(asyncio.CancelledError):
            await t
    client.close()

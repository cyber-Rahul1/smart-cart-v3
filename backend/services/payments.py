"""Payment Service (DEMO provider, Razorpay-shaped). Status only changes via server-side signature verification."""
import hashlib
import hmac
import json
import os
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from core import current_user, db, iso, new_id, notify, now, short_code

router = APIRouter(prefix="/api/payments", tags=["payments"])
DEMO_KEY = os.environ["PAYMENT_WEBHOOK_SECRET"].encode()


def sign(provider_order_id: str, provider_payment_id: str) -> str:
    return hmac.new(DEMO_KEY, f"{provider_order_id}|{provider_payment_id}".encode(), hashlib.sha256).hexdigest()


class InitiateIn(BaseModel):
    order_id: str


class DemoCompleteIn(BaseModel):
    outcome: Literal["success", "failure"]


class VerifyIn(BaseModel):
    provider_order_id: str
    provider_payment_id: str
    signature: str


@router.post("/initiate")
async def initiate(body: InitiateIn, user=Depends(current_user)):
    o = await db.orders.find_one({"id": body.order_id, "user_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if o["payment_status"] == "paid":
        raise HTTPException(400, "Order already paid")
    if o["status"] == "cancelled":
        raise HTTPException(400, "Order cancelled")
    existing = await db.payments.find_one({"order_id": o["id"], "status": "created"}, {"_id": 0})
    if existing:  # idempotent initiation
        return existing
    p = {"id": new_id(), "order_id": o["id"], "user_id": user["id"], "amount": o["bill"]["total"], "currency": "INR",
         "provider": "demo", "provider_order_id": short_code("order_demo_"), "status": "created", "attempts": [],
         "created_at": iso(now())}
    await db.payments.insert_one(dict(p))
    return p


async def apply_success(payment: dict, provider_payment_id: str):
    order = await db.orders.find_one({"id": payment["order_id"]}, {"_id": 0})
    if order["status"] == "cancelled" or payment["status"] in ("cancelled", "refunded"):
        # Money arrived for a cancelled order: never confirm it, auto-refund instead.
        res = await db.payments.update_one({"id": payment["id"], "status": {"$nin": ["captured", "refunded"]}},
                                           {"$set": {"status": "refunded", "provider_payment_id": provider_payment_id}})
        if res.modified_count:
            await db.refunds.insert_one({"id": new_id(), "order_id": order["id"], "payment_id": payment["id"], "amount": payment["amount"],
                                         "status": "processed", "provider": "demo", "reason": "order_cancelled", "created_at": iso(now())})
        raise HTTPException(409, "Order was cancelled — payment refunded")
    res = await db.payments.update_one({"id": payment["id"], "status": {"$nin": ["captured", "cancelled", "refunded"]}},
                                       {"$set": {"status": "captured", "provider_payment_id": provider_payment_id, "captured_at": iso(now())}})
    if not res.modified_count:
        return  # duplicate event, already processed
    o = order
    for i in o["items"]:
        await db.products.update_one({"id": i["product_id"]}, [{"$set": {"stock": {"$max": [0, {"$subtract": ["$stock", i["qty"]]}]}}}])
    await db.orders.update_one({"id": o["id"]}, {"$set": {"payment_status": "paid", "status": "confirmed", "payment_id": payment["id"]},
                                                 "$push": {"history": {"status": "confirmed", "at": iso(now())}}})
    await db.commissions.insert_one({"id": new_id(), "order_id": o["id"], "seller_id": o["seller_id"], "amount": o["bill"]["commission"],
                                     "created_at": iso(now())})
    if o["bill"].get("credit_used"):
        await db.users.update_one({"id": o["user_id"], "delivery_credits": {"$gt": 0}}, {"$inc": {"delivery_credits": -1}})
    await db.sellers.update_one({"id": o["seller_id"]}, {"$inc": {"trend_score": 1, "orders_count": 1}})
    await notify(o["member_ids"], "Order confirmed", f"{o['seller_name']} received your order {o['order_no']}", "order", o["id"])
    # Referral qualification: referee's first paid order rewards the referrer with a delivery credit.
    ref = await db.referrals.find_one({"referee_id": o["user_id"], "status": "pending"})
    if ref and o["bill"]["subtotal"] >= 149:
        await db.referrals.update_one({"id": ref["id"]}, {"$set": {"status": "rewarded", "order_id": o["id"], "rewarded_at": iso(now())}})
        await db.users.update_one({"id": ref["referrer_id"]}, {"$inc": {"delivery_credits": 1}})
        await notify([ref["referrer_id"]], "Referral reward", "Your friend placed their first order. You earned 1 free delivery credit!", "referral")


async def verify_and_apply(body: VerifyIn, user_id: str | None = None) -> dict:
    p = await db.payments.find_one({"provider_order_id": body.provider_order_id}, {"_id": 0})
    if not p or (user_id and p["user_id"] != user_id):
        raise HTTPException(404, "Payment not found")
    if not hmac.compare_digest(sign(body.provider_order_id, body.provider_payment_id), body.signature):
        await db.payments.update_one({"id": p["id"]}, {"$push": {"attempts": {"result": "bad_signature", "at": iso(now())}}})
        raise HTTPException(400, "Payment signature verification failed")
    await apply_success(p, body.provider_payment_id)
    return await db.payments.find_one({"id": p["id"]}, {"_id": 0})


@router.post("/verify")
async def verify(body: VerifyIn, user=Depends(current_user)):
    return await verify_and_apply(body, user["id"])


@router.post("/{pid}/demo-complete")
async def demo_complete(pid: str, body: DemoCompleteIn, user=Depends(current_user)):
    """Simulates the hosted checkout. Success produces a provider signature which is then verified server-side."""
    p = await db.payments.find_one({"id": pid, "user_id": user["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Payment not found")
    if p["status"] == "captured":
        return {"payment": p, "order_id": p["order_id"]}
    if body.outcome == "failure":
        await db.payments.update_one({"id": pid}, {"$set": {"status": "failed"},
                                     "$push": {"attempts": {"result": "failed", "at": iso(now())}}})
        await db.orders.update_one({"id": p["order_id"]}, {"$set": {"payment_status": "failed"}})
        raise HTTPException(402, "Payment failed. Your order is not paid — please retry.")
    ppid = short_code("pay_demo_")
    payment = await verify_and_apply(VerifyIn(provider_order_id=p["provider_order_id"], provider_payment_id=ppid,
                                              signature=sign(p["provider_order_id"], ppid)))
    return {"payment": payment, "order_id": p["order_id"]}


@router.post("/webhook")
async def webhook(request: Request, x_signature: str = Header(None)):
    raw = await request.body()
    expected = hmac.new(DEMO_KEY, raw, hashlib.sha256).hexdigest()
    if not x_signature or not hmac.compare_digest(expected, x_signature):
        raise HTTPException(400, "Invalid webhook signature")
    try:
        event = json.loads(raw)
        assert isinstance(event, dict) and isinstance(event.get("event_id"), str) and isinstance(event.get("type"), str)
    except (ValueError, AssertionError):
        raise HTTPException(400, "Invalid webhook payload")
    if await db.webhook_events.find_one({"event_id": event["event_id"]}):
        return {"ok": True, "duplicate": True}
    await db.webhook_events.insert_one({"event_id": event["event_id"], "type": event["type"], "received_at": iso(now())})
    if event["type"] == "payment.captured":
        p = await db.payments.find_one({"provider_order_id": event["provider_order_id"]}, {"_id": 0})
        if p:
            try:
                await apply_success(p, event.get("provider_payment_id", ""))
            except HTTPException:
                pass  # cancelled order -> refunded inside apply_success
    return {"ok": True}

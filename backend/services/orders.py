"""Order Service: order creation (individual / group / community flat), history, tracking, cancel, reorder."""
import secrets
from datetime import timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import current_user, db, iso, new_id, notify, now, parse_iso, short_code
from services.cart import cart_view
from services.pricing import resolve_items

router = APIRouter(prefix="/api/orders", tags=["orders"])

SCHEDULE_PRESETS = {"now": 0, "1h": 60, "2h": 120, "tonight": None, "tomorrow": None}


class CheckoutIn(BaseModel):
    address_id: str
    coupon: Optional[str] = None
    use_credit: bool = False
    schedule: Literal["now", "1h", "2h", "tonight", "tomorrow"] = "now"
    notes: str = ""


class ReorderIn(BaseModel):
    confirm: bool = False


def schedule_time(preset: str) -> Optional[str]:
    t = now()
    if preset == "now":
        return None
    if preset in ("1h", "2h"):
        return iso(t + timedelta(minutes=SCHEDULE_PRESETS[preset]))
    # Fixed slots interpreted in IST (UTC+5:30)
    ist = t + timedelta(hours=5, minutes=30)
    target = ist.replace(hour=20 if preset == "tonight" else 9, minute=0, second=0, microsecond=0)
    if preset == "tomorrow" or target <= ist:
        target += timedelta(days=1)
    return iso(target - timedelta(hours=5, minutes=30))


async def create_order(*, payer_id: str, member_ids: list[str], seller: dict, kind: str, items: list[dict], bill: dict,
                       address: dict | None, scheduled_for: str | None, ref_id: str | None = None, extra: dict | None = None) -> dict:
    order = {
        "id": new_id(), "order_no": short_code("GC-"), "user_id": payer_id, "member_ids": list(dict.fromkeys(member_ids)),
        "seller_id": seller["id"], "seller_name": seller["name"], "seller_image": seller.get("image"), "seller_category": seller["category"],
        "kind": kind, "ref_id": ref_id, "items": items, "bill": bill, "address": address, "scheduled_for": scheduled_for,
        "status": "pending_payment", "payment_status": "pending", "payment_id": None,
        "delivery_otp": f"{secrets.randbelow(10000):04d}", "rider": None,
        "history": [{"status": "pending_payment", "at": iso(now())}], "created_at": iso(now()), **(extra or {}),
    }
    await db.orders.insert_one(dict(order))
    order.pop("_id", None)
    return order


def visible(order: dict, user: dict) -> dict:
    o = dict(order)
    o.pop("_id", None)
    if user["id"] not in o["member_ids"]:
        raise HTTPException(404, "Order not found")
    o["is_payer"] = o["user_id"] == user["id"]
    return o


@router.post("/checkout")
async def checkout(body: CheckoutIn, user=Depends(current_user)):
    address = await db.addresses.find_one({"id": body.address_id, "user_id": user["id"]}, {"_id": 0})
    if not address:
        raise HTTPException(400, "Select a delivery address")
    view = await cart_view(user, body.coupon, body.use_credit)
    if not view["items"]:
        raise HTTPException(400, "Cart is empty")
    if view["unavailable"]:
        raise HTTPException(409, "Some items are unavailable; update your cart")
    if not view["bill"] or view["bill"].get("error"):
        raise HTTPException(400, (view["bill"] or {}).get("error", "Cannot price cart"))
    if not view["seller"].get("open", True):
        raise HTTPException(400, "Shop is closed right now")
    order = await create_order(payer_id=user["id"], member_ids=[user["id"]], seller=view["seller"], kind="individual",
                               items=view["items"], bill=view["bill"], address=address,
                               scheduled_for=schedule_time(body.schedule), extra={"notes": body.notes})
    await db.carts.delete_one({"user_id": user["id"]})
    return order


@router.get("")
async def my_orders(user=Depends(current_user)):
    rows = await db.orders.find({"member_ids": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [{**r, "is_payer": r["user_id"] == user["id"]} for r in rows]


@router.get("/{oid}")
async def order_detail(oid: str, user=Depends(current_user)):
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    return visible(o, user)


async def restore_stock(order: dict):
    for i in order["items"]:
        await db.products.update_one({"id": i["product_id"]}, {"$inc": {"stock": i["qty"]}})


@router.post("/{oid}/cancel")
async def cancel(oid: str, user=Depends(current_user)):
    o = await db.orders.find_one({"id": oid, "user_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if o["status"] not in ("pending_payment", "confirmed"):
        raise HTTPException(400, "Order can no longer be cancelled")
    update = {"status": "cancelled"}
    await db.payments.update_one({"order_id": oid, "status": {"$in": ["created", "failed"]}}, {"$set": {"status": "cancelled"}})
    if o["payment_status"] == "paid":
        refund = {"id": new_id(), "order_id": oid, "payment_id": o["payment_id"], "amount": o["bill"]["total"],
                  "status": "processed", "provider": "demo", "created_at": iso(now())}
        await db.refunds.insert_one(refund)
        await db.payments.update_one({"id": o["payment_id"]}, {"$set": {"status": "refunded"}})
        update["payment_status"] = "refunded"
        await restore_stock(o)
    await db.orders.update_one({"id": oid}, {"$set": update, "$push": {"history": {"status": "cancelled", "at": iso(now())}}})
    await notify(o["member_ids"], "Order cancelled",
                 f"{o['order_no']} was cancelled" + (" — refund initiated" if o["payment_status"] == "paid" else ""), "order", oid)
    return await order_detail(oid, user)


@router.post("/{oid}/reorder")
async def reorder(oid: str, body: ReorderIn, user=Depends(current_user)):
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    visible(o, user)
    mine = [i for i in o["items"] if o["kind"] != "group" or i.get("user_id") in (None, user["id"])] or o["items"]
    agg: dict[str, int] = {}
    for i in mine:
        agg[i["product_id"]] = agg.get(i["product_id"], 0) + i["qty"]
    lines, unavailable = await resolve_items(o["seller_id"], [{"product_id": k, "qty": v} for k, v in agg.items()])
    old_prices = {i["product_id"]: i["price"] for i in mine}
    for l in lines:
        l["old_price"] = old_prices.get(l["product_id"])
    if body.confirm:
        if not lines:
            raise HTTPException(400, "None of these items are available now")
        await db.carts.update_one({"user_id": user["id"]}, {"$set": {"seller_id": o["seller_id"],
                                  "items": [{"product_id": l["product_id"], "qty": l["qty"]} for l in lines], "updated_at": iso(now())}}, upsert=True)
    return {"available": lines, "unavailable": unavailable, "subtotal": sum(l["line_total"] for l in lines), "added": body.confirm}

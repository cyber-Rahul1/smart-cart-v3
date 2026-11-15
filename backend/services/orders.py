"""Order Service: order creation (individual / group / community flat), history, tracking, cancel, reorder."""
import json
import secrets
from datetime import timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from core import current_user, db, iso, new_id, notify, now, parse_iso, require, short_code
from services.async_event_service import cache_manager, sqs_service
from services.cart import cart_view
from services.pricing import resolve_items

router = APIRouter(prefix="/api/orders", tags=["orders"])

SCHEDULE_PRESETS = {"now": 0, "1h": 60, "2h": 120, "tonight": None, "tomorrow": None}
ORDER_ACCEPTANCE_TIMEOUT_MIN = 10  # Auto-cancel and refund if seller doesn't accept within 10 minutes


class CheckoutIn(BaseModel):
    address_id: str
    coupon: Optional[str] = None
    use_credit: bool = False
    schedule: Literal["now", "1h", "2h", "tonight", "tomorrow"] = "now"
    notes: str = ""
    idempotency_key: Optional[str] = None


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
        "status": "pending_payment", "payment_status": "pending", "payment_id": None, "seller_managed": bool(seller.get("owner_id")),
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
async def checkout(body: CheckoutIn, x_idempotency_key: Optional[str] = Header(None), user=Depends(require("customer"))):
    idem_key = body.idempotency_key or x_idempotency_key
    if idem_key:
        cache_key = f"idem:checkout:{user['id']}:{idem_key}"
        cached = cache_manager.get(cache_key)
        if cached:
            try:
                return json.loads(cached)
            except Exception:
                pass

    address = await db.addresses.find_one({"id": body.address_id, "user_id": user["id"]}, {"_id": 0})
    if not address:
        raise HTTPException(400, "Select a delivery address")
    view = await cart_view(user, body.coupon, body.use_credit)
    if not view["items"]:
        raise HTTPException(400, "Cart is empty")
    if view["unavailable"]:
        raise HTTPException(409, "Some items are unavailable; update your cart")

    groups = view.get("groups") or []
    if not groups:
        # Fallback to single order
        if not view["bill"] or view["bill"].get("error"):
            raise HTTPException(400, (view["bill"] or {}).get("error", "Cannot price cart"))
        if not view["seller"].get("approved"):
            raise HTTPException(400, "This shop is not available")
        if not view["seller"].get("open", True):
            raise HTTPException(400, "Shop is closed right now")
        order = await create_order(payer_id=user["id"], member_ids=[user["id"]], seller=view["seller"], kind="individual",
                                   items=view["items"], bill=view["bill"], address=address,
                                   scheduled_for=schedule_time(body.schedule), extra={"notes": body.notes, "idempotency_key": idem_key})
        await db.carts.delete_one({"user_id": user["id"]})
        sqs_service.send_event("order.created", {"order_id": order["id"], "user_id": user["id"], "seller_id": view["seller"]["id"]})
        if idem_key:
            cache_manager.set(f"idem:checkout:{user['id']}:{idem_key}", json.dumps(order), ex=3600)
        return order

    # Multi-store checkout: validate each store and create individual orders (each gets its own rider)
    created_orders = []
    group_checkout_id = new_id()
    for g in groups:
        s = g["seller"]
        s_bill = g["bill"]
        if not s.get("approved"):
            raise HTTPException(400, f"{s.get('name', 'Store')} is currently not available")
        if not s.get("open", True):
            raise HTTPException(400, f"{s.get('name', 'Store')} is closed right now")
        if not s_bill or s_bill.get("error"):
            raise HTTPException(400, (s_bill or {}).get("error", f"Cannot calculate bill for {s.get('name')}"))

        ord_doc = await create_order(
            payer_id=user["id"],
            member_ids=[user["id"]],
            seller=s,
            kind="individual",
            items=g["items"],
            bill=s_bill,
            address=address,
            scheduled_for=schedule_time(body.schedule),
            extra={
                "notes": body.notes,
                "multi_store_group_id": group_checkout_id,
                "stores_count": len(groups),
                "idempotency_key": idem_key,
            },
        )
        sqs_service.send_event("order.created", {"order_id": ord_doc["id"], "user_id": user["id"], "seller_id": s["id"]})
        created_orders.append(ord_doc)

    await db.carts.delete_one({"user_id": user["id"]})
    # Return the first order (or the consolidated object) for payment initiation
    first_order = created_orders[0]
    first_order["all_orders"] = [o["id"] for o in created_orders]
    first_order["total_orders_placed"] = len(created_orders)
    if idem_key:
        cache_manager.set(f"idem:checkout:{user['id']}:{idem_key}", json.dumps(first_order), ex=3600)
    return first_order


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


async def cancel_order_doc(o: dict, reason: str = "customer") -> None:
    """Cancel an order; refunds if it was paid. Shared by customer cancel and seller reject."""
    oid = o["id"]
    update = {"status": "cancelled", "cancel_reason": reason}
    await db.payments.update_one({"order_id": oid, "status": {"$in": ["created", "failed"]}}, {"$set": {"status": "cancelled"}})
    if o["payment_status"] == "cod":  # nothing was charged; just release the reserved stock
        await db.payments.update_one({"id": o["payment_id"]}, {"$set": {"status": "cancelled"}})
        update["payment_status"] = "void"
        await restore_stock(o)
    if o["payment_status"] == "paid":
        await db.refunds.insert_one({"id": new_id(), "order_id": oid, "payment_id": o["payment_id"], "amount": o["bill"]["total"],
                                     "status": "processed", "provider": "demo", "reason": reason, "created_at": iso(now())})
        await db.payments.update_one({"id": o["payment_id"]}, {"$set": {"status": "refunded"}})
        update["payment_status"] = "refunded"
        await restore_stock(o)
        sqs_service.send_event("refund.processed", {"order_id": oid, "amount": o["bill"]["total"], "reason": reason})
    await db.orders.update_one({"id": oid}, {"$set": update, "$push": {"history": {"status": "cancelled", "at": iso(now())}}})
    sqs_service.send_event("order.cancelled", {"order_id": oid, "reason": reason})
    who = "by the shop" if reason == "seller_rejected" else ""
    await notify(o["member_ids"], "Order cancelled",
                 f"{o['order_no']} was cancelled {who}".strip() + (" — refund initiated" if o["payment_status"] == "paid" else ""), "order", oid)


async def check_unaccepted_orders_timeout():
    """Swiggy-style auto-cancellation for orders left unaccepted past timeout."""
    threshold = iso(now() - timedelta(minutes=ORDER_ACCEPTANCE_TIMEOUT_MIN))
    pending_orders = await db.orders.find({
        "status": "confirmed",
        "seller_managed": True,
        "created_at": {"$lte": threshold}
    }, {"_id": 0}).to_list(100)
    for ord_doc in pending_orders:
        await cancel_order_doc(ord_doc, reason="acceptance_timeout")


@router.post("/{oid}/cancel")
async def cancel(oid: str, user=Depends(current_user)):
    o = await db.orders.find_one({"id": oid, "user_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if o["status"] not in ("pending_payment", "confirmed"):
        raise HTTPException(400, "Order can no longer be cancelled")
    await cancel_order_doc(o)
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

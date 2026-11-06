"""Bill calculation shared by cart, group and community flows (configurable via platform_config)."""
from fastapi import HTTPException

from core import db, get_config


async def resolve_items(seller_id: str, items: list[dict]) -> tuple[list[dict], list[dict]]:
    """items: [{product_id, qty, ...}] -> (priced lines with current price/stock, unavailable lines)."""
    ids = [i["product_id"] for i in items]
    prods = {p["id"]: p for p in await db.products.find({"id": {"$in": ids}, "seller_id": seller_id}, {"_id": 0}).to_list(500)}
    lines, unavailable = [], []
    for i in items:
        p = prods.get(i["product_id"])
        if not p or not p["available"] or p["stock"] < i["qty"]:
            unavailable.append({**i, "name": (p or {}).get("name", i.get("name", "Item")), "reason": "Out of stock" if p else "Removed"})
            continue
        lines.append({**i, "name": p["name"], "price": p["price"], "image": p.get("image"), "veg": p.get("veg"), "weight_kg": p.get("weight_kg", 0.5),
                      "line_total": p["price"] * i["qty"]})
    return lines, unavailable


async def compute_bill(seller: dict, subtotal: float, *, coupon: str | None = None, use_credit: bool = False,
                       user: dict | None = None, community_share: int = 1) -> dict:
    cfg = await get_config()
    if subtotal <= 0:
        raise HTTPException(400, "Cart is empty")
    if subtotal < seller.get("min_order", 0):
        raise HTTPException(400, f"Minimum order at {seller['name']} is ₹{seller['min_order']}")
    delivery_cost = round(cfg["delivery_base"] + cfg["delivery_per_km"] * seller["distance_km"])
    if community_share > 1:  # one rider trip shared across flats
        delivery_cost = max(10, round(delivery_cost * (1 - cfg["community_delivery_discount"])))
    delivery_fee, funding = delivery_cost, "customer"
    if subtotal >= cfg["free_delivery_threshold"]:
        delivery_fee, funding = 0, "platform"
    discount, coupon_applied = 0, None
    if coupon:
        c = await db.coupons.find_one({"code": coupon.upper(), "active": True}, {"_id": 0})
        if not c:
            raise HTTPException(400, "Invalid coupon")
        if subtotal < c["min_order"]:
            raise HTTPException(400, f"Coupon needs a minimum order of ₹{c['min_order']}")
        discount = c["flat"] if c["type"] == "flat" else min(round(subtotal * c["percent"] / 100), c["max_discount"])
        coupon_applied = c["code"]
    credit_used = 0
    if use_credit and user and user.get("delivery_credits", 0) > 0 and delivery_fee > 0:
        credit_used, delivery_fee, funding = delivery_fee, 0, "delivery_credit"
    convenience = cfg["convenience_fee"]
    total = round(subtotal - discount + delivery_fee + convenience, 2)
    return {"subtotal": subtotal, "discount": discount, "coupon": coupon_applied, "delivery_fee": delivery_fee,
            "delivery_cost": delivery_cost, "delivery_funding": funding, "credit_used": credit_used,
            "convenience_fee": convenience, "total": total,
            "commission": round(subtotal * cfg["commission_pct"] / 100, 2)}

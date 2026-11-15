"""Cart Service: multi-seller individual cart, grouping items by seller with separate bills and riders."""
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import current_user, db, iso, now, require
from services.pricing import compute_bill, resolve_items

router = APIRouter(prefix="/api/cart", tags=["cart"])


class CartItemIn(BaseModel):
    product_id: str
    qty: int = Field(ge=0, le=50)
    replace: bool = False  # retained for backward compatibility


class QuoteIn(BaseModel):
    coupon: Optional[str] = None
    use_credit: bool = False


async def load_cart(user_id: str) -> dict:
    return await db.carts.find_one({"user_id": user_id}, {"_id": 0}) or {"user_id": user_id, "seller_id": None, "items": []}


async def cart_view(user: dict, coupon=None, use_credit=False) -> dict:
    cart = await load_cart(user["id"])
    raw_items = cart.get("items", [])
    if not raw_items:
        return {
            "seller": None,
            "items": [],
            "unavailable": [],
            "bill": None,
            "groups": [],
            "sellers": [],
            "total_items": 0,
            "total_price": 0,
        }

    # Fetch all referenced products to group items by seller
    pids = [i["product_id"] for i in raw_items]
    products_cursor = db.products.find({"id": {"$in": pids}}, {"_id": 0})
    prods = {p["id"]: p async for p in products_cursor}

    items_by_seller: dict[str, list[dict]] = defaultdict(list)
    for i in raw_items:
        p = prods.get(i["product_id"])
        seller_id = p.get("seller_id") if p else cart.get("seller_id")
        if seller_id:
            items_by_seller[seller_id].append(i)

    # Fetch details for all sellers in the cart
    seller_ids = list(items_by_seller.keys())
    sellers_cursor = db.sellers.find({"id": {"$in": seller_ids}}, {"_id": 0})
    sellers_map = {s["id"]: s async for s in sellers_cursor}

    groups = []
    all_lines = []
    all_unavailable = []
    combined_subtotal = 0.0
    combined_discount = 0.0
    combined_delivery_fee = 0.0
    combined_convenience_fee = 0.0
    combined_total = 0.0

    # Build per-seller grouped cart views with individual delivery and bills
    first_seller_coupon = coupon
    for s_id, s_items in items_by_seller.items():
        s_obj = sellers_map.get(s_id) or {"id": s_id, "name": "Store", "distance_km": 1.5, "min_order": 0}
        lines, unavailable = await resolve_items(s_id, s_items)
        # Attach seller info directly to each line item
        for l in lines:
            l["seller_id"] = s_id
            l["seller_name"] = s_obj.get("name")
            l["seller_image"] = s_obj.get("image")

        all_lines.extend(lines)
        all_unavailable.extend(unavailable)

        sub = sum(l["line_total"] for l in lines)
        s_bill = None
        if lines:
            try:
                # Apply coupon to the primary/first seller if eligible
                s_bill = await compute_bill(
                    s_obj, sub, coupon=first_seller_coupon, use_credit=use_credit, user=user
                )
                if s_bill.get("discount", 0) > 0:
                    first_seller_coupon = None  # coupon successfully applied
            except HTTPException as e:
                s_bill = {"subtotal": sub, "error": e.detail, "total": sub}

        groups.append({
            "seller": s_obj,
            "items": lines,
            "unavailable": unavailable,
            "bill": s_bill,
            "subtotal": sub,
            "rider_assigned_separately": True,
        })

        if s_bill and not s_bill.get("error"):
            combined_subtotal += s_bill.get("subtotal", sub)
            combined_discount += s_bill.get("discount", 0)
            combined_delivery_fee += s_bill.get("delivery_fee", 0)
            combined_convenience_fee += s_bill.get("convenience_fee", 0)
            combined_total += s_bill.get("total", sub)
        else:
            combined_subtotal += sub
            combined_total += sub

    # Compute item-level original total vs discounted savings
    original_item_total = sum(l.get("original_price", l["price"]) * l["qty"] for l in all_lines)
    item_discount = max(0.0, round(original_item_total - combined_subtotal, 2))

    # Available coupons list for one-tap apply
    available_coupons_cursor = db.coupons.find({"active": True}, {"_id": 0}).limit(6)
    available_coupons = [c async for c in available_coupons_cursor]

    # Primary seller (first active seller) for backward compatibility
    primary_seller = groups[0]["seller"] if groups else None
    primary_bill = {
        "subtotal": round(combined_subtotal, 2),
        "discount": round(combined_discount, 2),
        "item_discount": item_discount,
        "total_savings": round(combined_discount + item_discount + (25 if combined_delivery_fee == 0 and combined_subtotal > 0 else 0), 2),
        "coupon": coupon if combined_discount > 0 else None,
        "delivery_fee": round(combined_delivery_fee, 2),
        "convenience_fee": round(combined_convenience_fee, 2),
        "total": round(combined_total, 2),
        "multi_store": len(groups) > 1,
    }

    return {
        "seller": primary_seller,
        "items": all_lines,
        "unavailable": all_unavailable,
        "bill": primary_bill,
        "groups": groups,
        "sellers": [g["seller"] for g in groups],
        "available_coupons": available_coupons,
        "total_items": sum(i.get("qty", 0) for i in all_lines),
        "total_price": round(combined_total, 2),
        "is_multi_store": len(groups) > 1,
    }


@router.get("")
async def get_cart(user=Depends(current_user)):
    return await cart_view(user)


@router.post("/quote")
async def quote(body: QuoteIn, user=Depends(current_user)):
    return await cart_view(user, body.coupon, body.use_credit)


@router.post("/items")
async def set_item(body: CartItemIn, user=Depends(require("customer"))):
    p = await db.products.find_one({"id": body.product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found")
    shop = await db.sellers.find_one({"id": p["seller_id"]}, {"_id": 0, "approved": 1, "open": 1})
    if not shop or not shop.get("approved"):
        raise HTTPException(404, "Product not found")
    if body.qty > 0 and not shop.get("open", True):
        raise HTTPException(400, "This shop is closed right now")
    if body.qty > 0 and (not p["available"] or p["stock"] < body.qty):
        raise HTTPException(400, f"Only {p['stock']} left" if p["available"] else "Item unavailable")

    cart = await load_cart(user["id"])
    # Multi-store cart enabled: we NO LONGER reject or wipe items from other shops!
    items = [i for i in cart.get("items", []) if i["product_id"] != body.product_id]
    if body.qty > 0:
        existing = next((i for i in cart.get("items", []) if i["product_id"] == body.product_id), None)
        insert_idx = cart["items"].index(existing) if existing and existing in cart["items"] else len(items)
        items.insert(insert_idx, {"product_id": body.product_id, "qty": body.qty})

    # Update seller_id: keep primary or set current
    primary_seller_id = p["seller_id"] if not items else cart.get("seller_id") or p["seller_id"]

    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$set": {"seller_id": primary_seller_id if items else None, "items": items, "updated_at": iso(now())}},
        upsert=True,
    )
    return await cart_view(user)


@router.delete("/sellers/{seller_id}")
async def remove_seller_items(seller_id: str, user=Depends(current_user)):
    """Remove all items belonging to a specific seller from user's multi-store cart."""
    seller_prods = await db.products.find({"seller_id": seller_id}, {"_id": 0, "id": 1}).to_list(1000)
    seller_prod_ids = set(p["id"] for p in seller_prods)

    cart = await load_cart(user["id"])
    existing_items = cart.get("items", [])
    filtered_items = [i for i in existing_items if i.get("product_id") not in seller_prod_ids]

    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$set": {"items": filtered_items, "updated_at": iso(now())}},
        upsert=True,
    )
    return await cart_view(user)


@router.delete("")
async def clear_cart(user=Depends(current_user)):
    await db.carts.delete_one({"user_id": user["id"]})
    return {"ok": True}

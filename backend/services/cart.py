"""Cart Service: one individual cart per customer (single seller), checkout validation."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import current_user, db, iso, now
from services.pricing import compute_bill, resolve_items

router = APIRouter(prefix="/api/cart", tags=["cart"])


class CartItemIn(BaseModel):
    product_id: str
    qty: int = Field(ge=0, le=50)
    replace: bool = False  # replace cart if from a different seller


class QuoteIn(BaseModel):
    coupon: Optional[str] = None
    use_credit: bool = False


async def load_cart(user_id: str) -> dict:
    return await db.carts.find_one({"user_id": user_id}, {"_id": 0}) or {"user_id": user_id, "seller_id": None, "items": []}


async def cart_view(user: dict, coupon=None, use_credit=False) -> dict:
    cart = await load_cart(user["id"])
    if not cart["items"]:
        return {"seller": None, "items": [], "unavailable": [], "bill": None}
    seller = await db.sellers.find_one({"id": cart["seller_id"]}, {"_id": 0})
    lines, unavailable = await resolve_items(cart["seller_id"], cart["items"])
    subtotal = sum(l["line_total"] for l in lines)
    bill = None
    if lines:
        try:
            bill = await compute_bill(seller, subtotal, coupon=coupon, use_credit=use_credit, user=user)
        except HTTPException as e:
            bill = {"subtotal": subtotal, "error": e.detail}
    return {"seller": seller, "items": lines, "unavailable": unavailable, "bill": bill}


@router.get("")
async def get_cart(user=Depends(current_user)):
    return await cart_view(user)


@router.post("/quote")
async def quote(body: QuoteIn, user=Depends(current_user)):
    return await cart_view(user, body.coupon, body.use_credit)


@router.post("/items")
async def set_item(body: CartItemIn, user=Depends(current_user)):
    p = await db.products.find_one({"id": body.product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found")
    if body.qty > 0 and (not p["available"] or p["stock"] < body.qty):
        raise HTTPException(400, f"Only {p['stock']} left" if p["available"] else "Item unavailable")
    cart = await load_cart(user["id"])
    if cart["seller_id"] and cart["seller_id"] != p["seller_id"] and cart["items"]:
        if not body.replace:
            raise HTTPException(409, "Your cart has items from another shop")
        cart["items"] = []
    cart["seller_id"] = p["seller_id"]
    items = [i for i in cart["items"] if i["product_id"] != body.product_id]
    if body.qty > 0:
        existing = next((i for i in cart["items"] if i["product_id"] == body.product_id), None)
        items.insert(cart["items"].index(existing) if existing else len(items), {"product_id": body.product_id, "qty": body.qty})
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"seller_id": p["seller_id"] if items else None, "items": items,
                                                                    "updated_at": iso(now())}}, upsert=True)
    return await cart_view(user)


@router.delete("")
async def clear_cart(user=Depends(current_user)):
    await db.carts.delete_one({"user_id": user["id"]})
    return {"ok": True}

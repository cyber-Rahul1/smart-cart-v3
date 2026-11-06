"""Seller + Catalog + Search + Promotion read APIs for customers."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from core import db

router = APIRouter(prefix="/api", tags=["catalog"])

PUBLIC = {"approved": True}


@router.get("/home")
async def home():
    trending = await db.sellers.find(PUBLIC, {"_id": 0}).sort("trend_score", -1).limit(6).to_list(6)
    new_shops = await db.sellers.find({**PUBLIC, "is_new": True}, {"_id": 0}).limit(6).to_list(6)
    nearby = await db.sellers.find(PUBLIC, {"_id": 0}).sort("distance_km", 1).limit(10).to_list(10)
    offers = await db.coupons.find({"active": True}, {"_id": 0}).to_list(10)
    recommended = await db.sellers.find(PUBLIC, {"_id": 0}).sort("rating", -1).limit(6).to_list(6)
    return {"trending": trending, "new_shops": new_shops, "nearby": nearby, "offers": offers, "recommended": recommended}


@router.get("/sellers")
async def list_sellers(category: Optional[str] = Query(None, pattern="^(food|grocery|new)$"), q: Optional[str] = None):
    f = dict(PUBLIC)
    if category == "food":
        f["category"] = "food"
    elif category == "grocery":
        f["category"] = "grocery"
    elif category == "new":
        f["is_new"] = True
    if q:
        f["name"] = {"$regex": q, "$options": "i"}
    return await db.sellers.find(f, {"_id": 0}).sort("distance_km", 1).to_list(100)


@router.get("/sellers/{sid}")
async def seller_detail(sid: str):
    s = await db.sellers.find_one({"id": sid, **PUBLIC}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Shop not found")
    products = await db.products.find({"seller_id": sid}, {"_id": 0}).sort("category", 1).to_list(500)
    return {"seller": s, "products": products}


@router.get("/search")
async def search(q: str = Query(min_length=1, max_length=50)):
    sellers = await db.sellers.find({**PUBLIC, "$or": [{"name": {"$regex": q, "$options": "i"}},
                                                       {"cuisine": {"$regex": q, "$options": "i"}}]}, {"_id": 0}).limit(20).to_list(20)
    products = await db.products.find({"name": {"$regex": q, "$options": "i"}}, {"_id": 0}).limit(30).to_list(30)
    names = {s["id"]: s["name"] for s in await db.sellers.find({"id": {"$in": [p["seller_id"] for p in products]}}, {"_id": 0}).to_list(100)}
    for p in products:
        p["seller_name"] = names.get(p["seller_id"], "")
    return {"sellers": sellers, "products": products}


@router.get("/reels")
async def reels():
    rows = await db.reels.find({"moderation": "approved"}, {"_id": 0}).sort("created_at", -1).to_list(50)
    names = {s["id"]: s for s in await db.sellers.find({}, {"_id": 0, "id": 1, "name": 1, "image": 1}).to_list(200)}
    for r in rows:
        r["seller_name"] = names.get(r["seller_id"], {}).get("name", "")
        r["seller_image"] = names.get(r["seller_id"], {}).get("image", "")
    return rows

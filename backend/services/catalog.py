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

    # Populate gallery with product images for nearby sellers if gallery has duplicates or is empty
    nearby_sids = [s["id"] for s in nearby]
    if nearby_sids:
        all_prods = await db.products.find({"seller_id": {"$in": nearby_sids}}, {"_id": 0, "seller_id": 1, "image": 1}).to_list(200)
        prod_map = {}
        for p in all_prods:
            if p.get("image"):
                prod_map.setdefault(p["seller_id"], []).append(p["image"])
        for s in nearby:
            s_prods = prod_map.get(s["id"], [])
            distinct_images = []
            for img in [s.get("image"), *s_prods, *(s.get("gallery") or [])]:
                if img and img not in distinct_images:
                    distinct_images.append(img)
            s["gallery"] = distinct_images[:5]

    offers = await db.coupons.find({"active": True}, {"_id": 0}).to_list(10)
    recommended = await db.sellers.find(PUBLIC, {"_id": 0}).sort("rating", -1).limit(6).to_list(6)
    return {"trending": trending, "new_shops": new_shops, "nearby": nearby, "offers": offers, "recommended": recommended}


@router.get("/sellers")
async def list_sellers(category: Optional[str] = Query(None, pattern="^(food|grocery|new|cloud_kitchen|recently_registered)$"), q: Optional[str] = None):
    f = dict(PUBLIC)
    sort_field = "distance_km"
    sort_dir = 1

    if category == "food":
        f["category"] = "food"
    elif category == "grocery":
        f["category"] = "grocery"
    elif category == "new":
        f["is_new"] = True
    elif category == "cloud_kitchen":
        f["business_type"] = "cloud_kitchen"
    elif category == "recently_registered":
        sort_field = "opened_on"
        sort_dir = -1

    if q:
        f["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"cuisine": {"$regex": q, "$options": "i"}},
            {"address": {"$regex": q, "$options": "i"}},
        ]
    return await db.sellers.find(f, {"_id": 0}).sort(sort_field, sort_dir).to_list(100)


@router.get("/discover")
async def discover_feed(
    category: Optional[str] = Query(None, pattern="^(all|food|grocery|cloud_kitchen|new|recently_registered)$"),
    q: Optional[str] = None,
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0)
):
    """
    Dedicated Discovery feed for newly registered and recently opened shops.
    Returns rich shop showcases with banner, gallery, highlights, and product previews.
    """
    f = dict(PUBLIC)
    sort_field = "opened_on"
    sort_dir = -1

    if category == "food":
        f["category"] = "food"
    elif category == "grocery":
        f["category"] = "grocery"
    elif category == "cloud_kitchen":
        f["business_type"] = "cloud_kitchen"
    elif category == "new":
        f["is_new"] = True
    elif category == "recently_registered":
        sort_field = "created_at"
        sort_dir = -1

    if q:
        f["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"cuisine": {"$regex": q, "$options": "i"}},
            {"address": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]

    total = await db.sellers.count_documents(f)
    sellers = await db.sellers.find(f, {"_id": 0}).sort(sort_field, sort_dir).skip(offset).limit(limit).to_list(limit)

    # Attach product previews (first 6 items per shop)
    seller_ids = [s["id"] for s in sellers]
    all_products = await db.products.find(
        {"seller_id": {"$in": seller_ids}, "available": True},
        {"_id": 0}
    ).to_list(1000)

    # Group products by seller
    products_by_seller: dict = {}
    for p in all_products:
        products_by_seller.setdefault(p["seller_id"], []).append(p)

    showcases = []
    for s in sellers:
        shop_prods = products_by_seller.get(s["id"], [])
        prod_images = [p["image"] for p in shop_prods if p.get("image")]
        gallery = s.get("gallery") or ([s.get("image")] + prod_images)[:4]
        highlights = s.get("highlights") or [p["name"] for p in shop_prods[:3]]

        showcases.append({
            "seller": s,
            "banner_url": s.get("banner_url") or s.get("image"),
            "gallery": gallery,
            "highlights": highlights,
            "description": s.get("description") or f"{s['name']} · authentic {s.get('cuisine', s['category'])}",
            "products": shop_prods[:8],
            "total_products": len(shop_prods)
        })

    return {
        "items": showcases,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": (offset + limit) < total
    }


@router.get("/sellers/{sid}")
async def seller_detail(sid: str):
    s = await db.sellers.find_one({"id": sid, **PUBLIC}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Shop not found")
    products = await db.products.find({"seller_id": sid}, {"_id": 0}).sort("category", 1).to_list(500)
    return {"seller": s, "products": products}


@router.get("/search")
async def search(q: str = Query(min_length=1, max_length=50), veg_only: Optional[bool] = None):
    seller_query = {**PUBLIC, "$or": [{"name": {"$regex": q, "$options": "i"}},
                                        {"cuisine": {"$regex": q, "$options": "i"}}]}
    sellers = await db.sellers.find(seller_query, {"_id": 0}).limit(20).to_list(20)
    live_ids = [s["id"] for s in await db.sellers.find(PUBLIC, {"_id": 0, "id": 1}).to_list(1000)]

    product_query: dict = {"name": {"$regex": q, "$options": "i"}, "seller_id": {"$in": live_ids}}
    if veg_only is True:
        product_query["veg"] = True
    elif veg_only is False:
        # nonveg means veg == False
        product_query["veg"] = False

    products = await db.products.find(product_query, {"_id": 0}).limit(30).to_list(30)
    names = {s["id"]: s["name"] for s in await db.sellers.find({"id": {"$in": [p["seller_id"] for p in products]}}, {"_id": 0}).to_list(100)}
    for p in products:
        p["seller_name"] = names.get(p["seller_id"], "")

    if veg_only is True:
        # Filter sellers who have veg dishes or are grocery/pure veg
        # Keep sellers who match or have veg products
        sellers_with_veg = set(p["seller_id"] for p in products)
        sellers = [s for s in sellers if s["id"] in sellers_with_veg or s.get("category") == "grocery" or "veg" in s.get("cuisine", "").lower()]
    elif veg_only is False:
        sellers_with_nonveg = set(p["seller_id"] for p in products)
        sellers = [s for s in sellers if s["id"] in sellers_with_nonveg or "non" in s.get("cuisine", "").lower() or "chicken" in s.get("cuisine", "").lower() or "biryani" in s.get("cuisine", "").lower()]

    return {"sellers": sellers, "products": products}


@router.get("/reels")
async def reels():
    rows = await db.reels.find({"moderation": "approved"}, {"_id": 0}).sort("created_at", -1).to_list(50)
    names = {s["id"]: s for s in await db.sellers.find({}, {"_id": 0, "id": 1, "name": 1, "image": 1}).to_list(200)}
    for r in rows:
        r["seller_name"] = names.get(r["seller_id"], {}).get("name", "")
        r["seller_image"] = names.get(r["seller_id"], {}).get("image", "")
    return rows

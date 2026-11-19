"""Seller Service: shop onboarding (incl. cloud kitchen + FSSAI submission), catalog management, order fulfilment, packing."""
from datetime import timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

from core import APP_ENV, FULFILLABLE, db, get_config, iso, new_id, notify, now, require
from services.orders import cancel_order_doc

router = APIRouter(prefix="/api/seller", tags=["seller"])
seller_only = require("seller")

U = "https://images.unsplash.com/photo-{}?w=800&q=70"
PRESET_IMAGES = {
    "biryani": U.format("1563379091339-03b21ab4a4f8"), "pizza": U.format("1513104890138-7c749659a591"),
    "dosa": U.format("1589301760014-d929f3979dbc"), "burger": U.format("1568901346375-23c9450c58cd"),
    "thali": U.format("1546833999-b9f581a1996d"), "noodles": U.format("1585032226651-759b368d7246"),
    "dessert": U.format("1488477181946-6428a0291777"), "rolls": U.format("1601050690597-df0568f70950"),
    "coffee": U.format("1509042239860-f550ce710b93"), "veg": U.format("1542838132-92c53300491e"),
    "fruits": U.format("1610832958506-aac56368f2f8"), "milk": U.format("1563636619-e9143da7973b"),
    "bread": U.format("1509440159596-0249088772ff"), "rice": U.format("1586201375761-83865001e31c"),
    "eggs": U.format("1582722872445-44dc5f7e3c8f"), "snacks": U.format("1566478989037-eec170784d0b"),
    "oil": U.format("1474979266404-7eaacbcd87c5"), "store": U.format("1604719312566-8912e9227c6a"),
}


class OnboardIn(BaseModel):
    business_name: str = Field(min_length=2, max_length=100)
    owner_name: str = Field(min_length=2, max_length=60)
    category: Literal["food", "grocery"]
    business_type: Literal["restaurant", "cloud_kitchen", "kirana", "supermarket"]
    cuisine: str = Field(min_length=2, max_length=120)
    address: str = Field(min_length=5, max_length=300)
    prep_time_min: int = Field(ge=5, le=120)
    min_order: int = Field(ge=0, le=5000)
    image_key: Optional[str] = "store"
    image_url: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    gallery: Optional[list[str]] = None
    description: Optional[str] = Field(None, max_length=1000)
    short_intro: Optional[str] = Field(None, max_length=160)
    contact_phone: Optional[str] = Field(None, max_length=20)
    contact_email: Optional[str] = Field(None, max_length=100)
    highlights: Optional[list[str]] = None
    is_pure_veg: Optional[bool] = False
    fssai_number: Optional[str] = None
    fssai_doc_url: Optional[str] = None
    gstin: Optional[str] = Field(None, max_length=20)
    pan: Optional[str] = Field(None, max_length=20)
    bank_account_no: Optional[str] = Field(None, max_length=30)
    bank_ifsc: Optional[str] = Field(None, max_length=20)
    bank_beneficiary: Optional[str] = Field(None, max_length=100)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    service_radius_km: Optional[float] = Field(5.0, ge=0.5, le=50)
    opens_at: Optional[str] = Field("09:00", pattern=r"^\d{2}:\d{2}$")
    closes_at: Optional[str] = Field("22:00", pattern=r"^\d{2}:\d{2}$")
    is_new: bool = True

    @model_validator(mode="after")
    def check(self):
        if self.category == "food":
            if self.business_type in ("kirana", "supermarket"):
                raise ValueError("Food businesses must be a restaurant or cloud kitchen")
            if not self.fssai_number or not self.fssai_number.isdigit() or len(self.fssai_number) != 14:
                raise ValueError("Enter your 14-digit FSSAI licence/registration number")
        else:
            if self.business_type not in ("kirana", "supermarket"):
                raise ValueError("Grocery businesses must be a kirana or supermarket")
        if not self.image_url and self.image_key not in PRESET_IMAGES:
            raise ValueError("Pick or upload a cover image")
        return self


class ShopUpdate(BaseModel):
    open: Optional[bool] = None
    prep_time_min: Optional[int] = Field(None, ge=5, le=120)
    min_order: Optional[int] = Field(None, ge=0, le=5000)
    offer: Optional[str] = Field(None, max_length=80)
    cuisine: Optional[str] = Field(None, min_length=2, max_length=120)
    opens_at: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    closes_at: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    image_url: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    description: Optional[str] = Field(None, max_length=1000)
    short_intro: Optional[str] = Field(None, max_length=160)
    contact_phone: Optional[str] = Field(None, max_length=20)
    contact_email: Optional[str] = Field(None, max_length=100)
    gallery: Optional[list[str]] = None
    highlights: Optional[list[str]] = None
    is_pure_veg: Optional[bool] = None
    address: Optional[str] = Field(None, min_length=5, max_length=300)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    service_radius_km: Optional[float] = Field(None, ge=0.5, le=50)
    operating_hours: Optional[dict] = None
    fssai_number: Optional[str] = None
    fssai_doc_url: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_beneficiary: Optional[str] = None


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    price: float = Field(gt=0, le=100000)
    category: str = Field(min_length=2, max_length=30)
    veg: bool = True
    stock: int = Field(ge=0, le=100000)
    available: bool = True
    description: str = Field("", max_length=200)
    image_key: str = "store"
    image_url: Optional[str] = Field(None, pattern=r"^/api/files/[0-9a-f-]{36}$")
    weight_kg: float = Field(0.5, gt=0, le=50)


class PackIn(BaseModel):
    index: int = Field(ge=0)
    checked: bool


class RejectIn(BaseModel):
    reason: str = Field("Item unavailable", max_length=120)


async def my_shop(user: dict) -> dict:
    s = await db.sellers.find_one({"owner_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Register your shop first")
    return s


async def my_order(oid: str, user: dict) -> tuple[dict, dict]:
    s = await my_shop(user)
    o = await db.orders.find_one({"id": oid, "seller_id": s["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    return s, o


def seller_view(o: dict) -> dict:
    """Sellers see items, package & delivery area — never customer phone, OTP or payment details."""
    packed = o.get("packed", [False] * len(o["items"]))
    return {k: o.get(k) for k in ("id", "order_no", "kind", "status", "items", "scheduled_for", "created_at", "flat", "community_name",
                                  "package_id", "package_label", "group_name", "cart_name", "notes", "ref_id", "history")} | {
        "subtotal": o["bill"]["subtotal"], "commission": o["bill"].get("commission", 0),
        "payout": round(o["bill"]["subtotal"] - o["bill"].get("commission", 0), 2),
        "area": (o.get("address") or {}).get("line", "")[:60], "packed": packed, "all_packed": all(packed) and bool(packed)}


@router.get("/images")
async def images():
    return PRESET_IMAGES


@router.get("/me")
async def me(user=Depends(seller_only)):
    s = await db.sellers.find_one({"owner_id": user["id"]}, {"_id": 0})
    return {"shop": s}


@router.post("/onboarding")
async def onboard(body: OnboardIn, user=Depends(seller_only)):
    if await db.sellers.find_one({"owner_id": user["id"]}):
        raise HTTPException(400, "You already registered a shop")
    cfg = await get_config()
    auto = bool(cfg.get("seller_auto_approve", False))
    sid = new_id()
    
    # Resolve cover image
    img = PRESET_IMAGES.get(body.image_key, PRESET_IMAGES["store"])
    if body.image_url:
        img = await owned_image(body.image_url, user) or img
    
    # Resolve logo, banner, and gallery images
    logo = await owned_image(body.logo_url, user) if body.logo_url else None
    banner = await owned_image(body.banner_url, user) if body.banner_url else img
    gallery = []
    if body.gallery:
        for g in body.gallery:
            clean_g = await owned_image(g, user)
            if clean_g:
                gallery.append(clean_g)
    if not gallery:
        gallery = [img]

    # Geolocation: default to Koramangala if lat/lng not provided
    lat = body.latitude if body.latitude is not None else 12.9352
    lng = body.longitude if body.longitude is not None else 77.6245

    doc = {
        "id": sid,
        "owner_id": user["id"],
        "name": body.business_name.strip(),
        "owner_name": body.owner_name.strip(),
        "category": body.category,
        "business_type": body.business_type,
        "cuisine": body.cuisine.strip(),
        "image": img,
        "logo_url": logo,
        "banner_url": banner,
        "gallery": gallery,
        "description": body.description.strip() if body.description else f"{body.business_name.strip()} · authentic {body.cuisine.strip()}",
        "short_intro": body.short_intro.strip() if body.short_intro else None,
        "contact_phone": body.contact_phone.strip() if body.contact_phone else user.get("phone"),
        "contact_email": body.contact_email.strip() if body.contact_email else None,
        "highlights": body.highlights or [body.cuisine.strip(), body.business_type.replace("_", " ").title()],
        "is_pure_veg": bool(body.is_pure_veg),
        "rating": 4.0,
        "distance_km": 1.5,
        "prep_time_min": body.prep_time_min,
        "eta_min": body.prep_time_min + 6,
        "is_new": body.is_new,
        "offer": None,
        "min_order": body.min_order,
        "approved": auto,
        "approval_status": "approved" if auto else "pending_review",
        "open": True,
        "opens_at": body.opens_at or "09:00",
        "closes_at": body.closes_at or "22:00",
        "address": body.address.strip(),
        "fssai_status": "submitted" if body.category == "food" else "not_required",
        "fssai_number": body.fssai_number,
        "fssai_doc_url": body.fssai_doc_url,
        "gstin": body.gstin,
        "pan": body.pan,
        "bank_account_no": body.bank_account_no,
        "bank_ifsc": body.bank_ifsc,
        "bank_beneficiary": body.bank_beneficiary,
        "service_radius_km": body.service_radius_km or 5.0,
        "location": {"type": "Point", "coordinates": [lng, lat]},
        "opened_on": iso(now()),
        "trend_score": 0,
        "orders_count": 0,
        "created_at": iso(now()),
    }
    await db.sellers.insert_one(dict(doc))
    await db.audit_logs.insert_one({"id": new_id(), "actor": user["id"], "action": "seller.onboard", "target": sid, "at": iso(now())})
    await db.users.update_one({"id": user["id"]}, {"$set": {"name": user.get("name") or body.owner_name.strip()}})
    return doc


@router.post("/shop/resubmit")
async def resubmit(user=Depends(seller_only)):
    """After a rejection the seller fixes details and asks for another review."""
    s = await my_shop(user)
    if s.get("approval_status") != "rejected":
        raise HTTPException(400, "Only rejected shops can be resubmitted")
    upd = {"approval_status": "pending_review", "approved": False, "resubmitted_at": iso(now())}
    if s["category"] == "food":
        upd["fssai_status"] = "submitted"
    await db.sellers.update_one({"id": s["id"]}, {"$set": upd})
    await db.audit_logs.insert_one({"id": new_id(), "actor": user["id"], "action": "seller.resubmit", "target": s["id"], "at": iso(now())})
    return await db.sellers.find_one({"id": s["id"]}, {"_id": 0})


class FssaiIn(BaseModel):
    fssai_number: str = Field(pattern=r"^\d{14}$")


@router.put("/shop/fssai")
async def update_fssai(body: FssaiIn, user=Depends(seller_only)):
    s = await my_shop(user)
    if s["approved"]:
        raise HTTPException(400, "Contact support to change a verified FSSAI number")
    await db.sellers.update_one({"id": s["id"]}, {"$set": {"fssai_number": body.fssai_number}})
    return await db.sellers.find_one({"id": s["id"]}, {"_id": 0})


@router.post("/shop/demo-approve")
async def demo_approve(user=Depends(seller_only)):
    """DEV-only stand-in for Admin review, used by automated tests. Real approvals happen in the Admin app."""
    if APP_ENV != "dev":
        raise HTTPException(404, "Not found")
    s = await my_shop(user)
    fssai = "verified" if s["category"] == "food" else "not_required"
    await db.sellers.update_one({"id": s["id"]}, {"$set": {"approved": True, "approval_status": "approved", "fssai_status": fssai}})
    await db.audit_logs.insert_one({"id": new_id(), "actor": "demo_admin", "action": "seller.approve", "target": s["id"], "at": iso(now())})
    await notify([user["id"]], "Shop approved", f"{s['name']} is now live for customers", "seller_shop", s["id"])
    return await db.sellers.find_one({"id": s["id"]}, {"_id": 0})


@router.put("/shop")
async def update_shop(body: ShopUpdate, user=Depends(seller_only)):
    s = await my_shop(user)
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "image_url" in upd:
        val = upd.pop("image_url")
        if val:
            upd["image"] = await owned_image(val, user) or val
    if "logo_url" in upd:
        val = upd["logo_url"]
        if val:
            upd["logo_url"] = await owned_image(val, user) or val
    if "banner_url" in upd:
        val = upd["banner_url"]
        if val:
            upd["banner_url"] = await owned_image(val, user) or val
    if "gallery" in upd:
        cleaned_gallery = []
        for g in upd["gallery"] or []:
            if g.startswith("/api/files/"):
                c = await owned_image(g, user)
                if c:
                    cleaned_gallery.append(c)
            elif g.startswith("http"):
                cleaned_gallery.append(g)
        upd["gallery"] = cleaned_gallery
    if "latitude" in upd or "longitude" in upd:
        lat = upd.pop("latitude", None) or s.get("location", {}).get("coordinates", [77.6245, 12.9352])[1]
        lng = upd.pop("longitude", None) or s.get("location", {}).get("coordinates", [77.6245, 12.9352])[0]
        upd["location"] = {"type": "Point", "coordinates": [lng, lat]}
    if "prep_time_min" in upd:
        upd["eta_min"] = upd["prep_time_min"] + int(s["distance_km"] * 4)
    if upd:
        await db.sellers.update_one({"id": s["id"]}, {"$set": upd})
    return await db.sellers.find_one({"id": s["id"]}, {"_id": 0})


@router.get("/products")
async def products(user=Depends(seller_only)):
    s = await my_shop(user)
    return await db.products.find({"seller_id": s["id"]}, {"_id": 0}).sort([("category", 1), ("name", 1)]).to_list(1000)


async def owned_image(url: Optional[str], user: dict) -> Optional[str]:
    if not url:
        return None
    if not await db.files.find_one({"id": url.rsplit("/", 1)[-1], "owner_id": user["id"], "is_deleted": False}):
        raise HTTPException(400, "Upload the photo again")
    return url


async def product_doc(body: ProductIn, user: dict) -> dict:
    d = body.model_dump()
    url = await owned_image(d.pop("image_url"), user)
    if not url and body.image_key not in PRESET_IMAGES:
        raise HTTPException(400, "Pick an image")
    d["image"] = url or PRESET_IMAGES[d["image_key"]]
    d.pop("image_key")
    d["name"], d["category"] = d["name"].strip(), d["category"].strip().title()
    return d


@router.post("/products")
async def add_product(body: ProductIn, user=Depends(seller_only)):
    s = await my_shop(user)
    doc = {"id": new_id(), "seller_id": s["id"], **(await product_doc(body, user)), "created_at": iso(now())}
    await db.products.insert_one(dict(doc))
    return doc


@router.put("/products/{pid}")
async def edit_product(pid: str, body: ProductIn, user=Depends(seller_only)):
    s = await my_shop(user)
    doc_data = await product_doc(body, user)
    res = await db.products.update_one({"id": pid, "seller_id": s["id"]}, {"$set": doc_data})
    if not res.matched_count:
        raise HTTPException(404, "Item not found")
    
    # Swiggy-style Real-time Cache & Inventory Event Emission
    try:
        from services.async_event_service import RedisCacheManager, SQSQueueService
        redis_cache = RedisCacheManager()
        redis_cache.delete(f"seller_menu:{s['id']}")
        redis_cache.delete(f"product:{pid}")
        # Emit stock/availability event
        sqs = SQSQueueService()
        sqs.send_event("product.updated", {"seller_id": s["id"], "product_id": pid, "available": doc_data["available"], "stock": doc_data["stock"]})
    except Exception:
        pass

    return await db.products.find_one({"id": pid}, {"_id": 0})


class StockToggleIn(BaseModel):
    available: bool


@router.patch("/products/{pid}/availability")
async def toggle_product_availability(pid: str, body: StockToggleIn, user=Depends(seller_only)):
    """Swiggy Partner App instant Out-Of-Stock (OOS) toggle.
    Allows kitchen staff to instantly disable/enable an item during peak hours with sub-second cache eviction.
    """
    s = await my_shop(user)
    res = await db.products.update_one(
        {"id": pid, "seller_id": s["id"]},
        {"$set": {"available": body.available, "updated_at": iso(now())}}
    )
    if not res.matched_count:
        raise HTTPException(404, "Item not found")

    try:
        from services.async_event_service import RedisCacheManager, SQSQueueService
        redis_cache = RedisCacheManager()
        redis_cache.delete(f"seller_menu:{s['id']}")
        redis_cache.delete(f"product:{pid}")
        sqs = SQSQueueService()
        sqs.send_event("product.availability_toggled", {"seller_id": s["id"], "product_id": pid, "available": body.available})
    except Exception:
        pass

    return {"id": pid, "available": body.available, "ok": True}


@router.delete("/products/{pid}")
async def delete_product(pid: str, user=Depends(seller_only)):
    s = await my_shop(user)
    res = await db.products.delete_one({"id": pid, "seller_id": s["id"]})
    if not res.deleted_count:
        raise HTTPException(404, "Item not found")
    return {"ok": True}


TABS = {"new": ["confirmed"], "active": ["preparing", "ready_for_pickup"], "done": ["out_for_delivery", "delivered", "cancelled"]}


@router.get("/orders")
async def orders(tab: Literal["new", "active", "scheduled", "done"] = "new", user=Depends(seller_only)):
    s = await my_shop(user)
    f: dict = {"seller_id": s["id"], "payment_status": {"$in": ["paid", "cod", "refunded", "void"]}}
    if tab == "scheduled":
        f |= {"scheduled_for": {"$ne": None}, "status": {"$in": ["confirmed", "preparing", "ready_for_pickup"]}}
    else:
        f["status"] = {"$in": TABS[tab]}
    rows = await db.orders.find(f, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [seller_view(o) for o in rows]


@router.get("/summary")
async def summary(user=Depends(seller_only)):
    s = await my_shop(user)
    ist = now() + timedelta(hours=5, minutes=30)
    today = iso((ist.replace(hour=0, minute=0, second=0, microsecond=0)) - timedelta(hours=5, minutes=30))
    rows = await db.orders.find({"seller_id": s["id"], "payment_status": {"$in": FULFILLABLE}, "created_at": {"$gte": today}}, {"_id": 0, "bill": 1, "status": 1}).to_list(2000)
    counts = {}
    for st in ("confirmed", "preparing", "ready_for_pickup"):
        counts[st] = await db.orders.count_documents({"seller_id": s["id"], "payment_status": {"$in": FULFILLABLE}, "status": st})
    return {"today_orders": len(rows), "today_sales": sum(r["bill"]["subtotal"] for r in rows),
            "today_payout": round(sum(r["bill"]["subtotal"] - r["bill"].get("commission", 0) for r in rows), 2),
            "new": counts["confirmed"], "preparing": counts["preparing"], "ready": counts["ready_for_pickup"]}


@router.get("/orders/{oid}")
async def order(oid: str, user=Depends(seller_only)):
    _, o = await my_order(oid, user)
    return seller_view(o)


async def move(o: dict, frm: list[str], to: str, msg: str):
    res = await db.orders.update_one({"id": o["id"], "status": {"$in": frm}, "payment_status": {"$in": FULFILLABLE}},
                                     {"$set": {"status": to}, "$push": {"history": {"status": to, "at": iso(now())}}})
    if not res.modified_count:
        raise HTTPException(400, "Order status changed — refresh and try again")
    await notify(o["member_ids"], "Order update", f"{o['order_no']} {msg}", "order", o["id"])


@router.post("/orders/{oid}/accept")
async def accept(oid: str, user=Depends(seller_only)):
    s, o = await my_order(oid, user)
    if not s["approved"]:
        raise HTTPException(403, "Your shop is pending approval")
    await move(o, ["confirmed"], "preparing", "was accepted and is being prepared")
    return await order(oid, user)


@router.post("/orders/{oid}/reject")
async def reject(oid: str, body: RejectIn, user=Depends(seller_only)):
    _, o = await my_order(oid, user)
    if o["status"] != "confirmed":
        raise HTTPException(400, "Only new orders can be rejected")
    await cancel_order_doc(o, "seller_rejected")
    await db.orders.update_one({"id": oid}, {"$set": {"reject_note": body.reason}})
    return await order(oid, user)


@router.post("/orders/{oid}/pack")
async def pack(oid: str, body: PackIn, user=Depends(seller_only)):
    _, o = await my_order(oid, user)
    if o["status"] != "preparing":
        raise HTTPException(400, "Accept the order before packing")
    if body.index >= len(o["items"]):
        raise HTTPException(400, "Invalid item")
    packed = o.get("packed", [False] * len(o["items"]))
    packed[body.index] = body.checked
    await db.orders.update_one({"id": oid}, {"$set": {"packed": packed}})
    return await order(oid, user)


@router.post("/orders/{oid}/ready")
async def ready(oid: str, user=Depends(seller_only)):
    _, o = await my_order(oid, user)
    packed = o.get("packed", [])
    if len(packed) != len(o["items"]) or not all(packed):
        raise HTTPException(400, "Tick every item on the packing checklist first")
    await move(o, ["preparing"], "ready_for_pickup", "is packed and ready for pickup")
    return await order(oid, user)


@router.get("/community-batches")
async def batches(user=Depends(seller_only)):
    """Consolidated fulfilment requests: one per community basket, each holding separate flat packages."""
    s = await my_shop(user)
    rows = await db.orders.find({"seller_id": s["id"], "kind": "community_flat", "payment_status": {"$in": FULFILLABLE},
                                 "status": {"$in": ["confirmed", "preparing", "ready_for_pickup"]}}, {"_id": 0}).sort("flat", 1).to_list(1000)
    out: dict[str, dict] = {}
    for o in rows:
        b = out.setdefault(o["ref_id"], {"basket_id": o["ref_id"], "community_name": o["community_name"], "scheduled_for": o["scheduled_for"],
                                         "packages": [], "items_total": {}})
        b["packages"].append(seller_view(o))
        for i in o["items"]:
            b["items_total"][i["name"]] = b["items_total"].get(i["name"], 0) + i["qty"]
    for b in out.values():
        b["ready_count"] = sum(1 for p in b["packages"] if p["status"] == "ready_for_pickup")
        b["items_total"] = [{"name": k, "qty": v} for k, v in b["items_total"].items()]
    return list(out.values())

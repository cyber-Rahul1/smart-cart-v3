"""Community Service: apartment communities, residents, seller-specific baskets -> SEPARATE flat orders."""
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import current_user, db, iso, new_id, notify, now, parse_iso, short_code
from services.delivery import allocate
from services.orders import create_order
from services.pricing import compute_bill, resolve_items

router = APIRouter(prefix="/api", tags=["community"])


class CommunityIn(BaseModel):
    name: str = Field(min_length=3, max_length=60)
    address: str = Field(min_length=5, max_length=200)
    flats: str = Field(min_length=1, max_length=2000, description="Comma separated flat numbers")
    my_flat: str


class JoinIn(BaseModel):
    code: str
    flat: str


class BasketIn(BaseModel):
    seller_id: str
    title: str = Field(min_length=2, max_length=40)
    closes_in_min: int = Field(ge=5, le=60 * 24 * 3)
    deliver_in_min: Optional[int] = Field(None, ge=10, le=60 * 24 * 4)


class ItemIn(BaseModel):
    product_id: str
    qty: int = Field(ge=1, le=20)


class QtyIn(BaseModel):
    qty: int = Field(ge=0, le=20)


async def resident(cid: str, user: dict) -> dict:
    r = await db.residents.find_one({"community_id": cid, "user_id": user["id"]}, {"_id": 0})
    if not r:
        raise HTTPException(404, "You are not a resident of this community")
    return r


@router.post("/communities")
async def create_community(body: CommunityIn, user=Depends(current_user)):
    flats = sorted({f.strip().upper() for f in body.flats.split(",") if f.strip()})
    if body.my_flat.strip().upper() not in flats:
        raise HTTPException(400, "Your flat must be in the flat list")
    c = {"id": new_id(), "name": body.name.strip(), "address": body.address.strip(), "flats": flats, "admin_id": user["id"],
         "invite_code": short_code("APT"), "lat": 12.9352, "lng": 77.6245, "created_at": iso(now())}
    await db.communities.insert_one(dict(c))
    await db.residents.insert_one({"id": new_id(), "community_id": c["id"], "user_id": user["id"], "name": user.get("name"),
                                   "flat": body.my_flat.strip().upper(), "verified": True, "role": "admin", "joined_at": iso(now())})
    return c


@router.get("/communities")
async def my_communities(user=Depends(current_user)):
    rs = await db.residents.find({"user_id": user["id"]}, {"_id": 0}).to_list(20)
    out = []
    for r in rs:
        c = await db.communities.find_one({"id": r["community_id"]}, {"_id": 0})
        if c:
            out.append({**c, "my_flat": r["flat"], "is_admin": c["admin_id"] == user["id"],
                        "resident_count": await db.residents.count_documents({"community_id": c["id"]})})
    return out


@router.post("/communities/join")
async def join(body: JoinIn, user=Depends(current_user)):
    c = await db.communities.find_one({"invite_code": body.code.strip().upper()}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Invalid community code")
    flat = body.flat.strip().upper()
    if flat not in c["flats"]:
        raise HTTPException(400, f"Flat {flat} is not registered in {c['name']}")
    if await db.residents.find_one({"community_id": c["id"], "user_id": user["id"]}):
        raise HTTPException(400, "You already joined this community")
    await db.residents.insert_one({"id": new_id(), "community_id": c["id"], "user_id": user["id"], "name": user.get("name"),
                                   "flat": flat, "verified": True, "verified_via": "invite_code", "role": "resident", "joined_at": iso(now())})
    await notify([c["admin_id"]], "New resident", f"{user.get('name') or 'A resident'} joined from flat {flat}", "community", c["id"])
    return c


@router.get("/communities/{cid}")
async def community_detail(cid: str, user=Depends(current_user)):
    r = await resident(cid, user)
    c = await db.communities.find_one({"id": cid}, {"_id": 0})
    baskets = await db.baskets.find({"community_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {**c, "my_flat": r["flat"], "is_admin": c["admin_id"] == user["id"],
            "resident_count": await db.residents.count_documents({"community_id": cid}),
            "baskets": [{k: b[k] for k in ("id", "title", "seller_name", "status", "closes_at", "deliver_at")}
                        | {"flat_count": len({i["flat"] for i in b["items"]})} for b in baskets]}


@router.post("/communities/{cid}/baskets")
async def create_basket(cid: str, body: BasketIn, user=Depends(current_user)):
    r = await resident(cid, user)
    c = await db.communities.find_one({"id": cid}, {"_id": 0})
    seller = await db.sellers.find_one({"id": body.seller_id, "approved": True}, {"_id": 0})
    if not seller:
        raise HTTPException(404, "Shop not found")
    if body.deliver_in_min and body.deliver_in_min <= body.closes_in_min:
        raise HTTPException(400, "Delivery must be after the basket closes")
    b = {"id": new_id(), "community_id": cid, "community_name": c["name"], "title": body.title.strip(), "creator_id": user["id"],
         "creator_flat": r["flat"], "seller_id": seller["id"], "seller_name": seller["name"], "status": "open",
         "closes_at": iso(now() + timedelta(minutes=body.closes_in_min)),
         "deliver_at": iso(now() + timedelta(minutes=body.deliver_in_min)) if body.deliver_in_min else None,
         "items": [], "order_ids": [], "created_at": iso(now())}
    await db.baskets.insert_one(dict(b))
    others = [x["user_id"] for x in await db.residents.find({"community_id": cid}, {"user_id": 1}).to_list(1000)]
    await notify(others, "Community basket open", f"{b['title']} from {seller['name']} — add your flat's items", "basket", b["id"])
    return b


async def get_basket(bid: str, user: dict) -> tuple[dict, dict]:
    b = await db.baskets.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Basket not found")
    return b, await resident(b["community_id"], user)


async def basket_payload(b: dict, r: dict, user: dict) -> dict:
    c = await db.communities.find_one({"id": b["community_id"]}, {"_id": 0})
    my_items = [i for i in b["items"] if i["flat"] == r["flat"]]
    flats: dict[str, int] = {}
    for i in b["items"]:
        flats[i["flat"]] = flats.get(i["flat"], 0) + i["qty"]
    # Privacy: other flats only expose item counts, never items, totals or payment info.
    my_order = None
    if b["order_ids"]:
        my_order = await db.orders.find_one({"id": {"$in": b["order_ids"]}, "member_ids": user["id"]}, {"_id": 0, "id": 1, "order_no": 1,
                                                                                                         "status": 1, "payment_status": 1, "bill": 1})
    out = {k: v for k, v in b.items() if k != "items"}
    return {**out, "my_flat": r["flat"], "my_items": my_items, "my_subtotal": sum(i["price"] * i["qty"] for i in my_items),
            "flats": [{"flat": f, "item_count": n, "is_mine": f == r["flat"]} for f, n in sorted(flats.items())],
            "can_close": user["id"] in (b["creator_id"], c["admin_id"]), "my_order": my_order}


@router.get("/community-baskets/{bid}")
async def view_basket(bid: str, user=Depends(current_user)):
    b, r = await get_basket(bid, user)
    return await basket_payload(b, r, user)


def ensure_open(b: dict):
    if b["status"] != "open" or parse_iso(b["closes_at"]) <= now():
        raise HTTPException(400, "This basket is closed")


@router.post("/community-baskets/{bid}/items")
async def add_item(bid: str, body: ItemIn, user=Depends(current_user)):
    b, r = await get_basket(bid, user)
    ensure_open(b)
    p = await db.products.find_one({"id": body.product_id, "seller_id": b["seller_id"]}, {"_id": 0})
    if not p or not p["available"]:
        raise HTTPException(400, "Item unavailable from this shop")
    mine = next((i for i in b["items"] if i["flat"] == r["flat"] and i["product_id"] == p["id"]), None)
    if mine:
        await db.baskets.update_one({"id": bid, "items.id": mine["id"]}, {"$inc": {"items.$.qty": body.qty}})
    else:
        await db.baskets.update_one({"id": bid}, {"$push": {"items": {
            "id": new_id(), "flat": r["flat"], "user_id": user["id"], "product_id": p["id"], "name": p["name"], "price": p["price"],
            "image": p.get("image"), "weight_kg": p.get("weight_kg", 0.5), "qty": body.qty}}})
    return await view_basket(bid, user)


@router.patch("/community-baskets/{bid}/items/{item_id}")
async def update_item(bid: str, item_id: str, body: QtyIn, user=Depends(current_user)):
    b, r = await get_basket(bid, user)
    ensure_open(b)
    item = next((i for i in b["items"] if i["id"] == item_id), None)
    if not item or item["flat"] != r["flat"]:
        raise HTTPException(403, "You can only change your own flat's items")
    if body.qty == 0:
        await db.baskets.update_one({"id": bid}, {"$pull": {"items": {"id": item_id}}})
    else:
        await db.baskets.update_one({"id": bid, "items.id": item_id}, {"$set": {"items.$.qty": body.qty}})
    return await view_basket(bid, user)


async def close_basket_doc(b: dict) -> list[dict]:
    """Close basket and create one independent order per flat (own bill, payment, package, OTP, status)."""
    res = await db.baskets.update_one({"id": b["id"], "status": "open"}, {"$set": {"status": "closing"}})
    if not res.modified_count:
        return []
    seller = await db.sellers.find_one({"id": b["seller_id"]}, {"_id": 0})
    by_flat: dict[str, list] = {}
    for i in b["items"]:
        by_flat.setdefault(i["flat"], []).append(i)
    orders, skipped = [], []
    for flat, items in sorted(by_flat.items()):
        flat_residents = [x["user_id"] for x in await db.residents.find({"community_id": b["community_id"], "flat": flat}, {"user_id": 1}).to_list(20)]
        payer = items[0]["user_id"]
        addr = await db.addresses.find_one({"user_id": payer, "is_default": True}, {"_id": 0}) or {
            "label": "Flat", "line": f"Flat {flat}, {b['community_name']}", "landmark": ""}
        lines, unavailable = await resolve_items(b["seller_id"], items)
        if not lines:
            skipped.append(flat)
            continue
        subtotal = sum(l["line_total"] for l in lines)
        try:
            bill = await compute_bill({**seller, "min_order": 0}, subtotal, community_share=len(by_flat))
        except HTTPException:
            skipped.append(flat)
            continue
        pkg = short_code("PKG-")
        o = await create_order(payer_id=payer, member_ids=flat_residents or [payer], seller=seller, kind="community_flat", items=lines,
                               bill=bill, address={**addr, "label": f"Flat {flat}", "line": b["community_name"]}, scheduled_for=b["deliver_at"],
                               ref_id=b["id"], extra={"flat": flat, "community_name": b["community_name"], "package_id": pkg,
                                                      "unavailable": unavailable,
                                                      "package_label": {"community": b["community_name"], "flat": flat, "package_id": pkg,
                                                                        "items": [f"{l['qty']} x {l['name']}" for l in lines],
                                                                        "handling": "Keep upright. Deliver to flat door; verify OTP."}})
        orders.append(o)
        await notify(o["member_ids"], "Your flat order is ready to pay", f"Flat {flat}: {o['order_no']} — ₹{bill['total']}", "order", o["id"])
    await db.baskets.update_one({"id": b["id"]}, {"$set": {"status": "closed", "closed_at": iso(now()), "order_ids": [o["id"] for o in orders],
                                                          "skipped_flats": skipped}})
    return orders


@router.post("/community-baskets/{bid}/close")
async def close(bid: str, user=Depends(current_user)):
    b, r = await get_basket(bid, user)
    c = await db.communities.find_one({"id": b["community_id"]}, {"_id": 0})
    if user["id"] not in (b["creator_id"], c["admin_id"]):
        raise HTTPException(403, "Only the basket creator or community admin can close it")
    if b["status"] != "open":
        raise HTTPException(400, "Basket already closed")
    if not b["items"]:
        raise HTTPException(400, "Basket is empty")
    orders = await close_basket_doc(b)
    return {"orders_created": len(orders), "basket": await view_basket(bid, user)}


@router.get("/community-baskets/{bid}/delivery-plan")
async def delivery_plan(bid: str, user=Depends(current_user)):
    b, _ = await get_basket(bid, user)
    if b["status"] != "closed":
        raise HTTPException(400, "Plan is available after the basket closes")
    orders = await db.orders.find({"id": {"$in": b["order_ids"]}, "status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(500)
    riders = await db.riders.find({"available": True, "verified": True}, {"_id": 0}).to_list(50)
    plan = allocate(orders, riders)
    # Residents see flat numbers and rider names only.
    for m in plan["manifests"]:
        m["rider"] = {"name": m["rider"]["name"], "vehicle": m["rider"]["vehicle"], "max_packages": m["rider"]["max_packages"]}
    return plan

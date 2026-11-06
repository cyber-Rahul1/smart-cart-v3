"""Group Ordering Service: bachelor/roommate groups, shared carts with backend-enforced granular permissions."""
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import current_user, db, iso, new_id, notify, now, parse_iso, short_code
from services.orders import create_order
from services.pricing import compute_bill, resolve_items

router = APIRouter(prefix="/api", tags=["group-ordering"])

DEFAULT_PERMS = {"view_cart": True, "add_items": True, "modify_own": True, "modify_others": False,
                 "remove_own": True, "remove_others": False, "close_cart": False, "finalize": False}


class GroupIn(BaseModel):
    name: str = Field(min_length=2, max_length=40)


class JoinIn(BaseModel):
    code: str = Field(min_length=4, max_length=12)


class Perms(BaseModel):
    view_cart: bool = True
    add_items: bool = True
    modify_own: bool = True
    modify_others: bool = False
    remove_own: bool = True
    remove_others: bool = False
    close_cart: bool = False
    finalize: bool = False


class GroupCartIn(BaseModel):
    name: str = Field(min_length=2, max_length=40)
    seller_id: str
    closes_in_min: int = Field(ge=5, le=60 * 24 * 3)
    deliver_in_min: Optional[int] = Field(None, ge=10, le=60 * 24 * 4)
    permissions: Perms = Perms()


class ItemIn(BaseModel):
    product_id: str
    qty: int = Field(ge=1, le=20)


class QtyIn(BaseModel):
    qty: int = Field(ge=0, le=20)


class FinalizeIn(BaseModel):
    address_id: str


async def get_group(gid: str, user: dict) -> dict:
    g = await db.groups.find_one({"id": gid}, {"_id": 0})
    if not g or user["id"] not in [m["user_id"] for m in g["members"]]:
        raise HTTPException(404, "Group not found")
    return g


def member_ids(g: dict) -> list[str]:
    return [m["user_id"] for m in g["members"]]


def can(cart: dict, user: dict, perm: str) -> bool:
    return cart["owner_id"] == user["id"] or bool(cart["permissions"].get(perm))


def require_perm(cart: dict, user: dict, perm: str):
    if not can(cart, user, perm):
        raise HTTPException(403, f"You don't have permission to {perm.replace('_', ' ')}")


@router.post("/groups")
async def create_group(body: GroupIn, user=Depends(current_user)):
    g = {"id": new_id(), "name": body.name.strip(), "owner_id": user["id"], "invite_code": short_code(),
         "members": [{"user_id": user["id"], "name": user.get("name") or "You", "phone": user["phone"], "joined_at": iso(now())}],
         "created_at": iso(now())}
    await db.groups.insert_one(dict(g))
    await notify([user["id"]], "Group created", f"Share code {g['invite_code']} with your roommates", "group", g["id"])
    return g


@router.get("/groups")
async def my_groups(user=Depends(current_user)):
    return await db.groups.find({"members.user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)


@router.post("/groups/join")
async def join_group(body: JoinIn, user=Depends(current_user)):
    g = await db.groups.find_one({"invite_code": body.code.strip().upper()}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Invalid group code")
    if user["id"] in member_ids(g):
        return g
    if len(g["members"]) >= 12:
        raise HTTPException(400, "Group is full")
    await db.groups.update_one({"id": g["id"]}, {"$push": {"members": {"user_id": user["id"], "name": user.get("name") or "Member",
                                                                       "phone": user["phone"], "joined_at": iso(now())}}})
    await notify(member_ids(g), "Member joined", f"{user.get('name') or 'A roommate'} joined {g['name']}", "group", g["id"])
    return await db.groups.find_one({"id": g["id"]}, {"_id": 0})


@router.get("/groups/{gid}")
async def group_detail(gid: str, user=Depends(current_user)):
    g = await get_group(gid, user)
    carts = await db.group_carts.find({"group_id": gid}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {**g, "carts": [{k: c[k] for k in ("id", "name", "seller_name", "status", "closes_at", "deliver_at")} | {"item_count": len(c["items"])}
                           for c in carts]}


@router.delete("/groups/{gid}/members/{uid}")
async def remove_member(gid: str, uid: str, user=Depends(current_user)):
    g = await get_group(gid, user)
    if g["owner_id"] != user["id"] and uid != user["id"]:
        raise HTTPException(403, "Only the group owner can remove members")
    if uid == g["owner_id"]:
        raise HTTPException(400, "Owner cannot leave the group")
    await db.groups.update_one({"id": gid}, {"$pull": {"members": {"user_id": uid}}})
    return {"ok": True}


@router.post("/groups/{gid}/carts")
async def create_cart(gid: str, body: GroupCartIn, user=Depends(current_user)):
    g = await get_group(gid, user)
    seller = await db.sellers.find_one({"id": body.seller_id, "approved": True}, {"_id": 0})
    if not seller:
        raise HTTPException(404, "Shop not found")
    if body.deliver_in_min and body.deliver_in_min <= body.closes_in_min:
        raise HTTPException(400, "Delivery must be after the cart closes")
    c = {"id": new_id(), "group_id": gid, "group_name": g["name"], "name": body.name.strip(), "owner_id": user["id"],
         "seller_id": seller["id"], "seller_name": seller["name"], "status": "open",
         "closes_at": iso(now() + timedelta(minutes=body.closes_in_min)),
         "deliver_at": iso(now() + timedelta(minutes=body.deliver_in_min)) if body.deliver_in_min else None,
         "permissions": body.permissions.model_dump(), "items": [], "reminded": False, "order_id": None, "created_at": iso(now())}
    await db.group_carts.insert_one(dict(c))
    await notify(member_ids(g), "Shared cart opened", f"{c['name']} from {seller['name']} — add your items before it closes", "group_cart", c["id"])
    return c


async def get_cart(cid: str, user: dict) -> tuple[dict, dict]:
    c = await db.group_carts.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Cart not found")
    g = await get_group(c["group_id"], user)
    if not can(c, user, "view_cart"):
        raise HTTPException(403, "You don't have permission to view this cart")
    return c, g


async def cart_payload(c: dict, user: dict) -> dict:
    subtotal = sum(i["price"] * i["qty"] for i in c["items"])
    shares: dict[str, dict] = {}
    for i in c["items"]:
        s = shares.setdefault(i["user_id"], {"user_id": i["user_id"], "name": i["user_name"], "amount": 0, "count": 0})
        s["amount"] += i["price"] * i["qty"]
        s["count"] += i["qty"]
    is_owner = c["owner_id"] == user["id"]
    my_perms = {k: (True if is_owner else v) for k, v in c["permissions"].items()}
    return {**c, "subtotal": subtotal, "shares": list(shares.values()), "my_share": shares.get(user["id"], {}).get("amount", 0),
            "is_owner": is_owner, "my_permissions": my_perms}


@router.get("/group-carts/{cid}")
async def view_cart(cid: str, user=Depends(current_user)):
    c, _ = await get_cart(cid, user)
    return await cart_payload(c, user)


def ensure_open(c: dict):
    if c["status"] != "open" or parse_iso(c["closes_at"]) <= now():
        raise HTTPException(400, "This cart is closed")


@router.post("/group-carts/{cid}/items")
async def add_item(cid: str, body: ItemIn, user=Depends(current_user)):
    c, g = await get_cart(cid, user)
    ensure_open(c)
    require_perm(c, user, "add_items")
    p = await db.products.find_one({"id": body.product_id, "seller_id": c["seller_id"]}, {"_id": 0})
    if not p or not p["available"]:
        raise HTTPException(400, "Item unavailable from this shop")
    mine = next((i for i in c["items"] if i["user_id"] == user["id"] and i["product_id"] == p["id"]), None)
    if mine:
        await db.group_carts.update_one({"id": cid, "items.id": mine["id"]}, {"$inc": {"items.$.qty": body.qty}})
    else:
        await db.group_carts.update_one({"id": cid}, {"$push": {"items": {
            "id": new_id(), "user_id": user["id"], "user_name": user.get("name") or "Member", "product_id": p["id"],
            "name": p["name"], "price": p["price"], "image": p.get("image"), "veg": p.get("veg"),
            "weight_kg": p.get("weight_kg", 0.5), "qty": body.qty, "added_at": iso(now())}}})
        await notify([m for m in member_ids(g) if m != user["id"]], "Item added",
                     f"{user.get('name') or 'A roommate'} added {p['name']} to {c['name']}", "group_cart", cid)
    return await view_cart(cid, user)


@router.patch("/group-carts/{cid}/items/{item_id}")
async def update_item(cid: str, item_id: str, body: QtyIn, user=Depends(current_user)):
    c, _ = await get_cart(cid, user)
    ensure_open(c)
    item = next((i for i in c["items"] if i["id"] == item_id), None)
    if not item:
        raise HTTPException(404, "Item not found")
    own = item["user_id"] == user["id"]
    if body.qty == 0:
        require_perm(c, user, "remove_own" if own else "remove_others")
        await db.group_carts.update_one({"id": cid}, {"$pull": {"items": {"id": item_id}}})
    else:
        require_perm(c, user, "modify_own" if own else "modify_others")
        await db.group_carts.update_one({"id": cid, "items.id": item_id}, {"$set": {"items.$.qty": body.qty}})
    return await view_cart(cid, user)


@router.put("/group-carts/{cid}/permissions")
async def set_perms(cid: str, body: Perms, user=Depends(current_user)):
    c, _ = await get_cart(cid, user)
    if c["owner_id"] != user["id"]:
        raise HTTPException(403, "Only the cart owner can change permissions")
    await db.group_carts.update_one({"id": cid}, {"$set": {"permissions": body.model_dump()}})
    return await view_cart(cid, user)


async def close_cart_doc(c: dict, g_members: list[str]):
    res = await db.group_carts.update_one({"id": c["id"], "status": "open"}, {"$set": {"status": "closed", "closed_at": iso(now())}})
    if res.modified_count:
        await notify(g_members, "Cart closed", f"{c['name']} is closed. Owner can finalize the order now.", "group_cart", c["id"])


@router.post("/group-carts/{cid}/close")
async def close(cid: str, user=Depends(current_user)):
    c, g = await get_cart(cid, user)
    require_perm(c, user, "close_cart")
    if c["status"] != "open":
        raise HTTPException(400, "Cart already closed")
    await close_cart_doc(c, member_ids(g))
    return await view_cart(cid, user)


@router.post("/group-carts/{cid}/finalize")
async def finalize(cid: str, body: FinalizeIn, user=Depends(current_user)):
    c, g = await get_cart(cid, user)
    require_perm(c, user, "finalize")
    if c["status"] == "finalized":
        raise HTTPException(400, "Already finalized")
    if not c["items"]:
        raise HTTPException(400, "Cart is empty")
    address = await db.addresses.find_one({"id": body.address_id, "user_id": user["id"]}, {"_id": 0})
    if not address:
        raise HTTPException(400, "Select a delivery address")
    seller = await db.sellers.find_one({"id": c["seller_id"]}, {"_id": 0})
    lines, unavailable = await resolve_items(c["seller_id"], c["items"])
    if unavailable:
        raise HTTPException(409, "Unavailable: " + ", ".join(u["name"] for u in unavailable))
    subtotal = sum(l["line_total"] for l in lines)
    bill = await compute_bill(seller, subtotal)
    shares = {}
    for l in lines:
        s = shares.setdefault(l["user_id"], {"user_id": l["user_id"], "name": l["user_name"], "amount": 0})
        s["amount"] += l["line_total"]
    order = await create_order(payer_id=user["id"], member_ids=member_ids(g), seller=seller, kind="group", items=lines, bill=bill,
                               address=address, scheduled_for=c["deliver_at"], ref_id=cid,
                               extra={"group_name": g["name"], "cart_name": c["name"], "shares": list(shares.values())})
    await db.group_carts.update_one({"id": cid}, {"$set": {"status": "finalized", "order_id": order["id"]}})
    await notify(member_ids(g), "Order finalized", f"{c['name']} order {order['order_no']} placed — total ₹{bill['total']}", "order", order["id"])
    return order

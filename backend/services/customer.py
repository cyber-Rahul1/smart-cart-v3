"""Customer Service: profile, addresses, referral attribution, notifications inbox."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import clean, current_user, db, iso, new_id, now

router = APIRouter(prefix="/api", tags=["customer"])


class ProfileIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    referral_code: Optional[str] = None


class AddressIn(BaseModel):
    label: str = Field(min_length=1, max_length=30)
    line: str = Field(min_length=5, max_length=200)
    landmark: str = ""
    lat: float = 12.9352
    lng: float = 77.6245
    is_default: bool = False


@router.put("/profile")
async def update_profile(body: ProfileIn, user=Depends(current_user)):
    update = {"name": body.name.strip()}
    if body.referral_code and not user.get("referred_by"):
        code = body.referral_code.strip().upper()
        ref = await db.users.find_one({"referral_code": code}, {"_id": 0})
        if not ref:
            raise HTTPException(400, "Referral code not found")
        if ref["id"] == user["id"] or ref["phone"] == user["phone"]:
            raise HTTPException(400, "You cannot use your own referral code")
        update["referred_by"] = ref["id"]
        await db.referrals.insert_one({"id": new_id(), "referrer_id": ref["id"], "referee_id": user["id"],
                                       "status": "pending", "created_at": iso(now())})
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    return clean(await db.users.find_one({"id": user["id"]}, {"_id": 0}))


@router.get("/referrals")
async def my_referrals(user=Depends(current_user)):
    rows = await db.referrals.find({"referrer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for r in rows:
        u = await db.users.find_one({"id": r["referee_id"]}, {"_id": 0, "name": 1})
        r["referee_name"] = (u or {}).get("name") or "New user"
    return {"code": user["referral_code"], "credits": user.get("delivery_credits", 0), "referrals": rows}


@router.get("/addresses")
async def list_addresses(user=Depends(current_user)):
    return await db.addresses.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(50)


@router.post("/addresses")
async def add_address(body: AddressIn, user=Depends(current_user)):
    count = await db.addresses.count_documents({"user_id": user["id"]})
    doc = {"id": new_id(), "user_id": user["id"], **body.model_dump(), "created_at": iso(now())}
    if count == 0:
        doc["is_default"] = True
    if doc["is_default"]:
        await db.addresses.update_many({"user_id": user["id"]}, {"$set": {"is_default": False}})
    await db.addresses.insert_one(dict(doc))
    return clean(doc)


@router.post("/addresses/{aid}/default")
async def set_default(aid: str, user=Depends(current_user)):
    if not await db.addresses.find_one({"id": aid, "user_id": user["id"]}):
        raise HTTPException(404, "Address not found")
    await db.addresses.update_many({"user_id": user["id"]}, {"$set": {"is_default": False}})
    await db.addresses.update_one({"id": aid}, {"$set": {"is_default": True}})
    return {"ok": True}


@router.delete("/addresses/{aid}")
async def delete_address(aid: str, user=Depends(current_user)):
    res = await db.addresses.delete_one({"id": aid, "user_id": user["id"]})
    if not res.deleted_count:
        raise HTTPException(404, "Address not found")
    return {"ok": True}


@router.get("/notifications")
async def notifications(user=Depends(current_user)):
    rows = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    unread = sum(1 for r in rows if not r["read"])
    return {"unread": unread, "items": rows}


@router.post("/notifications/read-all")
async def read_all(user=Depends(current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}

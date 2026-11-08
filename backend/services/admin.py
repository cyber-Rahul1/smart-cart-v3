"""Admin Service: shop & FSSAI review, rider verification, fee/commission configuration, overview metrics."""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

from core import db, get_config, iso, new_id, notify, now, require

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin_only = require("admin")


class ReviewIn(BaseModel):
    decision: Literal["approve", "reject"]
    note: str = Field("", max_length=200)

    @model_validator(mode="after")
    def need_note(self):
        if self.decision == "reject" and len(self.note.strip()) < 3:
            raise ValueError("Add a reason so the applicant knows what to fix")
        return self


class ConfigIn(BaseModel):
    delivery_base: float = Field(ge=0, le=500)
    delivery_per_km: float = Field(ge=0, le=100)
    free_delivery_threshold: float = Field(ge=0, le=10000)
    convenience_fee: float = Field(ge=0, le=100)
    commission_pct: float = Field(ge=0, le=50)
    community_delivery_discount: float = Field(ge=0, le=0.9)
    seller_auto_approve: bool = False


async def audit(actor: str, action: str, target: str, note: str = ""):
    await db.audit_logs.insert_one({"id": new_id(), "actor": actor, "action": action, "target": target, "note": note, "at": iso(now())})


@router.get("/overview")
async def overview(user=Depends(admin_only)):
    paid = await db.orders.find({"payment_status": "paid"}, {"_id": 0, "bill": 1, "kind": 1}).to_list(10000)
    gmv = sum(o["bill"]["total"] for o in paid)
    return {
        "orders": len(paid), "gmv": round(gmv, 2), "aov": round(gmv / len(paid), 2) if paid else 0,
        "commission": round(sum(o["bill"].get("commission", 0) for o in paid), 2),
        "delivery_cost": round(sum(o["bill"].get("delivery_cost", 0) for o in paid), 2),
        "community_orders": sum(1 for o in paid if o["kind"] == "community_flat"), "group_orders": sum(1 for o in paid if o["kind"] == "group"),
        "customers": await db.users.count_documents({"role": "customer"}),
        "sellers_live": await db.sellers.count_documents({"approved": True}),
        "sellers_pending": await db.sellers.count_documents({"approval_status": "pending_review"}),
        "riders_verified": await db.riders.count_documents({"verified": True}),
        "riders_pending": await db.riders.count_documents({"approval_status": "pending_review"}),
        "refunds": await db.refunds.count_documents({}),
    }


@router.get("/sellers")
async def sellers(status: Literal["pending_review", "approved", "rejected"] = "pending_review", user=Depends(admin_only)):
    f = {"approval_status": status} if status != "approved" else {"approved": True}
    return await db.sellers.find(f, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/sellers/{sid}/review")
async def review_seller(sid: str, body: ReviewIn, user=Depends(admin_only)):
    s = await db.sellers.find_one({"id": sid}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Shop not found")
    ok = body.decision == "approve"
    if s.get("approval_status") == ("approved" if ok else "rejected"):
        raise HTTPException(400, f"Shop is already {'approved' if ok else 'rejected'}")
    upd = {"approved": ok, "approval_status": "approved" if ok else "rejected", "review_note": body.note.strip(), "reviewed_at": iso(now())}
    if s["category"] == "food":
        upd["fssai_status"] = "verified" if ok else "rejected"
    await db.sellers.update_one({"id": sid}, {"$set": upd})
    await audit(user["id"], f"seller.{body.decision}", sid, body.note)
    if s.get("owner_id"):
        await notify([s["owner_id"]], "Shop approved" if ok else "Shop not approved",
                     f"{s['name']} is now live for customers" if ok else f"Reason: {body.note}", "seller_shop", sid)
    return await db.sellers.find_one({"id": sid}, {"_id": 0})


@router.get("/riders")
async def riders(status: Literal["pending_review", "approved", "rejected"] = "pending_review", user=Depends(admin_only)):
    f = {"approval_status": status} if status != "approved" else {"verified": True}
    return await db.riders.find(f, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/riders/{rid}/review")
async def review_rider(rid: str, body: ReviewIn, user=Depends(admin_only)):
    r = await db.riders.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Rider not found")
    ok = body.decision == "approve"
    if r.get("approval_status") == ("approved" if ok else "rejected"):
        raise HTTPException(400, f"Rider is already {'approved' if ok else 'rejected'}")
    await db.riders.update_one({"id": rid}, {"$set": {"verified": ok, "approval_status": "approved" if ok else "rejected",
                                                      "available": False if not ok else r.get("available", False), "review_note": body.note.strip()}})
    await audit(user["id"], f"rider.{body.decision}", rid, body.note)
    if r.get("user_id"):
        await notify([r["user_id"]], "Rider profile verified" if ok else "Rider profile not approved",
                     "Go online to start accepting deliveries" if ok else f"Reason: {body.note}", "rider", rid)
    return await db.riders.find_one({"id": rid}, {"_id": 0})


@router.get("/config")
async def config(user=Depends(admin_only)):
    return await get_config()


@router.put("/config")
async def set_config(body: ConfigIn, user=Depends(admin_only)):
    await db.platform_config.update_one({"id": "fees"}, {"$set": body.model_dump()}, upsert=True)
    await audit(user["id"], "config.update", "fees", str(body.model_dump()))
    return await get_config()

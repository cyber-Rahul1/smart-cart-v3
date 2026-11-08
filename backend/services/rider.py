"""Delivery partner (Rider) app API: onboarding, availability, capacity-aware claims, pickup, OTP-verified delivery."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import FULFILLABLE, db, iso, new_id, notify, now, require
from services.delivery import capacity, item_count, order_points, package_weight, plan_runs
from services.payments import collect_cod

router = APIRouter(prefix="/api/rider", tags=["rider"])
rider_only = require("rider")
CAPACITY = {"bike": (4, 12, 25), "scooter": (5, 15, 30), "cycle": (2, 5, 10)}  # packages, kg, items


class OnboardIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    vehicle: Literal["bike", "scooter", "cycle"]
    vehicle_number: str = Field("", max_length=15)
    licence_number: str = Field(min_length=6, max_length=20)


class AvailIn(BaseModel):
    available: bool


class ClaimIn(BaseModel):
    order_ids: list[str] = Field(min_length=1, max_length=20)


class OtpIn(BaseModel):
    otp: str = Field(pattern=r"^\d{4}$")
    cash_collected: bool = False


class LocationIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    heading: float | None = None


async def me_rider(user: dict) -> dict:
    r = await db.riders.find_one({"user_id": user["id"]}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Complete rider registration first")
    return r


async def view(o: dict) -> dict:
    """Rider sees pickup + drop details, package label and any cash to collect — never the OTP or payment details."""
    pickup_pt, drop_pt = await order_points(o)
    shop = await db.sellers.find_one({"id": o["seller_id"]}, {"_id": 0, "name": 1, "address": 1})
    member = await db.users.find_one({"id": o["user_id"]}, {"_id": 0, "name": 1})
    return {"id": o["id"], "order_no": o["order_no"], "kind": o["kind"], "status": o["status"], "flat": o.get("flat"),
            "community_name": o.get("community_name"), "package_id": o.get("package_id"), "package_label": o.get("package_label"),
            "items": [{"name": i["name"], "qty": i["qty"]} for i in o["items"]], "weight": package_weight(o), "item_count": item_count(o),
            "collect_cash": o["bill"]["total"] if o.get("payment_status") == "cod" else 0, "pickup_point": pickup_pt, "drop_point": drop_pt,
            "pickup": {"name": (shop or {}).get("name", o["seller_name"]), "address": (shop or {}).get("address", "")},
            "drop": {"name": ((member or {}).get("name") or "Customer").split(" ")[0], "address": (o.get("address") or {}).get("line", ""),
                     "landmark": (o.get("address") or {}).get("landmark", "")},
            "scheduled_for": o.get("scheduled_for"), "fee": o["bill"].get("delivery_cost", 0), "ref_id": o.get("ref_id")}


@router.get("/me")
async def me(user=Depends(rider_only)):
    r = await db.riders.find_one({"user_id": user["id"]}, {"_id": 0})
    if r:
        r["load"] = await current_load(r)
    return {"rider": r}


@router.post("/onboarding")
async def onboard(body: OnboardIn, user=Depends(rider_only)):
    if await db.riders.find_one({"user_id": user["id"]}):
        raise HTTPException(400, "Already registered")
    mp, mw, mi = CAPACITY[body.vehicle]
    r = {"id": new_id(), "user_id": user["id"], "name": body.name.strip(), "phone": user["phone"], "vehicle": body.vehicle.title(),
         "vehicle_number": body.vehicle_number.strip().upper(), "licence_number": body.licence_number.strip().upper(),
         "max_packages": mp, "max_weight_kg": mw, "max_items": mi, "available": False, "verified": False, "approval_status": "pending_review",
         "active_jobs": 0, "created_at": iso(now())}
    await db.riders.insert_one(dict(r))
    await db.users.update_one({"id": user["id"]}, {"$set": {"name": body.name.strip()}})
    await db.audit_logs.insert_one({"id": new_id(), "actor": user["id"], "action": "rider.onboard", "target": r["id"], "at": iso(now())})
    return r


@router.put("/availability")
async def availability(body: AvailIn, user=Depends(rider_only)):
    r = await me_rider(user)
    if body.available and not r["verified"]:
        raise HTTPException(403, "Your rider profile is awaiting admin verification")
    await db.riders.update_one({"id": r["id"]}, {"$set": {"available": body.available}})
    return await me(user)


async def current_load(r: dict) -> dict:
    rows = await db.orders.find({"rider.id": r["id"], "status": {"$in": ["ready_for_pickup", "out_for_delivery"]}}, {"_id": 0}).to_list(50)
    return {"packages": len(rows), "weight": round(sum(package_weight(o) for o in rows), 2), "items": sum(item_count(o) for o in rows)}


@router.put("/location")
async def location(body: LocationIn, user=Depends(rider_only)):
    """Foreground GPS ping from the rider app; customers with an assigned order see it on their live map."""
    r = await me_rider(user)
    await db.riders.update_one({"id": r["id"]}, {"$set": {"location": {"lat": body.lat, "lng": body.lng, "heading": body.heading, "at": iso(now())}}})
    return {"ok": True}


@router.get("/jobs")
async def jobs(user=Depends(rider_only)):
    r = await me_rider(user)
    if not r["verified"]:
        return {"singles": [], "batches": []}
    rows = await db.orders.find({"status": "ready_for_pickup", "rider": None, "payment_status": {"$in": FULFILLABLE}}, {"_id": 0}).sort("created_at", 1).to_list(200)
    singles, batches, docs = [], {}, {}
    for o in rows:
        v = await view(o)
        if o["kind"] == "community_flat":
            b = batches.setdefault(o["ref_id"], {"basket_id": o["ref_id"], "community_name": o["community_name"], "pickup": v["pickup"], "packages": []})
            b["packages"].append(v)
            docs.setdefault(o["ref_id"], []).append(o)
        else:
            singles.append(v)
    cap = capacity(r)
    load = await current_load(r)
    room = {"packages": cap["packages"] - load["packages"], "weight": round(cap["weight"] - load["weight"], 2), "items": cap["items"] - load["items"]}
    bag_full = room["packages"] <= 0 or room["weight"] <= 0 or room["items"] <= 0
    for bid, b in batches.items():
        # Big apartment orders are pre-split into runs sized to the free space left in this rider's bag.
        b["runs"] = plan_runs(docs[bid], cap if bag_full else room)
        b["bag_full"] = bag_full
        b["total_weight"] = round(sum(p["weight"] for p in b["packages"]), 2)
        b["total_items"] = sum(p["item_count"] for p in b["packages"])
    return {"singles": singles, "batches": list(batches.values()), "capacity": cap, "room": room}


@router.post("/claim")
async def claim(body: ClaimIn, user=Depends(rider_only)):
    """Claims whole packages that fit remaining capacity; the rest stay open for another rider (split delivery)."""
    r = await me_rider(user)
    if not r["verified"] or not r["available"]:
        raise HTTPException(403, "Go online to accept jobs")
    load = await current_load(r)
    claimed, skipped = [], []
    cap = capacity(r)
    orders = await db.orders.find({"id": {"$in": body.order_ids}}, {"_id": 0}).to_list(20)
    for o in sorted(orders, key=lambda x: -package_weight(x)):
        w, n = package_weight(o), item_count(o)
        if load["packages"] + 1 > cap["packages"] or load["weight"] + w > cap["weight"] or load["items"] + n > cap["items"]:
            skipped.append(o["id"])
            continue
        rider = {"id": r["id"], "user_id": user["id"], "name": r["name"], "phone": r["phone"], "vehicle": r["vehicle"]}
        res = await db.orders.update_one({"id": o["id"], "status": "ready_for_pickup", "rider": None, "payment_status": {"$in": FULFILLABLE}},
                                         {"$set": {"rider": rider, "rider_assigned_at": iso(now())}})
        if res.modified_count:
            claimed.append(o["id"])
            load = {"packages": load["packages"] + 1, "weight": round(load["weight"] + w, 2), "items": load["items"] + n}
            await notify(o["member_ids"], "Rider assigned", f"{r['name']} will pick up {o['order_no']}", "order", o["id"])
        else:
            skipped.append(o["id"])
    if not claimed:
        raise HTTPException(409, "These jobs are taken or exceed your capacity")
    await db.riders.update_one({"id": r["id"]}, {"$set": {"active_jobs": load["packages"]}})
    return {"claimed": claimed, "skipped": skipped, "load": load}


async def my_job(oid: str, user: dict) -> dict:
    o = await db.orders.find_one({"id": oid, "rider.user_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Job not found")
    return o


@router.get("/active")
async def active(user=Depends(rider_only)):
    rows = await db.orders.find({"rider.user_id": user["id"], "status": {"$in": ["ready_for_pickup", "out_for_delivery"]}}, {"_id": 0}).to_list(50)
    return [await view(o) for o in rows]


@router.get("/history")
async def history(user=Depends(rider_only)):
    rows = await db.orders.find({"rider.user_id": user["id"], "status": "delivered"}, {"_id": 0}).sort("delivered_at", -1).to_list(100)
    out = [await view(o) | {"delivered_at": o.get("delivered_at")} for o in rows]
    return {"count": len(out), "earnings": sum(x["fee"] for x in out), "items": out}


@router.get("/orders/{oid}")
async def job(oid: str, user=Depends(rider_only)):
    return await view(await my_job(oid, user))


@router.post("/orders/{oid}/pickup")
async def pickup(oid: str, user=Depends(rider_only)):
    o = await my_job(oid, user)
    res = await db.orders.update_one({"id": oid, "status": "ready_for_pickup"},
                                     {"$set": {"status": "out_for_delivery", "picked_up_at": iso(now())},
                                      "$push": {"history": {"status": "out_for_delivery", "at": iso(now())}}})
    if not res.modified_count:
        raise HTTPException(400, "Package is not ready for pickup")
    await notify(o["member_ids"], "Out for delivery", f"{o['order_no']} picked up by {o['rider']['name']}", "order", oid)
    return await job(oid, user)


@router.post("/orders/{oid}/deliver")
async def deliver(oid: str, body: OtpIn, user=Depends(rider_only)):
    o = await my_job(oid, user)
    if o["status"] != "out_for_delivery":
        raise HTTPException(400, "Pick up the package first")
    if o.get("otp_attempts", 0) >= 5:
        raise HTTPException(429, "Too many wrong OTPs. Contact support.")
    if body.otp != o["delivery_otp"]:
        await db.orders.update_one({"id": oid}, {"$inc": {"otp_attempts": 1}})
        raise HTTPException(400, "Incorrect OTP — ask the customer again")
    if o.get("payment_status") == "cod" and not body.cash_collected:
        raise HTTPException(400, f"Collect ₹{o['bill']['total']} cash before marking delivered")
    res = await db.orders.update_one({"id": oid, "status": "out_for_delivery"}, {"$set": {"status": "delivered", "delivered_at": iso(now())},
                                                                              "$push": {"history": {"status": "delivered", "at": iso(now())}}})
    if not res.modified_count:
        raise HTTPException(400, "Already delivered")
    await db.riders.update_one({"id": o["rider"]["id"], "active_jobs": {"$gt": 0}}, {"$inc": {"active_jobs": -1}})
    await collect_cod(o)
    await notify(o["member_ids"], "Delivered", f"{o['order_no']} was delivered. Enjoy!", "order", oid)
    return await job(oid, user)

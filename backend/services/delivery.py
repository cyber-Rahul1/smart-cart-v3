"""Delivery Service: rider assignment, capacity-based package allocation (split delivery), delivery OTP."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import current_user, db, iso, notify, now

router = APIRouter(prefix="/api/delivery", tags=["delivery"])

FLOW = ["confirmed", "preparing", "ready_for_pickup", "out_for_delivery", "delivered"]
LABELS = {"preparing": "is being prepared", "ready_for_pickup": "is packed and ready for pickup",
          "out_for_delivery": "is out for delivery", "delivered": "was delivered"}


class AdvanceIn(BaseModel):
    otp: Optional[str] = None


def package_weight(order: dict) -> float:
    return round(sum(i.get("weight_kg", 0.5) * i["qty"] for i in order["items"]), 2)


def allocate(orders: list[dict], riders: list[dict]) -> dict:
    """Assign whole flat packages to riders (first-fit decreasing). A flat order is never split across riders."""
    pkgs = sorted(({"order_id": o["id"], "flat": o.get("flat"), "package_id": o.get("package_id"), "weight": package_weight(o)}
                   for o in orders), key=lambda p: -p["weight"])
    manifests = [{"rider": r, "packages": [], "load": 0.0} for r in riders]
    unassigned = []
    for p in pkgs:
        slot = next((m for m in manifests if len(m["packages"]) < m["rider"]["max_packages"]
                     and m["load"] + p["weight"] <= m["rider"]["max_weight_kg"]), None)
        if slot:
            slot["packages"].append(p)
            slot["load"] = round(slot["load"] + p["weight"], 2)
        else:
            unassigned.append(p)
    used = [m for m in manifests if m["packages"]]
    return {"riders_needed": len(used), "split": len(used) > 1, "manifests": used, "unassigned": unassigned,
            "total_packages": len(pkgs), "total_weight": round(sum(p["weight"] for p in pkgs), 2)}


async def assign_rider(order: dict) -> dict:
    rider = await db.riders.find_one({"available": True, "verified": True}, {"_id": 0}, sort=[("active_jobs", 1)])
    if not rider:
        raise HTTPException(409, "No riders available right now")
    await db.riders.update_one({"id": rider["id"]}, {"$inc": {"active_jobs": 1}})
    return {"id": rider["id"], "name": rider["name"], "phone": rider["phone"], "vehicle": rider["vehicle"]}


@router.post("/orders/{oid}/demo-advance")
async def demo_advance(oid: str, body: AdvanceIn, user=Depends(current_user)):
    """DEMO stand-in for seller & rider apps: moves the order one step. Delivery requires the customer's OTP."""
    o = await db.orders.find_one({"id": oid, "member_ids": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if o["status"] not in FLOW or o["status"] == "delivered":
        raise HTTPException(400, "Order cannot be advanced" if o["payment_status"] == "paid" else "Order is not paid yet")
    nxt = FLOW[FLOW.index(o["status"]) + 1]
    update: dict = {"status": nxt}
    if nxt == "out_for_delivery" and not o.get("rider"):
        update["rider"] = await assign_rider(o)
    if nxt == "delivered":
        if not body.otp or body.otp != o["delivery_otp"]:
            raise HTTPException(400, "Incorrect delivery OTP")
        if o.get("rider"):
            await db.riders.update_one({"id": o["rider"]["id"]}, {"$inc": {"active_jobs": -1}})
    await db.orders.update_one({"id": oid}, {"$set": update, "$push": {"history": {"status": nxt, "at": iso(now())}}})
    await notify(o["member_ids"], "Order update", f"{o['order_no']} {LABELS[nxt]}", "order", oid)
    return await db.orders.find_one({"id": oid}, {"_id": 0, "delivery_otp": 0})

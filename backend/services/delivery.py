"""Delivery Service: rider assignment, weight + item-count package allocation (split delivery), live tracking, delivery OTP."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import FULFILLABLE, current_user, db, iso, notify, now
from services.geo import eta_minutes, haversine_km
from services.payments import collect_cod

router = APIRouter(prefix="/api/delivery", tags=["delivery"])

FLOW = ["confirmed", "preparing", "ready_for_pickup", "out_for_delivery", "delivered"]
LABELS = {"preparing": "is being prepared", "ready_for_pickup": "is packed and ready for pickup",
          "out_for_delivery": "is out for delivery", "delivered": "was delivered"}
# Fallback carrying limits when a rider record predates item limits.
STANDARD_CAP = {"packages": 4, "weight": 12.0, "items": 25}


class AdvanceIn(BaseModel):
    otp: Optional[str] = None


def package_weight(order: dict) -> float:
    return round(sum(i.get("weight_kg", 0.5) * i["qty"] for i in order["items"]), 2)


def item_count(order: dict) -> int:
    return sum(i["qty"] for i in order["items"])


def capacity(rider: dict) -> dict:
    return {"packages": rider.get("max_packages", STANDARD_CAP["packages"]), "weight": rider.get("max_weight_kg", STANDARD_CAP["weight"]),
            "items": rider.get("max_items", STANDARD_CAP["items"])}


def fits(load: dict, pkg: dict, cap: dict) -> bool:
    return (load["packages"] + 1 <= cap["packages"] and load["weight"] + pkg["weight"] <= cap["weight"]
            and load["items"] + pkg["items"] <= cap["items"])


def _packages(orders: list[dict]) -> list[dict]:
    # Heaviest first, then bulkiest; flats sorted so neighbours tend to land on the same run.
    pkgs = [{"order_id": o["id"], "flat": o.get("flat"), "package_id": o.get("package_id"), "weight": package_weight(o),
             "items": item_count(o), "fee": o["bill"].get("delivery_cost", 0)} for o in orders]
    return sorted(pkgs, key=lambda p: (-p["weight"], -p["items"], p["flat"] or ""))


def _add(run: dict, p: dict):
    run["packages"].append(p)
    run["weight"] = round(run["weight"] + p["weight"], 2)
    run["items"] += p["items"]


def plan_runs(orders: list[dict], cap: dict) -> list[dict]:
    """Split packages into rider runs that each respect weight, item and package limits (first-fit decreasing).
    A flat's package is never split; a package bigger than one run's limits gets its own run, flagged oversize."""
    runs: list[dict] = []
    for p in _packages(orders):
        run = next((r for r in runs if fits({"packages": len(r["packages"]), "weight": r["weight"], "items": r["items"]}, p, cap)), None)
        if not run:
            run = {"packages": [], "weight": 0.0, "items": 0, "oversize": False}
            runs.append(run)
        _add(run, p)
        run["oversize"] = run["oversize"] or p["weight"] > cap["weight"] or p["items"] > cap["items"]
    for n, r in enumerate(runs, 1):
        r["run_no"] = n
        r["fee"] = round(sum(p["fee"] for p in r["packages"]), 2)
        r["packages"].sort(key=lambda p: p["flat"] or "")
    return runs


def allocate(orders: list[dict], riders: list[dict]) -> dict:
    """Assign whole flat packages to available riders by weight and item count; leftovers are grouped into
    standard-size runs that wait for the next free rider."""
    manifests = [{"rider": r, "cap": capacity(r), "packages": [], "load": 0.0, "items": 0} for r in riders]
    unassigned = []
    pkgs = _packages(orders)
    for p in pkgs:
        slot = next((m for m in manifests if fits({"packages": len(m["packages"]), "weight": m["load"], "items": m["items"]}, p, m["cap"])), None)
        if slot:
            slot["packages"].append(p)
            slot["load"] = round(slot["load"] + p["weight"], 2)
            slot["items"] += p["items"]
        else:
            unassigned.append(p)
    used = [m for m in manifests if m["packages"]]
    for m in used:
        m.pop("cap")
    waiting = plan_runs([o for o in orders if o["id"] in {p["order_id"] for p in unassigned}], STANDARD_CAP) if unassigned else []
    return {"riders_needed": len(used) + len(waiting), "split": len(used) + len(waiting) > 1, "manifests": used, "unassigned": unassigned,
            "waiting_runs": waiting, "total_packages": len(pkgs), "total_weight": round(sum(p["weight"] for p in pkgs), 2),
            "total_items": sum(p["items"] for p in pkgs)}


async def assign_rider(order: dict) -> dict:
    rider = await db.riders.find_one({"available": True, "verified": True, "user_id": {"$exists": False}}, {"_id": 0}, sort=[("active_jobs", 1)])
    if not rider:
        raise HTTPException(409, "No riders available right now")
    await db.riders.update_one({"id": rider["id"]}, {"$inc": {"active_jobs": 1}})
    return {"id": rider["id"], "name": rider["name"], "phone": rider["phone"], "vehicle": rider["vehicle"]}


def drop_point(o: dict, community: dict | None) -> Optional[dict]:
    a = o.get("address") or {}
    if o.get("drop_lat") is not None:
        return {"lat": o["drop_lat"], "lng": o["drop_lng"]}
    if community and community.get("lat") is not None:
        return {"lat": community["lat"], "lng": community["lng"]}
    if a.get("lat") is not None:
        return {"lat": a["lat"], "lng": a["lng"]}
    return None


async def order_points(o: dict) -> tuple[Optional[dict], Optional[dict]]:
    shop = await db.sellers.find_one({"id": o["seller_id"]}, {"_id": 0, "location": 1})
    coords = ((shop or {}).get("location") or {}).get("coordinates")
    pickup = {"lat": coords[1], "lng": coords[0]} if coords else None
    community = None
    if o["kind"] == "community_flat":
        b = await db.baskets.find_one({"id": o.get("ref_id")}, {"_id": 0, "community_id": 1})
        community = await db.communities.find_one({"id": (b or {}).get("community_id")}, {"_id": 0, "lat": 1, "lng": 1}) if b else None
    return pickup, drop_point(o, community)


@router.get("/orders/{oid}/track")
async def track(oid: str, user=Depends(current_user)):
    """Customer live view: shop, home and (once a rider is assigned) the rider's latest GPS fix with an ETA."""
    o = await db.orders.find_one({"id": oid, "member_ids": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    pickup, drop = await order_points(o)
    out = {"status": o["status"], "pickup": pickup, "drop": drop, "rider": None, "distance_km": None, "eta_min": None, "live": False}
    r = o.get("rider") or {}
    if r and o["status"] in ("ready_for_pickup", "out_for_delivery"):
        doc = await db.riders.find_one({"id": r["id"]}, {"_id": 0, "location": 1})
        loc = (doc or {}).get("location")
        out["rider"] = {"name": r["name"], "vehicle": r["vehicle"], "location": loc}
        if loc and drop:
            target = drop if o["status"] == "out_for_delivery" else pickup
            km = haversine_km((loc["lat"], loc["lng"]), (target["lat"], target["lng"]))
            if o["status"] == "ready_for_pickup" and pickup:
                km += haversine_km((pickup["lat"], pickup["lng"]), (drop["lat"], drop["lng"]))
            out.update(distance_km=round(km, 2), eta_min=eta_minutes(km), live=True)
    return out


@router.post("/orders/{oid}/demo-advance")
async def demo_advance(oid: str, body: AdvanceIn, user=Depends(current_user)):
    """DEMO stand-in for seller & rider apps: moves the order one step. Delivery requires the customer's OTP."""
    o = await db.orders.find_one({"id": oid, "member_ids": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if o["status"] not in FLOW or o["status"] == "delivered":
        raise HTTPException(400, "Order cannot be advanced" if o["payment_status"] in FULFILLABLE else "Order is not paid yet")
    nxt = FLOW[FLOW.index(o["status"]) + 1]
    if (o.get("rider") or {}).get("user_id"):
        raise HTTPException(400, "Your delivery partner will update this order")
    shop = await db.sellers.find_one({"id": o["seller_id"]}, {"_id": 0, "owner_id": 1})
    if shop and shop.get("owner_id") and o["status"] in ("confirmed", "preparing"):
        raise HTTPException(400, "Waiting for the shop to accept and pack this order")
    update: dict = {"status": nxt}
    if nxt == "out_for_delivery" and not o.get("rider"):
        update["rider"] = await assign_rider(o)
    if nxt == "delivered":
        if not body.otp or body.otp != o["delivery_otp"]:
            raise HTTPException(400, "Incorrect delivery OTP")
        if o.get("rider"):
            await db.riders.update_one({"id": o["rider"]["id"]}, {"$inc": {"active_jobs": -1}})
    await db.orders.update_one({"id": oid}, {"$set": update, "$push": {"history": {"status": nxt, "at": iso(now())}}})
    if nxt == "delivered":
        await collect_cod(o)
    await notify(o["member_ids"], "Order update", f"{o['order_no']} {LABELS[nxt]}", "order", oid)
    return await db.orders.find_one({"id": oid}, {"_id": 0, "delivery_otp": 0})

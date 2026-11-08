"""Iteration 5: COD payments, online demo, geo proxy, rider live location + customer tracking, community run splitting."""
import os
import random

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"
_env = dotenv_values("C:/Users/Rahul/Desktop/smart_cart_v3/backend/.env")
mongo_url = os.environ.get("MONGO_URL") or _env.get("MONGO_URL", "mongodb://127.0.0.1:27018")
db_name = os.environ.get("DB_NAME") or _env.get("DB_NAME", "smartcart_prod")
mdb = MongoClient(mongo_url)[db_name]
SFX = str(random.randint(100000, 999999))


def login(phone, role, name=None):
    r = requests.post(f"{BASE}/auth/otp/request", json={"phone": phone, "role": role})
    assert r.status_code == 200, r.text
    v = requests.post(f"{BASE}/auth/otp/verify", json={"phone": phone, "code": r.json()["dev_code"], "role": role}).json()
    h = {"Authorization": f"Bearer {v['access_token']}"}
    if name:
        requests.put(f"{BASE}/profile", json={"name": name}, headers=h)
    return h


@pytest.fixture(scope="module")
def ctx():
    ah = login("+919999900000", "admin")
    sh = login(f"+9172{SFX}1", "seller")
    shop = requests.post(f"{BASE}/seller/onboarding", headers=sh, json={
        "business_name": f"TEST_CodShop{SFX}", "owner_name": "Ravi", "category": "food", "business_type": "cloud_kitchen",
        "cuisine": "Rolls", "address": "Koramangala 6th block", "prep_time_min": 15, "min_order": 0,
        "fssai_number": "12345678901234", "image_key": "rolls"}).json()
    requests.post(f"{BASE}/seller/shop/demo-approve", headers=sh)
    mk = lambda name, price, w, stock=500: requests.post(f"{BASE}/seller/products", headers=sh, json={
        "name": name, "price": price, "category": "rolls", "stock": stock, "weight_kg": w}).json()
    p = mk("TEST_Roll", 150, 2)
    light = mk("TEST_Candy", 20, 0.1)
    pricey = mk("TEST_Hamper", 3500, 1)
    ch = login(f"+9173{SFX}1", "customer", "TEST_Buyer")
    a = requests.post(f"{BASE}/addresses", headers=ch, json={"label": "Home", "line": "TEST_ Flat 3, Koramangala", "lat": 12.935, "lng": 77.624}).json()
    rh = login(f"+9174{SFX}1", "rider")
    rd = requests.post(f"{BASE}/rider/onboarding", headers=rh, json={"name": "TEST_Bike Rider", "vehicle": "bike", "licence_number": "KA01202300"}).json()
    requests.post(f"{BASE}/admin/riders/{rd['id']}/review", headers=ah, json={"decision": "approve"})
    assert requests.put(f"{BASE}/rider/availability", headers=rh, json={"available": True}).status_code == 200
    yield {"ah": ah, "sh": sh, "shop": shop, "p": p, "light": light, "pricey": pricey, "ch": ch, "addr": a, "rh": rh, "rider": rd}
    requests.put(f"{BASE}/rider/availability", headers=rh, json={"available": False})
    requests.put(f"{BASE}/seller/shop", headers=sh, json={"open": False})


def place(ctx, pid, qty=1):
    ch = ctx["ch"]
    requests.delete(f"{BASE}/cart", headers=ch)
    assert requests.post(f"{BASE}/cart/items", headers=ch, json={"product_id": pid, "qty": qty}).status_code == 200
    r = requests.post(f"{BASE}/orders/checkout", headers=ch, json={"address_id": ctx["addr"]["id"]})
    assert r.status_code == 200, r.text
    return r.json()


def stock(pid):
    return mdb.products.find_one({"id": pid})["stock"]


def make_ready(ctx, oid):
    sh = ctx["sh"]
    assert requests.post(f"{BASE}/seller/orders/{oid}/accept", headers=sh).status_code == 200
    requests.post(f"{BASE}/seller/orders/{oid}/pack", headers=sh, json={"index": 0, "checked": True})
    r = requests.post(f"{BASE}/seller/orders/{oid}/ready", headers=sh)
    assert r.json()["status"] == "ready_for_pickup", r.text


# Payment methods
def test_methods(ctx):
    m = requests.get(f"{BASE}/payments/methods", headers=ctx["ch"]).json()
    assert m["online"] is True and m["cod"] is True and m["cod_limit"] == 3000


# COD confirm + idempotency + limits + ownership
def test_cod_confirm(ctx):
    o = place(ctx, ctx["p"]["id"], 2)
    before = stock(ctx["p"]["id"])
    other = login(f"+9175{SFX}1", "customer", "TEST_Other")
    assert requests.post(f"{BASE}/payments/cod", headers=other, json={"order_id": o["id"]}).status_code == 404
    r = requests.post(f"{BASE}/payments/cod", headers=ctx["ch"], json={"order_id": o["id"]})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "confirmed" and d["payment_status"] == "cod" and d["payment_method"] == "cod"
    assert "delivery_otp" not in d
    assert stock(ctx["p"]["id"]) == before - 2
    assert requests.post(f"{BASE}/payments/cod", headers=ctx["ch"], json={"order_id": o["id"]}).status_code == 400
    # online initiate on COD-confirmed order -> 400
    assert requests.post(f"{BASE}/payments/initiate", headers=ctx["ch"], json={"order_id": o["id"]}).status_code == 400
    notes = requests.get(f"{BASE}/notifications", headers=ctx["sh"]).json()
    notes = notes.get("items", notes) if isinstance(notes, dict) else notes
    assert any(o["order_no"] in (n.get("body") or "") for n in notes), "seller not notified"
    ctx["cod_order"] = o


def test_cod_limit(ctx):
    o = place(ctx, ctx["pricey"]["id"], 1)
    r = requests.post(f"{BASE}/payments/cod", headers=ctx["ch"], json={"order_id": o["id"]})
    assert r.status_code == 400 and "3000" in r.text
    requests.post(f"{BASE}/orders/{o['id']}/cancel", headers=ctx["ch"])


# COD cancel -> void, no refund, stock restored
def test_cod_cancel(ctx):
    o = place(ctx, ctx["p"]["id"], 3)
    before = stock(ctx["p"]["id"])
    requests.post(f"{BASE}/payments/cod", headers=ctx["ch"], json={"order_id": o["id"]})
    assert stock(ctx["p"]["id"]) == before - 3
    c = requests.post(f"{BASE}/orders/{o['id']}/cancel", headers=ctx["ch"])
    assert c.status_code == 200, c.text
    assert c.json()["status"] == "cancelled" and c.json()["payment_status"] == "void"
    assert mdb.refunds.count_documents({"order_id": o["id"]}) == 0
    assert stock(ctx["p"]["id"]) == before


# Online demo still works
def test_online_demo(ctx):
    o = place(ctx, ctx["p"]["id"], 1)
    pay = requests.post(f"{BASE}/payments/initiate", headers=ctx["ch"], json={"order_id": o["id"]}).json()
    f = requests.post(f"{BASE}/payments/{pay['id']}/demo-complete", headers=ctx["ch"], json={"outcome": "failure"})
    assert f.status_code == 402
    pay = requests.post(f"{BASE}/payments/initiate", headers=ctx["ch"], json={"order_id": o["id"]}).json()
    s = requests.post(f"{BASE}/payments/{pay['id']}/demo-complete", headers=ctx["ch"], json={"outcome": "success"})
    assert s.status_code == 200, s.text
    od = requests.get(f"{BASE}/orders/{o['id']}", headers=ctx["ch"]).json()
    assert od["status"] == "confirmed" and od["payment_status"] == "paid" and od.get("payment_method") == "online"
    requests.post(f"{BASE}/orders/{o['id']}/cancel", headers=ctx["ch"])


# Geo proxy
def test_geo(ctx):
    assert requests.get(f"{BASE}/geo/reverse?lat=12.9352&lng=77.6245").status_code in (401, 403)
    r = requests.get(f"{BASE}/geo/reverse?lat=12.9352&lng=77.6245", headers=ctx["ch"])
    assert r.status_code == 200, r.text
    assert r.json()["line"], r.json()
    s = requests.get(f"{BASE}/geo/search?q=koramangala", headers=ctx["ch"])
    assert s.status_code == 200, s.text
    assert len(s.json()) >= 1 and {"lat", "lng", "name", "line"} <= set(s.json()[0])
    assert requests.get(f"{BASE}/geo/search?q=ko", headers=ctx["ch"]).status_code == 422


# Rider location auth + COD end-to-end with tracking
def test_rider_location_rider_only(ctx):
    assert requests.put(f"{BASE}/rider/location", headers=ctx["ch"], json={"lat": 12.9, "lng": 77.6}).status_code == 403
    assert requests.put(f"{BASE}/rider/location", headers=ctx["rh"], json={"lat": 120, "lng": 77.6}).status_code == 422


def test_cod_delivery_flow_with_tracking(ctx):
    o = ctx["cod_order"]
    ch, rh = ctx["ch"], ctx["rh"]
    t0 = requests.get(f"{BASE}/delivery/orders/{o['id']}/track", headers=ch).json()
    assert t0["live"] is False and t0["drop"] is not None
    make_ready(ctx, o["id"])
    jobs = requests.get(f"{BASE}/rider/jobs", headers=rh).json()
    job = next(j for j in jobs["singles"] if j["id"] == o["id"])
    assert job["collect_cash"] == o["bill"]["total"]
    c = requests.post(f"{BASE}/rider/claim", headers=rh, json={"order_ids": [o["id"]]})
    assert c.status_code == 200 and o["id"] in c.json()["claimed"], c.text
    assert requests.put(f"{BASE}/rider/location", headers=rh, json={"lat": 12.93, "lng": 77.62}).json()["ok"]
    t = requests.get(f"{BASE}/delivery/orders/{o['id']}/track", headers=ch).json()
    assert t["live"] is True and t["rider"]["location"]["lat"] == 12.93 and t["eta_min"] >= 1 and t["distance_km"] is not None, t
    other = login(f"+9175{SFX}1", "customer")
    assert requests.get(f"{BASE}/delivery/orders/{o['id']}/track", headers=other).status_code == 404
    assert requests.post(f"{BASE}/rider/orders/{o['id']}/pickup", headers=rh).json()["status"] == "out_for_delivery"
    otp = requests.get(f"{BASE}/orders/{o['id']}", headers=ch).json()["delivery_otp"]
    r = requests.post(f"{BASE}/rider/orders/{o['id']}/deliver", headers=rh, json={"otp": otp, "cash_collected": False})
    assert r.status_code == 400 and "cash" in r.text.lower()
    r = requests.post(f"{BASE}/rider/orders/{o['id']}/deliver", headers=rh, json={"otp": otp, "cash_collected": True})
    assert r.status_code == 200 and r.json()["status"] == "delivered", r.text
    od = requests.get(f"{BASE}/orders/{o['id']}", headers=ch).json()
    assert od["payment_status"] == "paid"


# Community batch split into runs by item count
def test_community_runs_item_limit(ctx):
    sh = ctx["sh"]
    hs = [login(f"+9176{i}{SFX}", "customer", f"TEST_Flat{i}") for i in range(2)]
    cm = requests.post(f"{BASE}/communities", headers=hs[0], json={"name": f"TEST_RunComm{SFX}", "address": "80ft Road Koramangala",
                       "flats": "R1,R2", "my_flat": "R1"}).json()
    requests.post(f"{BASE}/communities/join", headers=hs[1], json={"code": cm["invite_code"], "flat": "R2"})
    b = requests.post(f"{BASE}/communities/{cm['id']}/baskets", headers=hs[0], json={"seller_id": ctx["shop"]["id"], "title": "TEST_Runs", "closes_in_min": 60}).json()
    for h in hs:  # 15 items x 0.1kg each -> 1.5kg, 15 items; 2 flats = 30 items > bike limit 25
        assert requests.post(f"{BASE}/community-baskets/{b['id']}/items", headers=h, json={"product_id": ctx["light"]["id"], "qty": 15}).status_code == 200
    assert requests.post(f"{BASE}/community-baskets/{b['id']}/close", headers=hs[0]).json()["orders_created"] == 2
    ids = []
    for h in hs:
        mine = [o for o in requests.get(f"{BASE}/orders", headers=h).json() if o.get("ref_id") == b["id"]][0]
        assert requests.post(f"{BASE}/payments/cod", headers=h, json={"order_id": mine["id"]}).status_code == 200
        ids.append(mine["id"])
    plan = requests.get(f"{BASE}/community-baskets/{b['id']}/delivery-plan", headers=hs[0])
    assert plan.status_code == 200, plan.text
    plan = plan.json()
    assert "waiting_runs" in plan and plan["total_items"] == 30
    for oid in ids:
        make_ready(ctx, oid)
    jobs = requests.get(f"{BASE}/rider/jobs", headers=ctx["rh"]).json()
    assert jobs["capacity"] == {"packages": 4, "weight": 12, "items": 25}
    bt = next(x for x in jobs["batches"] if x["basket_id"] == b["id"])
    assert bt["total_items"] == 30 and bt["total_weight"] == 3.0
    assert len(bt["runs"]) == 2 and all(r["items"] == 15 for r in bt["runs"]), bt["runs"]
    c = requests.post(f"{BASE}/rider/claim", headers=ctx["rh"], json={"order_ids": ids}).json()
    assert len(c["claimed"]) == 1 and len(c["skipped"]) == 1, c
    ctx["run_ids"] = ids


# Pure planner checks for weight / package limits per vehicle
def test_plan_runs_unit():
    import sys
    sys.path.insert(0, "/app/backend")
    os.environ.setdefault("PAYMENT_WEBHOOK_SECRET", _env.get("PAYMENT_WEBHOOK_SECRET", "x"))
    for k, v in _env.items():
        os.environ.setdefault(k, v)
    from services.delivery import plan_runs
    mk = lambda i, w, q: {"id": f"o{i}", "flat": f"F{i}", "items": [{"weight_kg": w, "qty": q}], "bill": {"delivery_cost": 10}}
    cycle = {"packages": 2, "weight": 5, "items": 10}
    runs = plan_runs([mk(i, 1, 2) for i in range(5)], cycle)  # 2kg/2 items each -> 2 per run
    assert len(runs) == 3 and all(len(r["packages"]) <= 2 and r["weight"] <= 5 for r in runs)
    scooter = {"packages": 5, "weight": 15, "items": 30}
    runs = plan_runs([mk(i, 4, 1) for i in range(6)], scooter)  # 4kg each -> 3 per run
    assert len(runs) == 2 and all(r["weight"] <= 15 for r in runs)
    runs = plan_runs([mk(0, 1, 40)], scooter)
    assert runs[0]["oversize"] is True

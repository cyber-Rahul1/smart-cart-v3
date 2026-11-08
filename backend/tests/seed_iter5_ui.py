"""Iteration 5 UI seed: seller+shop+products, customer w/ address + cart, verified rider online, community batch split in runs.
Writes /tmp/iter5_seed.json. All data TEST_ prefixed."""
import json
import os
import random

import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"
SFX = str(random.randint(100000, 999999))


def login(phone, role, name=None):
    r = requests.post(f"{BASE}/auth/otp/request", json={"phone": phone, "role": role})
    assert r.status_code == 200, r.text
    v = requests.post(f"{BASE}/auth/otp/verify", json={"phone": phone, "code": r.json()["dev_code"], "role": role}).json()
    h = {"Authorization": f"Bearer {v['access_token']}"}
    if name:
        requests.put(f"{BASE}/profile", json={"name": name}, headers=h)
    return h


def make_ready(sh, oid):
    assert requests.post(f"{BASE}/seller/orders/{oid}/accept", headers=sh).status_code == 200
    requests.post(f"{BASE}/seller/orders/{oid}/pack", headers=sh, json={"index": 0, "checked": True})
    r = requests.post(f"{BASE}/seller/orders/{oid}/ready", headers=sh)
    assert r.json()["status"] == "ready_for_pickup", r.text


ah = login("+919999900000", "admin")
seller_phone = f"+9182{SFX}12"
sh = login(seller_phone, "seller")
shop = requests.post(f"{BASE}/seller/onboarding", headers=sh, json={
    "business_name": f"TEST_UIShop{SFX}", "owner_name": "Ravi", "category": "food", "business_type": "cloud_kitchen",
    "cuisine": "Rolls", "address": "Koramangala 6th block", "prep_time_min": 15, "min_order": 0,
    "fssai_number": "12345678901234", "image_key": "rolls"}).json()
requests.post(f"{BASE}/seller/shop/demo-approve", headers=sh)
mk = lambda name, price, w: requests.post(f"{BASE}/seller/products", headers=sh, json={
    "name": name, "price": price, "category": "rolls", "stock": 500, "weight_kg": w}).json()
roll = mk("TEST_Roll", 150, 0.5)
candy = mk("TEST_Candy", 20, 0.1)

cust_phone = f"+9183{SFX}12"
ch = login(cust_phone, "customer", "TEST_UIBuyer")
addr = requests.post(f"{BASE}/addresses", headers=ch, json={"label": "Home", "line": "TEST_ Flat 3, Koramangala", "lat": 12.935, "lng": 77.624}).json()
requests.delete(f"{BASE}/cart", headers=ch)
assert requests.post(f"{BASE}/cart/items", headers=ch, json={"product_id": roll["id"], "qty": 2}).status_code == 200

rider_phone = f"+9184{SFX}12"
rh = login(rider_phone, "rider")
rd = requests.post(f"{BASE}/rider/onboarding", headers=rh, json={"name": "TEST_UIRider", "vehicle": "bike", "licence_number": "KA01202300"}).json()
requests.post(f"{BASE}/admin/riders/{rd['id']}/review", headers=ah, json={"decision": "approve"})
assert requests.put(f"{BASE}/rider/availability", headers=rh, json={"available": True}).status_code == 200

# community batch: 2 flats x 15 items = 30 > bike 25 items -> 2 runs
hs = [login(f"+9185{i}{SFX}2", "customer", f"TEST_UIFlat{i}") for i in range(2)]
cm = requests.post(f"{BASE}/communities", headers=hs[0], json={"name": f"TEST_UIComm{SFX}", "address": "80ft Road Koramangala",
                   "flats": "R1,R2", "my_flat": "R1"}).json()
requests.post(f"{BASE}/communities/join", headers=hs[1], json={"code": cm["invite_code"], "flat": "R2"})
b = requests.post(f"{BASE}/communities/{cm['id']}/baskets", headers=hs[0], json={"seller_id": shop["id"], "title": "TEST_UIRuns", "closes_in_min": 60}).json()
for h in hs:
    assert requests.post(f"{BASE}/community-baskets/{b['id']}/items", headers=h, json={"product_id": candy["id"], "qty": 15}).status_code == 200
requests.post(f"{BASE}/community-baskets/{b['id']}/close", headers=hs[0])
ids = []
for h in hs:
    mine = [o for o in requests.get(f"{BASE}/orders", headers=h).json() if o.get("ref_id") == b["id"]][0]
    assert requests.post(f"{BASE}/payments/cod", headers=h, json={"order_id": mine["id"]}).status_code == 200
    ids.append(mine["id"])
for oid in ids:
    make_ready(sh, oid)
jobs = requests.get(f"{BASE}/rider/jobs", headers=rh).json()
bt = next(x for x in jobs["batches"] if x["basket_id"] == b["id"])
print("runs", [(r["run_no"], r["items"]) for r in bt["runs"]])

out = {"seller_phone": seller_phone, "sh": sh, "cust_phone": cust_phone, "ch": ch, "addr": addr, "rider_phone": rider_phone, "rh": rh,
       "rider": rd, "shop": shop, "roll": roll, "basket_id": b["id"], "community_order_ids": ids, "runs": [r["run_no"] for r in bt["runs"]]}
json.dump(out, open("/tmp/iter5_seed.json", "w"))
print(json.dumps({k: out[k] for k in ["cust_phone", "rider_phone", "basket_id", "runs"]}))

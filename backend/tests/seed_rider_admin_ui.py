"""Seed TEST_ data for rider/admin/seller UI tests: one approved shop w/ photo product + ready_for_pickup order, one pending shop. Writes /tmp/ui_seed.json"""
import json
import os
import random

import requests

BASE = os.environ["API"]
PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082")


def login(phone, role, name=None):
    r = requests.post(f"{BASE}/auth/otp/request", json={"phone": phone, "role": role})
    v = requests.post(f"{BASE}/auth/otp/verify", json={"phone": phone, "code": r.json()["dev_code"], "role": role}).json()
    h = {"Authorization": f"Bearer {v['access_token']}"}
    if name:
        requests.put(f"{BASE}/profile", json={"name": name}, headers=h)
    return h


def shop(h, name):
    return requests.post(f"{BASE}/seller/onboarding", headers=h, json={"business_name": name, "owner_name": "Ravi", "category": "food",
                         "business_type": "cloud_kitchen", "cuisine": "Rolls", "address": "Koramangala 6th block", "prep_time_min": 15, "min_order": 0,
                         "fssai_number": "12345678901234", "image_key": "rolls"}).json()


sfx = str(random.randint(1000000, 9999999))
ah = login("+919999900000", "admin")
sh = login(f"+9182{sfx}1", "seller")
s1 = shop(sh, f"TEST_UI Kitchen {sfx}")
requests.post(f"{BASE}/admin/sellers/{s1['id']}/review", headers=ah, json={"decision": "approve"})
url = requests.post(f"{BASE}/seller/upload", headers=sh, files={"file": ("a.png", PNG, "image/png")}).json()["url"]
p = requests.post(f"{BASE}/seller/products", headers=sh, json={"name": f"TEST_Photo Roll {sfx}", "price": 150, "category": "rolls", "stock": 30,
                  "image_url": url, "weight_kg": 1}).json()
ch = login(f"+9183{sfx}1", "customer", "TEST_Buyer")
a = requests.post(f"{BASE}/addresses", headers=ch, json={"label": "Home", "line": "Flat 3, Koramangala"}).json()
requests.delete(f"{BASE}/cart", headers=ch)
requests.post(f"{BASE}/cart/items", headers=ch, json={"product_id": p["id"], "qty": 1})
o = requests.post(f"{BASE}/orders/checkout", headers=ch, json={"address_id": a["id"]}).json()
pay = requests.post(f"{BASE}/payments/initiate", headers=ch, json={"order_id": o["id"]}).json()
requests.post(f"{BASE}/payments/{pay['id']}/demo-complete", headers=ch, json={"outcome": "success"})
requests.post(f"{BASE}/seller/orders/{o['id']}/accept", headers=sh)
requests.post(f"{BASE}/seller/orders/{o['id']}/pack", headers=sh, json={"index": 0, "checked": True})
st = requests.post(f"{BASE}/seller/orders/{o['id']}/ready", headers=sh).json()["status"]
otp = requests.get(f"{BASE}/orders/{o['id']}", headers=ch).json().get("delivery_otp")
sh2 = login(f"+9184{sfx}1", "seller")
s2 = shop(sh2, f"TEST_UI Pending {sfx}")
sh3 = login(f"+9185{sfx}1", "seller")
s3 = shop(sh3, f"TEST_UI Reject {sfx}")
out = {"sfx": sfx, "shop1": s1["id"], "product": p["id"], "img": url, "order": o["id"], "order_status": st, "otp": otp,
       "seller_phone": f"82{sfx}1", "customer_phone": f"83{sfx}1", "pending_shop": s2["id"], "reject_shop": s3["id"],
       "pending_seller_phone": f"84{sfx}1", "rider_phone": f"86{sfx}1"}
json.dump(out, open("/tmp/ui_seed.json", "w"))
print(out)

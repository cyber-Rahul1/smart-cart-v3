"""Rider + admin + photo flow (self-contained)."""
import os
import random

import requests

BASE = os.environ["API"]
PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082")


def login(phone, role, name=None):
    r = requests.post(f"{BASE}/auth/otp/request", json={"phone": phone, "role": role})
    assert r.status_code == 200, r.text
    v = requests.post(f"{BASE}/auth/otp/verify", json={"phone": phone, "code": r.json()["dev_code"], "role": role}).json()
    h = {"Authorization": f"Bearer {v['access_token']}"}
    if name:
        requests.put(f"{BASE}/profile", json={"name": name}, headers=h)
    return h


def test_rider_admin_flow():
    sfx = str(random.randint(1000000, 9999999))
    assert requests.post(f"{BASE}/auth/otp/request", json={"phone": f"+9191{sfx}1", "role": "admin"}).status_code == 403
    ah = login("+919999900000", "admin")
    sh = login(f"+9192{sfx}1", "seller")
    assert requests.get(f"{BASE}/admin/overview", headers=sh).status_code == 403
    shop = requests.post(f"{BASE}/seller/onboarding", headers=sh, json={"business_name": "Rider Test Kitchen", "owner_name": "Ravi", "category": "food",
                         "business_type": "cloud_kitchen", "cuisine": "Rolls", "address": "Koramangala 6th block", "prep_time_min": 15, "min_order": 0,
                         "fssai_number": "12345678901234", "image_key": "rolls"}).json()
    assert requests.post(f"{BASE}/admin/sellers/{shop['id']}/review", headers=ah, json={"decision": "reject"}).status_code == 422
    rv = requests.post(f"{BASE}/admin/sellers/{shop['id']}/review", headers=ah, json={"decision": "approve"}).json()
    assert rv["approved"] and rv["fssai_status"] == "verified"
    up = requests.post(f"{BASE}/seller/upload", headers=sh, files={"file": ("a.png", PNG, "image/png")})
    assert up.status_code == 200, up.text
    assert requests.post(f"{BASE}/seller/upload", headers=sh, files={"file": ("a.png", b"notanimage", "image/png")}).status_code == 400
    url = up.json()["url"]
    p = requests.post(f"{BASE}/seller/products", headers=sh, json={"name": "Photo Roll", "price": 150, "category": "rolls", "stock": 30, "image_url": url,
                      "weight_kg": 2}).json()
    assert p["image"] == url
    assert requests.get(BASE[:-4] + url).status_code == 200
    # customer orders 3 times
    ch = login(f"+9193{sfx}1", "customer", "Buyer")
    a = requests.post(f"{BASE}/addresses", headers=ch, json={"label": "Home", "line": "Flat 3, Koramangala"}).json()
    ids = []
    for _ in range(3):
        requests.delete(f"{BASE}/cart", headers=ch)
        requests.post(f"{BASE}/cart/items", headers=ch, json={"product_id": p["id"], "qty": 1})
        o = requests.post(f"{BASE}/orders/checkout", headers=ch, json={"address_id": a["id"]}).json()
        pay = requests.post(f"{BASE}/payments/initiate", headers=ch, json={"order_id": o["id"]}).json()
        requests.post(f"{BASE}/payments/{pay['id']}/demo-complete", headers=ch, json={"outcome": "success"})
        requests.post(f"{BASE}/seller/orders/{o['id']}/accept", headers=sh)
        requests.post(f"{BASE}/seller/orders/{o['id']}/pack", headers=sh, json={"index": 0, "checked": True})
        assert requests.post(f"{BASE}/seller/orders/{o['id']}/ready", headers=sh).json()["status"] == "ready_for_pickup"
        ids.append(o["id"])
    rh = login(f"+9194{sfx}1", "rider")
    rd = requests.post(f"{BASE}/rider/onboarding", headers=rh, json={"name": "Cycle Rider", "vehicle": "cycle", "licence_number": "KA01202300"}).json()
    assert requests.put(f"{BASE}/rider/availability", headers=rh, json={"available": True}).status_code == 403
    requests.post(f"{BASE}/admin/riders/{rd['id']}/review", headers=ah, json={"decision": "approve"})
    requests.put(f"{BASE}/rider/availability", headers=rh, json={"available": True})
    c = requests.post(f"{BASE}/rider/claim", headers=rh, json={"order_ids": ids}).json()
    assert len(c["claimed"]) == 2 and len(c["skipped"]) == 1, c  # cycle: 2 pkgs / 5kg
    oid = c["claimed"][0]
    assert requests.post(f"{BASE}/delivery/orders/{oid}/demo-advance", headers=ch, json={}).status_code == 400
    assert requests.post(f"{BASE}/rider/orders/{oid}/deliver", headers=rh, json={"otp": "0000"}).status_code == 400  # not picked up
    assert requests.post(f"{BASE}/rider/orders/{oid}/pickup", headers=rh).json()["status"] == "out_for_delivery"
    otp = requests.get(f"{BASE}/orders/{oid}", headers=ch).json()["delivery_otp"]
    wrong = "0000" if otp != "0000" else "1111"
    assert requests.post(f"{BASE}/rider/orders/{oid}/deliver", headers=rh, json={"otp": wrong}).status_code == 400
    assert requests.post(f"{BASE}/rider/orders/{oid}/deliver", headers=rh, json={"otp": otp}).json()["status"] == "delivered"
    assert requests.post(f"{BASE}/rider/orders/{oid}/deliver", headers=rh, json={"otp": otp}).status_code == 400
    assert requests.get(f"{BASE}/rider/history", headers=rh).json()["count"] == 1
    # fees config
    cfg = requests.get(f"{BASE}/admin/config", headers=ah).json()
    body = {k: cfg[k] for k in ("delivery_base", "delivery_per_km", "free_delivery_threshold", "convenience_fee", "commission_pct", "community_delivery_discount")}
    new = requests.put(f"{BASE}/admin/config", headers=ah, json=body | {"convenience_fee": 7, "seller_auto_approve": False}).json()
    assert new["convenience_fee"] == 7
    requests.put(f"{BASE}/admin/config", headers=ah, json=body | {"seller_auto_approve": False})
    requests.put(f"{BASE}/seller/shop", headers=sh, json={"open": False})  # cleanup: hide test shop
    print("RIDER/ADMIN OK")
    # reject -> resubmit
    sh3 = login(f"+9195{sfx}1", "seller")
    s3 = requests.post(f"{BASE}/seller/onboarding", headers=sh3, json={"business_name": "Resubmit Shop", "owner_name": "Ravi", "category": "grocery",
                       "business_type": "kirana", "cuisine": "Staples", "address": "Koramangala 1st block", "prep_time_min": 15, "min_order": 0, "image_key": "veg"}).json()
    assert requests.post(f"{BASE}/seller/shop/resubmit", headers=sh3).status_code == 400
    requests.post(f"{BASE}/admin/sellers/{s3['id']}/review", headers=ah, json={"decision": "reject", "note": "Address unclear"})
    assert requests.post(f"{BASE}/admin/sellers/{s3['id']}/review", headers=ah, json={"decision": "reject", "note": "again"}).status_code == 400
    assert requests.post(f"{BASE}/seller/shop/resubmit", headers=sh3).json()["approval_status"] == "pending_review"
    requests.post(f"{BASE}/admin/sellers/{s3['id']}/review", headers=ah, json={"decision": "reject", "note": "TEST_cleanup"})
    print("RESUBMIT OK")


if __name__ == "__main__":
    test_rider_admin_flow()

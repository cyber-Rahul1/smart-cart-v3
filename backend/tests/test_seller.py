"""Seller app flow: role-locked login, onboarding, approval gate, catalog, accept/pack/ready, reject refund, community packing."""
import os

import requests

BASE = os.environ["API"]


def login(phone, role, name=None):
    r = requests.post(f"{BASE}/auth/otp/request", json={"phone": phone, "role": role}).json()
    v = requests.post(f"{BASE}/auth/otp/verify", json={"phone": phone, "code": r["dev_code"], "role": role})
    assert v.status_code == 200, v.text
    h = {"Authorization": f"Bearer {v.json()['access_token']}"}
    if name:
        requests.put(f"{BASE}/profile", json={"name": name}, headers=h)
    return h


def test_seller_flow():
    import random
    sfx = str(random.randint(100000, 999999))
    sh = login(f"+91970{sfx}1", "seller")
    # same phone cannot log in as customer
    r = requests.post(f"{BASE}/auth/otp/request", json={"phone": f"+91970{sfx}1", "role": "customer"}).json()
    assert requests.post(f"{BASE}/auth/otp/verify", json={"phone": f"+91970{sfx}1", "code": r["dev_code"], "role": "customer"}).status_code == 409
    # customer cannot hit seller api
    ch = login(f"+91971{sfx}1", "customer", "Buyer")
    assert requests.get(f"{BASE}/seller/me", headers=ch).status_code == 403
    assert requests.get(f"{BASE}/seller/me", headers=sh).json()["shop"] is None
    bad = requests.post(f"{BASE}/seller/onboarding", headers=sh, json={"business_name": "Test Kitchen", "owner_name": "Ravi", "category": "food",
                        "business_type": "cloud_kitchen", "cuisine": "Biryani", "address": "Koramangala 5th block", "prep_time_min": 20, "min_order": 0})
    assert bad.status_code == 422  # FSSAI required
    shop = requests.post(f"{BASE}/seller/onboarding", headers=sh, json={"business_name": "Test Kitchen", "owner_name": "Ravi", "category": "food",
                         "business_type": "cloud_kitchen", "cuisine": "Biryani", "address": "Koramangala 5th block", "prep_time_min": 20,
                         "min_order": 0, "fssai_number": "12345678901234", "image_key": "biryani"}).json()
    assert shop["approved"] is False and shop["fssai_status"] == "submitted"
    p = requests.post(f"{BASE}/seller/products", headers=sh, json={"name": "Test Biryani", "price": 250, "category": "biryani", "stock": 20,
                      "image_key": "biryani"}).json()
    assert requests.get(f"{BASE}/sellers/{shop['id']}").status_code == 404  # hidden while pending
    assert requests.post(f"{BASE}/seller/shop/demo-approve", headers=sh).json()["approved"] is True
    assert requests.get(f"{BASE}/sellers/{shop['id']}").status_code == 200
    # customer orders twice
    a = requests.post(f"{BASE}/addresses", headers=ch, json={"label": "Home", "line": "Flat 1, Koramangala"}).json()
    ids = []
    for _ in range(2):
        requests.delete(f"{BASE}/cart", headers=ch)
        requests.post(f"{BASE}/cart/items", headers=ch, json={"product_id": p["id"], "qty": 1})
        o = requests.post(f"{BASE}/orders/checkout", headers=ch, json={"address_id": a["id"]}).json()
        pay = requests.post(f"{BASE}/payments/initiate", headers=ch, json={"order_id": o["id"]}).json()
        requests.post(f"{BASE}/payments/{pay['id']}/demo-complete", headers=ch, json={"outcome": "success"})
        ids.append(o["id"])
    new = requests.get(f"{BASE}/seller/orders?tab=new", headers=sh).json()
    assert {x["id"] for x in new} == set(ids) and "delivery_otp" not in new[0]
    # customer demo-advance blocked while shop handles it
    assert requests.post(f"{BASE}/delivery/orders/{ids[0]}/demo-advance", headers=ch, json={}).status_code == 400
    assert requests.post(f"{BASE}/seller/orders/{ids[0]}/ready", headers=sh).status_code == 400
    assert requests.post(f"{BASE}/seller/orders/{ids[0]}/accept", headers=sh).json()["status"] == "preparing"
    assert requests.post(f"{BASE}/seller/orders/{ids[0]}/ready", headers=sh).status_code == 400  # not packed
    requests.post(f"{BASE}/seller/orders/{ids[0]}/pack", headers=sh, json={"index": 0, "checked": True})
    assert requests.post(f"{BASE}/seller/orders/{ids[0]}/ready", headers=sh).json()["status"] == "ready_for_pickup"
    rej = requests.post(f"{BASE}/seller/orders/{ids[1]}/reject", headers=sh, json={"reason": "Kitchen too busy"}).json()
    assert rej["status"] == "cancelled"
    assert requests.get(f"{BASE}/orders/{ids[1]}", headers=ch).json()["payment_status"] == "refunded"
    # other seller cannot see this order
    sh2 = login(f"+91972{sfx}1", "seller")
    assert requests.get(f"{BASE}/seller/orders/{ids[0]}", headers=sh2).status_code == 404
    print("SELLER OK")
    # cleanup: hide the test shop from customers
    requests.put(f"{BASE}/seller/shop", headers=sh, json={"open": False})


if __name__ == "__main__":
    test_seller_flow()

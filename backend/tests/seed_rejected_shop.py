"""Seed a TEST_ rejected food shop for UI testing of the 'Not approved' -> resubmit flow. Writes /tmp/rejected_shop.json."""
import json
import os
import random

import requests

BASE = os.environ["API"]


def login(phone, role):
    r = requests.post(f"{BASE}/auth/otp/request", json={"phone": phone, "role": role})
    assert r.status_code == 200, r.text
    v = requests.post(f"{BASE}/auth/otp/verify", json={"phone": phone, "code": r.json()["dev_code"], "role": role}).json()
    return {"Authorization": f"Bearer {v['access_token']}"}


if __name__ == "__main__":
    local = "93" + str(random.randint(10000000, 99999999))
    ah = login("+919999900000", "admin")
    sh = login(f"+91{local}", "seller")
    shop = requests.post(f"{BASE}/seller/onboarding", headers=sh, json={
        "business_name": "TEST_Rejected Kitchen", "owner_name": "Ravi", "category": "food", "business_type": "cloud_kitchen",
        "cuisine": "Rolls", "address": "Koramangala", "prep_time_min": 15, "min_order": 0, "fssai_number": "12345678901234", "image_key": "rolls"}).json()
    rv = requests.post(f"{BASE}/admin/sellers/{shop['id']}/review", headers=ah, json={"decision": "reject", "note": "Address unclear"})
    print(rv.status_code, rv.json().get("approval_status"))
    json.dump({"phone": local, "shop_id": shop["id"]}, open("/tmp/rejected_shop.json", "w"))
    print(local, shop["id"])

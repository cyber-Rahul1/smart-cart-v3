"""Admin fees config validation (iteration 3). Always restores original config."""
import os

import pytest
import requests

BASE = os.environ["API"]
KEYS = ["delivery_base", "delivery_per_km", "free_delivery_threshold", "convenience_fee", "commission_pct", "community_delivery_discount", "seller_auto_approve"]


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{BASE}/auth/otp/request", json={"phone": "+919999900000", "role": "admin"}).json()
    v = requests.post(f"{BASE}/auth/otp/verify", json={"phone": "+919999900000", "code": r["dev_code"], "role": "admin"}).json()
    h = {"Authorization": f"Bearer {v['access_token']}"}
    orig = requests.get(f"{BASE}/admin/config", headers=h).json()
    yield h, {k: orig[k] for k in KEYS}
    requests.put(f"{BASE}/admin/config", headers=h, json={k: orig[k] for k in KEYS})


@pytest.mark.parametrize("field,val", [("commission_pct", -5), ("commission_pct", 150), ("community_delivery_discount", 5), ("delivery_base", -1)])
def test_config_rejects_out_of_range(admin, field, val):
    h, orig = admin
    r = requests.put(f"{BASE}/admin/config", headers=h, json=orig | {field: val})
    requests.put(f"{BASE}/admin/config", headers=h, json=orig)
    assert r.status_code == 422, f"{field}={val} accepted: {r.status_code}"


def test_config_roundtrip(admin):
    h, orig = admin
    r = requests.put(f"{BASE}/admin/config", headers=h, json=orig | {"convenience_fee": orig["convenience_fee"] + 1})
    assert r.status_code == 200
    assert requests.get(f"{BASE}/admin/config", headers=h).json()["convenience_fee"] == orig["convenience_fee"] + 1

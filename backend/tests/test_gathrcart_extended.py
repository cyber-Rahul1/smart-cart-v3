"""Extended regression: refresh rotation/replay, payment signatures, webhook HMAC+idempotency, privacy, delivery OTP, cancel/refund, community."""
import hashlib
import hmac
import json
import os
import random
import uuid

import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"
JWT_SECRET = os.environ["JWT_SECRET"]
DEMO_KEY = os.environ["PAYMENT_WEBHOOK_SECRET"].encode()  # payments now sign with their own secret


def phone():
    return f"+9197{random.randint(10000000, 99999999)}"


def login(name):
    ph = phone()
    r = requests.post(f"{BASE}/auth/otp/request", json={"phone": ph})
    assert r.status_code == 200, r.text
    v = requests.post(f"{BASE}/auth/otp/verify", json={"phone": ph, "code": r.json()["dev_code"]}).json()
    h = {"Authorization": f"Bearer {v['access_token']}"}
    requests.put(f"{BASE}/profile", json={"name": name}, headers=h)
    a = requests.post(f"{BASE}/addresses", json={"label": "Home", "line": f"TEST_ flat of {name}, Koramangala"}, headers=h).json()
    return {"h": h, "addr": a["id"], "v": v, "phone": ph}


@pytest.fixture(scope="module")
def u1():
    return login("TEST_A")


@pytest.fixture(scope="module")
def u2():
    return login("TEST_B")


def make_order(u, product="s-paradise-p0", qty=2):
    requests.delete(f"{BASE}/cart", headers=u["h"])
    r = requests.post(f"{BASE}/cart/items", json={"product_id": product, "qty": qty}, headers=u["h"])
    assert r.status_code == 200, r.text
    o = requests.post(f"{BASE}/orders/checkout", json={"address_id": u["addr"]}, headers=u["h"])
    assert o.status_code == 200, o.text
    return o.json()


def pay(u, oid):
    p = requests.post(f"{BASE}/payments/initiate", json={"order_id": oid}, headers=u["h"]).json()
    r = requests.post(f"{BASE}/payments/{p['id']}/demo-complete", json={"outcome": "success"}, headers=u["h"])
    assert r.status_code == 200, r.text
    return p


# --- Identity: OTP + refresh rotation ---
class TestAuth:
    def test_otp_invalid_phone(self):
        assert requests.post(f"{BASE}/auth/otp/request", json={"phone": "12345"}).status_code == 422

    def test_otp_wrong_code_and_rate_limit(self):
        ph = phone()
        assert requests.post(f"{BASE}/auth/otp/request", json={"phone": ph}).status_code == 200
        assert requests.post(f"{BASE}/auth/otp/request", json={"phone": ph}).status_code == 429
        assert requests.post(f"{BASE}/auth/otp/verify", json={"phone": ph, "code": "000000"}).status_code in (400,)

    def test_refresh_rotation_and_replay_revokes_family(self):
        u = login("TEST_R")
        old = u["v"]["refresh_token"]
        r1 = requests.post(f"{BASE}/auth/refresh", json={"refresh_token": old})
        assert r1.status_code == 200
        new = r1.json()["refresh_token"]
        assert new != old and r1.json()["access_token"]
        me = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {r1.json()['access_token']}"})
        assert me.status_code == 200 and me.json()["phone"] == u["phone"] and "_id" not in me.json()
        # replay old token -> 401 and whole family revoked (new token unusable too)
        assert requests.post(f"{BASE}/auth/refresh", json={"refresh_token": old}).status_code == 401
        assert requests.post(f"{BASE}/auth/refresh", json={"refresh_token": new}).status_code == 401

    def test_logout_revokes(self):
        u = login("TEST_L")
        rt = u["v"]["refresh_token"]
        assert requests.post(f"{BASE}/auth/logout", json={"refresh_token": rt}).status_code == 200
        assert requests.post(f"{BASE}/auth/refresh", json={"refresh_token": rt}).status_code == 401

    def test_me_requires_auth(self):
        assert requests.get(f"{BASE}/auth/me").status_code == 401


# --- Payments: signature verification + webhook ---
class TestPayments:
    def test_forged_and_valid_signature(self, u1):
        o = make_order(u1)
        p = requests.post(f"{BASE}/payments/initiate", json={"order_id": o["id"]}, headers=u1["h"]).json()
        assert p["amount"] == o["bill"]["total"]
        bad = requests.post(f"{BASE}/payments/verify", json={"provider_order_id": p["provider_order_id"],
                            "provider_payment_id": "pay_x", "signature": "deadbeef"}, headers=u1["h"])
        assert bad.status_code == 400
        assert requests.get(f"{BASE}/orders/{o['id']}", headers=u1["h"]).json()["payment_status"] != "paid"
        sig = hmac.new(DEMO_KEY, f"{p['provider_order_id']}|pay_ok1".encode(), hashlib.sha256).hexdigest()
        ok = requests.post(f"{BASE}/payments/verify", json={"provider_order_id": p["provider_order_id"],
                           "provider_payment_id": "pay_ok1", "signature": sig}, headers=u1["h"])
        assert ok.status_code == 200 and ok.json()["status"] == "captured"
        od = requests.get(f"{BASE}/orders/{o['id']}", headers=u1["h"]).json()
        assert od["status"] == "confirmed" and od["payment_status"] == "paid"
        assert requests.post(f"{BASE}/payments/initiate", json={"order_id": o["id"]}, headers=u1["h"]).status_code == 400

    def test_webhook_hmac_and_idempotency(self, u1):
        o = make_order(u1)
        p = requests.post(f"{BASE}/payments/initiate", json={"order_id": o["id"]}, headers=u1["h"]).json()
        ev = json.dumps({"event_id": f"TEST_evt_{uuid.uuid4().hex}", "type": "payment.captured",
                         "provider_order_id": p["provider_order_id"], "provider_payment_id": "pay_wh1"}).encode()
        assert requests.post(f"{BASE}/payments/webhook", data=ev).status_code == 400
        assert requests.post(f"{BASE}/payments/webhook", data=ev, headers={"X-Signature": "bad"}).status_code == 400
        sig = hmac.new(DEMO_KEY, ev, hashlib.sha256).hexdigest()
        r1 = requests.post(f"{BASE}/payments/webhook", data=ev, headers={"X-Signature": sig, "Content-Type": "application/json"})
        assert r1.status_code == 200 and r1.json().get("duplicate") is not True
        r2 = requests.post(f"{BASE}/payments/webhook", data=ev, headers={"X-Signature": sig, "Content-Type": "application/json"})
        assert r2.status_code == 200 and r2.json().get("duplicate") is True
        od = requests.get(f"{BASE}/orders/{o['id']}", headers=u1["h"]).json()
        assert od["payment_status"] == "paid"
        assert sum(1 for x in od["history"] if x["status"] == "confirmed") == 1

    def test_webhook_malformed_event_returns_4xx(self):
        ev = json.dumps({"type": "payment.captured"}).encode()
        sig = hmac.new(DEMO_KEY, ev, hashlib.sha256).hexdigest()
        r = requests.post(f"{BASE}/payments/webhook", data=ev, headers={"X-Signature": sig})
        assert r.status_code < 500, f"server error {r.status_code}"


# --- Privacy: other users cannot access orders/payments ---
class TestPrivacy:
    def test_other_user_cannot_access(self, u1, u2):
        o = make_order(u1)
        p = requests.post(f"{BASE}/payments/initiate", json={"order_id": o["id"]}, headers=u1["h"]).json()
        assert requests.get(f"{BASE}/orders/{o['id']}", headers=u2["h"]).status_code == 404
        assert requests.post(f"{BASE}/orders/{o['id']}/cancel", headers=u2["h"]).status_code == 404
        assert requests.post(f"{BASE}/orders/{o['id']}/reorder", json={}, headers=u2["h"]).status_code == 404
        assert requests.post(f"{BASE}/delivery/orders/{o['id']}/demo-advance", json={}, headers=u2["h"]).status_code == 404
        assert requests.post(f"{BASE}/payments/initiate", json={"order_id": o["id"]}, headers=u2["h"]).status_code == 404
        assert requests.post(f"{BASE}/payments/{p['id']}/demo-complete", json={"outcome": "success"}, headers=u2["h"]).status_code == 404
        assert all(x["id"] != o["id"] for x in requests.get(f"{BASE}/orders", headers=u2["h"]).json())

    def test_checkout_with_other_users_address(self, u1, u2):
        requests.delete(f"{BASE}/cart", headers=u2["h"])
        requests.post(f"{BASE}/cart/items", json={"product_id": "s-paradise-p0", "qty": 2}, headers=u2["h"])
        assert requests.post(f"{BASE}/orders/checkout", json={"address_id": u1["addr"]}, headers=u2["h"]).status_code == 400


# --- Delivery OTP + cancel/refund + reorder ---
class TestOrderLifecycle:
    def test_unpaid_cannot_advance(self, u1):
        o = make_order(u1)
        assert requests.post(f"{BASE}/delivery/orders/{o['id']}/demo-advance", json={}, headers=u1["h"]).status_code == 400

    def test_advance_and_delivery_otp(self, u1):
        o = make_order(u1)
        pay(u1, o["id"])
        for expected in ("preparing", "ready_for_pickup", "out_for_delivery"):
            r = requests.post(f"{BASE}/delivery/orders/{o['id']}/demo-advance", json={}, headers=u1["h"])
            assert r.status_code == 200 and r.json()["status"] == expected, r.text
        assert "delivery_otp" not in r.json() and r.json()["rider"]
        assert requests.post(f"{BASE}/delivery/orders/{o['id']}/demo-advance", json={}, headers=u1["h"]).status_code == 400
        bad = requests.post(f"{BASE}/delivery/orders/{o['id']}/demo-advance", json={"otp": "9999x"}, headers=u1["h"])
        assert bad.status_code == 400
        otp = requests.get(f"{BASE}/orders/{o['id']}", headers=u1["h"]).json()["delivery_otp"]
        ok = requests.post(f"{BASE}/delivery/orders/{o['id']}/demo-advance", json={"otp": otp}, headers=u1["h"])
        assert ok.status_code == 200 and ok.json()["status"] == "delivered"
        assert requests.post(f"{BASE}/orders/{o['id']}/cancel", headers=u1["h"]).status_code == 400

    def test_cancel_paid_refund(self, u1):
        o = make_order(u1)
        pay(u1, o["id"])
        r = requests.post(f"{BASE}/orders/{o['id']}/cancel", headers=u1["h"])
        assert r.status_code == 200 and r.json()["status"] == "cancelled" and r.json()["payment_status"] == "refunded"

    def test_reorder_preview_and_confirm(self, u1):
        o = make_order(u1, qty=3)
        prev = requests.post(f"{BASE}/orders/{o['id']}/reorder", json={}, headers=u1["h"]).json()
        assert prev["added"] is False and prev["available"][0]["qty"] == 3
        conf = requests.post(f"{BASE}/orders/{o['id']}/reorder", json={"confirm": True}, headers=u1["h"]).json()
        assert conf["added"] is True
        cart = requests.get(f"{BASE}/cart", headers=u1["h"]).json()
        assert cart["items"][0]["qty"] == 3


# --- Community basket: separate flat orders ---
class TestCommunity:
    def test_community_flow(self, u1, u2):
        c = requests.post(f"{BASE}/communities", json={"name": "TEST_ Towers", "address": "TEST_ road, Bangalore",
                          "flats": "A101, A102, B201", "my_flat": "A101"}, headers=u1["h"])
        assert c.status_code == 200, c.text
        c = c.json()
        assert requests.post(f"{BASE}/communities/join", json={"code": c["invite_code"], "flat": "Z999"}, headers=u2["h"]).status_code == 400
        assert requests.post(f"{BASE}/communities/join", json={"code": c["invite_code"].lower(), "flat": "a102"}, headers=u2["h"]).status_code == 200
        b = requests.post(f"{BASE}/communities/{c['id']}/baskets", json={"seller_id": "s-fresh", "title": "TEST_ veg",
                          "closes_in_min": 30, "deliver_in_min": 60}, headers=u1["h"]).json()
        v1 = requests.post(f"{BASE}/community-baskets/{b['id']}/items", json={"product_id": "s-fresh-p0", "qty": 2}, headers=u1["h"]).json()
        v2 = requests.post(f"{BASE}/community-baskets/{b['id']}/items", json={"product_id": "s-fresh-p1", "qty": 1}, headers=u2["h"]).json()
        assert v2["my_flat"] == "A102" and all(i["flat"] == "A102" for i in v2["my_items"])
        assert "items" not in v2 and len(v2["flats"]) == 2
        other_item = v1["my_items"][0]["id"]
        assert requests.patch(f"{BASE}/community-baskets/{b['id']}/items/{other_item}", json={"qty": 0}, headers=u2["h"]).status_code == 403
        assert requests.post(f"{BASE}/community-baskets/{b['id']}/close", headers=u2["h"]).status_code == 403
        cl = requests.post(f"{BASE}/community-baskets/{b['id']}/close", headers=u1["h"])
        assert cl.status_code == 200 and cl.json()["orders_created"] == 2, cl.text
        mine = [o for o in requests.get(f"{BASE}/orders", headers=u2["h"]).json() if o["ref_id"] == b["id"]]
        assert len(mine) == 1 and mine[0]["flat"] == "A102" and mine[0]["package_label"]["flat"] == "A102"
        plan = requests.get(f"{BASE}/community-baskets/{b['id']}/delivery-plan", headers=u2["h"])
        assert plan.status_code == 200 and plan.json()["total_packages"] == 2


# --- Edge: payment completed after order cancelled must not resurrect order ---
class TestCancelledThenPaid:
    def test_pay_after_cancel_does_not_confirm(self, u1):
        o = make_order(u1)
        p = requests.post(f"{BASE}/payments/initiate", json={"order_id": o["id"]}, headers=u1["h"]).json()
        assert requests.post(f"{BASE}/orders/{o['id']}/cancel", headers=u1["h"]).status_code == 200
        requests.post(f"{BASE}/payments/{p['id']}/demo-complete", json={"outcome": "success"}, headers=u1["h"])
        od = requests.get(f"{BASE}/orders/{o['id']}", headers=u1["h"]).json()
        assert od["status"] == "cancelled", f"cancelled order resurrected: status={od['status']} payment={od['payment_status']}"

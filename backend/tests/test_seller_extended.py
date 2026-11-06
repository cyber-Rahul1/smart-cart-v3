"""Seller app extended: validation, shop settings, catalog CRUD, visibility gates, demo-advance after ready, community packing batches, isolation."""
import os
import random

import pytest
import requests

BASE = os.environ["API"]


def login(phone, role="customer", name=None):
    r = requests.post(f"{BASE}/auth/otp/request", json={"phone": phone, "role": role}).json()
    v = requests.post(f"{BASE}/auth/otp/verify", json={"phone": phone, "code": r["dev_code"], "role": role})
    assert v.status_code == 200, v.text
    h = {"Authorization": f"Bearer {v.json()['access_token']}"}
    if name:
        requests.put(f"{BASE}/profile", json={"name": name}, headers=h)
    return h


SFX = str(random.randint(100000, 999999))
SHOP = {"business_name": "TEST_Kitchen", "owner_name": "Ravi", "category": "food", "business_type": "cloud_kitchen", "cuisine": "Biryani",
        "address": "Koramangala 5th block", "prep_time_min": 20, "min_order": 0, "fssai_number": "12345678901234", "image_key": "biryani"}


@pytest.fixture(scope="module")
def ctx():
    sh = login(f"+91960{SFX}1", "seller")
    shop = requests.post(f"{BASE}/seller/onboarding", headers=sh, json=SHOP).json()
    p1 = requests.post(f"{BASE}/seller/products", headers=sh, json={"name": "TEST_Biryani", "price": 250, "category": "biryani", "stock": 50, "image_key": "biryani"}).json()
    p2 = requests.post(f"{BASE}/seller/products", headers=sh, json={"name": "TEST_Raita", "price": 40, "category": "sides", "stock": 50, "image_key": "thali"}).json()
    return {"sh": sh, "shop": shop, "p1": p1, "p2": p2}


# Onboarding validation
class TestOnboarding:
    def test_fssai_must_be_14_digits(self):
        h = login(f"+91961{SFX}1", "seller")
        for bad in ("123", "1234567890123A", "123456789012345"):
            assert requests.post(f"{BASE}/seller/onboarding", headers=h, json=SHOP | {"fssai_number": bad}).status_code == 422
        assert requests.post(f"{BASE}/seller/onboarding", headers=h, json=SHOP | {"business_type": "kirana"}).status_code == 422
        g = SHOP | {"category": "grocery", "business_type": "kirana", "fssai_number": None, "image_key": "veg"}
        r = requests.post(f"{BASE}/seller/onboarding", headers=h, json=g)
        assert r.status_code == 200 and r.json()["fssai_status"] == "not_required"
        assert requests.post(f"{BASE}/seller/onboarding", headers=h, json=g).status_code == 400  # one shop per seller

    def test_bad_image_key(self):
        h = login(f"+91962{SFX}1", "seller")
        assert requests.post(f"{BASE}/seller/onboarding", headers=h, json=SHOP | {"image_key": "nope"}).status_code == 422

    def test_seller_without_shop_gets_404(self):
        h = login(f"+91963{SFX}1", "seller")
        assert requests.get(f"{BASE}/seller/orders", headers=h).status_code == 404


# Visibility gates while pending
class TestPendingGate:
    def test_pending_shop_hidden_and_not_orderable(self, ctx):
        assert ctx["shop"]["approval_status"] == "pending_review"
        assert all(s["id"] != ctx["shop"]["id"] for s in requests.get(f"{BASE}/sellers?category=food").json())
        ch = login(f"+91964{SFX}1", "customer", "TEST_Buyer")
        requests.delete(f"{BASE}/cart", headers=ch)
        r = requests.post(f"{BASE}/cart/items", headers=ch, json={"product_id": ctx["p1"]["id"], "qty": 1})
        assert r.status_code >= 400, f"pending shop product addable to cart: {r.status_code}"

    def test_search_hides_pending(self, ctx):
        r = requests.get(f"{BASE}/search", params={"q": "TEST_Biryani"}).json()
        assert ctx["p1"]["id"] not in str(r) and ctx["shop"]["id"] not in str(r)


# Shop settings + catalog CRUD (after approval)
class TestShopAndMenu:
    def test_approve_and_settings(self, ctx):
        sh = ctx["sh"]
        assert requests.post(f"{BASE}/seller/shop/demo-approve", headers=sh).json()["fssai_status"] == "verified"
        s = requests.put(f"{BASE}/seller/shop", headers=sh, json={"prep_time_min": 30, "min_order": 99, "offer": "10% off", "opens_at": "08:00", "closes_at": "23:00"}).json()
        assert s["prep_time_min"] == 30 and s["min_order"] == 99 and s["offer"] == "10% off" and s["opens_at"] == "08:00"
        assert requests.put(f"{BASE}/seller/shop", headers=sh, json={"opens_at": "8am"}).status_code == 422
        pub = requests.get(f"{BASE}/sellers/{ctx['shop']['id']}").json()["seller"]
        assert pub["min_order"] == 99
        requests.put(f"{BASE}/seller/shop", headers=sh, json={"min_order": 0})

    def test_edit_availability_delete(self, ctx):
        sh = ctx["sh"]
        p = requests.post(f"{BASE}/seller/products", headers=sh, json={"name": "TEST_Tmp", "price": 10, "category": "x1", "stock": 1}).json()
        e = requests.put(f"{BASE}/seller/products/{p['id']}", headers=sh, json={"name": "TEST_Tmp2", "price": 12, "category": "x1", "stock": 3, "available": False}).json()
        assert e["name"] == "TEST_Tmp2" and e["available"] is False and e["price"] == 12
        assert requests.delete(f"{BASE}/seller/products/{p['id']}", headers=sh).json()["ok"] is True
        assert all(x["id"] != p["id"] for x in requests.get(f"{BASE}/seller/products", headers=sh).json())
        assert requests.delete(f"{BASE}/seller/products/{p['id']}", headers=sh).status_code == 404

    def test_closed_shop_not_orderable(self, ctx):
        sh = ctx["sh"]
        requests.put(f"{BASE}/seller/shop", headers=sh, json={"open": False})
        ch = login(f"+91965{SFX}1", "customer", "TEST_Buyer2")
        requests.delete(f"{BASE}/cart", headers=ch)
        r = requests.post(f"{BASE}/cart/items", headers=ch, json={"product_id": ctx["p1"]["id"], "qty": 1})
        requests.put(f"{BASE}/seller/shop", headers=sh, json={"open": True})
        assert r.status_code >= 400, f"closed shop product addable: {r.status_code}"


# Full single-order lifecycle: seller ready -> customer demo-advance rider steps + OTP
class TestLifecycle:
    def test_ready_then_rider_and_otp(self, ctx):
        sh = ctx["sh"]
        ch = login(f"+91966{SFX}1", "customer", "TEST_Buyer3")
        a = requests.post(f"{BASE}/addresses", headers=ch, json={"label": "Home", "line": "Flat 9, Koramangala"}).json()
        requests.delete(f"{BASE}/cart", headers=ch)
        requests.post(f"{BASE}/cart/items", headers=ch, json={"product_id": ctx["p1"]["id"], "qty": 1})
        requests.post(f"{BASE}/cart/items", headers=ch, json={"product_id": ctx["p2"]["id"], "qty": 2})
        o = requests.post(f"{BASE}/orders/checkout", headers=ch, json={"address_id": a["id"]}).json()
        pay = requests.post(f"{BASE}/payments/initiate", headers=ch, json={"order_id": o["id"]}).json()
        requests.post(f"{BASE}/payments/{pay['id']}/demo-complete", headers=ch, json={"outcome": "success"})
        sv = requests.get(f"{BASE}/seller/orders/{o['id']}", headers=sh).json()
        assert "delivery_otp" not in sv and "phone" not in str(sv.keys()) and "payment" not in sv
        requests.post(f"{BASE}/seller/orders/{o['id']}/accept", headers=sh)
        assert requests.post(f"{BASE}/delivery/orders/{o['id']}/demo-advance", headers=ch, json={}).status_code == 400
        requests.post(f"{BASE}/seller/orders/{o['id']}/pack", headers=sh, json={"index": 0, "checked": True})
        assert requests.post(f"{BASE}/seller/orders/{o['id']}/ready", headers=sh).status_code == 400  # partial
        assert requests.post(f"{BASE}/seller/orders/{o['id']}/pack", headers=sh, json={"index": 5, "checked": True}).status_code == 400
        requests.post(f"{BASE}/seller/orders/{o['id']}/pack", headers=sh, json={"index": 1, "checked": True})
        assert requests.post(f"{BASE}/seller/orders/{o['id']}/ready", headers=sh).json()["status"] == "ready_for_pickup"
        assert requests.post(f"{BASE}/seller/orders/{o['id']}/reject", headers=sh, json={}).status_code == 400
        r = requests.post(f"{BASE}/delivery/orders/{o['id']}/demo-advance", headers=ch, json={})
        assert r.status_code == 200 and r.json()["status"] == "out_for_delivery"
        otp = requests.get(f"{BASE}/orders/{o['id']}", headers=ch).json().get("delivery_otp")
        assert requests.post(f"{BASE}/delivery/orders/{o['id']}/demo-advance", headers=ch, json={"otp": "0000x"}).status_code == 400
        assert requests.post(f"{BASE}/delivery/orders/{o['id']}/demo-advance", headers=ch, json={"otp": otp}).json()["status"] == "delivered"
        done = requests.get(f"{BASE}/seller/orders?tab=done", headers=sh).json()
        assert any(x["id"] == o["id"] for x in done)
        summ = requests.get(f"{BASE}/seller/summary", headers=sh).json()
        assert summ["today_orders"] >= 1


# Community packing: basket against seller shop -> batch with one package per flat
class TestCommunityBatch:
    def test_batch(self, ctx):
        sh = ctx["sh"]
        requests.post(f"{BASE}/seller/shop/demo-approve", headers=sh)  # self-contained: don't rely on earlier test order
        hs = [login(f"+9196{7 + i}{SFX}1", "customer", f"TEST_F{i}") for i in range(2)]
        cm = requests.post(f"{BASE}/communities", json={"name": f"TEST_Comm{SFX}", "address": "80ft Road Koramangala", "flats": "A1,A2", "my_flat": "A1"}, headers=hs[0]).json()
        requests.post(f"{BASE}/communities/join", json={"code": cm["invite_code"], "flat": "A2"}, headers=hs[1])
        b = requests.post(f"{BASE}/communities/{cm['id']}/baskets", json={"seller_id": ctx["shop"]["id"], "title": "TEST_Batch", "closes_in_min": 60}, headers=hs[0])
        assert b.status_code == 200, b.text
        b = b.json()
        requests.post(f"{BASE}/community-baskets/{b['id']}/items", json={"product_id": ctx["p1"]["id"], "qty": 2}, headers=hs[0])
        requests.post(f"{BASE}/community-baskets/{b['id']}/items", json={"product_id": ctx["p1"]["id"], "qty": 1}, headers=hs[1])
        requests.post(f"{BASE}/community-baskets/{b['id']}/items", json={"product_id": ctx["p2"]["id"], "qty": 1}, headers=hs[1])
        res = requests.post(f"{BASE}/community-baskets/{b['id']}/close", headers=hs[0]).json()
        assert res["orders_created"] == 2, res
        for h in hs:
            mine = [o for o in requests.get(f"{BASE}/orders", headers=h).json() if o.get("ref_id") == b["id"]]
            assert mine, "flat order not visible to member"
            pay = requests.post(f"{BASE}/payments/initiate", headers=h, json={"order_id": mine[0]["id"]}).json()
            requests.post(f"{BASE}/payments/{pay['id']}/demo-complete", headers=h, json={"outcome": "success"})
        batches = [x for x in requests.get(f"{BASE}/seller/community-batches", headers=sh).json() if x["basket_id"] == b["id"]]
        assert len(batches) == 1
        bt = batches[0]
        assert len(bt["packages"]) == 2 and {p["flat"] for p in bt["packages"]} == {"A1", "A2"}
        tot = {i["name"]: i["qty"] for i in bt["items_total"]}
        assert tot == {"TEST_Biryani": 3, "TEST_Raita": 1}
        assert all(p.get("package_label") for p in bt["packages"]), "package labels missing"
        # other seller cannot see this batch
        sh2 = login(f"+91969{SFX}1", "seller")
        requests.post(f"{BASE}/seller/onboarding", headers=sh2, json=SHOP | {"business_name": "TEST_Other"})
        assert all(x["basket_id"] != b["id"] for x in requests.get(f"{BASE}/seller/community-batches", headers=sh2).json())
        assert requests.post(f"{BASE}/seller/orders/{bt['packages'][0]['id']}/accept", headers=sh2).status_code == 404


# Role isolation on customer APIs
class TestIsolation:
    def test_seller_cannot_use_customer_cart(self, ctx):
        r = requests.post(f"{BASE}/cart/items", headers=ctx["sh"], json={"product_id": "s-paradise-p0", "qty": 1})
        assert r.status_code == 403, f"seller can use customer cart: {r.status_code}"

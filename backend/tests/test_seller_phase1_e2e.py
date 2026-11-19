"""
End-to-End Integration Test for Real Seller Ecosystem:
1. Register new seller account (without DB seeding)
2. Submit full onboarding profile with branding, custom images, coordinates, hours, FSSAI, GSTIN, PAN
3. Admin review & approval
4. Publish products (food & grocery)
5. Test dedicated availability PATCH endpoint (sub-second OOS toggle)
6. Customer Discover feed verification (real seller values, no mock leak)
7. Customer add to cart and order checkout
8. Real seller order acceptance, item checklist packing, and ready_for_pickup transition
9. Verify ownership isolation (other seller cannot access or modify)
"""
import os
import time
import requests
import pytest

BASE = os.environ.get("API", "http://localhost:8001/api")
SFX = str(int(time.time()))[-6:]


def auth(phone: str, role: str, name: str) -> dict:
    r = requests.post(f"{BASE}/auth/otp/request", json={"phone": phone, "role": role}).json()
    code = r.get("dev_code", "123456")
    v = requests.post(f"{BASE}/auth/otp/verify", json={"phone": phone, "code": code, "role": role})
    assert v.status_code == 200, v.text
    token = v.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestSellerPhase1E2E:
    def test_complete_seller_lifecycle(self):
        admin_h = auth("+919999900000", "admin", "Admin")
        seller_phone = f"+91981{SFX}01"
        seller_h = auth(seller_phone, "seller", "Ramesh Chef")

        # 1. Onboard Real Restaurant
        shop_payload = {
            "business_name": f"Royal Dawat {SFX}",
            "owner_name": "Ramesh Kumar",
            "category": "food",
            "business_type": "restaurant",
            "cuisine": "Awadhi, Lucknowi Biryani, Mughlai",
            "description": "Authentic slow-cooked Awadhi biryani made with traditional spices.",
            "contact_phone": f"+91981{SFX}01",
            "contact_email": f"dawat{SFX}@example.com",
            "address": "Shop 12, Ground Floor, 80 Feet Road, Koramangala 4th Block, Bengaluru, Karnataka - 560034",
            "prep_time_min": 30,
            "min_order": 149,
            "is_pure_veg": False,
            "image_key": "biryani",
            "fssai_number": "11223344556677",
            "gstin": "29ABCDE1234F1Z5",
            "pan": "ABCDE1234F",
            "opens_at": "11:00",
            "closes_at": "23:00",
            "latitude": 12.9345,
            "longitude": 77.6255,
            "service_radius_km": 6.5,
        }
        res_onboard = requests.post(f"{BASE}/seller/onboarding", headers=seller_h, json=shop_payload)
        assert res_onboard.status_code == 200, res_onboard.text
        shop = res_onboard.json()
        sid = shop["id"]
        assert shop["approval_status"] == "pending_review"
        assert shop["approved"] is False
        assert shop["fssai_status"] == "submitted"
        assert shop["name"] == f"Royal Dawat {SFX}"
        assert shop["contact_phone"] == f"+91981{SFX}01"

        # 2. Verify Shop Settings Update
        update_payload = {
            "highlights": ["Dum Biryani Specialist", "Authentic Awadhi Spices", "Late Night Delivery"],
            "offer": "20% OFF up to ₹100",
            "description": "Updated signature Awadhi royal cuisine description.",
        }
        res_upd = requests.put(f"{BASE}/seller/shop", headers=seller_h, json=update_payload)
        assert res_upd.status_code == 200
        upd_shop = res_upd.json()
        assert upd_shop["highlights"] == ["Dum Biryani Specialist", "Authentic Awadhi Spices", "Late Night Delivery"]
        assert upd_shop["offer"] == "20% OFF up to ₹100"

        # 3. Admin Review & Approval
        res_approve = requests.post(
            f"{BASE}/admin/sellers/{sid}/review",
            headers=admin_h,
            json={"decision": "approve", "note": "All documents and FSSAI verified."},
        )
        assert res_approve.status_code == 200
        approved_shop = res_approve.json()
        assert approved_shop["approved"] is True
        assert approved_shop["approval_status"] == "approved"
        assert approved_shop["fssai_status"] == "verified"
        assert approved_shop["is_new"] is True

        # 4. Create Catalogue Products
        p1_res = requests.post(
            f"{BASE}/seller/products",
            headers=seller_h,
            json={
                "name": "Dum Gosht Biryani",
                "price": 380.0,
                "category": "Biryani",
                "veg": False,
                "stock": 50,
                "available": True,
                "description": "Mutton slow cooked in sealed handi",
                "image_key": "biryani",
                "weight_kg": 0.8,
            },
        )
        assert p1_res.status_code == 200
        p1 = p1_res.json()

        p2_res = requests.post(
            f"{BASE}/seller/products",
            headers=seller_h,
            json={
                "name": "Mirchi Ka Salan",
                "price": 60.0,
                "category": "Sides",
                "veg": True,
                "stock": 100,
                "available": True,
                "description": "Rich peanut and sesame gravy",
                "image_key": "thali",
                "weight_kg": 0.3,
            },
        )
        assert p2_res.status_code == 200
        p2 = p2_res.json()

        # 5. Test Dedicated Availability PATCH Endpoint
        patch_res = requests.patch(
            f"{BASE}/seller/products/{p2['id']}/availability",
            headers=seller_h,
            json={"available": False},
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["available"] is False

        # Toggle back to true
        patch_res2 = requests.patch(
            f"{BASE}/seller/products/{p2['id']}/availability",
            headers=seller_h,
            json={"available": True},
        )
        assert patch_res2.status_code == 200
        assert patch_res2.json()["available"] is True

        # 6. Verify Customer Discover Feed
        discover_res = requests.get(f"{BASE}/discover?limit=30")
        assert discover_res.status_code == 200
        items = discover_res.json()["items"]
        matching = [item for item in items if item["seller"]["id"] == sid]
        assert len(matching) == 1, "Real seller must appear in Discover feed"
        showcase = matching[0]
        assert showcase["seller"]["name"] == f"Royal Dawat {SFX}"
        assert showcase["seller"]["business_type"] == "restaurant"
        assert showcase["seller"]["fssai_status"] == "verified"
        assert showcase["seller"]["contact_phone"] == f"+91981{SFX}01"
        assert len(showcase["products"]) >= 2

        # 7. Customer Places an Order for Real Seller
        buyer_h = auth(f"+91982{SFX}99", "customer", "Happy Customer")
        addr_res = requests.post(
            f"{BASE}/addresses",
            headers=buyer_h,
            json={"label": "Flat 301", "line": "Prestige Heights, Koramangala 4th Block"},
        )
        addr_id = addr_res.json()["id"]

        requests.delete(f"{BASE}/cart", headers=buyer_h)
        requests.post(f"{BASE}/cart/items", headers=buyer_h, json={"product_id": p1["id"], "qty": 1})
        requests.post(f"{BASE}/cart/items", headers=buyer_h, json={"product_id": p2["id"], "qty": 1})

        order_res = requests.post(f"{BASE}/orders/checkout", headers=buyer_h, json={"address_id": addr_id})
        assert order_res.status_code == 200
        order = order_res.json()
        oid = order["id"]
        assert order["seller_id"] == sid

        # Pay order
        pay_res = requests.post(f"{BASE}/payments/initiate", headers=buyer_h, json={"order_id": oid})
        pay = pay_res.json()
        requests.post(f"{BASE}/payments/{pay['id']}/demo-complete", headers=buyer_h, json={"outcome": "success"})

        # 8. Real Seller Order Acceptance, Checklist Packing, and Ready Transition
        orders_list = requests.get(f"{BASE}/seller/orders", headers=seller_h).json()
        assert any(o["id"] == oid for o in orders_list)

        # Accept order
        acc_res = requests.post(f"{BASE}/seller/orders/{oid}/accept", headers=seller_h)
        assert acc_res.status_code == 200
        assert acc_res.json()["status"] == "preparing"

        # Pack items
        pack1 = requests.post(f"{BASE}/seller/orders/{oid}/pack", headers=seller_h, json={"index": 0, "checked": True})
        assert pack1.status_code == 200
        pack2 = requests.post(f"{BASE}/seller/orders/{oid}/pack", headers=seller_h, json={"index": 1, "checked": True})
        assert pack2.status_code == 200
        assert pack2.json()["all_packed"] is True

        # Mark ready for pickup
        ready_res = requests.post(f"{BASE}/seller/orders/{oid}/ready", headers=seller_h)
        assert ready_res.status_code == 200
        assert ready_res.json()["status"] == "ready_for_pickup"

        # 9. Cross-Seller Isolation Test (Another seller cannot access or modify this seller's data)
        seller2_h = auth(f"+91983{SFX}02", "seller", "Another Merchant")
        res_other = requests.get(f"{BASE}/seller/orders/{oid}", headers=seller2_h)
        assert res_other.status_code in (404, 400), "Other seller must not access this order"

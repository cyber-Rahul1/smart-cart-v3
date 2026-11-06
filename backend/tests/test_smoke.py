"""Backend smoke test: auth, cart/checkout/payment, group permissions, community flat orders."""
import os
import requests

BASE = os.environ["API"]


def login(phone, name):
    r = requests.post(f"{BASE}/auth/otp/request", json={"phone": phone}).json()
    v = requests.post(f"{BASE}/auth/otp/verify", json={"phone": phone, "code": r["dev_code"]}).json()
    h = {"Authorization": f"Bearer {v['access_token']}"}
    requests.put(f"{BASE}/profile", json={"name": name}, headers=h)
    a = requests.post(f"{BASE}/addresses", json={"label": "Home", "line": f"Flat for {name}, Koramangala"}, headers=h).json()
    return h, a["id"], v


def test_flow():
    h1, a1, v1 = login("+919800000101", "Rahul")
    h2, a2, _ = login("+919800000102", "Aman")
    h3, a3, _ = login("+919800000103", "Karan")
    # refresh rotation
    r = requests.post(f"{BASE}/auth/refresh", json={"refresh_token": v1["refresh_token"]})
    assert r.status_code == 200
    assert requests.post(f"{BASE}/auth/refresh", json={"refresh_token": v1["refresh_token"]}).status_code == 401
    # individual
    requests.delete(f"{BASE}/cart", headers=h1)
    assert requests.post(f"{BASE}/cart/items", json={"product_id": "s-paradise-p0", "qty": 2}, headers=h1).status_code == 200
    o = requests.post(f"{BASE}/orders/checkout", json={"address_id": a1, "coupon": "GATHR50"}, headers=h1).json()
    assert o["status"] == "pending_payment" and o["bill"]["discount"] == 50
    p = requests.post(f"{BASE}/payments/initiate", json={"order_id": o["id"]}, headers=h1).json()
    assert requests.post(f"{BASE}/payments/{p['id']}/demo-complete", json={"outcome": "failure"}, headers=h1).status_code == 402
    assert requests.get(f"{BASE}/orders/{o['id']}", headers=h1).json()["payment_status"] == "failed"
    p = requests.post(f"{BASE}/payments/initiate", json={"order_id": o["id"]}, headers=h1).json()
    assert requests.post(f"{BASE}/payments/{p['id']}/demo-complete", json={"outcome": "success"}, headers=h1).status_code == 200
    assert requests.get(f"{BASE}/orders/{o['id']}", headers=h1).json()["status"] == "confirmed"
    assert requests.get(f"{BASE}/orders/{o['id']}", headers=h2).status_code == 404  # privacy
    # forged verify
    assert requests.post(f"{BASE}/payments/verify", json={"provider_order_id": p["provider_order_id"], "provider_payment_id": "x", "signature": "bad"}, headers=h1).status_code == 400
    # group
    g = requests.post(f"{BASE}/groups", json={"name": "Flat 4B"}, headers=h1).json()
    requests.post(f"{BASE}/groups/join", json={"code": g["invite_code"]}, headers=h2)
    requests.post(f"{BASE}/groups/join", json={"code": g["invite_code"]}, headers=h3)
    c = requests.post(f"{BASE}/groups/{g['id']}/carts", json={"name": "Dinner", "seller_id": "s-rollwala", "closes_in_min": 30}, headers=h1).json()
    requests.post(f"{BASE}/group-carts/{c['id']}/items", json={"product_id": "s-rollwala-p0", "qty": 1}, headers=h1)
    gc = requests.post(f"{BASE}/group-carts/{c['id']}/items", json={"product_id": "s-rollwala-p1", "qty": 2}, headers=h2).json()
    aman_item = next(i for i in gc["items"] if i["product_id"] == "s-rollwala-p1")
    assert requests.patch(f"{BASE}/group-carts/{c['id']}/items/{aman_item['id']}", json={"qty": 0}, headers=h3).status_code == 403
    assert requests.post(f"{BASE}/group-carts/{c['id']}/finalize", json={"address_id": a2}, headers=h2).status_code == 403
    go = requests.post(f"{BASE}/group-carts/{c['id']}/finalize", json={"address_id": a1}, headers=h1).json()
    assert go["kind"] == "group" and len(go["shares"]) == 2
    # community
    cm = requests.post(f"{BASE}/communities", json={"name": "Green Meadows", "address": "80ft Road Koramangala", "flats": "101,102,103", "my_flat": "101"}, headers=h1).json()
    requests.post(f"{BASE}/communities/join", json={"code": cm["invite_code"], "flat": "102"}, headers=h2)
    requests.post(f"{BASE}/communities/join", json={"code": cm["invite_code"], "flat": "103"}, headers=h3)
    b = requests.post(f"{BASE}/communities/{cm['id']}/baskets", json={"seller_id": "s-fresh", "title": "Weekly", "closes_in_min": 60}, headers=h1).json()
    requests.post(f"{BASE}/community-baskets/{b['id']}/items", json={"product_id": "s-fresh-p0", "qty": 2}, headers=h1)
    requests.post(f"{BASE}/community-baskets/{b['id']}/items", json={"product_id": "s-fresh-p1", "qty": 1}, headers=h2)
    bv = requests.post(f"{BASE}/community-baskets/{b['id']}/items", json={"product_id": "s-fresh-p5", "qty": 2}, headers=h3).json()
    assert len(bv["my_items"]) == 1 and len(bv["flats"]) == 3
    assert requests.post(f"{BASE}/community-baskets/{b['id']}/close", headers=h2).status_code == 403
    res = requests.post(f"{BASE}/community-baskets/{b['id']}/close", headers=h1).json()
    assert res["orders_created"] == 3
    plan = requests.get(f"{BASE}/community-baskets/{b['id']}/delivery-plan", headers=h1).json()
    assert plan["total_packages"] == 3 and plan["split"] is True, plan
    print("ALL OK", plan["riders_needed"])


if __name__ == "__main__":
    test_flow()

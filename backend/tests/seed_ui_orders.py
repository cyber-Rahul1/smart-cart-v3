"""Creates TEST_ data for UI testing against a seller phone: 2 paid individual orders + 1 paid community batch (2 flats)."""
import os, random, sys, json, requests
sys.path.insert(0, "/app/backend/tests")
from test_seller_extended import login
BASE = os.environ["API"]
sh = login("+91" + sys.argv[1], "seller")
shop = requests.get(f"{BASE}/seller/me", headers=sh).json()["shop"]
prods = requests.get(f"{BASE}/seller/products", headers=sh).json()
p2 = requests.post(f"{BASE}/seller/products", headers=sh, json={"name": "TEST_UI Raita", "price": 40, "category": "Sides", "stock": 50, "image_key": "thali"}).json()
p1 = [p for p in prods if p["available"]][0]
s = str(random.randint(100000, 999999))
ch = login(f"+91940{s}1", "customer", "TEST_Cust")
a = requests.post(f"{BASE}/addresses", headers=ch, json={"label": "Home", "line": "Flat 7, Koramangala"}).json()
ids = []
for _ in range(2):
    requests.delete(f"{BASE}/cart", headers=ch)
    requests.post(f"{BASE}/cart/items", headers=ch, json={"product_id": p1["id"], "qty": 1})
    requests.post(f"{BASE}/cart/items", headers=ch, json={"product_id": p2["id"], "qty": 2})
    o = requests.post(f"{BASE}/orders/checkout", headers=ch, json={"address_id": a["id"]}).json()
    pay = requests.post(f"{BASE}/payments/initiate", headers=ch, json={"order_id": o["id"]}).json()
    requests.post(f"{BASE}/payments/{pay['id']}/demo-complete", headers=ch, json={"outcome": "success"})
    ids.append(o["id"])
hs = [ch, login(f"+91941{s}1", "customer", "TEST_Flat2")]
cm = requests.post(f"{BASE}/communities", json={"name": f"TEST_Comm{s}", "address": "80ft Road Koramangala", "flats": "B1,B2", "my_flat": "B1"}, headers=hs[0]).json()
requests.post(f"{BASE}/communities/join", json={"code": cm["invite_code"], "flat": "B2"}, headers=hs[1])
b = requests.post(f"{BASE}/communities/{cm['id']}/baskets", json={"seller_id": shop["id"], "title": "TEST_Batch", "closes_in_min": 60}, headers=hs[0]).json()
requests.post(f"{BASE}/community-baskets/{b['id']}/items", json={"product_id": p1["id"], "qty": 2}, headers=hs[0])
requests.post(f"{BASE}/community-baskets/{b['id']}/items", json={"product_id": p2["id"], "qty": 1}, headers=hs[1])
print(requests.post(f"{BASE}/community-baskets/{b['id']}/close", headers=hs[0]).json().get("orders_created"))
for h in hs:
    for o in requests.get(f"{BASE}/orders", headers=h).json():
        if o.get("ref_id") == b["id"]:
            pay = requests.post(f"{BASE}/payments/initiate", headers=h, json={"order_id": o["id"]}).json()
            requests.post(f"{BASE}/payments/{pay['id']}/demo-complete", headers=h, json={"outcome": "success"})
json.dump({"orders": ids, "basket": b["id"], "cust_phone": f"40{s}1", "shop": shop["id"]}, open("/tmp/ui_seed.json", "w"))
print(open("/tmp/ui_seed.json").read())

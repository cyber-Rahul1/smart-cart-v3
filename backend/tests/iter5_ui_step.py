"""Helper for iteration-5 UI tests: step <name>. Reads /tmp/iter5_seed.json and /tmp/iter5_cod.json."""
import json
import os
import sys

import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"
S = json.load(open("/tmp/iter5_seed.json"))
step = sys.argv[1]
ch, sh, rh = S["ch"], S["sh"], S["rh"]

if step == "online_order":
    requests.delete(f"{BASE}/cart", headers=ch)
    requests.post(f"{BASE}/cart/items", headers=ch, json={"product_id": S["roll"]["id"], "qty": 1})
    o = requests.post(f"{BASE}/orders/checkout", headers=ch, json={"address_id": S["addr"]["id"]}).json()
    print(json.dumps({"online_order": o["id"]}))
elif step == "ready":
    oid = json.load(open("/tmp/iter5_cod.json"))["cod_order"]
    print(requests.post(f"{BASE}/seller/orders/{oid}/accept", headers=sh).status_code)
    requests.post(f"{BASE}/seller/orders/{oid}/pack", headers=sh, json={"index": 0, "checked": True})
    print(requests.post(f"{BASE}/seller/orders/{oid}/ready", headers=sh).json()["status"])
    print(requests.get(f"{BASE}/delivery/orders/{oid}/track", headers=ch).json())
elif step == "claim":
    oid = json.load(open("/tmp/iter5_cod.json"))["cod_order"]
    print(requests.post(f"{BASE}/rider/claim", headers=rh, json={"order_ids": [oid]}).json())
    print(requests.put(f"{BASE}/rider/location", headers=rh, json={"lat": 12.945, "lng": 77.63}).json())
    print(requests.get(f"{BASE}/delivery/orders/{oid}/track", headers=ch).json())
elif step == "addresses":
    for a in requests.get(f"{BASE}/addresses", headers=ch).json():
        print(a.get("label"), a.get("line"), a.get("lat"), a.get("lng"), a.get("landmark"))
elif step == "order":
    oid = sys.argv[2]
    o = requests.get(f"{BASE}/orders/{oid}", headers=ch).json()
    print(o["status"], o.get("payment_status"), o.get("payment_method"))

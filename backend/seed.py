"""Idempotent development seed data (realistic Bengaluru local shops)."""
from datetime import timedelta

from core import db, iso, now

U = "https://images.unsplash.com/photo-{}?w=800&q=70"
IMG = {
    "biryani": U.format("1563379091339-03b21ab4a4f8"), "pizza": U.format("1513104890138-7c749659a591"),
    "dosa": U.format("1589301760014-d929f3979dbc"), "burger": U.format("1568901346375-23c9450c58cd"),
    "thali": U.format("1546833999-b9f581a1996d"), "noodles": U.format("1585032226651-759b368d7246"),
    "dessert": U.format("1488477181946-6428a0291777"), "veg": U.format("1542838132-92c53300491e"),
    "fruits": U.format("1610832958506-aac56368f2f8"), "milk": U.format("1563636619-e9143da7973b"),
    "bread": U.format("1509440159596-0249088772ff"), "rice": U.format("1586201375761-83865001e31c"),
    "eggs": U.format("1582722872445-44dc5f7e3c8f"), "snacks": U.format("1566478989037-eec170784d0b"),
    "oil": U.format("1474979266404-7eaacbcd87c5"), "store": U.format("1604719312566-8912e9227c6a"),
    "rolls": U.format("1601050690597-df0568f70950"), "coffee": U.format("1509042239860-f550ce710b93"),
}

SELLERS = [
    ("s-paradise", "Biryani Bhavan", "food", "restaurant", "Biryani, Mughlai", "biryani", 4.5, 1.8, 30, False, "50% OFF up to ₹100", 199),
    ("s-slice", "Slice Story Cloud Kitchen", "food", "cloud_kitchen", "Pizza, Italian", "pizza", 4.3, 2.6, 35, False, "Free garlic bread", 149),
    ("s-rollwala", "Kolkata Roll Wala", "food", "cloud_kitchen", "Rolls, Street Food", "rolls", 4.4, 1.2, 25, True, "₹40 OFF above ₹249", 99),
    ("s-udupi", "Udupi Upahara", "food", "restaurant", "South Indian, Breakfast", "dosa", 4.6, 0.9, 20, False, None, 99),
    ("s-burger", "Smash Lab Burgers", "food", "cloud_kitchen", "Burgers, Shakes", "burger", 4.2, 3.4, 30, True, "Buy 1 Get 1 on Tuesdays", 149),
    ("s-wok", "Wok This Way", "food", "restaurant", "Chinese, Asian", "noodles", 4.1, 2.2, 30, False, "20% OFF", 149),
    ("s-fresh", "FreshBasket Kirana", "grocery", "kirana", "Groceries, Staples", "store", 4.5, 1.1, 20, False, "Free delivery above ₹399", 99),
    ("s-greens", "Green Leaf Organics", "grocery", "kirana", "Fruits, Vegetables", "veg", 4.7, 2.0, 25, True, "10% OFF first order", 149),
    ("s-dairy", "Nandi Dairy & Bakery", "grocery", "kirana", "Dairy, Bakery", "milk", 4.4, 0.7, 15, False, None, 49),
    ("s-brew", "Brew & Bake Cafe", "food", "restaurant", "Cafe, Desserts", "coffee", 4.3, 1.6, 20, True, "Opening week: 30% OFF", 99),
]

P = {
    "s-paradise": [("Chicken Dum Biryani", 289, "Biryani", False, "biryani"), ("Mutton Biryani", 389, "Biryani", False, "biryani"),
                   ("Veg Dum Biryani", 219, "Biryani", True, "biryani"), ("Chicken 65", 229, "Starters", False, "thali"),
                   ("Double Ka Meetha", 99, "Desserts", True, "dessert")],
    "s-slice": [("Margherita Pizza", 249, "Pizza", True, "pizza"), ("Farmhouse Pizza", 349, "Pizza", True, "pizza"),
                ("Chicken Pepperoni Pizza", 399, "Pizza", False, "pizza"), ("Garlic Breadsticks", 129, "Sides", True, "bread")],
    "s-rollwala": [("Chicken Kathi Roll", 149, "Rolls", False, "rolls"), ("Egg Chicken Roll", 169, "Rolls", False, "rolls"),
                   ("Paneer Tikka Roll", 139, "Rolls", True, "rolls"), ("Mutton Seekh Roll", 199, "Rolls", False, "rolls")],
    "s-udupi": [("Masala Dosa", 79, "Dosa", True, "dosa"), ("Idli Vada", 69, "Breakfast", True, "dosa"),
                ("Ghee Roast Dosa", 109, "Dosa", True, "dosa"), ("Filter Coffee", 35, "Beverages", True, "coffee"),
                ("South Indian Thali", 179, "Meals", True, "thali")],
    "s-burger": [("Classic Smash Burger", 199, "Burgers", False, "burger"), ("Crispy Veg Burger", 159, "Burgers", True, "burger"),
                 ("Oreo Shake", 149, "Shakes", True, "dessert")],
    "s-wok": [("Hakka Noodles", 179, "Noodles", True, "noodles"), ("Chilli Chicken", 249, "Starters", False, "noodles"),
              ("Schezwan Fried Rice", 199, "Rice", True, "rice")],
    "s-fresh": [("Sona Masoori Rice 5kg", 389, "Staples", True, "rice", 5.0), ("Sunflower Oil 1L", 165, "Staples", True, "oil", 1.0),
                ("Toor Dal 1kg", 159, "Staples", True, "rice", 1.0), ("Potato Chips", 20, "Snacks", True, "snacks", 0.1),
                ("Cola 750ml", 40, "Beverages", True, "snacks", 0.8), ("Atta 5kg", 279, "Staples", True, "bread", 5.0)],
    "s-greens": [("Tomato 1kg", 38, "Vegetables", True, "veg", 1.0), ("Onion 1kg", 42, "Vegetables", True, "veg", 1.0),
                 ("Banana (12 pcs)", 60, "Fruits", True, "fruits", 1.2), ("Apple Shimla 1kg", 180, "Fruits", True, "fruits", 1.0),
                 ("Spinach Bunch", 25, "Vegetables", True, "veg", 0.3)],
    "s-dairy": [("Toned Milk 1L", 56, "Dairy", True, "milk", 1.0), ("Brown Bread", 45, "Bakery", True, "bread", 0.4),
                ("Farm Eggs (6)", 54, "Dairy", True, "eggs", 0.4), ("Curd 500g", 35, "Dairy", True, "milk", 0.5),
                ("Paneer 200g", 90, "Dairy", True, "milk", 0.2)],
    "s-brew": [("Cappuccino", 149, "Coffee", True, "coffee"), ("Chocolate Brownie", 119, "Desserts", True, "dessert"),
               ("Blueberry Cheesecake", 199, "Desserts", True, "dessert")],
}


async def seed():
    cfg = await db.platform_config.find_one({"id": "fees"})
    if not cfg:
        await db.platform_config.insert_one({
            "id": "fees", "delivery_base": 20, "delivery_per_km": 6, "free_delivery_threshold": 499, "convenience_fee": 5,
            "commission_pct": 15, "community_delivery_discount": 0.6,
            "radius_km": {"food": 5, "grocery": 5, "scheduled_food": 8, "scheduled_grocery": 10, "community": 10}})
    for (sid, name, cat, btype, cuisine, img, rating, dist, eta, is_new, offer, min_order) in SELLERS:
        doc = {"id": sid, "name": name, "category": cat, "business_type": btype, "cuisine": cuisine, "image": IMG[img], "rating": rating,
               "distance_km": dist, "eta_min": eta + int(dist * 4), "prep_time_min": eta, "is_new": is_new, "offer": offer, "min_order": min_order,
               "approved": True, "open": True, "fssai_status": "verified" if cat == "food" else "not_required",
               "address": "Koramangala, Bengaluru", "location": {"type": "Point", "coordinates": [77.6245 + dist / 200, 12.9352]},
               "opened_on": iso(now() - timedelta(days=7 if is_new else 400))}
        await db.sellers.update_one({"id": sid}, {"$set": doc, "$setOnInsert": {"trend_score": int(rating * 10), "orders_count": 0}}, upsert=True)
        for idx, row in enumerate(P[sid]):
            pname, price, pcat, veg, pimg = row[:5]
            weight = row[5] if len(row) > 5 else 0.5
            pid = f"{sid}-p{idx}"
            await db.products.update_one({"id": pid}, {"$set": {
                "id": pid, "seller_id": sid, "name": pname, "price": price, "category": pcat, "veg": veg, "image": IMG[pimg],
                "available": True, "weight_kg": weight, "description": f"Freshly prepared {pname.lower()}" if cat == "food" else pcat},
                "$setOnInsert": {"stock": 200}}, upsert=True)
    for code, ctype, val, min_order, mx, desc in [("GATHR50", "flat", 50, 299, 50, "₹50 off on orders above ₹299"),
                                                  ("ROOMIES20", "percent", 20, 399, 120, "20% off orders above ₹399, up to ₹120"),
                                                  ("FRESH10", "percent", 10, 199, 60, "10% off groceries up to ₹60")]:
        await db.coupons.update_one({"code": code}, {"$set": {"code": code, "type": ctype, "flat": val if ctype == "flat" else 0,
                                                              "percent": val if ctype == "percent" else 0, "min_order": min_order,
                                                              "max_discount": mx, "description": desc, "active": True}}, upsert=True)
    for rid, name, vehicle, mp, mw in [("r-1", "Ravi Kumar", "Bike", 4, 12), ("r-2", "Suresh N", "Bike", 3, 8), ("r-3", "Imran Pasha", "Scooter", 5, 15)]:
        await db.riders.update_one({"id": rid}, {"$set": {"id": rid, "name": name, "phone": "+9190000000" + rid[-1], "vehicle": vehicle,
                                                          "max_packages": mp, "max_weight_kg": mw, "available": True, "verified": True},
                                                 "$setOnInsert": {"active_jobs": 0}}, upsert=True)
    reels = [("rl-1", "s-paradise", "Dum biryani, sealed & slow-cooked for 4 hours", "biryani", True),
             ("rl-2", "s-brew", "We're open! Opening week 30% off on all desserts", "dessert", False),
             ("rl-3", "s-greens", "Farm to flat in 30 minutes — fresh greens daily", "veg", True),
             ("rl-4", "s-rollwala", "Kolkata-style kathi rolls, now in Koramangala", "rolls", False),
             ("rl-5", "s-slice", "Hand-stretched sourdough pizzas from our cloud kitchen", "pizza", False)]
    for rid, sid, title, img, sp in reels:
        await db.reels.update_one({"id": rid}, {"$set": {"id": rid, "seller_id": sid, "title": title, "media_url": IMG[img], "media_type": "image",
                                                         "sponsored": sp, "moderation": "approved", "created_at": iso(now())},
                                                "$setOnInsert": {"likes": 120 + len(title)}}, upsert=True)

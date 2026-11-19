# SMART CART V3 — UPDATED SELLER ECOSYSTEM FEATURE ROADMAP

**Document Version:** 2.0 (Post Phase 1 Implementation)  
**Status:** Living Engineering Document  
**Date:** November 19, 2026  

---

## 1. MILESTONE PROGRESS SUMMARY

| Phase / Tier | Scope | Status | Verification Reference |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Seller Onboarding, Business Profile, Verification & Discover Integration** | **COMPLETED** | `backend/tests/test_seller_phase1_e2e.py` (100% Pass) |
| **Phase 2 (Upcoming)** | **Real-Time Push Alerts, Kitchen Audio Chime, Product Variants & Modifiers** | Planned | P1 Operational Completeness |
| **Phase 3** | **Financial Ledger Reconciliation & Automated Payout Pipeline** | Planned | Relational Ledger & RazorpayX |
| **Phase 4** | **Enterprise Multi-Outlet Chains & Bluetooth Thermal Hardware Integration** | Planned | Scale & Restaurant POS |

---

## 2. STATUS BY PRIORITY ITEM

### P0 — LAUNCH BLOCKERS & CRITICAL DEFECTS

* [x] **1. Fix Customer Discover Hardcoded Mock Leaks**
  * *Completed:* Replaced "Test Kitchen" with real merchant logo/monogram; replaced "Cloud Kitchen" with real business type; replaced hardcoded Visakhapatnam with parsed address; replaced dummy phone with live store contact.
* [x] **2. Fix Product Availability Toggle Anti-Pattern**
  * *Completed:* Replaced destructive full `PUT` in `frontend/app/partner/(tabs)/menu.tsx` with optimized `PATCH /products/{id}/availability`. Custom product photos are 100% preserved.
* [x] **3. Enforce FSSAI Verification Conditional Badge**
  * *Completed:* Discover card conditionally renders "FSSAI Verified" green badge ONLY when `seller.fssai_status === "verified"`.
* [x] **4. Isolate Seeded Stores & Fix Seller Delivery Bypass**
  * *Completed:* Seeded demo stores tagged with `is_demo: True`. Real merchant stores strictly require seller acceptance and packing.
* [ ] **5. Reconcile Financial Ledger & Commission Discrepancies**
  * *Status:* **Pending Phase 2.** Relational SQLite/Postgres commission calculation (10% on gross) must be aligned with MongoDB pricing helper (15% on food subtotal), and Cash-on-Delivery (COD) orders must be recorded in relational ledger upon completion.

---

### P1 — CORE OPERATIONAL COMPLETENESS (NEXT PRIORITY)

* [ ] **6. Real-Time Push Alerts & Kitchen Audio Chime**
  * *Details:* Replace 15-second interval polling on `partner/(tabs)/index.tsx` with WebSockets / Server-Sent Events (SSE) and Expo Push Notifications. Implement an audible alarm loop with screen wake-lock for new orders.
  * *Complexity:* High.
* [ ] **7. Product Variants, Add-ons & Modifiers**
  * *Details:* Expand product model beyond flat pricing to support variant sizes (Small/Medium/Large), weights (250g/500g/1kg), and customizable addon groups (extra cheese, spice levels, crust choices).
  * *Complexity:* High.
* [ ] **8. Bank Account Setup & Automated Settlement Pipeline**
  * *Details:* Implement merchant bank account management in `shop.tsx` (Account Number, IFSC, Account Holder Name). Activate `SellerSettlement` model with automated daily batch settlement worker.
  * *Complexity:* High.
* [x] **9. Structured Geolocation & Address Persistence**
  * *Completed in Phase 1:* Onboarding captures street address, city, state, pincode, GPS latitude and longitude, and persists GeoJSON Point to MongoDB `2dsphere` index.
* [x] **10. Operating Schedule & Quick Store Open/Close Toggle**
  * *Completed in Phase 1:* Instant `open` toggle implemented in `shop.tsx` with live customer storefront reflection ("Open till [closes_at]" or "Closed").
* [ ] **11. Rider Tracking & Contact Visibility for Merchants**
  * *Details:* Expose assigned rider first name, masked phone number, and live arrival ETA on `order/[id].tsx` once pickup is claimed.
  * *Complexity:* Low.

---

### P2 — GROWTH, DISCOVER & MERCHANT ENABLEMENT

* [x] **12. Multi-Image Banner & Ambience Gallery Management**
  * *Completed in Phase 1:* Merchants can upload and delete photos in their ambience gallery directly from `partner/(tabs)/shop.tsx`.
* [ ] **13. Merchant Analytics Dashboard**
  * *Details:* Build dedicated analytics screen for 7-day / 30-day revenue trends, best-selling items, cancellation rates, and customer reviews.
  * *Complexity:* Medium.
* [x] **14. Document Upload & Compliance Verification**
  * *Completed in Phase 1:* FSSAI certificate upload, GSTIN, and Business PAN capture implemented and linked to Admin review pane.

---

### P3 — ENTERPRISE & HARDWARE INTEGRATION

* [ ] **15. Kitchen Order Ticket (KOT) Bluetooth Thermal Receipt Printing**
  * *Details:* ESC/POS 80mm and 58mm thermal receipt printing for kitchen cooks and bag slips.
  * *Complexity:* High.
* [ ] **16. Multi-Outlet Brand Management**
  * *Details:* Allow one merchant account to manage multiple branches with an outlet switcher in the Partner header.
  * *Complexity:* High.
* [ ] **17. Rider Handover Verification (QR / Pickup OTP)**
  * *Details:* Merchant verifies rider pickup OTP or scans rider QR code before handing over packages.
  * *Complexity:* Medium.

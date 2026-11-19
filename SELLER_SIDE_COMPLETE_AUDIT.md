# SMART CART V3 — COMPREHENSIVE SELLER SIDE FUNCTIONALITY AUDIT & GAP ANALYSIS
**Document Status:** Final Audit Deliverable (Audit-Only Task — Zero Code Modifications Made)  
**Target Systems:** Smart Cart v3 Seller Partner Experience, Admin Review & Governance, Relational Financial Ledger, Customer-Facing Discover & Storefront  
**Date of Inspection:** November 19, 2026  

---

## EXECUTIVE SUMMARY & AUDIT SCORECARD

A rigorous, end-to-end architectural and code-level audit was conducted across both backend (`backend/`) and frontend (`frontend/`) codebases of Smart Cart v3. The inspection traced seller lifecycle workflows from merchant authentication and onboarding to catalogue management, order fulfillment, community batch consolidation, financial reconciliation, and customer-facing discovery.

### Overall Seller Ecosystem Maturity
* **Current Operational State:** Functional Early-Stage MVP with severe feature fragmentation, dual-database desynchronization, and significant customer-facing mock data leakage.
* **Core Strengths:** Fast order status state machine (`confirmed` -> `preparing` -> `ready_for_pickup`), interactive item-by-item packing checklist (`POST /seller/orders/{id}/pack`), unique apartment community batch pick-list consolidation (`/seller/community-batches`), and clean RBAC (`seller_only = require("seller")`).
* **Critical Flaws & Deficits:**
  1. **Dual-Database Disconnect:** MongoDB handles 100% of live seller, catalog, and order data. The PostgreSQL/SQLite relational ledger (`database/service.py`) contains zero merchant tables, hardcodes commission at a conflicting 10% rate (vs. 15% in MongoDB `pricing.py`), ignores Cash-on-Delivery (COD) orders entirely, and leaves the `SellerSettlement` model (`models.py:75`) completely dead.
  2. **Seeded "Ghost Stores":** All 10 seeded stores (`s-paradise`, `s-slice`, `s-dairy`, etc.) lack `owner_id`. No human merchant can log in or manage them. Furthermore, customer delivery bypasses seller packing on seeded stores via `delivery.py:270-272`.
  3. **Customer Discover UI Hardcoding:** `frontend/app/listing/[type].tsx` hardcodes "Test Kitchen" as the logo text, "Cloud Kitchen" on all store cards (even supermarkets), "Visakhapatnam, Andhra Pradesh - 530017" as the city/pincode for every store, "+91 98765 43210" as the contact number, and "Open till 11PM" on storefront headers regardless of real operating hours.
  4. **Single-Store Constraint:** Strict 1:1 user-to-store mapping enforced by unique partial index on `db.sellers.owner_id` (`server.py:27`). Merchants cannot operate multi-outlet chains or brand branches.
  5. **No Financial Settlements / Payout Pipeline:** No bank account details (IFSC, Account Number, UPI), no automated settlement batches, and no seller payout request workflow exist.

---

## 1. SELLER ARCHITECTURE & DATA FLOW TRACE

```
                                  +------------------------------------+
                                  |      Merchant Mobile Device        |
                                  |   (frontend/app/partner/*.tsx)     |
                                  +-----------------+------------------+
                                                    |
                                      JWT Bearer    |  REST API Calls
                                     (role: seller) |  (/api/seller/*)
                                                    v
                                  +------------------------------------+
                                  |        FastAPI Backend             |
                                  |     (backend/services/seller.py)   |
                                  +--------+------------------+--------+
                                           |                  |
                          100% Operational |                  | Relational Ledger
                          State & Catalog  |                  | (Mirroring only)
                                           v                  v
                       +-----------------------+     +------------------------+
                       |    MongoDB Database   |     | PostgreSQL / SQLite DB |
                       | (db.sellers, products,|     | (SQLAlchemy Service:   |
                       |  orders, audit_logs)  |     |  orders, payments,     |
                       +-----------------------+     |  ledger_entries)       |
                                  |                  +------------------------+
                  Sync Pipeline   |                   * Missing sellers table
                  & Discover Feed |                   * SellerSettlement DEAD
                                  v
                       +-----------------------+
                       | Customer Discover UI  |
                       | (listing/[type].tsx)  |
                       +-----------------------+
```

### Complete Seller Lifecycle Data Flow
1. **Merchant Registration:** User signs up (`POST /api/auth/register`) and requests `"seller"` role. User document created in `db.users`.
2. **Onboarding Form Submission:** Seller fills single-screen form (`onboarding.tsx`), submitting `POST /api/seller/onboarding`.
3. **Database Persistence:** Initial seller document inserted into MongoDB `db.sellers` with `approval_status: "pending_review"` (or `"approved"` if `seller_auto_approve` is toggled in config).
4. **Admin Verification:** Super-admin navigates to `frontend/app/admin/(tabs)/shops.tsx` and executes `POST /api/admin/sellers/{id}/approve` or `POST /api/admin/sellers/{id}/reject`.
5. **Customer Visibility:** Customer visits `frontend/app/listing/[type].tsx` or `frontend/app/search.tsx`. `catalog.py:100` filters `db.sellers` with `{"approved": True, "open": True}`.
6. **Order Receipt & Fulfillment:** Customer places order. Seller dashboard polls `GET /api/seller/orders` every 15s. Seller transitions status: `confirmed` -> `preparing` -> `ready_for_pickup`.
7. **Settlement & Payout:** **BROKEN / MISSING**. MongoDB records `today_payout` in memory, but no bank payout pipeline or automated ledger payout exists.

---

## 2. DETAILED SUBSYSTEM AUDIT

### 2.1 Seller Login & Authentication
* **Frontend Screen:** `frontend/app/login.tsx` (supports query param `?partner=1`).
* **Route Protection:** `frontend/app/partner/_layout.tsx:10-11` checks `useAuth()`. If `!user`, redirects to `/login?partner=1`; if `user.role !== "seller"`, redirects to `/`.
* **Backend Endpoint:** `POST /api/auth/login` (`backend/services/auth.py:53`).
* **Security Findings:**
  * JWT tokens encode `{ "sub": user_id, "role": user.role }`. Tokens expire in 15 minutes (`ACCESS_TOKEN_EXPIRE_MINUTES = 15`), with a refresh token mechanism (`/api/auth/refresh`).
  * **Critical Gap — Role Tampering at Registration:** In `backend/services/auth.py:34-45`, `RegisterIn` accepts `role: Literal["customer", "seller", "rider"] = "customer"`. Any client can register directly with `role: "seller"` without phone OTP verification or admin pre-authorization.
  * **No Multi-User / Staff Permissions:** Only a single user can log in as the store merchant. No sub-accounts exist for kitchen managers, cashiers, or packing staff.

### 2.2 Seller Registration & Onboarding
* **Frontend Screen:** `frontend/app/partner/onboarding.tsx` (83 lines).
* **Backend Endpoint:** `POST /api/seller/onboarding` (`backend/services/seller.py:126-145`).
* **Backend Validation Model:** `OnboardIn` (`backend/services/seller.py:28-50`).
* **Validation Gaps:**
  * Client side performs **zero empty-string or length validation**; invalid forms immediately crash with backend 422 errors.
  * `business_type` is restricted to 3 choices: `"restaurant"`, `"cloud_kitchen"`, `"kirana"`. Supermarkets, bakeries, meat shops, and pharmacies cannot onboard.
  * Location is not captured via map or GPS: coordinates are hardcoded to `[77.6245, 12.9352]` (Koramangala, Bangalore) on line 139.
  * Store cover photo is restricted to 18 stock Unsplash presets (`PRESET_IMAGES`, lines 15-25). No custom storefront image upload is supported during onboarding.
  * FSSAI number validation is a naive 14-digit regex (`^\d{14}$`). No document upload or checksum verification is implemented.

### 2.3 Seller Dashboard
* **Frontend Screen:** `frontend/app/partner/(tabs)/index.tsx` (126 lines).
* **Backend Endpoint:** `GET /api/seller/summary` (`backend/services/seller.py:310-322`).
* **Functionality & Data Provenance:**
  * Metrics displayed: `New`, `Preparing`, `Ready`, and `Today payout`.
  * Metrics are computed live from MongoDB fulfillable orders created since midnight IST today (`orders.py:25`).
  * Real-time update mechanism is **client-side polling every 15,000ms (15 seconds)** (`index.tsx:28`).
* **Operational Gaps:**
  * **No Sound / Audible Chime:** In busy kitchen operations, new incoming orders do not sound an alarm.
  * **No Push Notifications:** No Firebase Cloud Messaging (FCM) or Expo Push Notification integration for foreground/background order alerts.
  * **No Screen Wake-Lock:** The tablet/phone screen turns off during inactivity.
  * **No Quick Open/Close Toggle:** The seller must switch to the Settings tab to pause or resume order acceptance.

### 2.4 Seller Catalogue & Product Management
* **Frontend Screens:** `frontend/app/partner/(tabs)/menu.tsx` (Catalog list) & `frontend/app/partner/product.tsx` (Product Create/Edit form).
* **Backend Endpoints:**
  * `GET /api/seller/products` (`backend/services/seller.py:195`)
  * `POST /api/seller/products` (`backend/services/seller.py:202`)
  * `PUT /api/seller/products/{id}` (`backend/services/seller.py:220`)
  * `DELETE /api/seller/products/{id}` (`backend/services/seller.py:241`)
  * `PATCH /api/seller/products/{id}/availability` (`backend/services/seller.py:260`)
* **Critical Architectural Defect — Availability Toggle:**
  * The backend provides an optimized `PATCH /products/{id}/availability` endpoint that handles atomic availability changes, Redis menu cache eviction (`seller_menu:{sid}`), and SQS notification dispatch.
  * However, `frontend/app/partner/(tabs)/menu.tsx:26-35` **completely ignores the PATCH endpoint**. Instead, it performs a full entity overwrite via `PUT /seller/products/{id}`.
  * During this `PUT`, the frontend attempts to reverse-engineer `image_key` from Unsplash image URLs. If a product uses a custom uploaded image (`/api/files/...`), the lookup fails and silently corrupts the product image to the default `"store"` preset.
* **Catalogue Model Deficits:**
  * **No Variants:** Sizes (Small/Medium/Large), weights (500g/1kg), or portion counts are completely unsupported.
  * **No Add-ons / Modifiers:** Customizations such as extra toppings, dips, crust choices, or cooking notes do not exist.
  * **No Dietary Nuance:** Only a single binary boolean `veg: true/false`. No support for Vegan, Eggitarian, Jain, or Halal.
  * **No Allergen Declarations:** Peanuts, gluten, dairy, and soy warnings are absent.
  * **No Pricing Granularity:** No MRP vs. Selling Price, no B2B wholesale pricing, and no GST tax slab assignment (0%, 5%, 12%, 18%).
  * **Flat Inventory:** A simple integer `stock` count exists (`$inc: -qty` on checkout in `orders.py:157`), but there is no low-stock alert, batch tracking, or expiry date management.

### 2.5 Seller Order Management & Fulfilment
* **Frontend Screens:** `frontend/app/partner/order/[id].tsx` (Order Details & Checklist) & `frontend/app/partner/batch/[id].tsx` (Apartment Basket Consolidation).
* **Backend Endpoints:**
  * `GET /api/seller/orders` (`backend/services/seller.py:325`)
  * `GET /api/seller/orders/{id}` (`backend/services/seller.py:339`)
  * `POST /api/seller/orders/{id}/accept` (`backend/services/seller.py:344`)
  * `POST /api/seller/orders/{id}/reject` (`backend/services/seller.py:354`)
  * `POST /api/seller/orders/{id}/pack` (`backend/services/seller.py:372`)
  * `POST /api/seller/orders/{id}/ready` (`backend/services/seller.py:383`)
  * `GET /api/seller/community-batches` (`backend/services/seller.py:390`)
* **State Transition & Packing Flow:**
  * When a customer order is paid, its status becomes `confirmed`.
  * Seller clicks "Accept Order" -> status transitions to `preparing`. (Cannot adjust prep time during acceptance).
  * Seller clicks item checkboxes -> `POST /pack` updates `packed: [true, false, ...]`.
  * Once all items are checked (`all_packed: true`), "Ready for Pickup" becomes enabled -> status transitions to `ready_for_pickup`.
  * Rejection: Bottom sheet allows selecting 3 preset reasons (`Item unavailable`, `Kitchen too busy`, `Closing soon`). Triggers auto-cancellation, full customer refund, and audit log.
* **Fulfilment Blindspots:**
  * **Zero Rider Information:** `backend/services/seller.py:105-113` deliberately strips the rider object from `seller_view`. The merchant cannot see the rider's name, vehicle number, phone number, or arrival ETA.
  * **Zero Handover Verification:** No OTP, barcode, or QR code is scanned to ensure the rider picks up the correct bag.
  * **Zero Printing Support:** No Bluetooth / ESC-POS thermal receipt printer integration for kitchen order tickets (KOT).

### 2.6 Seller Store Settings & Profile Management
* **Frontend Screen:** `frontend/app/partner/(tabs)/shop.tsx` (126 lines).
* **Backend Endpoint:** `PUT /api/seller/shop` (`backend/services/seller.py:182`).
* **Missing Settings in Frontend UI:**
  * While backend `ShopUpdate` (`backend/services/seller.py:53-66`) accepts `banner_url`, `description`, `gallery`, and `highlights`, **`shop.tsx` renders NO inputs for any of these fields**.
  * Sellers cannot edit store address, GPS coordinates, delivery radius, packaging fees, or bank account details.
  * Temporary holiday closure / vacation pause mode is missing.

### 2.7 Admin Seller Management & Governance
* **Frontend Screen:** `frontend/app/admin/(tabs)/shops.tsx` (118 lines).
* **Backend Endpoints:**
  * `GET /api/admin/sellers` (`backend/services/admin.py:173`)
  * `POST /api/admin/sellers/{id}/approve` (`backend/services/admin.py:180`)
  * `POST /api/admin/sellers/{id}/reject` (`backend/services/admin.py:192`)
  * `POST /api/admin/sellers/{id}/suspend` (`backend/services/admin.py:204`)
  * `POST /api/admin/sellers/{id}/reinstate` (`backend/services/admin.py:214`)
  * `POST /api/admin/sellers/{id}/commission` (`backend/services/admin.py:224`)
* **Governance Gaps:**
  * Admin rejection does not send a notification or explanation email to the merchant.
  * Store documents (FSSAI licenses, GST certificates) cannot be reviewed or downloaded because document file upload was never implemented.

---

## 3. SELLER FINANCIAL RECONCILIATION & LEDGER AUDIT

A deep inspection of `backend/database/models.py`, `backend/database/service.py`, `backend/services/payments.py`, and `backend/services/seller.py` revealed severe architectural discrepancies between MongoDB and PostgreSQL.

### 3.1 Dual-Database Divergence Matrix

| Architectural Dimension | MongoDB Operational Layer (`backend/services/`) | PostgreSQL / SQLite Relational Layer (`backend/database/`) | Status / Risk |
| :--- | :--- | :--- | :--- |
| **Seller Profiles & Stores** | Fully managed in `db.sellers`. Stores name, category, FSSAI, address, coords, ratings. | **Zero seller tables**. Sellers do not exist in the relational schema. | **CRITICAL**: Relational database cannot identify merchant details. |
| **Product Catalog** | Fully managed in `db.products`. 60+ seeded items with pricing, category, stock. | **Zero product tables**. Line items stored as unstructured JSON in `orders.items`. | **HIGH**: No relational integrity for inventory or catalog. |
| **Commission Rate** | **15% on Food Subtotal** (`backend/services/pricing.py:52`): `round(food_subtotal * 0.15, 2)`. Grocery commission is 0%. | **10% on Gross Customer Total** (`backend/database/service.py:124`): `round(order.total_amount * Decimal("0.10"), 2)` including delivery fees! | **CRITICAL FINANCIAL BUG**: MongoDB and Postgres ledger calculate completely contradictory commission amounts for every order. |
| **Cash-on-Delivery (COD)** | Supported in `db.orders`. Updates `payment_status: "pending_cod"`. | **Completely Ignored**. `record_order_payment` is ONLY called on online Razorpay webhook (`payments.py:169`). COD orders are NEVER recorded in the financial ledger! | **CRITICAL AUDIT DEFECT**: COD orders bypass relational accounting entirely. |
| **Settlement Pipeline** | Calculates `today_payout = subtotal - commission` in memory for display. | Model `SellerSettlement` defined in `models.py:75-88` with `period_start`, `period_end`, `payout_reference`. | **DEAD CODE**: `SellerSettlement` is NEVER instantiated, queried, or updated anywhere in the codebase. |

---

## 4. SELLER DISCOVERY & CUSTOMER STOREFRONT AUDIT

### 4.1 The Seeded "Ghost Store" Problem
In `backend/seed.py:118-135`, 10 demo stores are seeded into `db.sellers` (`s-paradise`, `s-slice`, `s-dairy`, `s-udupi`, `s-burger`, `s-brew`, `s-greens`, `s-fresh`, `s-rollwala`, `s-bake`).
* **Missing Owner ID:** None of these stores have an `owner_id` field populated.
* **Impact:** Real merchants cannot log in to claim, edit, or receive orders for these stores.
* **Delivery Bypass:** In `backend/services/delivery.py:270-272`:
  ```python
  # Auto-advance seeded demo shops without active owners so demo flow doesn't stall
  if shop and shop.get("owner_id"):
      # Real store: waits for seller acceptance and packing
  else:
      # Ghost store: bypasses seller acceptance and instantly assigns rider
  ```
  Consequently, customer tests on seeded stores do not test actual seller workflows.

### 4.2 Customer Discover Hardcoded Mock Leaks
When customers open `frontend/app/listing/[type].tsx` or `frontend/app/seller/[id].tsx`, multiple critical UI elements display hardcoded mock data rather than live seller data:
1. **Hardcoded Logo Text:** Line 757 renders `<Text style={discoverCardStyles.shopLogoText}>Test{"\n"}Kitchen</Text>` on **every single discover card**.
2. **Hardcoded Business Type:** Line 690 renders `"Cloud Kitchen"` unconditionally, even for supermarkets and bakeries.
3. **Hardcoded Address Line 2:** Line 597 renders `"Visakhapatnam, Andhra Pradesh - 530017"` across all stores regardless of their actual location.
4. **Hardcoded Contact Phone:** Line 851 renders `+91 98765 43210` on every card.
5. **Hardcoded Storefront Hours:** `frontend/app/seller/[id].tsx:737` renders `"Open till 11PM"` even if the seller configured `closes_at: "20:00"`.
6. **Hardcoded Delivery Fee:** Line 819 renders `"₹30 delivery"` regardless of distance or order value.
7. **Synthetic Popularity Metrics:** `frontend/src/components/seller-card.tsx:68-83` computes fake review and order counts via mathematical hashes on `seller.id`.

---

## 5. FEATURE COMPLETENESS & TRACEABILITY MATRIX

| Feature Area | Frontend Screen / File | Backend API Endpoint | Backend Service File | Database Model / Collection | Implementation Status | Critical Deficit / Root Cause |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Seller Registration** | `partner/onboarding.tsx` | `POST /api/seller/onboarding` | `services/seller.py:126` | MongoDB `db.sellers` | **Partial** | No client validation, hardcoded GPS coords, restricted to stock photos. |
| **Seller Dashboard** | `partner/(tabs)/index.tsx` | `GET /api/seller/summary` | `services/seller.py:310` | MongoDB `db.orders` | **Partial** | Polling only (15s), no push alerts, no audio chime, no quick open/close. |
| **Menu Listing** | `partner/(tabs)/menu.tsx` | `GET /api/seller/products` | `services/seller.py:195` | MongoDB `db.products` | **Implemented** | Functional listing, category grouping. |
| **Product Create/Edit** | `partner/product.tsx` | `POST/PUT /api/seller/products` | `services/seller.py:202` | MongoDB `db.products` | **Partial** | No variants, add-ons, modifiers, allergens, or tax slabs. |
| **Instant OOS Toggle** | `partner/(tabs)/menu.tsx:26` | `PUT /api/seller/products/{id}` | `services/seller.py:220` | MongoDB `db.products` | **Broken / Fragile** | Calls destructive full `PUT` instead of existing `PATCH /availability`; corrupts image URLs. |
| **Store Settings** | `partner/(tabs)/shop.tsx` | `PUT /api/seller/shop` | `services/seller.py:182` | MongoDB `db.sellers` | **Incomplete** | Missing UI inputs for banner, description, gallery, and highlights. |
| **Order Acceptance** | `partner/order/[id].tsx:102`| `POST /api/seller/orders/{id}/accept` | `services/seller.py:344` | MongoDB `db.orders` | **Implemented** | Cannot adjust prep time dynamically. |
| **Order Rejection** | `partner/order/[id].tsx:101`| `POST /api/seller/orders/{id}/reject` | `services/seller.py:354` | MongoDB `db.orders` | **Implemented** | Preset reasons only, auto-cancels and auto-refunds. |
| **Item Packing Checklist** | `partner/order/[id].tsx:70` | `POST /api/seller/orders/{id}/pack` | `services/seller.py:372` | MongoDB `db.orders` | **Implemented** | Interactive checkbox per item; enforces 100% check before ready. |
| **Order Ready for Pickup**| `partner/order/[id].tsx:106`| `POST /api/seller/orders/{id}/ready` | `services/seller.py:383` | MongoDB `db.orders` | **Implemented** | Transitions status to `ready_for_pickup`. |
| **Community Batch View** | `partner/batch/[id].tsx` | `GET /api/seller/community-batches`| `services/seller.py:390` | MongoDB `db.orders` | **Implemented** | Consolidated kitchen pick list + flat packages. |
| **Rider Tracking for Seller**| `partner/order/[id].tsx` | None | `services/seller.py:105` | MongoDB `db.orders` | **Missing** | Backend strips rider object and contact from seller view. |
| **KOT / Receipt Printing**| `partner/order/[id].tsx` | None | None | None | **Missing** | No ESC/POS or Bluetooth printing integration. |
| **FSSAI Document Upload** | None | None | None | None | **Missing** | Only raw 14-digit text input; no PDF/image upload. |
| **GSTIN & Tax Verification**| None | None | None | None | **Missing** | No GST fields or verification. |
| **Bank Account & Payouts**| None | None | None | None | **Missing** | No bank details captured; `SellerSettlement` is dead code. |
| **Financial Ledger (Mirror)**| None | None | `database/service.py:124` | PostgreSQL `ledger_entries` | **Defective** | Commission calculation mismatch (10% vs 15%), ignores COD orders. |
| **Admin Seller Approval** | `admin/(tabs)/shops.tsx` | `POST /api/admin/sellers/{id}/approve`| `services/admin.py:180` | MongoDB `db.sellers` | **Implemented** | Approves store; sets `fssai_status: "verified"`. |
| **Discover Feed API** | `listing/[type].tsx` | `GET /api/discover` | `services/catalog.py:100` | MongoDB `db.sellers` | **Implemented** | Returns rich showcase items with fallbacks. |
| **Discover UI Display** | `listing/[type].tsx:474` | `GET /api/discover` | `services/catalog.py:100` | Frontend UI State | **Severe Mock Leaks** | Hardcoded logo text, badges, address line 2, phone number, and hours. |

---

## 6. SECURITY & REGULATORY COMPLIANCE FINDINGS

1. **Role Escalation Vulnerability (`backend/services/auth.py:34-45`):**
   * The public registration endpoint accepts `role: "seller"` without phone OTP verification or prior admin invite. Any malicious user can generate a seller token.
2. **Missing FSSAI Document Enforcement:**
   * Food Safety and Standards Authority of India (FSSAI) compliance mandates verifying the physical license certificate. Smart Cart v3 only accepts an arbitrary 14-digit string without document proof.
3. **Data Privacy in Seller View (`backend/services/seller.py:105-113`):**
   * The privacy redaction in `seller_view` correctly masks customer phone numbers, delivery OTPs, and payment transaction IDs from merchants.
4. **Unauthenticated File Uploads (`backend/services/media.py`):**
   * Verification needed on whether `/api/files/upload` restricts MIME types and scans for malicious payloads before persisting to disk.

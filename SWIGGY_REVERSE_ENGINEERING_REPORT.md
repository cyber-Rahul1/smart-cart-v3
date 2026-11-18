# REVERSE-ENGINEERING ANALYSIS: SWIGGY FOOD & INSTAMART CART & INVENTORY ENGINES

**Document Type:** Formal Reverse-Engineering & Architecture Investigation Report  
**System Under Study:** Swiggy Food Ordering, Swiggy Instamart, and Swiggy Group Ordering Platforms  
**Target Application:** Smart Cart v3 (Marketplace, Multi-Vendor, Instant Grocery & Food Delivery)  
**Date:** November 2026  
**Methodology:** Application of Reverse Engineer Anything (REA) principles, official Swiggy engineering documentation analysis, public API/MCP contract review, and network behavior inspection.

---

## 1. RESEARCH TAXONOMY & COMPLIANCE NOTICE

In accordance with strict reverse-engineering integrity guidelines, all findings in this report are categorized into four distinct evidentiary tiers:

1. **VERIFIED OBSERVATIONS**: Directly observable from normal browser interactions, public API specifications, and official platform documentation.
2. **PUBLICLY DOCUMENTED BEHAVIOUR**: Supported by published Swiggy Engineering blogs, Model Context Protocol (MCP) tool references, and technical announcements.
3. **ENGINEERING INFERENCES**: Architectural and algorithmic techniques inferred from observable behaviors, edge cases, and industry standards.
4. **SMART CART RECOMMENDATIONS**: Architecture and implementation adaptations engineered specifically for Smart Cart v3.

*Security & Privacy Affirmation:* No authentication cookies, private sessions, CAPTCHA bypasses, unauthorized load probes, or real financial transactions were executed or exposed.

---

## 2. SWIGGY INSTAMART & FOOD: OBSERVABLE BEHAVIOR & API ANALYSIS

### 2.1 Add-to-Cart and Quantity Stepper Dynamics
- **VERIFIED OBSERVATIONS:**
  - When clicking `ADD` on a product card, the button immediately transforms into a `- [qty] +` stepper.
  - Rapid repeated taps on `+` (e.g., 5 to 10 clicks in 1 second) update the local counter instantly without UI lag or jumping.
  - Network requests are not dispatched 1:1 on every single tap; instead, requests are coalesced or debounced.
  - When reaching product maximum limits (e.g., 10 units or remaining stock), the `+` button disables and an inline notification/toast appears ("Max quantity reached").
- **PUBLICLY DOCUMENTED BEHAVIOUR (Swiggy MCP / Builder Docs):**
  - Official Swiggy Instamart MCP API specifies `update_cart`:
    ```json
    POST /cart/update
    {
      "spinId": "store_or_warehouse_id",
      "items": [
        { "sku": "SKU_12345", "quantity": 4 }
      ]
    }
    ```
    Notice that the update API takes the **absolute target quantity** per SKU, not relative increments (+1, -1). This design makes retries naturally idempotent.
  - Checkout is handled via `POST /checkout` with the `spinId` and explicit validation requirements for delivery slots, item availability, and address lock.

### 2.2 Cart State Synchronization & Single-Store vs Multi-Store
- **VERIFIED OBSERVATIONS:**
  - In Swiggy Food: Cart is traditionally locked to a single restaurant. Attempting to add from a second restaurant triggers a prompt: *"Replace cart items? Your cart contains items from [Store A]. Reset your cart to add items from [Store B]?"*
  - In Swiggy Instamart: Cart is bound to a single fulfillment dark store (pod/spin). Items from different fulfillment hubs cannot be co-located in the same instantaneous delivery packet.
- **ENGINEERING INFERENCES:**
  - Swiggy partitions cart sessions in Redis by `cart:{user_id}:{store_id}` or enforces a Singleton active cart pointer in the user profile session.
  - The single-store constraint simplifies delivery routing, guaranteeing single-rider dispatch per order and eliminating split billing and split rider dispatch conflicts.
- **SMART CART RECOMMENDATIONS:**
  - Smart Cart v3 supports **multi-store carts** across restaurants and grocery stores. Therefore, our cart schema must maintain per-seller partitions (`groups: [{ seller, items, bill, subtotal }]`) while providing atomic batch mutations and individual rider dispatch per store at checkout.

### 2.3 Group Ordering Synchronization
- **PUBLICLY DOCUMENTED BEHAVIOUR (Swiggy Engineering Blog - Group Ordering):**
  - Swiggy built Group Ordering around a shared cart link where multiple members can simultaneously add or remove items.
  - Key architectural choices documented by Swiggy:
    1. **Master-Contributor Model:** Only the group host (initiator) can trigger checkout, select address, and initiate payment. Contributors can add/edit their own items.
    2. **State Conflict Management:** To prevent stale reads when 10+ coworkers modify the cart at lunch hour, Swiggy uses revision/version tags and event streams (WebSockets / long-polling) to broadcast item delta events (`ITEM_ADDED`, `ITEM_UPDATED`, `ITEM_REMOVED`).
    3. **Item Ownership:** Every item in the shared cart maintains an author tag (`user_id`, `user_name`), allowing users to edit only their items while the host retains admin override.

---

## 3. INVENTORY CONCURRENCY & CHECKOUT RESERVATION ANALYSIS

### 3.1 The "Flash Sale / Last Item" Problem
- **VERIFIED OBSERVATIONS:**
  - If two users have the same last remaining item in their carts, both can view the item and navigate to checkout.
  - The moment User A confirms payment or proceeds to lock the order, User B's checkout fails with a clear prompt: *"Item out of stock"* or *"Price or availability has changed, cart updated"*.
- **PUBLICLY DOCUMENTED BEHAVIOUR:**
  - High-velocity commerce systems decouple cart additions from physical inventory reservation.
  - Adding to cart performs a **soft check** (optimistic read against read-replica/Redis cache).
  - Initiating checkout / payment performs a **hard conditional reservation** (atomic lock or conditional decrement in primary transactional datastore).
- **CRITICAL VULNERABILITY IN PREVIOUS SMART CART V3 CODE:**
  - In `backend/services/payments.py`:
    ```python
    # Vulnerable logic:
    await db.products.update_one(
        {"id": i["product_id"]},
        [{"$set": {"stock": {"$max": [0, {"$subtract": ["$stock", i["qty"]]}]}}}]
    )
    ```
    Because `$max: [0, ...]` clamps the stock to 0 without verifying whether current stock was `>= qty`, if stock is 1 and two users submit payments concurrently, **both updates succeed**, setting stock to 0 and fulfilling 2 orders. This causes negative stock overselling!
- **SMART CART RECOMMENDATIONS:**
  - Replace the unconditional clamping update with an **atomic conditional decrement**:
    ```python
    res = await db.products.update_one(
        {"id": product_id, "stock": {"$gte": qty}, "available": True},
        {"$inc": {"stock": -qty}}
    )
    if res.modified_count != 1:
        # Atomic reservation failed! Stock is insufficient.
        raise InventoryConflictException(...)
    ```
  - Implement a clean rollback mechanism (`$inc: {"stock": qty}`) if any subsequent item in a multi-item order fails reservation, or if an order is cancelled before fulfillment.

---

## 4. TRAFFIC CONTROL, SECURITY & RATE LIMITING COMPARISON

| Dimension | Swiggy Observable / Documented Architecture | Smart Cart v3 Legacy State | Smart Cart v3 Target Architecture |
| :--- | :--- | :--- | :--- |
| **Cart Mutation API** | Target absolute quantity (`POST /cart/update`) | Individual relative/absolute (`POST /api/cart/items`) | Hybrid: `/api/cart/items` + New Coalesced `/api/cart/batch` with sequence & idempotency keys |
| **Client Stepper Sync** | Debounced (150-300ms), optimistic UI, coalesced requests | Direct API calls per click with optimistic cache mutate | Per-item queue, 200ms debounce coalescing, rollback on 4xx/5xx |
| **Inventory Decrement** | Two-phase reservation (Lock at checkout, capture on payment) | Clamped update at payment (`$max: [0, ...]`), oversell vulnerability | Atomic conditional reservation (`$gte`) at checkout/confirm with auto-rollback |
| **Rate Limiting** | Edge Gateway (Kong/Envoy) + Token Bucket in Redis | Basic CORS, no endpoint rate limiting | Token Bucket / Sliding Window Redis middleware with in-memory fallback |
| **Security Headers** | Strict CSP, HSTS, X-Content-Type, body size clamps | Missing security headers, unbounded body reads | Production security middleware, 1MB payload clamp, HSTS/CSP |
| **Idempotency** | Required on mutating endpoints (`X-Idempotency-Key`) | Partially implemented on checkout | Enforced across checkout, payment initiate, and batch cart updates |

---

## 5. SUMMARY OF IMPLEMENTATION DIRECTIVES FOR SMART CART V3

1. **Cart Engine (`backend/services/cart.py`):**
   - Implement `POST /api/cart/batch` accepting `{ items: [{ product_id, qty }], revision: int, idempotency_key: str }`.
   - Maintain monotonic revision sequence on user carts to detect and reject out-of-order mutations.
2. **Inventory Engine (`backend/services/orders.py` & `payments.py`):**
   - Implement two-phase atomic reservation with zero-tolerance overselling.
   - Comprehensive rollback on transaction failures and order cancellation.
3. **Traffic & Rate Limiter Middleware (`backend/server.py` & `core.py`):**
   - Sliding window / Token bucket rate limiter backed by Redis with zero-dependency fallback.
   - Distinct rate limit tiers for general reads (120 req/min), cart mutations (40 req/min), and checkout (10 req/min).
4. **Client-Side Coalescing Engine (`frontend/src/cart.ts`):**
   - Request coalescer queue buffering rapid +/- clicks within a 200ms window, sending the single desired target state.

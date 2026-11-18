# SMART CART V3 — CART ENGINE & INVENTORY CONCURRENCY ARCHITECTURE

**System Specification & Technical Design Document**  
**Project:** Smart Cart v3 (Food Delivery, Instamart Grocery & Multi-Vendor Marketplace)  
**Status:** Implemented & Verified  
**Date:** November 2026  

---

## 1. ARCHITECTURAL OVERVIEW

Smart Cart v3 implements a high-throughput, multi-vendor cart engine and transactional inventory management system inspired by the observable behavior and documented architectures of Swiggy Food and Swiggy Instamart.

### 1.1 Core Problems Solved
1. **The Add-to-Cart Request Storm:** Rapid user taps on item counters (+/- steppers) previously triggered uncoordinated HTTP floods, creating database contention and out-of-order state overwrite risks.
2. **Flash Sale Inventory Overselling:** Previous payment confirmation used non-conditional stock deductions clamped by `$max: [0, ...]`, allowing concurrent checkouts to succeed even when inventory was exhausted (producing silent overselling and negative virtual stock).
3. **Multi-Store State Complexity:** Unlike traditional single-restaurant platforms, Smart Cart supports orders comprising products from multiple shops, requiring segmented grouping, per-store billing, and split delivery routing while maintaining atomic transaction boundaries.

---

## 2. HIGH-CONCURRENCY ADD-TO-CART ENGINE

### 2.1 Coalescing Mutation Pipeline (Client-Side)
- **Immediate Optimistic UI:** Whenever a customer taps `+` or `-` on a product stepper, React Query cache is mutated optimistically in zero milliseconds (`applyOptimisticCartItem`).
- **Per-Item Debounce & Queue:** Mutations for a single product are held in an in-memory queue (`mutateCartItemCoalesced`) with a 200ms coalescing window. Rapid clicks within 200ms collapse into a single desired target quantity.
- **Absolute Target Quantity Model:** Rather than dispatching relative delta commands (`+1, +1, +1`), the client transmits the final target state (`qty: 5`). This makes retries naturally idempotent.
- **Automatic Rollback:** If the backend rejects a mutation (e.g., product disabled, stock limit reached, or concurrency conflict), the client automatically rolls back to the exact pre-mutation state and resyncs with the server.

### 2.2 Monotonic Cart Revision & Batch API
- **Endpoint:** `POST /api/cart/batch`
  ```json
  {
    "items": [
      { "product_id": "prod_mango_01", "qty": 4 },
      { "product_id": "prod_milk_02", "qty": 2 }
    ],
    "expected_revision": 12,
    "idempotency_key": "c7a8b9-44d2"
  }
  ```
- **Revision Tracking:** Every user cart maintains a monotonically increasing integer (`revision`). If an out-of-order request arrives with `expected_revision < current_revision`, the server rejects it with `409 Conflict`, preventing stale network responses from corrupting newer local state.

---

## 3. ZERO-OVERSOLD ATOMIC INVENTORY ENGINE

### 3.1 Two-Phase Transactional Model
The inventory engine separates browsing from fulfillment:
- **Phase 1: Soft Validation (Cart / Quote):** Reading product availability and remaining stock from the read tier to display stock warnings ("Only 2 left!").
- **Phase 2: Hard Atomic Reservation (Checkout / Payment Confirmation):** Conditional atomic decrement against primary persistence.

### 3.2 Atomic Conditional Decrement & Compensating Rollback
In `backend/services/payments.py`:
```python
for item in order["items"]:
    pid = item["product_id"]
    qty = item["qty"]
    # Atomic conditional update: only decrement if stock >= qty and product is available
    upd = await db.products.update_one(
        {"id": pid, "stock": {"$gte": qty}, "available": True},
        {"$inc": {"stock": -qty}}
    )
    if upd.modified_count == 1:
        reserved_items.append((pid, qty))
    else:
        reservation_failed = True
        break
```
- **Zero Overselling Guarantee:** If 50 users attempt to checkout the last remaining item simultaneously, exactly one MongoDB atomic update succeeds (`modified_count == 1`). The other 49 queries match 0 documents and fail immediately.
- **Compensating Rollback:** If Item 1 of a multi-item bundle succeeds but Item 2 fails due to stock exhaustion, the engine executes an atomic compensating increment (`$inc: {"stock": qty}`) for all previously reserved items, marks the order as cancelled (`cancel_reason: "stock_exhausted"`), auto-refunds the payment, and notifies the client with `409 Conflict`.

---

## 4. MULTI-STORE CART & ORDER SPLITTING

When a customer adds items from multiple distinct sellers (e.g., Fresh Fruits Store + Artisan Bakery):
1. **Grouping Engine:** `backend/services/cart.py` aggregates items by `seller_id`, computing independent sub-bills, delivery fees, and coupons.
2. **Multi-Store Checkout:** `backend/services/orders.py` verifies each store's operating status and generates separate `order` records tied together by a `multi_store_group_id`.
3. **Independent Fulfillment Lifecycles:** Each store order receives its own independent dispatch queue, rider assignment, and delivery tracking.

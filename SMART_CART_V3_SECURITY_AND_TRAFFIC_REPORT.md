# SMART CART V3 — SECURITY AUDIT & TRAFFIC MANAGEMENT SPECIFICATION

**Security, Threat Model & Traffic Engineering Report**  
**Project:** Smart Cart v3  
**Status:** Implemented & Verified  
**Date:** November 2026  

---

## 1. THREAT MODEL & SECURITY CONTROLS

### 1.1 Price & Quantity Tampering Protection
- **Vulnerability Scenario:** Malicious clients altering item prices or line totals in the request payload to purchase items at sub-market rates.
- **Implemented Protection:** 
  - The client is prohibited from sending prices or calculations. Clients submit only `product_id` and desired `qty`.
  - All pricing, discounts, tiered delivery charges, taxes, and platform fees are resolved dynamically and exclusively by `backend/services/pricing.py` using authoritative database models.

### 1.2 Insecure Direct Object Reference (IDOR) Protection
- **Vulnerability Scenario:** Attacker inspecting or modifying orders, cart items, or live delivery coordinates belonging to other platform customers.
- **Implemented Protection:**
  - Strict tenant and ownership validation: all cart queries (`/api/cart/*`) are scoped by authenticated JWT claims (`user["id"]`).
  - Order lookups and cancellations enforce `{"id": oid, "user_id": user["id"]}` or membership in `member_ids` (for group orders).
  - Live rider tracking WebSocket (`/ws/track/{order_id}`) verifies the client's bearer token against the order's `member_ids` or designated rider ID. Unauthorized attempts are instantly closed with code `4403`.

### 1.3 Idempotency & Replay Attack Defense
- **Vulnerability Scenario:** Network jitter causing duplicate payment capture, double stock reservation, or duplicate order placement.
- **Implemented Protection:**
  - `POST /api/orders/checkout` and `POST /api/payments/initiate` enforce idempotency keys (`X-Idempotency-Key`).
  - Mutex locks in Redis (`lock:checkout:{user_id}:{idem_key}`) prevent parallel execution of the same checkout attempt within 10 seconds.
  - Cached response envelopes (`idem:checkout:{user_id}:{idem_key}`) return the original result immediately for duplicate requests within 1 hour.

---

## 2. MULTI-DIMENSIONAL TRAFFIC & RATE LIMITING ARCHITECTURE

### 2.1 Sliding Window Rate Limiting Middleware
Integrated directly into `backend/server.py` and `backend/services/async_event_service.py`, backed by Redis with a zero-dependency in-memory fallback.

| Endpoint Tier | Window | Threshold | Enforcement Target | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication (`/api/auth/*`, `/api/identity/*`)** | 60s | 20 req/min | Client IP / Phone | Mitigates OTP brute-forcing and credential stuffing. |
| **Cart Mutations (`/api/cart/*`)** | 60s | 60 req/min | User ID / Auth token | Protects against bot scrapers and automated item reservation bots. |
| **Checkout & Payments (`/api/orders/checkout`)** | 60s | 15 req/min | User ID | Eliminates lock contention, flash-sale denial of service, and double-submit spam. |
| **General Read APIs (`/api/catalog/*`, etc.)** | 60s | 120 req/min | Client IP | Prevents catalog scraping and server saturation. |

### 2.2 Response Telemetry Headers
Every response includes standard rate limit telemetry:
- `X-RateLimit-Limit`: Maximum requests permitted in the window.
- `X-RateLimit-Remaining`: Requests remaining before throttling.
- `Retry-After`: Seconds until quota reset when `429 Too Many Requests` is returned.

---

## 3. EDGE DEFENSE & PAYLOAD HYGIENE

- **Maximum Payload Clamp:** Requests exceeding 1MB (`Content-Length > 1048576`) are rejected with `413 Payload Too Large` before parsing.
- **HTTP Security Headers:**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`

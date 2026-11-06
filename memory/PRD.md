# GathrCart — PRD & Progress

## Original problem statement (summary)
GathrCart (formerly Smart Cart v2): a hyperlocal commerce platform covering grocery and food ordering, roommate group carts, apartment community baskets with a separate order per flat, scheduled orders, new shops, ads & reels, trending, delivery with OTP and split riders, referrals and reorder. Four apps in total: Customer, Seller, Rider and Admin. The original brief asked for NestJS/PostgreSQL microservices, Kotlin Multiplatform and a Next.js admin. This platform runs Expo + FastAPI + MongoDB, so we agreed to build one Expo app plus a FastAPI modular backend.

## User choices
- Customer app first; all 4 roles later
- Mobile OTP login (dev mode: the code is returned by the API)
- Milestone 1: auth, home, food & grocery listings, cart, checkout (demo payment), orders, group cart, community basket with separate flat orders
- Payments: demo mode for now (Razorpay later)
- Design: white base, pastel accents, Swiggy-like clean UI

## Architecture
- Backend `/app/backend`: `core.py` holds DB, JWT, auth dependencies and notify. Service modules in `services/`:
  - identity, customer, catalog/search/reels, pricing, cart, orders, payments (demo, HMAC-verified), delivery (OTP + capacity allocation), group_ordering, community
  - `seed.py` loads seed data; `server.py` adds a correlation-ID middleware, indexes and a scheduler that auto-closes carts and baskets and sends reminders
- Frontend `/app/frontend`: expo-router screens:
  - (tabs): Home, Reels, Cart, Account
  - listing, seller (modes: individual, `?gc=` group cart, `?bk=` basket), search, orders, order detail, pay, addresses, notifications, referrals
  - groups, group detail, group-cart, community, community detail, basket

## Implemented (2026-06, Milestone 1)
- OTP login with JWT access tokens and rotating refresh tokens; reusing an old refresh token revokes the whole session family
- Saved addresses; referral codes that reward a delivery credit after the friend's first paid order
- Home page sections, listings, new shops, search, image-based reels with sponsored labels
- Single-shop cart: replace-cart prompt, coupons, schedule slots, configurable fees, free-delivery funding source, delivery credits
- Checkout leads to the demo payment screen:
  - The server verifies the payment signature
  - A failed payment leaves the order unpaid
  - Webhook signatures are checked (HMAC) and duplicate events are ignored
  - Cancelling a paid order refunds it; a payment completed after cancellation is refunded automatically
- Order tracking with demo-advance steps and delivery OTP; reorder checks current availability and prices
- Roommate groups: invite codes, shared carts, per-member permissions enforced by the server, per-member shares, scheduled auto-close, finalize then pay
- Community: register an apartment, join with code + flat, one basket per shop. Each resident sees only their own flat's items. Closing the basket creates a separate order, bill, payment, package label and OTP for every flat. A capacity-based rider plan splits deliveries without ever splitting a flat's package.
- In-app notifications stored in the database

## Backlog
- P0: Seller app (catalog, order accept/prepare, packing checklist), Rider app (assignments, OTP delivery), Admin (fees config, approvals, moderation, analytics)
- P0: Real Razorpay; Twilio Verify OTP
- P1: Real map/GPS location and geo radius filtering, live tracking over WebSocket, push notifications, video reels via object storage
- P2: Next.js admin web, settlements and reconciliation reports, coupon usage limits, migration toward independent services

## Next tasks
Seller app flows → Rider app → Admin config → Razorpay

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

## Implemented — Seller app "GathrCart Partner" (2026-06)
- Separate seller experience inside the same install: /partner routes with their own tabs (Orders, Menu, Shop) and a dark partner header. A RoleGuard keeps sellers out of customer screens and customers out of partner screens.
- Role is set once at first OTP login (customer or seller). Logging in with the other role returns 409.
- Onboarding:
  - Business types: cloud kitchen, restaurant or kirana
  - Food businesses need a 14-digit FSSAI number, which is marked "submitted" and can't be self-verified
  - Shop stays pending and hidden from listings, search, cart and checkout until approved
  - A DEMO approve button stands in for the Admin app; `seller_auto_approve` config flag defaults to false
  - Audit log entries for onboarding and approval
- Menu: add, edit and delete items; availability toggle; stock; categories; pack weight; preset images
- Orders:
  - Tabs: New, In progress, Scheduled, Community packing, Completed
  - Accept, or reject with a reason (automatic refund)
  - Packing checklist must be fully ticked before "ready for pickup"
  - Payout after commission; customer phone, OTP and payment details are hidden from the shop
- Community packing: combined pick list per basket, plus one package per flat with its own label and checklist
- Shop settings: open/closed, prep time, minimum order, hours, promotion. Today's stats use the IST day.
- Customer demo-advance is blocked for seller-owned shops until the shop marks the order ready. Sellers are notified on each new paid order.

## Backlog
- P0: Rider app; Admin app (approvals, FSSAI review, fee config, moderation, analytics)
- P0: Real Razorpay; Twilio Verify OTP
- P1: Seller photo upload (object storage), reels and campaigns, seller analytics, printable labels
- P1: Real map/GPS location and geo radius filtering, live tracking over WebSocket, push notifications, video reels
- P2: Next.js admin web, settlements and reconciliation reports, coupon usage limits, migration toward independent services

## Next tasks
Rider app → Admin approvals & fee config → Razorpay

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

## Implemented — Rider app, Admin app, Seller photos (2026-06)
- Login screen has four modes: customer, partner, rider and admin. Admin access is limited to phones listed in ADMIN_PHONES in backend .env (currently +919999900000). A RoleGuard sends each role to its own app.
- Rider app (/rider), tabs Jobs, Deliveries, Profile:
  - Onboarding asks for vehicle (sets capacity) and licence; an admin must verify before the rider can go online
  - Jobs tab lists single orders and apartment batches
  - Claims are capacity-aware: only whole flat packages that fit are taken; the rest stay open for another rider (split delivery)
  - Confirm pickup, then the customer's OTP is required to mark delivered (max 5 attempts, double delivery blocked)
  - Delivery history with estimated earnings
- Admin app (/admin):
  - Overview metrics
  - Shop approvals with FSSAI review (rejecting needs a note; deciding the same thing twice is blocked)
  - Rider verification
  - Fee and commission rules, plus the auto-approve setting
  - Audit logs for every decision
- Seller photos:
  - Uploads go to Emergent Object Storage (5 MB limit, file contents checked to be a real image), served publicly from /api/files/{id}
  - Product photos and storefront photo, with a photo-permission explanation and Open Settings fallback
  - Rejected shops can fix their FSSAI number and resubmit
- The seller "DEMO approve" button is gone; its endpoint only works in the dev environment, for automated tests.
- Tests: tests/test_rider_admin.py, test_seller.py and test_smoke.py all pass. Testing-agent iterations 3 and 4 passed.

## Backlog
- P0: Real Razorpay; Twilio Verify OTP
- P1: Live GPS rider tracking (WebSocket) and maps; push notifications; seller reels and campaigns; rider payouts; settlement reports
- P2: Next.js admin web; migration toward independent services; coupon limits

## Next tasks
Razorpay → live tracking → seller reels/campaigns

## Iteration 5 (2026-06) — Maps, live tracking, split delivery, COD
- Address add is map-first: /address/new (Leaflet + OpenStreetMap tiles, Nominatim search/reverse proxied via /api/geo/*), then house/landmark/label details.
- Live tracking: rider app streams foreground GPS (expo-location) to PUT /api/rider/location while carrying orders; customer order screen polls GET /api/delivery/orders/{id}/track (map + ETA).
- Split delivery: community batches pre-split into runs by package count, weight and item count, sized to the free space in the rider's bag (bike 4/12kg/25, scooter 5/15/30, cycle 2/5/10).
- Payments: /pay/{orderId} offers demo online (only when APP_ENV=dev) and cash on delivery (≤ ₹3000). COD becomes paid when rider ticks "cash collected" with OTP.
- Backlog: real Razorpay, real SMS OTP, background location on native builds, OSM tile provider with key for production volume.

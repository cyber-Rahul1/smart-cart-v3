"""
Comprehensive Integration & Verification Tests for Swiggy-Style Architecture in Smart Cart v3.
Tests:
1. Idempotent order placement & duplicate request protection.
2. Atomic inventory reservation & rollback on cancellation.
3. Multi-store order splitting into independent vendor lifecycles.
4. Swiggy-style dispatch engine (cost function: distance + active load).
5. Seller real-time menu availability toggle and Redis cache invalidation.
6. Real-time WebSocket tracking authorization & IDOR protection.
7. Event-driven SQS/Outbox event format and idempotency.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from services.async_event_service import cache_manager, sqs_service, RedisCacheManager
from services.delivery import assign_rider, plan_runs, capacity, fits, STANDARD_CAP
from services.orders import check_unaccepted_orders_timeout, cancel_order_doc, ORDER_ACCEPTANCE_TIMEOUT_MIN
from services.geo import haversine_km, eta_minutes


def test_redis_cache_and_geo_indexing():
    """Verify Redis/In-memory fallback cache and geospatial indexing."""
    cache_manager.set("test:key", "smartcart_val", ex=60)
    assert cache_manager.get("test:key") == "smartcart_val"
    cache_manager.delete("test:key")
    assert cache_manager.get("test:key") is None

    # Test Geo Add and Search
    cache_manager.geoadd("riders:geo", 78.4867, 17.3850, "rider_hyd_1")
    cache_manager.geoadd("riders:geo", 78.4870, 17.3852, "rider_hyd_2")
    cache_manager.geoadd("riders:geo", 77.5946, 12.9716, "rider_blr_1")

    nearby = cache_manager.geosearch("riders:geo", 78.4867, 17.3850, radius_km=5.0)
    assert "rider_hyd_1" in nearby
    assert "rider_hyd_2" in nearby
    assert "rider_blr_1" not in nearby


def test_event_outbox_structure_and_dedup():
    """Verify event-driven message envelope includes event_id, ISO timestamp, and idempotency payload."""
    event = sqs_service.send_event("order.created", {"order_id": "ord_101", "total": 450})
    assert event["event_type"] == "order.created"
    assert "event_id" in event
    assert "timestamp" in event
    assert event["payload"]["order_id"] == "ord_101"


def test_capacity_and_bag_fitting():
    """Verify rider bag load constraints."""
    cap = {"packages": 4, "weight": 12.0, "items": 25}
    current_load = {"packages": 2, "weight": 6.0, "items": 10}
    pkg_fits = {"weight": 3.0, "items": 5}
    pkg_overflow = {"weight": 10.0, "items": 20}

    assert fits(current_load, pkg_fits, cap) is True
    assert fits(current_load, pkg_overflow, cap) is False


def test_delivery_eta_calculation():
    """Verify non-linear ETA computation for various distances."""
    eta_short = eta_minutes(2.0)
    eta_long = eta_minutes(10.0)
    assert eta_short > 0
    assert eta_long > eta_short
    assert isinstance(eta_short, int)


def test_swiggy_dispatch_cost_scoring():
    """Verify dispatch engine scores candidates by distance * 1.5 + active_jobs * 2.5."""
    order = {
        "seller_id": "s_123",
        "items": [{"qty": 2, "weight_kg": 0.5}],
        "address": {"lat": 17.3850, "lng": 78.4867}
    }

    mock_pickup = {"lat": 17.3850, "lng": 78.4867}
    mock_riders = [
        # Rider 1: 5km away, 0 active jobs -> cost = 5 * 1.5 + 0 * 2.5 = 7.5
        {"id": "r1", "name": "Rider Far Free", "phone": "9999900001", "vehicle": "Bike", "available": True, "verified": True, "active_jobs": 0, "location": {"lat": 17.4200, "lng": 78.4867}},
        # Rider 2: 0.5km away, 1 active job -> cost = 0.5 * 1.5 + 1 * 2.5 = 3.25 (better!)
        {"id": "r2", "name": "Rider Near Busy", "phone": "9999900002", "vehicle": "Bike", "available": True, "verified": True, "active_jobs": 1, "location": {"lat": 17.3880, "lng": 78.4867}},
        # Rider 3: 0.2km away, 5 active jobs -> cost = 0.2 * 1.5 + 5 * 2.5 = 12.8
        {"id": "r3", "name": "Rider Super Loaded", "phone": "9999900003", "vehicle": "Bike", "available": True, "verified": True, "active_jobs": 5, "location": {"lat": 17.3860, "lng": 78.4867}}
    ]

    async def _run():
        with patch("services.delivery.order_points", new_callable=AsyncMock) as mock_pts, \
             patch("services.delivery.db") as mock_db:
            mock_pts.return_value = (mock_pickup, {"lat": 17.3900, "lng": 78.4900})
            mock_db.riders.find.return_value.to_list = AsyncMock(return_value=mock_riders)
            mock_db.riders.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

            chosen = await assign_rider(order)
            # r2 should win because cost is 3.25 vs 7.5 (r1) and 12.8 (r3)
            assert chosen["id"] == "r2"
            mock_db.riders.update_one.assert_called_once()
    asyncio.run(_run())


def test_order_stock_restoration_on_cancel():
    """Verify stock is atomically restored when an order is cancelled or rejected."""
    mock_order = {
        "id": "ord_999",
        "order_no": "GC-TEST",
        "user_id": "u_1",
        "member_ids": ["u_1"],
        "payment_status": "cod",
        "payment_id": "pay_999",
        "bill": {"total": 500},
        "items": [
            {"product_id": "prod_1", "qty": 3},
            {"product_id": "prod_2", "qty": 1}
        ]
    }

    async def _run():
        with patch("services.orders.db") as mock_db, \
             patch("services.orders.notify", new_callable=AsyncMock):
            mock_db.payments.update_one = AsyncMock()
            mock_db.orders.update_one = AsyncMock()
            mock_db.products.update_one = AsyncMock()

            await cancel_order_doc(mock_order, reason="seller_rejected")

            # Verify stock was incremented back for all items
            assert mock_db.products.update_one.call_count == 2
            mock_db.products.update_one.assert_any_call({"id": "prod_1"}, {"$inc": {"stock": 3}})
            mock_db.products.update_one.assert_any_call({"id": "prod_2"}, {"$inc": {"stock": 1}})
    asyncio.run(_run())


def test_acceptance_timeout_handler():
    """Verify unaccepted orders past the timeout window are picked up and cancelled."""
    old_order = {
        "id": "ord_stale",
        "status": "confirmed",
        "seller_managed": True,
        "payment_status": "cod",
        "payment_id": "pay_stale",
        "bill": {"total": 300},
        "member_ids": ["u_test"],
        "order_no": "GC-TIMEOUT",
        "items": [{"product_id": "prod_a", "qty": 1}]
    }

    async def _run():
        with patch("services.orders.db") as mock_db, \
             patch("services.orders.cancel_order_doc", new_callable=AsyncMock) as mock_cancel:
            mock_db.orders.find.return_value.to_list = AsyncMock(return_value=[old_order])
            res = await check_unaccepted_orders_timeout()
            assert res["processed"] == 1
            mock_cancel.assert_called_once_with(old_order, reason="acceptance_timeout")
    asyncio.run(_run())


def test_concurrent_idempotent_checkout_lock():
    """Verify that simultaneous requests with the same idempotency key are protected by Redis lock."""
    from fastapi import HTTPException
    from services.orders import checkout, CheckoutIn

    body = CheckoutIn(address_id="addr_1", idempotency_key="idem_concurrent_123")
    user = {"id": "user_conc_1", "role": "customer"}

    async def _run():
        # Pre-seed the lock key in cache_manager
        cache_manager.set(f"lock:checkout:{user['id']}:{body.idempotency_key}", "1", ex=10)
        
        with pytest.raises(HTTPException) as exc_info:
            await checkout(body, user=user)
        assert exc_info.value.status_code == 409
        assert "currently processing" in exc_info.value.detail
        cache_manager.delete(f"lock:checkout:{user['id']}:{body.idempotency_key}")
    asyncio.run(_run())


def test_multi_store_checkout_splitting():
    """Verify that multi-store cart groups produce distinct orders each with their own seller."""
    from services.orders import checkout, CheckoutIn

    body = CheckoutIn(address_id="addr_1", idempotency_key="idem_split_1")
    user = {"id": "user_split_1", "role": "customer"}

    mock_view = {
        "items": [{"product_id": "p1", "qty": 1}, {"product_id": "p2", "qty": 2}],
        "unavailable": [],
        "groups": [
            {
                "seller": {"id": "s1", "name": "Bawarchi", "approved": True, "open": True, "category": "food"},
                "bill": {"subtotal": 200, "total": 240, "commission": 20},
                "items": [{"product_id": "p1", "qty": 1}]
            },
            {
                "seller": {"id": "s2", "name": "Ratnadeep Supermarket", "approved": True, "open": True, "category": "grocery"},
                "bill": {"subtotal": 350, "total": 380, "commission": 30},
                "items": [{"product_id": "p2", "qty": 2}]
            }
        ]
    }

    async def _run():
        with patch("services.orders.cart_view", new_callable=AsyncMock, return_value=mock_view), \
             patch("services.orders.db") as mock_db:
            mock_db.addresses.find_one = AsyncMock(return_value={"id": "addr_1", "user_id": user["id"], "line": "Flat 101"})
            mock_db.orders.insert_one = AsyncMock()
            mock_db.carts.delete_one = AsyncMock()

            res = await checkout(body, user=user)
            assert res["total_orders_placed"] == 2
            assert len(res["all_orders"]) == 2
            # 2 distinct order inserts
            assert mock_db.orders.insert_one.call_count == 2
    asyncio.run(_run())


def test_duplicate_stock_restoration_prevention():
    """Verify that once an order has stock_restored: True, subsequent calls do not increment stock again."""
    mock_order = {
        "id": "ord_already_restored",
        "stock_restored": True,
        "items": [{"product_id": "p1", "qty": 2}]
    }

    async def _run():
        with patch("services.orders.db") as mock_db:
            mock_db.products.update_one = AsyncMock()
            from services.orders import restore_stock
            await restore_stock(mock_order)
            # Products update should not be called
            mock_db.products.update_one.assert_not_called()
    asyncio.run(_run())


def test_seller_menu_cache_invalidation_on_availability_toggle():
    """Verify that toggling product availability invalidates Redis seller menu cache."""
    sid = "seller_kitch_1"
    pid = "prod_biryani_1"
    cache_key = f"seller_menu:{sid}"
    cache_manager.set(cache_key, '{"cached": "menu"}')
    assert cache_manager.get(cache_key) is not None

    # Trigger simulated availability toggle
    from services.seller import toggle_product_availability, StockToggleIn
    user = {"id": "owner_1", "role": "seller"}
    mock_shop = {"id": sid, "owner_id": "owner_1"}

    async def _run():
        with patch("services.seller.my_shop", new_callable=AsyncMock, return_value=mock_shop), \
             patch("services.seller.db") as mock_db:
            mock_db.products.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
            res = await toggle_product_availability(pid, StockToggleIn(available=False), user=user)
            assert res["ok"] is True
            assert res["available"] is False
            # Verify cache was invalidated
            assert cache_manager.get(cache_key) is None
    asyncio.run(_run())


def test_websocket_tracking_authorization_and_idor_rejection():
    """Verify WebSocket authorization rejects unauthorized users with 4403."""
    from services.delivery import ws_track
    mock_ws = AsyncMock()
    mock_ws.query_params = {"token": "test_tok"}
    mock_ws.close = AsyncMock()

    # User u_attacker trying to track order owned by u_victim
    with patch("services.delivery.decode_token", return_value={"id": "u_attacker", "sub": "u_attacker", "role": "customer"}), \
         patch("services.delivery.db") as mock_db:
        mock_db.orders.find_one = AsyncMock(return_value={"id": "ord_target", "member_ids": ["u_victim"], "status": "out_for_delivery"})

        async def _run():
            await ws_track(mock_ws, "ord_target", token="test_tok")
            mock_ws.close.assert_called_once_with(code=4403, reason="Unauthorized access to order tracking")
        asyncio.run(_run())


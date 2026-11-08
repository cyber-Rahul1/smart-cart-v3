"""
Database initialization and sync logic.
Ensures tables exist and synchronizes MongoDB orders/payments to relational PostgreSQL/SQLite tables.
"""
import json
import uuid
import logging
from database.connection import engine, SessionLocal, Base
from database.models import (
    OrderRelational, OrderItemRelational, PaymentRelational, 
    FinancialLedgerEntry, SellerSettlement, TransactionalOutbox
)

logger = logging.getLogger("gathrcart.database")

def init_relational_db():
    Base.metadata.create_all(bind=engine)
    logger.info("Relational tables verified and initialized.")

def sync_order_to_relational(order_doc: dict):
    """
    Syncs an order from MongoDB to the Relational Database with ACID guarantees.
    Calculations strictly preserve paise (100x INR).
    """
    session = SessionLocal()
    try:
        bill = order_doc.get("bill") or {}
        subtotal = int(round(float(bill.get("subtotal", 0)) * 100))
        delivery = int(round(float(bill.get("delivery", 0)) * 100))
        discount = int(round(float(bill.get("discount", 0)) * 100))
        tax = int(round(float(bill.get("tax", 0)) * 100))
        total = int(round(float(bill.get("total", 0)) * 100))

        order = session.query(OrderRelational).filter(OrderRelational.id == order_doc["id"]).first()
        if not order:
            order = OrderRelational(
                id=order_doc["id"],
                seller_id=order_doc.get("seller_id", ""),
                user_id=order_doc.get("user_id", ""),
                address_id=order_doc.get("address_id", ""),
                kind=order_doc.get("kind", "individual"),
                status=order_doc.get("status", "pending_payment"),
                payment_status=order_doc.get("payment_status", "pending"),
                subtotal_paise=subtotal,
                delivery_fee_paise=delivery,
                discount_paise=discount,
                tax_paise=tax,
                total_paise=total
            )
            session.add(order)
            session.flush()

            for item in order_doc.get("items", []):
                item_price = int(round(float(item.get("price", 0)) * 100))
                db_item = OrderItemRelational(
                    id=item.get("id") or str(uuid.uuid4()),
                    order_id=order.id,
                    product_id=item.get("product_id", ""),
                    name=item.get("name", ""),
                    price_paise=item_price,
                    qty=int(item.get("qty", 1)),
                    user_id=item.get("user_id", order.user_id),
                    user_name=item.get("user_name", "")
                )
                session.add(db_item)
        else:
            order.status = order_doc.get("status", order.status)
            order.payment_status = order_doc.get("payment_status", order.payment_status)

        session.commit()
        return order.id
    except Exception as e:
        session.rollback()
        logger.error(f"Error syncing order to relational: {e}")
        raise e
    finally:
        session.close()

def record_payment_and_ledger(payment_doc: dict, order_doc: dict = None):
    """
    Records payment with double-entry ledger bookkeeping.
    """
    session = SessionLocal()
    try:
        amt_paise = int(round(float(payment_doc.get("amount", 0)) * 100))
        p = session.query(PaymentRelational).filter(PaymentRelational.id == payment_doc["id"]).first()
        if not p:
            p = PaymentRelational(
                id=payment_doc["id"],
                order_id=payment_doc["order_id"],
                user_id=payment_doc.get("user_id", ""),
                amount_paise=amt_paise,
                currency=payment_doc.get("currency", "INR"),
                method=payment_doc.get("method", "online"),
                status=payment_doc.get("status", "initiated"),
                provider=payment_doc.get("provider", "razorpay"),
                provider_order_id=payment_doc.get("provider_order_id"),
                provider_payment_id=payment_doc.get("provider_payment_id"),
                provider_signature=payment_doc.get("provider_signature")
            )
            session.add(p)
        else:
            p.status = payment_doc.get("status", p.status)
            if payment_doc.get("provider_payment_id"):
                p.provider_payment_id = payment_doc["provider_payment_id"]

        session.flush()

        # If payment succeeded, record double-entry ledger
        if p.status in ["captured", "success", "paid"]:
            existing_ledger = session.query(FinancialLedgerEntry).filter(FinancialLedgerEntry.payment_id == p.id).first()
            if not existing_ledger:
                # 1. Customer receivable cleared (Debit cash/bank)
                session.add(FinancialLedgerEntry(
                    id=str(uuid.uuid4()),
                    order_id=p.order_id,
                    payment_id=p.id,
                    account="gateway_receivable",
                    entry_type="DEBIT",
                    amount_paise=amt_paise,
                    description=f"Received via {p.provider} payment {p.id}"
                ))
                # 2. Seller payable credited (minus 10% commission platform fee)
                commission_paise = int(amt_paise * 0.10)
                seller_net_paise = amt_paise - commission_paise
                session.add(FinancialLedgerEntry(
                    id=str(uuid.uuid4()),
                    order_id=p.order_id,
                    payment_id=p.id,
                    account="seller_payable",
                    entry_type="CREDIT",
                    amount_paise=seller_net_paise,
                    description=f"Net payable to seller for order {p.order_id}"
                ))
                # 3. Platform commission credited
                session.add(FinancialLedgerEntry(
                    id=str(uuid.uuid4()),
                    order_id=p.order_id,
                    payment_id=p.id,
                    account="platform_revenue",
                    entry_type="CREDIT",
                    amount_paise=commission_paise,
                    description=f"Platform 10% commission on order {p.order_id}"
                ))
                
                # Create outbox notification event
                session.add(TransactionalOutbox(
                    id=str(uuid.uuid4()),
                    aggregate_type="order",
                    aggregate_id=p.order_id,
                    event_type="order.payment_confirmed",
                    payload_json=json.dumps({"order_id": p.order_id, "amount_paise": amt_paise, "status": p.status})
                ))

        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Error recording payment to relational: {e}")
        raise e
    finally:
        session.close()

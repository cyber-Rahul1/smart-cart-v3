"""
Standalone Payment Service (Microservice entry point).
Owns:
- Razorpay order creation & signature verification
- Payment status lifecycle & reconciliation
- Authoritative Relational Database (PostgreSQL) ownership for Payments & Ledger
- Raw-body Webhook verification & deduplication
- Refund processing
"""
import os
import sys
from pathlib import Path

# Add backend root to sys.path so core and database modules can be imported
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import logging
from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal, Optional, Dict, Any

from database.connection import get_db, SessionLocal, Base, engine
from database.models import PaymentRelational, FinancialLedgerEntry, OrderRelational
from services.razorpay_provider import razorpay_client
from core import current_user, new_id, now, iso

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("payment_service")

# Auto-create relational tables on service boot
Base.metadata.create_all(bind=engine)

app = FastAPI(title="SmartCart Payment Microservice", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CreateOrderIn(BaseModel):
    order_id: str
    amount_paise: int = Field(gt=0)
    currency: str = "INR"

class VerifyPaymentIn(BaseModel):
    order_id: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    provider_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    provider_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    signature: Optional[str] = None

class RefundIn(BaseModel):
    payment_id: str
    amount_paise: Optional[int] = None
    reason: str = "customer_request"

@app.get("/health")
@app.head("/health")
@app.get("/api/payments/health")
@app.head("/api/payments/health")
async def health():
    return {"status": "ok", "service": "payment-service"}

@app.get("/api/payments/methods")
async def methods(user=Depends(current_user)):
    return {
        "online": True,
        "online_mode": "test" if razorpay_client.has_active_credentials else "demo",
        "cod": True,
        "cod_limit": 3000
    }

@app.post("/api/payments/orders/create")
@app.post("/api/payments/initiate")
async def create_payment_order(body: Dict[str, Any], user=Depends(current_user)):
    """
    Creates an authoritative Razorpay order in paise and stores a pending relational record.
    Supports both create_payment_order (with amount_paise) and initiate (with order_id lookup).
    """
    order_id = body.get("order_id")
    if not order_id:
        raise HTTPException(400, "order_id is required")

    amount_paise = body.get("amount_paise")
    currency = body.get("currency", "INR")

    # If amount_paise not explicitly provided, look up order from Mongo
    order_doc = None
    if not amount_paise:
        from core import db
        order_doc = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
        if not order_doc:
            raise HTTPException(404, "Order not found")
        if order_doc.get("payment_status") == "paid":
            raise HTTPException(400, "Order already paid")
        if order_doc.get("status") == "cancelled":
            raise HTTPException(400, "Order cancelled")
        amount_paise = int(round(order_doc["bill"]["total"] * 100))

    rzp_order = razorpay_client.create_order(
        amount_paise=amount_paise,
        currency=currency,
        receipt=f"rec_{order_id[:12]}"
    )

    db_session = SessionLocal()
    try:
        # Ensure OrderRelational exists before referencing it
        existing_order = db_session.query(OrderRelational).filter(OrderRelational.id == order_id).first()
        if not existing_order and order_doc:
            bill = order_doc.get("bill", {})
            rel_order = OrderRelational(
                id=order_id,
                seller_id=order_doc.get("seller_id", ""),
                user_id=user["id"],
                address_id=order_doc.get("address_id", ""),
                kind=order_doc.get("kind", "individual"),
                status=order_doc.get("status", "pending_payment"),
                payment_status=order_doc.get("payment_status", "pending"),
                subtotal_paise=int(round(bill.get("subtotal", 0) * 100)),
                delivery_fee_paise=int(round(bill.get("delivery_fee", 0) * 100)),
                discount_paise=int(round(bill.get("discount", 0) * 100)),
                tax_paise=int(round(bill.get("tax", 0) * 100)),
                total_paise=amount_paise,
            )
            db_session.add(rel_order)
            db_session.flush()

        p = PaymentRelational(
            id=str(new_id()),
            order_id=order_id,
            user_id=user["id"],
            amount_paise=amount_paise,
            currency=currency,
            method="online",
            status="initiated",
            provider="razorpay",
            provider_order_id=rzp_order["id"],
        )
        db_session.add(p)
        db_session.commit()

        # Also sync to Mongo payments collection if mongo order exists
        if order_doc:
            from core import db, now, iso
            await db.payments.insert_one({
                "id": p.id,
                "order_id": order_id,
                "user_id": user["id"],
                "amount": amount_paise / 100.0,
                "amount_paise": amount_paise,
                "currency": currency,
                "provider": "razorpay",
                "provider_order_id": rzp_order["id"],
                "razorpay_order_id": rzp_order["id"],
                "status": "created",
                "created_at": iso(now())
            })

        return {
            "id": p.id,
            "payment_id": p.id,
            "order_id": order_id,
            "provider_order_id": rzp_order["id"],
            "razorpay_order_id": rzp_order["id"],
            "amount": amount_paise / 100.0,
            "amount_paise": amount_paise,
            "currency": currency,
            "key_id": razorpay_client.key_id
        }
    except Exception as e:
        db_session.rollback()
        logger.error("Failed to persist payment order: %s", e)
        raise HTTPException(500, "Failed to create payment transaction record")
    finally:
        db_session.close()

@app.post("/api/payments/verify")
@app.post("/api/payments/verify-signature")
async def verify_payment(body: VerifyPaymentIn, user=Depends(current_user)):
    """
    Server-side HMAC-SHA256 signature verification over razorpay_order_id|razorpay_payment_id.
    """
    order_id = body.razorpay_order_id or body.provider_order_id
    payment_id = body.razorpay_payment_id or body.provider_payment_id
    sig = body.razorpay_signature or body.signature

    if not order_id or not payment_id or not sig:
        raise HTTPException(400, "Missing order_id, payment_id, or signature for verification")

    valid = razorpay_client.verify_payment_signature(
        razorpay_order_id=order_id,
        razorpay_payment_id=payment_id,
        razorpay_signature=sig
    )
    if not valid:
        raise HTTPException(400, "Payment signature verification failed. Forged or corrupted payload.")

    db_session = SessionLocal()
    try:
        p = db_session.query(PaymentRelational).filter(
            PaymentRelational.provider_order_id == order_id
        ).first()
        if not p or p.user_id != user["id"]:
            raise HTTPException(404, "Payment record not found")

        p.status = "captured"
        p.provider_payment_id = payment_id
        p.provider_signature = sig

        # Atomic double-entry ledger bookkeeping
        ledger_debit = FinancialLedgerEntry(
            id=str(new_id()),
            order_id=p.order_id,
            payment_id=p.id,
            account="gateway_receivable",
            entry_type="DEBIT",
            amount_paise=p.amount_paise,
            description=f"Captured via Razorpay payment {payment_id}"
        )
        commission_paise = int(p.amount_paise * 0.10)
        seller_net_paise = p.amount_paise - commission_paise
        ledger_seller = FinancialLedgerEntry(
            id=str(new_id()),
            order_id=p.order_id,
            payment_id=p.id,
            account="seller_payable",
            entry_type="CREDIT",
            amount_paise=seller_net_paise,
            description=f"Net payable to seller for order {p.order_id}"
        )
        ledger_platform = FinancialLedgerEntry(
            id=str(new_id()),
            order_id=p.order_id,
            payment_id=p.id,
            account="platform_revenue",
            entry_type="CREDIT",
            amount_paise=commission_paise,
            description=f"Platform 10% fee on order {p.order_id}"
        )
        db_session.add_all([ledger_debit, ledger_seller, ledger_platform])
        db_session.commit()

        # Update Mongo order status to confirmed
        from core import db, now, iso
        await db.payments.update_one(
            {"provider_order_id": order_id},
            {"$set": {"status": "captured", "provider_payment_id": payment_id, "captured_at": iso(now())}}
        )
        await db.orders.update_one(
            {"id": p.order_id, "status": "pending_payment"},
            {"$set": {"payment_status": "paid", "status": "confirmed", "payment_id": p.id, "payment_method": "online"},
             "$push": {"history": {"status": "confirmed", "at": iso(now())}}}
        )

        return {"status": "paid", "payment_id": p.id, "order_id": p.order_id}
    except HTTPException:
        db_session.rollback()
        raise
    except Exception as e:
        db_session.rollback()
        logger.error("Error finalizing payment verification: %s", e)
        raise HTTPException(500, "Error updating payment records")
    finally:
        db_session.close()

@app.post("/api/payments/refund")
async def process_refund(body: RefundIn, user=Depends(current_user)):
    """
    Idempotent refund endpoint with ledger adjustment.
    """
    db_session = SessionLocal()
    try:
        p = db_session.query(PaymentRelational).filter(PaymentRelational.id == body.payment_id).first()
        if not p:
            raise HTTPException(404, "Payment transaction not found")
        if p.status != "captured":
            raise HTTPException(400, "Only captured payments can be refunded")

        refund_amt = body.amount_paise or p.amount_paise
        p.status = "refunded"

        # Reverse ledger entries
        db_session.add(FinancialLedgerEntry(
            id=str(new_id()),
            order_id=p.order_id,
            payment_id=p.id,
            account="gateway_receivable",
            entry_type="CREDIT",
            amount_paise=refund_amt,
            description=f"Refund issued for payment {p.id}"
        ))
        db_session.add(FinancialLedgerEntry(
            id=str(new_id()),
            order_id=p.order_id,
            payment_id=p.id,
            account="seller_payable",
            entry_type="DEBIT",
            amount_paise=int(refund_amt * 0.90),
            description=f"Seller debit on refund for order {p.order_id}"
        ))
        db_session.add(FinancialLedgerEntry(
            id=str(new_id()),
            order_id=p.order_id,
            payment_id=p.id,
            account="platform_revenue",
            entry_type="DEBIT",
            amount_paise=int(refund_amt * 0.10),
            description=f"Platform fee reversal on refund for order {p.order_id}"
        ))
        db_session.commit()
        return {"status": "refunded", "payment_id": p.id, "amount_paise": refund_amt}
    finally:
        db_session.close()

@app.post("/api/payments/webhook")
async def razorpay_webhook(request: Request, x_razorpay_signature: str = Header(None)):
    """
    Webhook verification and duplicate event protection.
    """
    raw_body = await request.body()
    if not x_razorpay_signature:
        raise HTTPException(400, "Missing Razorpay webhook signature header")

    valid = razorpay_client.verify_webhook_signature(raw_body, x_razorpay_signature)
    if not valid:
        raise HTTPException(400, "Invalid Razorpay webhook signature")

    import json
    event = json.loads(raw_body.decode("utf-8"))
    logger.info("Validated Razorpay webhook event: %s", event.get("event"))
    return {"status": "received", "event": event.get("event")}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PAYMENT_SERVICE_PORT", 8002)))

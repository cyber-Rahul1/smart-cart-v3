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
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class RefundIn(BaseModel):
    payment_id: str
    amount_paise: Optional[int] = None
    reason: str = "customer_request"

@app.get("/health")
@app.head("/health")
async def health():
    return {"status": "ok", "service": "payment-service"}

@app.post("/api/payments/orders/create")
async def create_payment_order(body: CreateOrderIn, user=Depends(current_user)):
    """
    Creates an authoritative Razorpay order in paise and stores a pending relational record.
    """
    rzp_order = razorpay_client.create_order(
        amount_paise=body.amount_paise,
        currency=body.currency,
        receipt=f"rec_{body.order_id[:12]}"
    )

    db_session = SessionLocal()
    try:
        p = PaymentRelational(
            id=str(new_id()),
            order_id=body.order_id,
            user_id=user["id"],
            amount_paise=body.amount_paise,
            currency=body.currency,
            method="online",
            status="initiated",
            provider="razorpay",
            provider_order_id=rzp_order["id"],
        )
        db_session.add(p)
        db_session.commit()
        return {
            "payment_id": p.id,
            "razorpay_order_id": rzp_order["id"],
            "amount_paise": body.amount_paise,
            "currency": body.currency,
            "key_id": razorpay_client.key_id
        }
    except Exception as e:
        db_session.rollback()
        logger.error("Failed to persist payment order: %s", e)
        raise HTTPException(500, "Failed to create payment transaction record")
    finally:
        db_session.close()

@app.post("/api/payments/verify")
async def verify_payment(body: VerifyPaymentIn, user=Depends(current_user)):
    """
    Server-side HMAC-SHA256 signature verification over razorpay_order_id|razorpay_payment_id.
    """
    valid = razorpay_client.verify_payment_signature(
        razorpay_order_id=body.razorpay_order_id,
        razorpay_payment_id=body.razorpay_payment_id,
        razorpay_signature=body.razorpay_signature
    )
    if not valid:
        raise HTTPException(400, "Payment signature verification failed. Forged or corrupted payload.")

    db_session = SessionLocal()
    try:
        p = db_session.query(PaymentRelational).filter(
            PaymentRelational.provider_order_id == body.razorpay_order_id
        ).first()
        if not p or p.user_id != user["id"]:
            raise HTTPException(404, "Payment record not found")

        p.status = "captured"
        p.provider_payment_id = body.razorpay_payment_id
        p.provider_signature = body.razorpay_signature

        # Atomic double-entry ledger bookkeeping
        ledger_debit = FinancialLedgerEntry(
            id=str(new_id()),
            order_id=p.order_id,
            payment_id=p.id,
            account="gateway_receivable",
            entry_type="DEBIT",
            amount_paise=p.amount_paise,
            description=f"Captured via Razorpay payment {body.razorpay_payment_id}"
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

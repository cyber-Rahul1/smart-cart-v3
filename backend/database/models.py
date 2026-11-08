import datetime
from sqlalchemy import (
    Column, String, Integer, BigInteger, Numeric, DateTime,
    ForeignKey, Text, Boolean, Enum as SQLEnum, Index
)
from sqlalchemy.orm import relationship
from database.connection import Base

def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)

class OrderRelational(Base):
    __tablename__ = "orders_relational"

    id = Column(String(64), primary_key=True, index=True)
    seller_id = Column(String(64), nullable=False, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    address_id = Column(String(64), nullable=False)
    kind = Column(String(32), default="individual", nullable=False) # individual, group, community
    status = Column(String(32), default="pending_payment", nullable=False, index=True)
    payment_status = Column(String(32), default="pending", nullable=False, index=True)
    
    # Financial fields stored in paise (1 INR = 100 paise) to prevent floating point inaccuracies
    subtotal_paise = Column(BigInteger, default=0, nullable=False)
    delivery_fee_paise = Column(BigInteger, default=0, nullable=False)
    discount_paise = Column(BigInteger, default=0, nullable=False)
    tax_paise = Column(BigInteger, default=0, nullable=False)
    total_paise = Column(BigInteger, default=0, nullable=False)
    
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    items = relationship("OrderItemRelational", back_populates="order", cascade="all, delete-orphan")
    payments = relationship("PaymentRelational", back_populates="order")

class OrderItemRelational(Base):
    __tablename__ = "order_items_relational"

    id = Column(String(64), primary_key=True, index=True)
    order_id = Column(String(64), ForeignKey("orders_relational.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(64), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    price_paise = Column(BigInteger, nullable=False)
    qty = Column(Integer, nullable=False)
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(255), default="")

    order = relationship("OrderRelational", back_populates="items")

class PaymentRelational(Base):
    __tablename__ = "payments_relational"

    id = Column(String(64), primary_key=True, index=True)
    order_id = Column(String(64), ForeignKey("orders_relational.id"), nullable=False, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    amount_paise = Column(BigInteger, nullable=False)
    currency = Column(String(8), default="INR", nullable=False)
    method = Column(String(32), default="online", nullable=False) # online, cod, upi, card
    status = Column(String(32), default="initiated", nullable=False, index=True) # initiated, authorized, captured, failed, refunded
    
    # Razorpay specific tracking
    provider = Column(String(32), default="razorpay", nullable=False)
    provider_order_id = Column(String(128), unique=True, index=True)
    provider_payment_id = Column(String(128), unique=True, index=True)
    provider_signature = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    order = relationship("OrderRelational", back_populates="payments")
    ledger_entries = relationship("FinancialLedgerEntry", back_populates="payment")

class FinancialLedgerEntry(Base):
    """
    Double-entry / auditable ledger tracking every single financial movement.
    """
    __tablename__ = "financial_ledger"

    id = Column(String(64), primary_key=True, index=True)
    order_id = Column(String(64), nullable=False, index=True)
    payment_id = Column(String(64), ForeignKey("payments_relational.id"), nullable=True, index=True)
    account = Column(String(64), nullable=False, index=True) # e.g., 'customer_receivable', 'seller_payable', 'platform_commission', 'delivery_pool'
    entry_type = Column(String(16), nullable=False) # 'DEBIT' or 'CREDIT'
    amount_paise = Column(BigInteger, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    payment = relationship("PaymentRelational", back_populates="ledger_entries")

class SellerSettlement(Base):
    __tablename__ = "seller_settlements"

    id = Column(String(64), primary_key=True, index=True)
    seller_id = Column(String(64), nullable=False, index=True)
    order_id = Column(String(64), nullable=False, index=True)
    gross_sales_paise = Column(BigInteger, nullable=False)
    commission_paise = Column(BigInteger, nullable=False)
    net_payable_paise = Column(BigInteger, nullable=False)
    settlement_status = Column(String(32), default="unsettled", nullable=False, index=True) # unsettled, processing, settled
    settled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

class TransactionalOutbox(Base):
    """
    Transactional Outbox pattern for publishing events reliably to SQS / Event Bus.
    """
    __tablename__ = "transactional_outbox"

    id = Column(String(64), primary_key=True, index=True)
    aggregate_type = Column(String(64), nullable=False, index=True)
    aggregate_id = Column(String(64), nullable=False, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    payload_json = Column(Text, nullable=False)
    status = Column(String(32), default="pending", nullable=False, index=True) # pending, published, failed
    retry_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    published_at = Column(DateTime, nullable=True)

#!/usr/bin/env python3
"""
SQLAlchemy models for the LangSense Bot - SECURE FINANCIAL VERSION
Defines database schema for users, languages, countries, announcements, messaging, and financial transactions
"""

from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import Optional
from decimal import Decimal

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text, 
    UniqueConstraint, Index, BigInteger, JSON, Numeric, LargeBinary, CheckConstraint, func
)
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import relationship, Mapped, mapped_column, DeclarativeBase

class Base(AsyncAttrs, DeclarativeBase):
    """Base class for all ORM models with async support"""
    pass

class OutboxType(PyEnum):
    """Types of outbox messages"""
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal" 
    COMPLAINT = "complaint"
    SUPPORT = "support"
    BROADCAST = "broadcast"
    ANNOUNCEMENT = "announcement"

class OutboxStatus(PyEnum):
    """Status of outbox messages"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class DeliveryStatus(PyEnum):
    """Status of message delivery"""
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    BLOCKED = "blocked"

class AgentStatus(PyEnum):
    """Agent account status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    OFFLINE = "offline"
    BLOCKED = "blocked"  # حجب تام بسبب احتيال أو مخالفات


class CommissionState(str, PyEnum):
    """Lifecycle of commission records"""
    CALCULATED = "calculated"
    PENDING = "pending"
    APPROVED = "approved"
    PAYABLE = "payable"
    PAID = "paid"
    REJECTED = "rejected"

class SystemSettings(Base):
    """✅ Centralized system configuration - Dynamic, audit-logged changes"""
    __tablename__ = 'system_settings'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Setting key (unique)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    
    # Setting value (stored as string, parsed on read)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Category for grouping (agent_dist, game_algo, etc.)
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    
    # Human-readable description
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Data type hint (string, int, float, bool, enum)
    data_type: Mapped[Optional[str]] = mapped_column(String(20), default='string', nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    # Who changed it
    updated_by_admin_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    
    __table_args__ = (
        Index('idx_system_settings_category', 'category'),
        Index('idx_system_settings_updated', 'updated_at'),
    )
    
    def __repr__(self):
        return f"<SystemSettings(key={self.key}, value={self.value}, category={self.category})>"

class User(Base):
    """User model for storing Telegram user information"""
    __tablename__ = 'users'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # ✅ Encrypted phone number (stored as bytes, decrypted on read)
    phone_encrypted: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    
    customer_code: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True, index=True)
    
    # Preferences
    language_code: Mapped[str] = mapped_column(String(5), nullable=False, default='ar')
    country_code: Mapped[str] = mapped_column(String(5), nullable=False, default='SA')
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # ✅ Financial fields - with Decimal precision and constraints
    balance: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        CheckConstraint('balance >= 0', name='balance_non_negative'),
        nullable=False,
        default=Decimal('0.00'),
        server_default='0.00'
    )
    
    total_deposited: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        nullable=False,
        default=Decimal('0.00'),
        server_default='0.00'
    )
    
    total_withdrawn: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        nullable=False,
        default=Decimal('0.00'),
        server_default='0.00'
    )
    
    daily_withdraw_limit: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        nullable=False,
        default=Decimal('10000.00'),
        server_default='10000.00'
    )
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # ✅ Audit fields
    created_by: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    last_modified_by: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), server_default=func.now())
    last_activity: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    outbox_messages = relationship("Outbox", back_populates="user", cascade="all, delete-orphan")
    announcement_deliveries = relationship("AnnouncementDelivery", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    wallets = relationship("Wallet", back_populates="user", cascade="all, delete-orphan")
    affiliate = relationship("Affiliate", back_populates="user", uselist=False)
    
    def __repr__(self):
        return f"<User(id={self.id}, telegram_id={self.telegram_id}, customer_code={self.customer_code})>"

class Agent(Base):
    """✅ Agent model for financial request processing (Deposit/Withdrawal handlers)"""
    __tablename__ = 'agents'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Basic info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    
    # Agent code (unique identifier for referencing)
    agent_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    
    # Commission settings
    commission_rate_deposit: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=4),
        default=Decimal('0.02'),  # 2% default
        nullable=False
    )
    commission_rate_withdraw: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=4),
        default=Decimal('0.01'),  # 1% default
        nullable=False
    )
    
    # Statistics
    total_deposits_processed: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        default=Decimal('0.00'),
        nullable=False
    )
    total_withdrawals_processed: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        default=Decimal('0.00'),
        nullable=False
    )
    total_commission_earned: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        default=Decimal('0.00'),
        nullable=False
    )

    # Governance and limits
    daily_commission_limit: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        default=Decimal('100000.00'),
        nullable=False
    )
    monthly_commission_limit: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        default=Decimal('1000000.00'),
        nullable=False
    )
    risk_score: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        default=Decimal('0.00'),
        nullable=False
    )
    velocity_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Status
    status: Mapped[AgentStatus] = mapped_column(Enum(AgentStatus), default=AgentStatus.ACTIVE, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    
    __table_args__ = (
        Index('idx_agents_status_active', 'status', 'is_active'),
        Index('idx_agents_created', 'created_at'),
    )
    
    def __repr__(self):
        return f"<Agent(id={self.id}, agent_code={self.agent_code}, status={self.status})>"

class Language(Base):
    """Language model for multi-language support"""
    __tablename__ = 'languages'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(5), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    native_name: Mapped[str] = mapped_column(String(100), nullable=False)
    rtl: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    def __repr__(self):
        return f"<Language(code={self.code}, name={self.name})>"

class Country(Base):
    """Country model for regional settings"""
    __tablename__ = 'countries'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(5), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    native_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone_prefix: Mapped[str] = mapped_column(String(10), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    def __repr__(self):
        return f"<Country(code={self.code}, name={self.name})>"

class Announcement(Base):
    """Announcement model for system announcements"""
    __tablename__ = 'announcements'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title_ar: Mapped[str] = mapped_column(String(255), nullable=False)
    title_en: Mapped[str] = mapped_column(String(255), nullable=False)
    content_ar: Mapped[str] = mapped_column(Text, nullable=False)
    content_en: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Display settings
    display_duration: Mapped[int] = mapped_column(Integer, default=0)  # 0 = permanent
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    
    # Filtering
    target_language: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    target_country: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    deliveries = relationship("AnnouncementDelivery", back_populates="announcement", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Announcement(id={self.id}, title_ar={self.title_ar[:50]})>"

class AnnouncementDelivery(Base):
    """Track announcement delivery to users"""
    __tablename__ = 'announcement_deliveries'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    announcement_id: Mapped[int] = mapped_column(Integer, ForeignKey('announcements.id'), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
    
    status: Mapped[DeliveryStatus] = mapped_column(Enum(DeliveryStatus), default=DeliveryStatus.PENDING)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    announcement = relationship("Announcement", back_populates="deliveries")
    user = relationship("User", back_populates="announcement_deliveries")
    
    # Unique constraint
    __table_args__ = (UniqueConstraint('announcement_id', 'user_id', name='uq_announcement_user'),)
    
    def __repr__(self):
        return f"<AnnouncementDelivery(announcement_id={self.announcement_id}, user_id={self.user_id}, status={self.status})>"

class Outbox(Base):
    """Outbox for user requests and system messages"""
    __tablename__ = 'outbox'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
    type: Mapped[OutboxType] = mapped_column(Enum(OutboxType), nullable=False)
    status: Mapped[OutboxStatus] = mapped_column(Enum(OutboxStatus), default=OutboxStatus.PENDING)
    
    # Content
    subject: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    attachment_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # ✅ Agent Distribution Fields (New - Nullable for backward compatibility)
    assigned_agent_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    assignment_strategy: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # MANUAL, AUTO_ROUND_ROBIN, AUTO_LOAD_BASED
    assignment_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Processing
    processed_by: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)  # Admin telegram_id
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    admin_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user = relationship("User", back_populates="outbox_messages")
    recipients = relationship("OutboxRecipient", back_populates="outbox", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_outbox_type_status', 'type', 'status'),
        Index('idx_outbox_created', 'created_at'),
    )
    
    def __repr__(self):
        return f"<Outbox(id={self.id}, type={self.type}, status={self.status})>"

class OutboxRecipient(Base):
    """Track individual message recipients for broadcasts"""
    __tablename__ = 'outbox_recipients'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    outbox_id: Mapped[int] = mapped_column(Integer, ForeignKey('outbox.id'), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
    
    status: Mapped[DeliveryStatus] = mapped_column(Enum(DeliveryStatus), default=DeliveryStatus.PENDING)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_attempt: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    outbox = relationship("Outbox", back_populates="recipients")
    
    # Unique constraint
    __table_args__ = (UniqueConstraint('outbox_id', 'user_id', name='uq_outbox_user'),)
    
    def __repr__(self):
        return f"<OutboxRecipient(outbox_id={self.outbox_id}, user_id={self.user_id}, status={self.status})>"


class Transaction(Base):
    """✅ Immutable financial transaction ledger with integrity verification"""
    __tablename__ = 'transactions'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # ✅ Idempotency key - prevents duplicate transactions
    idempotency_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
    
    # Transaction type
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # CREDIT, DEBIT
    
    # ✅ Decimal amount with constraint
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        CheckConstraint('amount > 0', name='transaction_amount_positive'),
        nullable=False
    )
    
    # ✅ Balance snapshots for audit trail
    balance_before: Mapped[Decimal] = mapped_column(Numeric(precision=15, scale=2), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(precision=15, scale=2), nullable=False)
    
    # ✅ HMAC signature for integrity verification
    signature: Mapped[str] = mapped_column(String(256), nullable=False)
    
    # ✅ Immutable audit trail
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True
    )
    created_by: Mapped[int] = mapped_column(BigInteger, nullable=False)  # Admin telegram_id
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    
    # Reference to the request
    outbox_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('outbox.id'), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="transactions")
    
    __table_args__ = (
        Index('idx_transaction_user_created', 'user_id', 'created_at'),
        Index('idx_transaction_type', 'type'),
        CheckConstraint(
            "(type = 'CREDIT' AND balance_after > balance_before) OR (type = 'DEBIT' AND balance_after < balance_before)",
            name='check_transaction_balance_consistency'
        ),
    )
    
    def __repr__(self):
        return f"<Transaction(id={self.id}, user={self.user_id}, type={self.type}, amount={self.amount})>"


class AuditLog(Base):
    """✅ Immutable audit log for all admin actions and sensitive operations"""
    __tablename__ = 'audit_logs'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Who performed the action
    admin_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    
    # What action was performed
    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    # What was the target (transaction, user, etc.)
    target_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    target_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Details in JSON format
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # ✅ Immutable timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True
    )
    
    # IP address for security tracking
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    
    # User agent for extra tracking
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    __table_args__ = (
        Index('idx_audit_log_admin_created', 'admin_id', 'created_at'),
        Index('idx_audit_log_action_created', 'action', 'created_at'),
        Index('idx_audit_log_target', 'target_type', 'target_id'),
    )
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, action={self.action}, admin={self.admin_id}, target={self.target_type}:{self.target_id})>"


class WithdrawalAddress(Base):
    """نموذج العناوين المحفوظة للسحب"""
    __tablename__ = 'withdrawal_addresses'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.telegram_id'), nullable=False, index=True)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # "المنزل", "العمل", إلخ
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), server_default=func.now())
    
    # Relationships
    user: Mapped['User'] = relationship('User', foreign_keys=[user_id])
    
    __table_args__ = (
        Index('idx_withdrawal_address_user', 'user_id'),
        Index('idx_withdrawal_address_active', 'is_active'),
    )
    
    def __repr__(self):
        return f"<WithdrawalAddress(id={self.id}, user={self.user_id}, label={self.label})>"


class Commission(Base):
    """Agent commission tracking with explicit lifecycle"""
    __tablename__ = 'commissions'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    agent_id: Mapped[int] = mapped_column(Integer, ForeignKey('agents.id'), nullable=False, index=True)
    transaction_id: Mapped[int] = mapped_column(Integer, ForeignKey('transactions.id'), nullable=False, index=True)
    
    # Commission amount
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        CheckConstraint('amount > 0', name='commission_amount_positive'),
        nullable=False
    )
    
    # Commission rate (e.g., 0.025 for 2.5%)
    rate: Mapped[Decimal] = mapped_column(Numeric(precision=5, scale=4), nullable=False)
    
    # Lifecycle status
    status: Mapped[CommissionState] = mapped_column(
        Enum(CommissionState),
        default=CommissionState.CALCULATED,
        nullable=False,
        index=True
    )
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    payable_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    payout_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index('idx_commission_agent_status', 'agent_id', 'status'),
        Index('idx_commission_transaction', 'transaction_id'),
    )
    
    def __repr__(self):
        return f"<Commission(id={self.id}, agent={self.agent_id}, amount={self.amount}, status={self.status})>"


# ==================== NEW MODELS - WALLET SYSTEM ====================

class CurrencyEnum(str, PyEnum):
    """العملات المدعومة"""
    SAR = "SAR"
    USD = "USD"
    EUR = "EUR"
    AED = "AED"
    EGP = "EGP"
    KWD = "KWD"
    QAR = "QAR"
    BHD = "BHD"
    OMR = "OMR"
    JOD = "JOD"
    TRY = "TRY"


class WalletPurpose(str, PyEnum):
    """تصنيف المحافظ"""
    MAIN = "main"
    COMMISSION = "commission"
    ESCROW = "escrow"


class Wallet(Base):
    """محفظة المستخدم - كل مستخدم له محفظة لكل عملة"""
    __tablename__ = 'wallets'
    __table_args__ = (
        UniqueConstraint('user_id', 'currency', name='uq_user_currency'),
    )
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    currency = Column(Enum(CurrencyEnum), nullable=False, default=CurrencyEnum.SAR)
    purpose = Column(Enum(WalletPurpose), nullable=False, default=WalletPurpose.MAIN)
    balance = Column(Numeric(15, 2), default=0.0, nullable=False)
    frozen_amount = Column(Numeric(15, 2), default=0.0)
    total_deposited = Column(Numeric(15, 2), default=0.0)
    total_withdrawn = Column(Numeric(15, 2), default=0.0)
    total_commission = Column(Numeric(15, 2), default=0.0)
    total_payouts = Column(Numeric(15, 2), default=0.0)
    daily_limit = Column(Numeric(15, 2), default=0.0)
    monthly_limit = Column(Numeric(15, 2), default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="wallets")
    transactions = relationship("WalletTransaction", back_populates="wallet", cascade="all, delete-orphan")


class WalletTransaction(Base):
    """سجل معاملات المحفظة - غير قابل للتعديل"""
    __tablename__ = 'wallet_transactions'
    
    id = Column(Integer, primary_key=True)
    wallet_id = Column(Integer, ForeignKey('wallets.id'), nullable=False)
    type = Column(String(20), nullable=False)  # deposit, withdraw, commission, refund
    amount = Column(Numeric(15, 2), nullable=False)
    idempotency_key = Column(String(64), unique=True, nullable=True)
    reference_id = Column(String(100))
    reference_type = Column(String(50))  # transaction, commission, payout
    description = Column(Text)
    status = Column(String(20), default='completed')  # completed, pending, failed
    created_by = Column(Integer, nullable=True)
    approved_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    wallet = relationship("Wallet", back_populates="transactions")


# ==================== NEW MODELS - AFFILIATE SYSTEM ====================

class AffiliateStatus(str, PyEnum):
    """حالة الوكيل"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"


class CommissionType(str, PyEnum):
    """نوع العمولة"""
    PERCENTAGE = "percentage"
    FIXED = "fixed"


class AffiliateTier(str, PyEnum):
    """مستويات المسوق"""
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"


class Affiliate(Base):
    """الوكيل أو المسوق"""
    __tablename__ = 'affiliates'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True)
    affiliate_code = Column(String(20), unique=True, nullable=False)
    affiliate_link = Column(String(255))
    referral_token = Column(String(64), unique=True)
    link_signature = Column(String(128))
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    email = Column(String(100))
    commission_type = Column(Enum(CommissionType), default=CommissionType.PERCENTAGE)
    commission_rate = Column(Numeric(10, 2), nullable=False)
    tier = Column(Enum(AffiliateTier), default=AffiliateTier.BRONZE)
    tier_set_at = Column(DateTime, default=datetime.utcnow)
    total_referrals = Column(Integer, default=0)
    active_referrals = Column(Integer, default=0)
    total_commission_earned = Column(Numeric(15, 2), default=0.0)
    total_commission_paid = Column(Numeric(15, 2), default=0.0)
    pending_commission = Column(Numeric(15, 2), default=0.0)
    status = Column(Enum(AffiliateStatus), default=AffiliateStatus.ACTIVE)
    is_verified = Column(Boolean, default=False)
    minimum_payout = Column(Numeric(10, 2), default=100.0)
    daily_payout_limit = Column(Numeric(15, 2), default=0.0)
    monthly_payout_limit = Column(Numeric(15, 2), default=0.0)
    escrow_balance = Column(Numeric(15, 2), default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="affiliate")
    referrals = relationship("AffiliateReferral", back_populates="affiliate")
    commissions = relationship("AffiliateCommission", back_populates="affiliate")
    payouts = relationship("AffiliatePayout", back_populates="affiliate")


class AffiliateReferral(Base):
    """الإحالات - العملاء الذين جاءوا من الوكيل"""
    __tablename__ = 'affiliate_referrals'
    
    id = Column(Integer, primary_key=True)
    affiliate_id = Column(Integer, ForeignKey('affiliates.id'), nullable=False)
    referred_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    referral_date = Column(DateTime, default=datetime.utcnow)
    attributed_at = Column(DateTime, default=datetime.utcnow)
    total_spent = Column(Numeric(15, 2), default=0.0)
    commission_earned = Column(Numeric(15, 2), default=0.0)
    status = Column(String(20), default='active')
    locked = Column(Boolean, default=False)
    __table_args__ = (
        UniqueConstraint('affiliate_id', 'referred_user_id', name='uq_affiliate_referral_user'),
    )
    
    # Relationships
    affiliate = relationship("Affiliate", back_populates="referrals")
    referred_user = relationship("User")


class AffiliateCommission(Base):
    """عمولات الوكيل"""
    __tablename__ = 'affiliate_commissions'
    
    id = Column(Integer, primary_key=True)
    affiliate_id = Column(Integer, ForeignKey('affiliates.id'), nullable=False)
    transaction_id = Column(Integer)
    transaction_amount = Column(Numeric(15, 2), nullable=False)
    commission_amount = Column(Numeric(15, 2), nullable=False)
    status = Column(Enum(CommissionState), default=CommissionState.CALCULATED)
    idempotency_key = Column(String(64), unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime)
    approved_by = Column(Integer)
    paid_at = Column(DateTime)
    payout_id = Column(Integer)
    
    # Relationships
    affiliate = relationship("Affiliate", back_populates="commissions")


class AffiliatePayout(Base):
    """دفعات الوكيل"""
    __tablename__ = 'affiliate_payouts'
    
    id = Column(Integer, primary_key=True)
    affiliate_id = Column(Integer, ForeignKey('affiliates.id'), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(10), default='SAR')
    payment_method = Column(String(50))
    status = Column(String(20), default='pending')  # pending, approved, rejected, paid
    idempotency_key = Column(String(64), unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime)
    approved_by = Column(Integer)
    processed_at = Column(DateTime)
    paid_at = Column(DateTime)
    failure_reason = Column(Text)
    
    # Relationships
    affiliate = relationship("Affiliate", back_populates="payouts")


# ==================== NEW MODELS - PAYMENT METHODS ====================

class PaymentMethodType(str, PyEnum):
    """أنواع طرق الدفع"""
    BANK_TRANSFER = "bank_transfer"
    IBAN = "iban"
    WALLET = "wallet"
    CRYPTO = "crypto"
    CARD = "card"


class PaymentMethodStatus(str, PyEnum):
    """حالة طريقة الدفع"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    DISABLED = "disabled"


class PaymentMethod(Base):
    """طرق الدفع المتاحة"""
    __tablename__ = 'payment_methods'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    type = Column(Enum(PaymentMethodType), nullable=False)
    display_name_ar = Column(String(150), nullable=False)
    display_name_en = Column(String(150))
    deposit_fee = Column(Numeric(5, 2), default=0.0)
    withdrawal_fee = Column(Numeric(5, 2), default=0.0)
    min_deposit = Column(Numeric(15, 2), default=0.0)
    max_deposit = Column(Numeric(15, 2), default=999999.99)
    min_withdrawal = Column(Numeric(15, 2), default=0.0)
    max_withdrawal = Column(Numeric(15, 2), default=999999.99)
    supported_currencies = Column(JSON, default=['SAR'])
    bank_details = Column(JSON)
    config = Column(JSON)
    status = Column(Enum(PaymentMethodStatus), default=PaymentMethodStatus.ACTIVE)
    is_active = Column(Boolean, default=True)
    is_deposit = Column(Boolean, default=True)
    is_withdrawal = Column(Boolean, default=True)
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserPaymentMethod(Base):
    """طرق الدفع المحفوظة للمستخدم"""
    __tablename__ = 'user_payment_methods'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    payment_method_id = Column(Integer, ForeignKey('payment_methods.id'), nullable=False)
    account_holder_name = Column(String(150))
    account_number = Column(String(50))
    bank_code = Column(String(10))
    card_last_digits = Column(String(4))
    extra_data = Column(JSON)
    is_verified = Column(Boolean, default=False)
    is_primary = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ✅ Game System Models (Legacy - DEPRECATED, use SecureGameSession instead)

class GameSession(Base):
    """
    DEPRECATED: Legacy game session model. Use SecureGameSession instead.
    
    This model is kept for backward compatibility only and is not actively used.
    The table 'game_sessions' is no longer created by migrations.
    All new code should use SecureGameSession with digital signatures and security features.
    """
    __tablename__ = 'game_sessions'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    
    # Game type (dice, slots, coin, roulette)
    game_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    # ✅ Algorithm tracking
    algorithm_used: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # FIXED_HOUSE_EDGE, DYNAMIC
    algorithm_version: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    algorithm_parameters: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Session state
    status: Mapped[str] = mapped_column(String(20), default='ACTIVE', nullable=False)  # ACTIVE, COMPLETED, ABANDONED
    total_rounds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_bets: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal('0.00'), nullable=False)
    total_wins: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal('0.00'), nullable=False)
    total_losses: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal('0.00'), nullable=False)
    
    # Balance snapshots
    initial_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    final_balance: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    
    # Timestamps
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index('idx_game_sessions_user_created', 'user_id', 'started_at'),
        Index('idx_game_sessions_type_created', 'game_type', 'started_at'),
    )
    
    def __repr__(self):
        return f"<GameSession(id={self.id}, user={self.user_id}, game={self.game_type}, algo={self.algorithm_used})>"


class GameRound(Base):
    """Individual game rounds within a session - tracks algorithm outcomes"""
    __tablename__ = 'game_rounds'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey('game_sessions.id'), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    
    # Round details
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    bet_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    
    # ✅ Algorithm outcome
    result: Mapped[str] = mapped_column(String(20), nullable=False)  # WIN, LOSS, DRAW
    payout_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    multiplier: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True)
    
    # Game state
    game_state: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Dice rolls, slots result, etc.
    player_input: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Player's guess/prediction
    
    # ✅ Which algorithm calculated this
    algorithm_used: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    algorithm_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Debug info
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    
    __table_args__ = (
        Index('idx_game_rounds_session', 'session_id'),
        Index('idx_game_rounds_user_created', 'user_id', 'created_at'),
    )
    
    def __repr__(self):
        return f"<GameRound(id={self.id}, session={self.session_id}, round={self.round_number}, result={self.result})>"


# Update User model to add relationships
User.wallets = relationship("Wallet", back_populates="user")
User.affiliate = relationship("Affiliate", back_populates="user", uselist=False)
User.game_sessions = relationship("GameSession", foreign_keys=[GameSession.user_id], backref="user_sessions")
User.game_rounds = relationship("GameRound", foreign_keys=[GameRound.user_id], backref="user_rounds")
User.secure_game_sessions = relationship(
    "SecureGameSession",
    back_populates="player",
    foreign_keys="SecureGameSession.player_id",
)


# ==================== NOTIFICATION SYSTEM ====================

class NotificationPriority(str, PyEnum):
    """Priority levels for notifications"""
    CRITICAL = "critical"  # Modal overlay, blocks workflow
    HIGH = "high"  # Persistent banner
    MEDIUM = "medium"  # Toast notification
    LOW = "low"  # Silent notification
    INFO = "info"  # Informational toast


class NotificationType(str, PyEnum):
    """Types of notifications"""
    AGENT_COMMISSION = "agent_commission"
    AFFILIATE_PAYOUT = "affiliate_payout"
    TRANSACTION_ALERT = "transaction_alert"
    PLAYER_ACTION = "player_action"
    SYSTEM_ALERT = "system_alert"
    APPROVAL_REQUEST = "approval_request"
    FINANCIAL_WARNING = "financial_warning"
    COMPLIANCE_ALERT = "compliance_alert"
    GAME_EVENT = "game_event"
    CUSTOM = "custom"


class NotificationStatus(str, PyEnum):
    """Notification delivery and interaction status"""
    PENDING = "pending"
    DELIVERED = "delivered"
    READ = "read"
    INTERACTED = "interacted"
    DISMISSED = "dismissed"
    FAILED = "failed"


class Notification(Base):
    """Real-time notification system for control panel users"""
    __tablename__ = 'notifications'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Recipient
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    
    # Notification content
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType), nullable=False, index=True)
    priority: Mapped[NotificationPriority] = mapped_column(Enum(NotificationPriority), nullable=False, index=True)
    
    # Action and navigation
    action_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    action_label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    action_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Status tracking
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(NotificationStatus),
        default=NotificationStatus.PENDING,
        nullable=False,
        index=True
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    interacted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    dismissed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Event tracking
    event_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    actor_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    event_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Idempotency and deduplication
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True, index=True)
    
    # Delivery tracking
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivery_channel: Mapped[str] = mapped_column(String(50), default='web', nullable=False)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Metadata (renamed from 'metadata' to avoid SQLAlchemy conflict)
    notification_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    # Relationships
    user = relationship("User", backref="notifications")
    
    __table_args__ = (
        Index('idx_notifications_user_status', 'user_id', 'status'),
        Index('idx_notifications_user_created', 'user_id', 'created_at'),
        Index('idx_notifications_priority_created', 'priority', 'created_at'),
        Index('idx_notifications_type_created', 'type', 'created_at'),
    )
    
    def __repr__(self):
        return f"<Notification(id={self.id}, user={self.user_id}, type={self.type}, priority={self.priority}, status={self.status})>"


class NotificationEvent(Base):
    """Tracks notification-triggering events for audit and analytics"""
    __tablename__ = 'notification_events'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Event details
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    event_source: Mapped[str] = mapped_column(String(100), nullable=False)
    event_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    
    # Actor who triggered the event
    actor_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    actor_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # Notification generation
    notification_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    target_users: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    
    # Processing status
    processed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Idempotency
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True, index=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )
    
    __table_args__ = (
        Index('idx_notification_events_type_created', 'event_type', 'created_at'),
        Index('idx_notification_events_processed', 'processed', 'created_at'),
    )
    
    def __repr__(self):
        return f"<NotificationEvent(id={self.id}, type={self.event_type}, processed={self.processed})>"


# ============================================================================
# 🎮 GAMING SYSTEM MODELS
# ============================================================================

class GameType(str, PyEnum):
    """Type of game"""
    INTERNAL = "internal"  # Games running inside our system (e.g., Flying Plane)
    EXTERNAL = "external"  # Games from external providers via iframe/API

class GameStatus(str, PyEnum):
    """Game operational status"""
    ACTIVE = "active"
    DISABLED = "disabled"
    MAINTENANCE = "maintenance"
    TESTING = "testing"

class GameOutcome(str, PyEnum):
    """Outcome of a game session"""
    WIN = "win"
    LOSE = "lose"
    CANCELLED = "cancelled"
    PENDING = "pending"

class TicketType(str, PyEnum):
    """Type of support ticket"""
    COMPLAINT = "complaint"
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    SUPPORT = "support"
    GAME_ISSUE = "game_issue"

class TicketStatus(str, PyEnum):
    """Status of support ticket"""
    PENDING = "pending"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"


class Game(Base):
    """Game definition with configuration and rules"""
    __tablename__ = 'games'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Basic info
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    game_type: Mapped[GameType] = mapped_column(Enum(GameType), nullable=False, index=True)
    
    # External game URL (for external games only)
    game_launch_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Icon/Image
    icon_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    icon_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # 'static', 'gif', 'lottie'
    
    # Betting limits
    min_bet_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        CheckConstraint('min_bet_amount > 0', name='game_min_bet_positive'),
        nullable=False,
        default=Decimal('10.00')
    )
    
    max_bet_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        CheckConstraint('max_bet_amount >= min_bet_amount', name='game_max_bet_valid'),
        nullable=False,
        default=Decimal('10000.00')
    )
    
    # Payout configuration
    payout_min_percent: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=False,
        default=Decimal('50.00')
    )
    
    payout_max_percent: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=False,
        default=Decimal('150.00')
    )
    
    house_edge_percent: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=False,
        default=Decimal('5.00')
    )
    
    # Game settings
    status: Mapped[GameStatus] = mapped_column(
        Enum(GameStatus),
        nullable=False,
        default=GameStatus.ACTIVE,
        index=True
    )
    
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    max_sessions_per_day: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    
    # Notification settings
    win_notification_threshold: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        nullable=False,
        default=Decimal('1000.00')
    )
    
    # Statistics (cached)
    total_sessions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_bet_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        default=Decimal('0.00'),
        nullable=False
    )
    total_win_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        default=Decimal('0.00'),
        nullable=False
    )
    
    # Audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    created_by_admin_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    
    # Relationships
    sessions = relationship("SecureGameSession", back_populates="game", cascade="all, delete-orphan")
    player_overrides = relationship("GamePlayerOverride", back_populates="game", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_game_status_featured', 'status', 'is_featured'),
        Index('idx_game_type_status', 'game_type', 'status'),
    )
    
    def __repr__(self):
        return f"<Game(id={self.id}, name={self.name}, type={self.game_type}, status={self.status})>"


class SecureGameSession(Base):
    """Secure game session with digital signature"""
    __tablename__ = 'secure_game_sessions'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Unique session identifier
    session_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    
    # References
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    game_id: Mapped[int] = mapped_column(Integer, ForeignKey('games.id'), nullable=False, index=True)
    
    # Betting
    bet_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        CheckConstraint('bet_amount > 0', name='session_bet_positive'),
        nullable=False
    )
    
    # Session timeline
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )
    
    end_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True
    )
    
    # Outcome
    outcome: Mapped[GameOutcome] = mapped_column(
        Enum(GameOutcome),
        default=GameOutcome.PENDING,
        nullable=False,
        index=True
    )
    
    win_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        default=Decimal('0.00'),
        nullable=False
    )
    
    profit_loss: Mapped[Decimal] = mapped_column(
        Numeric(precision=15, scale=2),
        default=Decimal('0.00'),
        nullable=False
    )
    
    # Security
    session_token: Mapped[str] = mapped_column(String(500), nullable=False)  # JWT/HMAC token
    signature: Mapped[str] = mapped_column(String(256), nullable=False)  # HMAC signature
    
    # Game data (JSON)
    game_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # External game integration
    external_game_session_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    webhook_received: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Idempotency
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    
    # Tracking
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Session expiry (prevent old sessions from being manipulated)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    # Relationships
    player = relationship("User", back_populates="secure_game_sessions", foreign_keys=[player_id])
    game = relationship("Game", back_populates="sessions")
    
    __table_args__ = (
        Index('idx_game_session_player_game', 'player_id', 'game_id'),
        Index('idx_game_session_outcome_created', 'outcome', 'start_time'),
        Index('idx_game_session_expires', 'expires_at'),
        CheckConstraint(
            "outcome != 'win' OR win_amount > 0",
            name='check_win_amount_consistency'
        ),
    )
    
    def __repr__(self):
        return f"<SecureGameSession(id={self.id}, session={self.session_id}, player={self.player_id}, outcome={self.outcome})>"


class GamePlayerOverride(Base):
    """Player-specific game overrides (VIP/Testing)"""
    __tablename__ = 'game_player_overrides'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    game_id: Mapped[int] = mapped_column(Integer, ForeignKey('games.id'), nullable=False, index=True)
    
    # Custom betting limits
    custom_min_bet: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=15, scale=2), nullable=True)
    custom_max_bet: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=15, scale=2), nullable=True)
    
    # Custom payout
    custom_payout_percent: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=5, scale=2), nullable=True)
    
    # Custom session limit
    max_sessions_override: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    
    # Expiry
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    created_by_admin_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    
    # Relationships
    player = relationship("User", foreign_keys=[player_id])
    game = relationship("Game", back_populates="player_overrides")
    
    __table_args__ = (
        UniqueConstraint('player_id', 'game_id', name='uq_player_game_override'),
        Index('idx_override_player_active', 'player_id', 'is_active'),
    )
    
    def __repr__(self):
        return f"<GamePlayerOverride(id={self.id}, player={self.player_id}, game={self.game_id})>"


class Ticket(Base):
    """Support tickets for complaints, deposits, withdrawals"""
    __tablename__ = 'tickets'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Unique ticket number
    ticket_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    
    # References
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    
    # Type and status
    ticket_type: Mapped[TicketType] = mapped_column(Enum(TicketType), nullable=False, index=True)
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus),
        default=TicketStatus.PENDING,
        nullable=False,
        index=True
    )
    
    # Content
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Amount (for deposit/withdrawal)
    amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(precision=15, scale=2), nullable=True)
    
    # Admin response
    admin_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    responded_by_admin_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Priority
    priority: Mapped[int] = mapped_column(Integer, default=1, nullable=False)  # 1=low, 5=critical
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    attachments = relationship("TicketAttachment", back_populates="ticket", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_ticket_user_status', 'user_id', 'status'),
        Index('idx_ticket_type_status', 'ticket_type', 'status'),
        Index('idx_ticket_created', 'created_at'),
    )
    
    def __repr__(self):
        return f"<Ticket(id={self.id}, number={self.ticket_number}, type={self.ticket_type}, status={self.status})>"


class TicketAttachment(Base):
    """File attachments for tickets (images/documents)"""
    __tablename__ = 'ticket_attachments'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    ticket_id: Mapped[int] = mapped_column(Integer, ForeignKey('tickets.id'), nullable=False, index=True)
    
    # File info
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)  # bytes
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Timestamps
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    # Relationships
    ticket = relationship("Ticket", back_populates="attachments")
    
    def __repr__(self):
        return f"<TicketAttachment(id={self.id}, ticket={self.ticket_id}, file={self.file_name})>"

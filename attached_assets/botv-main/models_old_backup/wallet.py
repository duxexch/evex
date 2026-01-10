"""
محفظة العميل - Wallet Model
نظام المحفظة الذي يتتبع رصيد العميل حسب العملة
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Enum as SQLEnum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import Base


class CurrencyEnum(str, enum.Enum):
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


class Wallet(Base):
    """
    محفظة العميل
    كل عميل يمكن أن يكون له عدة محافظ بعملات مختلفة
    """
    __tablename__ = 'wallets'
    __table_args__ = (
        UniqueConstraint('user_id', 'currency', name='uq_user_currency'),
    )
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    currency = Column(SQLEnum(CurrencyEnum), nullable=False, default=CurrencyEnum.SAR)
    balance = Column(Float, default=0.0, nullable=False)
    
    # إحصائيات
    total_deposited = Column(Float, default=0.0)
    total_withdrawn = Column(Float, default=0.0)
    total_commission = Column(Float, default=0.0)
    
    # الحالة
    is_active = Column(Boolean, default=True)
    frozen_amount = Column(Float, default=0.0)  # المبلغ المجمد (في انتظار الموافقة)
    
    # التتبع
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_transaction_at = Column(DateTime)
    
    # العلاقات
    user = relationship("User", back_populates="wallets")
    transactions = relationship("WalletTransaction", back_populates="wallet")
    
    def __repr__(self):
        return f"<Wallet {self.user_id} - {self.currency}: {self.balance}>"


class WalletTransaction(Base):
    """
    تحويلات المحفظة
    كل إيداع أو سحب يتم تسجيله هنا
    """
    __tablename__ = 'wallet_transactions'
    
    id = Column(Integer, primary_key=True)
    wallet_id = Column(Integer, ForeignKey('wallets.id'), nullable=False)
    
    type = Column(String(20), nullable=False)  # deposit, withdraw, commission, refund
    amount = Column(Float, nullable=False)
    
    # التفاصيل
    reference_id = Column(String(50))  # معرف الطلب الأصلي
    description = Column(String(255))
    
    # الحالة
    status = Column(String(20), default='completed')  # completed, pending, failed
    
    # التتبع
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_by = Column(Integer)  # معرف الأدمن إن وجد
    
    # العلاقات
    wallet = relationship("Wallet", back_populates="transactions")
    
    def __repr__(self):
        return f"<WalletTransaction {self.id} - {self.type}: {self.amount}>"

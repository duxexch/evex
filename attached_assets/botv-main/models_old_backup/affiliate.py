"""
نظام المسوقين والوكلاء - Affiliate System
يدير المسوقين والوكلاء والعمولات والإحالات
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import Base


class AffiliateStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"


class CommissionType(str, enum.Enum):
    PERCENTAGE = "percentage"  # نسبة مئوية
    FIXED = "fixed"  # مبلغ ثابت


class TransactionStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"


class PayoutStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Affiliate(Base):
    """
    المسوق أو الوكيل
    شخص يجلب عملاء جدد ويحصل على عمولة
    """
    __tablename__ = 'affiliates'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True)
    
    # معرف فريد للمسوق
    affiliate_code = Column(String(20), unique=True, nullable=False)
    affiliate_link = Column(String(255))  # رابط الإحالة
    
    # معلومات المسوق
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    email = Column(String(100))
    
    # عمولة المسوق
    commission_type = Column(SQLEnum(CommissionType), default=CommissionType.PERCENTAGE)
    commission_rate = Column(Float, nullable=False)  # النسبة أو المبلغ
    
    # إحصائيات
    total_referrals = Column(Integer, default=0)  # عدد الإحالات
    active_referrals = Column(Integer, default=0)  # الإحالات النشطة
    total_commission_earned = Column(Float, default=0.0)
    total_commission_paid = Column(Float, default=0.0)
    pending_commission = Column(Float, default=0.0)
    
    # الحد الأدنى للدفع
    minimum_payout = Column(Float, default=100.0)
    
    # الحالة
    status = Column(SQLEnum(AffiliateStatus), default=AffiliateStatus.PENDING)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # التتبع
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_payout_at = Column(DateTime)
    
    # الملاحظات
    notes = Column(String(500))
    
    # العلاقات
    user = relationship("User", back_populates="affiliate_profile")
    referrals = relationship("AffiliateReferral", back_populates="affiliate", foreign_keys="AffiliateReferral.affiliate_id")
    
    def __repr__(self):
        return f"<Affiliate {self.affiliate_code}: {self.name}>"


class AffiliateReferral(Base):
    """
    الإحالات
    تسجيل عملاء جدد تم إحالتهم بواسطة مسوق
    """
    __tablename__ = 'affiliate_referrals'
    
    id = Column(Integer, primary_key=True)
    affiliate_id = Column(Integer, ForeignKey('affiliates.id'), nullable=False)
    referred_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    
    # تفاصيل الإحالة
    referral_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default='active')  # active, inactive, churned
    
    # الإحصائيات
    total_spent = Column(Float, default=0.0)
    commission_earned = Column(Float, default=0.0)
    
    # التتبع
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # العلاقات
    affiliate = relationship("Affiliate", back_populates="referrals", foreign_keys=[affiliate_id])
    
    def __repr__(self):
        return f"<AffiliateReferral {self.id}: {self.affiliate_id} -> {self.referred_user_id}>"


class AffiliateCommission(Base):
    """
    العمولات المحتسبة
    تتبع العمولات المستحقة والمدفوعة
    """
    __tablename__ = 'affiliate_commissions'
    
    id = Column(Integer, primary_key=True)
    affiliate_id = Column(Integer, ForeignKey('affiliates.id'), nullable=False)
    transaction_id = Column(Integer)  # معرف المعاملة الأصلية
    
    # المبلغ والعمولة
    transaction_amount = Column(Float, nullable=False)
    commission_amount = Column(Float, nullable=False)
    
    # الحالة
    status = Column(String(20), default='pending')  # pending, approved, paid
    
    # التتبع
    created_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime)
    
    # الملاحظات
    notes = Column(String(255))
    
    def __repr__(self):
        return f"<AffiliateCommission {self.id}: {self.commission_amount}>"


class AffiliatePayout(Base):
    """
    مدفوعات العمولات
    تسجيل دفع العمولات للمسوقين
    """
    __tablename__ = 'affiliate_payouts'
    
    id = Column(Integer, primary_key=True)
    affiliate_id = Column(Integer, ForeignKey('affiliates.id'), nullable=False)
    
    # تفاصيل الدفع
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default='SAR')
    
    # طريقة الدفع
    payment_method = Column(String(50))  # bank_transfer, wallet, etc
    bank_account = Column(String(50))
    
    # الحالة
    status = Column(String(20), default='pending')  # pending, processing, completed, failed
    
    # التتبع
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # الملاحظات
    notes = Column(String(255))
    
    def __repr__(self):
        return f"<AffiliatePayout {self.id}: {self.amount} {self.status}>"

"""
Payment Methods Model - نموذج طرق الدفع
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import Base


class PaymentMethodType(str, Enum):
    """أنواع طرق الدفع"""
    BANK_TRANSFER = "bank_transfer"  # تحويل بنكي
    IBAN = "iban"  # حساب آيبان
    WALLET = "wallet"  # محفظة
    CRYPTO = "crypto"  # عملات رقمية
    CARD = "card"  # بطاقة


class PaymentMethodStatus(str, Enum):
    """حالة طريقة الدفع"""
    ACTIVE = "active"  # نشطة
    INACTIVE = "inactive"  # غير نشطة
    SUSPENDED = "suspended"  # معطلة
    DISABLED = "disabled"  # معطلة نهائياً


class PaymentMethod(Base):
    """طريقة دفع"""
    __tablename__ = "payment_methods"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)  # اسم الطريقة (بنك السعودي، بايبال، إلخ)
    type = Column(SQLEnum(PaymentMethodType), nullable=False)  # نوع الطريقة
    display_name_ar = Column(String(150), nullable=False)  # الاسم بالعربية للعرض
    display_name_en = Column(String(150), nullable=True)  # الاسم بالإنجليزية
    
    # الرسوم
    deposit_fee = Column(Float, default=0.0)  # رسوم الإيداع (%)
    withdrawal_fee = Column(Float, default=0.0)  # رسوم السحب (%)
    
    # الحدود
    min_deposit = Column(Float, default=0.0)  # الحد الأدنى للإيداع
    max_deposit = Column(Float, default=999999.99)  # الحد الأقصى للإيداع
    min_withdrawal = Column(Float, default=0.0)  # الحد الأدنى للسحب
    max_withdrawal = Column(Float, default=999999.99)  # الحد الأقصى للسحب
    
    # العملات المدعومة
    supported_currencies = Column(JSON, default=['SAR'])  # [SAR, USD, EUR, ...]
    
    # البيانات الإضافية
    bank_details = Column(JSON, nullable=True)  # تفاصيل البنك
    config = Column(JSON, nullable=True)  # إعدادات إضافية
    
    # الحالة
    status = Column(SQLEnum(PaymentMethodStatus), default=PaymentMethodStatus.ACTIVE)
    is_active = Column(Boolean, default=True)
    
    # للإيداع فقط
    is_deposit = Column(Boolean, default=True)
    # للسحب فقط
    is_withdrawal = Column(Boolean, default=True)
    
    # الترتيب في القائمة
    order = Column(Integer, default=0)
    
    # التواريخ
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def is_available_for_deposit(self) -> bool:
        """هل طريقة الدفع متاحة للإيداع"""
        return self.is_active and self.is_deposit and self.status == PaymentMethodStatus.ACTIVE
    
    def is_available_for_withdrawal(self) -> bool:
        """هل طريقة الدفع متاحة للسحب"""
        return self.is_active and self.is_withdrawal and self.status == PaymentMethodStatus.ACTIVE
    
    def get_display_name(self, language: str = 'ar') -> str:
        """الحصول على اسم العرض"""
        if language == 'ar':
            return self.display_name_ar
        else:
            return self.display_name_en or self.display_name_ar
    
    def calculate_deposit_fee(self, amount: float) -> float:
        """حساب رسوم الإيداع"""
        return (amount * self.deposit_fee) / 100
    
    def calculate_withdrawal_fee(self, amount: float) -> float:
        """حساب رسوم السحب"""
        return (amount * self.withdrawal_fee) / 100
    
    def get_net_deposit(self, amount: float) -> float:
        """الحصول على المبلغ الصافي بعد الرسوم للإيداع"""
        fee = self.calculate_deposit_fee(amount)
        return amount - fee
    
    def get_net_withdrawal(self, amount: float) -> float:
        """الحصول على المبلغ الصافي بعد الرسوم للسحب"""
        fee = self.calculate_withdrawal_fee(amount)
        return amount - fee


class UserPaymentMethod(Base):
    """طريقة دفع محفوظة للمستخدم"""
    __tablename__ = "user_payment_methods"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)  # معرف المستخدم
    payment_method_id = Column(Integer, nullable=False)  # معرف طريقة الدفع
    
    # بيانات الحساب (مشفرة)
    account_holder_name = Column(String(150), nullable=True)  # اسم صاحب الحساب
    account_number = Column(String(50), nullable=True)  # رقم الحساب/الآيبان
    bank_code = Column(String(10), nullable=True)  # رمز البنك
    card_last_digits = Column(String(4), nullable=True)  # آخر 4 أرقام من البطاقة
    
    # بيانات إضافية
    extra_data = Column(JSON, nullable=True)
    
    # الحالة
    is_verified = Column(Boolean, default=False)  # هل تم التحقق
    is_primary = Column(Boolean, default=False)  # الطريقة الافتراضية
    is_active = Column(Boolean, default=True)
    
    # التواريخ
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

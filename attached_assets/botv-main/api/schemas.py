#!/usr/bin/env python3
"""
Pydantic schemas for API requests and responses
"""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional
from datetime import datetime


# Authentication schemas
class LoginRequest(BaseModel):
    phone_number: str = Field(..., description="User phone number")
    
    @field_validator('phone_number')
    @classmethod
    def validate_phone(cls, v):
        if not v or len(v) < 10:
            raise ValueError('Invalid phone number')
        return v


class RegisterRequest(BaseModel):
    phone_number: str
    first_name: str
    last_name: Optional[str] = None
    language_code: str = "ar"
    country_code: str = "SA"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    customer_code: Optional[str]


# User schemas
class UserProfile(BaseModel):
    id: int
    telegram_id: Optional[int] = None
    phone_number: Optional[str]
    customer_code: Optional[str]
    first_name: str
    last_name: Optional[str]
    username: Optional[str]
    language_code: str
    country_code: str
    notifications_enabled: bool
    is_active: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    language_code: Optional[str] = None
    country_code: Optional[str] = None
    notifications_enabled: Optional[bool] = None


# Financial schemas
class DepositRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Deposit amount")
    payment_method: str
    receipt_url: Optional[str] = None
    notes: Optional[str] = None


class WithdrawalRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Withdrawal amount")
    account_details: str
    notes: Optional[str] = None


class ComplaintRequest(BaseModel):
    subject: str
    description: str
    attachment_url: Optional[str] = None


class TransactionResponse(BaseModel):
    id: int
    type: str
    amount: Optional[float]
    status: str
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Settings schemas
class LanguageResponse(BaseModel):
    id: int
    code: str
    name: str
    native_name: str
    rtl: bool
    is_active: bool
    
    model_config = ConfigDict(from_attributes=True)


class CountryResponse(BaseModel):
    id: int
    code: str
    name: str
    native_name: str
    is_active: bool
    
    model_config = ConfigDict(from_attributes=True)


# Admin schemas
class BroadcastRequest(BaseModel):
    message: str
    target_type: str = "all"  # all, language, country
    target_value: Optional[str] = None


class AdminStatsResponse(BaseModel):
    total_users: int
    active_users: int
    pending_requests: int
    total_deposits: float
    total_withdrawals: float

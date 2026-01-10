"""
Players API Schemas
Request/response models for player management endpoints
"""
from pydantic import BaseModel, Field, field_serializer, ConfigDict
from typing import Optional, List
from decimal import Decimal
from datetime import datetime


class PlayerBalanceBase(BaseModel):
    """Base model for player balance"""
    current_balance: Decimal = Field(Decimal('0.00'), ge=Decimal('0'))
    total_deposited: Decimal = Field(Decimal('0.00'), ge=Decimal('0'))
    total_withdrawn: Decimal = Field(Decimal('0.00'), ge=Decimal('0'))
    total_wagered: Decimal = Field(Decimal('0.00'), ge=Decimal('0'))
    total_winnings: Decimal = Field(Decimal('0.00'), ge=Decimal('0'))


class PlayerBalanceResponse(PlayerBalanceBase):
    """Player balance response"""
    id: int
    player_id: int
    is_banned: bool
    ban_reason: Optional[str] = None
    ban_until: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_serializer('current_balance', 'total_deposited', 'total_withdrawn', 'total_wagered', 'total_winnings')
    def serialize_decimal(self, value: Decimal) -> float:
        return float(value)


class BalanceTransactionBase(BaseModel):
    """Base model for balance transaction"""
    transaction_type: str = Field(..., pattern="^(deposit|withdrawal|game_payout|adjustment|refund)$")
    amount: Decimal = Field(..., decimal_places=2)
    description: Optional[str] = None


class BalanceTransactionCreate(BalanceTransactionBase):
    """Create balance transaction"""
    game_id: Optional[int] = None
    game_session_id: Optional[str] = None
    reference_id: Optional[str] = None


class BalanceTransactionResponse(BalanceTransactionCreate):
    """Balance transaction response"""
    id: int
    player_id: int
    balance_before: Decimal
    balance_after: Decimal
    is_verified: bool
    created_by: Optional[int] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_serializer('amount', 'balance_before', 'balance_after')
    def serialize_decimal(self, value: Decimal) -> float:
        return float(value)


class PlayerStatisticsResponse(BaseModel):
    """Player statistics response"""
    player_id: int
    current_balance: float
    total_deposited: float
    total_withdrawn: float
    total_wagered: float
    total_winnings: float
    is_banned: bool
    ban_reason: Optional[str] = None
    ban_until: Optional[str] = None
    net_profit: float
    created_at: Optional[str] = None


class PlayerBanRequest(BaseModel):
    """Ban player request"""
    reason: str = Field(..., min_length=1, max_length=255)
    ban_until: Optional[datetime] = None


class PlayerUnbanRequest(BaseModel):
    """Unban player request"""
    pass


class DepositRequest(BaseModel):
    """Player deposit request"""
    amount: Decimal = Field(..., gt=Decimal('0'), decimal_places=2)
    reference_id: Optional[str] = Field(None, max_length=100)


class WithdrawalRequest(BaseModel):
    """Player withdrawal request"""
    amount: Decimal = Field(..., gt=Decimal('0'), decimal_places=2)
    reference_id: Optional[str] = Field(None, max_length=100)


class AdjustmentRequest(BaseModel):
    """Player balance adjustment request"""
    amount: Decimal = Field(..., decimal_places=2)
    description: str = Field(..., min_length=1, max_length=255)
    reference_id: Optional[str] = Field(None, max_length=100)


class TransactionHistoryResponse(BaseModel):
    """Transaction history response"""
    total: int
    skip: int
    limit: int
    transactions: List[BalanceTransactionResponse]


class PlayerListResponse(BaseModel):
    """Player list response"""
    total: int
    skip: int
    limit: int
    players: List[PlayerBalanceResponse]


class TopPlayersResponse(BaseModel):
    """Top players by volume response"""
    player_id: int
    total_wagered: float
    total_winnings: float
    current_balance: float


class PlayerBatchOperationRequest(BaseModel):
    """Batch operation on players"""
    player_ids: List[int] = Field(..., min_length=1)
    operation: str = Field(..., pattern="^(ban|unban)$")
    reason: Optional[str] = None

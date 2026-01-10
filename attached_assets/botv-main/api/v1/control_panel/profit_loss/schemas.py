"""
Profit/Loss API Schemas
Request/response models for profit/loss management endpoints
"""
from pydantic import BaseModel, Field, field_serializer, ConfigDict
from typing import Optional, List
from decimal import Decimal
from datetime import datetime, date


class ProfitLossRuleBase(BaseModel):
    """Base model for profit/loss rule"""
    rule_name: Optional[str] = Field(None, max_length=100)
    rule_type: str = Field(..., pattern="^(house_edge_adjustment|payout_multiplier|loss_cap)$")
    house_edge_adjustment: Decimal = Field(Decimal('0'), decimal_places=2)
    payout_multiplier: Decimal = Field(Decimal('1.0'), decimal_places=2, gt=Decimal('0'))
    loss_cap: Optional[Decimal] = Field(None, decimal_places=2, gt=Decimal('0'))
    min_amount: Optional[Decimal] = Field(None, decimal_places=2, ge=Decimal('0'))
    max_amount: Optional[Decimal] = Field(None, decimal_places=2, gt=Decimal('0'))
    win_streak_threshold: Optional[int] = Field(None, ge=1)
    loss_streak_threshold: Optional[int] = Field(None, ge=1)
    priority: int = Field(100, ge=1)


class ProfitLossRuleCreate(ProfitLossRuleBase):
    """Create profit/loss rule"""
    game_id: int
    player_id: Optional[int] = None


class ProfitLossRuleUpdate(BaseModel):
    """Update profit/loss rule"""
    rule_name: Optional[str] = None
    house_edge_adjustment: Optional[Decimal] = None
    payout_multiplier: Optional[Decimal] = None
    loss_cap: Optional[Decimal] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
    win_streak_threshold: Optional[int] = None
    loss_streak_threshold: Optional[int] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class ProfitLossRuleResponse(ProfitLossRuleBase):
    """Profit/Loss rule response"""
    id: int
    game_id: int
    player_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_serializer('house_edge_adjustment', 'payout_multiplier', 'loss_cap', 'min_amount', 'max_amount')
    def serialize_decimal(self, value: Optional[Decimal]) -> Optional[float]:
        return float(value) if value is not None else None


class ProfitLossPlayerRuleBase(BaseModel):
    """Base model for player-specific profit/loss rule"""
    custom_house_edge: Optional[Decimal] = Field(None, decimal_places=2)
    daily_loss_limit: Optional[Decimal] = Field(None, decimal_places=2, gt=Decimal('0'))
    weekly_loss_limit: Optional[Decimal] = Field(None, decimal_places=2, gt=Decimal('0'))
    max_payout_multiplier: Optional[Decimal] = Field(None, decimal_places=2, gt=Decimal('0'))
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ProfitLossPlayerRuleCreate(ProfitLossPlayerRuleBase):
    """Create player-specific rule"""
    player_id: int
    game_id: Optional[int] = None


class ProfitLossPlayerRuleUpdate(BaseModel):
    """Update player-specific rule"""
    custom_house_edge: Optional[Decimal] = None
    daily_loss_limit: Optional[Decimal] = None
    weekly_loss_limit: Optional[Decimal] = None
    max_payout_multiplier: Optional[Decimal] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None


class ProfitLossPlayerRuleResponse(ProfitLossPlayerRuleBase):
    """Player-specific rule response"""
    id: int
    player_id: int
    game_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    updated_by: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_serializer('custom_house_edge', 'daily_loss_limit', 'weekly_loss_limit', 'max_payout_multiplier')
    def serialize_decimal(self, value: Optional[Decimal]) -> Optional[float]:
        return float(value) if value is not None else None


class RuleListResponse(BaseModel):
    """Rule list response"""
    total: int
    skip: int
    limit: int
    rules: List[ProfitLossRuleResponse]


class PlayerRuleListResponse(BaseModel):
    """Player rule list response"""
    total: int
    skip: int
    limit: int
    rules: List[ProfitLossPlayerRuleResponse]


class EffectiveSettingsResponse(BaseModel):
    """Effective profit/loss settings for a player"""
    custom_house_edge: Optional[float] = None
    daily_loss_limit: Optional[float] = None
    weekly_loss_limit: Optional[float] = None
    max_payout_multiplier: Optional[float] = None
    game_rules: List[dict] = []


class RuleSummaryResponse(BaseModel):
    """Profit/loss rule summary"""
    total_rules: int
    active_rules: int
    inactive_rules: int
    rules_by_type: dict


class BulkRuleUpdate(BaseModel):
    """Bulk update rules"""
    rule_ids: List[int] = Field(..., min_length=1)
    is_active: Optional[bool] = None
    priority: Optional[int] = None

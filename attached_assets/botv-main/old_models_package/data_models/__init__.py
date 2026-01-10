"""
Data Models for CSV-based persistence
Defines dataclasses for all domain entities
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from enum import Enum

# ==================== ENUMS ====================

class GameType(Enum):
    RPG = "rpg"
    CASINO = "casino"
    SPORTS = "sports"

class GameSessionResult(Enum):
    WIN = "win"
    LOSS = "loss"
    DRAW = "draw"

class AffiliateStatus(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"

# ==================== GAME MODELS ====================

@dataclass
class Game:
    """Game definition for CSV storage"""
    id: str
    name: str
    description: str
    type: str  # rpg, casino, sports
    payout_min_percent: float  # 50.0-100.0
    payout_max_percent: float  # 100.0-200.0
    status: str  # active, inactive
    created_date: str  # ISO format
    
    def to_csv_row(self) -> List[str]:
        return [
            self.id, self.name, self.description, self.type,
            str(self.payout_min_percent), str(self.payout_max_percent),
            self.status, self.created_date
        ]

@dataclass
class GameSession:
    """Game play session"""
    id: str
    user_id: int
    game_id: str
    stake_amount: Decimal
    result: str  # win, loss, draw
    payout_amount: Decimal
    profit_loss: Decimal  # Can be negative
    status: str  # completed, pending, failed
    created_date: str
    
    def to_csv_row(self) -> List[str]:
        return [
            self.id, str(self.user_id), self.game_id,
            str(self.stake_amount), self.result,
            str(self.payout_amount), str(self.profit_loss),
            self.status, self.created_date
        ]

@dataclass
class GameAlgorithm:
    """Win/loss probability overrides per game/region/user"""
    id: str
    game_id: str
    region: Optional[str]  # None = global
    user_id: Optional[int]  # None = all users
    win_probability: float  # 0.0-1.0
    loss_multiplier: float  # 0.5-2.0
    active: bool
    updated_date: str
    
    def to_csv_row(self) -> List[str]:
        return [
            self.id, self.game_id, self.region or "global",
            str(self.user_id) if self.user_id else "all",
            str(self.win_probability), str(self.loss_multiplier),
            "yes" if self.active else "no", self.updated_date
        ]

# ==================== AGENT MODELS ====================

@dataclass
class Agent:
    """Agent (Wakil) account"""
    id: str
    agent_name: str
    phone: str
    balance: Decimal
    commission_rate: float  # 1-10%
    is_active: bool
    created_date: str
    
    def to_csv_row(self) -> List[str]:
        return [
            self.id, self.agent_name, self.phone,
            str(self.balance), str(self.commission_rate),
            "yes" if self.is_active else "no", self.created_date
        ]

@dataclass
class AgentCommission:
    """Monthly commission tracking"""
    id: str
    agent_id: str
    month: str  # YYYY-MM
    total_volume: Decimal
    commission_amount: Decimal
    status: str  # pending, paid
    created_date: str
    
    def to_csv_row(self) -> List[str]:
        return [
            self.id, self.agent_id, self.month,
            str(self.total_volume), str(self.commission_amount),
            self.status, self.created_date
        ]

# ==================== AFFILIATE MODELS ====================

@dataclass
class Affiliate:
    """Affiliate/Marketer account"""
    id: str
    user_id: int
    referral_code: str
    total_referrals: int
    lifetime_commission: Decimal
    created_date: str
    
    def to_csv_row(self) -> List[str]:
        return [
            self.id, str(self.user_id), self.referral_code,
            str(self.total_referrals), str(self.lifetime_commission),
            self.created_date
        ]

@dataclass
class AffiliateReferral:
    """Referred user tracking"""
    id: str
    affiliate_id: str
    referred_user_id: int
    signup_date: str
    commission_rate: float  # 5-10%
    status: str  # active, inactive
    
    def to_csv_row(self) -> List[str]:
        return [
            self.id, self.affiliate_id, str(self.referred_user_id),
            self.signup_date, str(self.commission_rate), self.status
        ]

# ==================== USER PROFILE MODELS ====================

@dataclass
class UserProfile:
    """Extended user profile"""
    user_id: int
    phone_number: str
    phone_verified: bool
    profile_image_path: Optional[str]
    id_document_path: Optional[str]
    recovery_password: Optional[str]
    badges: List[str]  # JSON list
    last_verified_date: Optional[str]
    
    def to_csv_row(self) -> List[str]:
        import json
        return [
            str(self.user_id), self.phone_number,
            "yes" if self.phone_verified else "no",
            self.profile_image_path or "",
            self.id_document_path or "",
            self.recovery_password or "",
            json.dumps(self.badges),
            self.last_verified_date or ""
        ]

@dataclass
class Badge:
    """User achievement badge"""
    id: str
    user_id: int
    badge_name: str
    criteria: str  # game_played_10_times, deposited_1000, etc
    earned_date: str
    
    def to_csv_row(self) -> List[str]:
        return [self.id, str(self.user_id), self.badge_name, self.criteria, self.earned_date]

# ==================== COMPLAINT MODELS ====================

@dataclass
class Complaint:
    """User complaint about transaction"""
    id: str
    user_id: int
    transaction_id: str
    description: str
    status: str  # pending, investigating, resolved, rejected
    resolution: Optional[str]
    balance_adjustment: Optional[Decimal]
    created_date: str
    resolved_date: Optional[str]
    resolved_by: Optional[int]  # admin id
    
    def to_csv_row(self) -> List[str]:
        return [
            self.id, str(self.user_id), self.transaction_id,
            self.description, self.status,
            self.resolution or "", str(self.balance_adjustment) if self.balance_adjustment else "",
            self.created_date, self.resolved_date or "", str(self.resolved_by) if self.resolved_by else ""
        ]

# ==================== BALANCE LEDGER ====================

@dataclass
class BalanceLedgerEntry:
    """Financial transaction ledger for audit"""
    id: str
    user_id: int
    transaction_type: str  # deposit, withdraw, game_win, game_loss, commission, adjustment
    amount: Decimal
    balance_before: Decimal
    balance_after: Decimal
    description: str
    created_date: str
    
    def to_csv_row(self) -> List[str]:
        return [
            self.id, str(self.user_id), self.transaction_type,
            str(self.amount), str(self.balance_before),
            str(self.balance_after), self.description, self.created_date
        ]

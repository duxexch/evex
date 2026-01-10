"""
Analytics API Schemas
Request/response models for analytics and reporting endpoints
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date


class GamePerformanceResponse(BaseModel):
    """Game performance metrics"""
    game_id: int
    game_name: str
    play_count: int
    total_volume: float
    total_wagered: float
    total_payouts: float
    transaction_count: int
    house_edge: float
    rtp: float
    status: str


class OverallStatisticsResponse(BaseModel):
    """Overall platform statistics"""
    total_games: int
    active_games: int
    total_players: int
    active_players: int
    banned_players: int
    total_balance: float
    total_deposited: float
    total_withdrawn: float
    total_wagered: float
    total_winnings: float
    house_profit: float
    transaction_count: int


class TopGamesResponse(BaseModel):
    """Top games by volume"""
    game_id: int
    game_name: str
    total_volume: float
    play_count: int
    house_edge: float


class TopGamesListResponse(BaseModel):
    """List of top games"""
    games: List[TopGamesResponse]


class PlayerPerformanceResponse(BaseModel):
    """Player performance metrics"""
    player_id: int
    current_balance: float
    total_deposited: float
    total_withdrawn: float
    total_wagered: float
    total_winnings: float
    net_profit: float
    is_banned: bool
    period_deposits: float
    period_withdrawals: float
    period_payouts: float
    transaction_count: int


class DailyStatisticsResponse(BaseModel):
    """Daily platform statistics"""
    date: str
    total_games: int
    active_games: int
    total_players: int
    active_players: int
    banned_players: int
    total_balance: float
    total_deposited: float
    total_withdrawn: float
    total_wagered: float
    total_winnings: float
    house_profit: float
    transaction_count: int


class DailyStatisticsListResponse(BaseModel):
    """List of daily statistics"""
    days: int
    statistics: List[DailyStatisticsResponse]


class PlayerActivityTrendResponse(BaseModel):
    """Player activity trend"""
    date: str
    active_players: int


class PlayerActivityTrendListResponse(BaseModel):
    """List of player activity trends"""
    days: int
    trends: List[PlayerActivityTrendResponse]


class AnalyticsFilter(BaseModel):
    """Analytics filter request"""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    game_id: Optional[int] = None
    player_id: Optional[int] = None


class AnalyticsDateRangeFilter(BaseModel):
    """Analytics date range filter"""
    start_date: datetime
    end_date: datetime


class CustomReportRequest(BaseModel):
    """Custom report request"""
    report_type: str = Field(..., pattern="^(game|player|revenue|engagement)$")
    start_date: datetime
    end_date: datetime
    filters: Optional[Dict[str, Any]] = None
    group_by: Optional[str] = None


class RevenueMetricsResponse(BaseModel):
    """Revenue metrics"""
    total_revenue: float
    gross_profit: float
    net_profit: float
    average_bet: float
    average_payout: float
    roi: float
    house_edge_effective: float


class EngagementMetricsResponse(BaseModel):
    """Player engagement metrics"""
    new_players: int
    returning_players: int
    active_players: int
    churn_rate: float
    average_session_duration: float
    average_bets_per_session: int


class PartnerAgentAnalyticsResponse(BaseModel):
    """Aggregated analytics for agents."""
    total_agents: int
    active_agents: int
    blocked_agents: int
    total_commission_earned: float
    total_deposits_processed: float
    total_withdrawals_processed: float
    commission_status: dict


class PartnerAffiliateAnalyticsResponse(BaseModel):
    """Aggregated analytics for affiliates."""
    total_affiliates: int
    verified_affiliates: int
    total_referrals: int
    pending_commission: float
    total_commission_paid: float
    escrow_balance: float
    commission_status: dict
    payout_status: dict

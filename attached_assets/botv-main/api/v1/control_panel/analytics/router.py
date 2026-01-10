"""
Analytics API Router
Endpoints for analytics and reporting
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from datetime import datetime

from api.v1.control_panel.analytics.schemas import (
    GamePerformanceResponse,
    OverallStatisticsResponse,
    TopGamesResponse,
    TopGamesListResponse,
    PlayerPerformanceResponse,
    DailyStatisticsResponse,
    DailyStatisticsListResponse,
    PlayerActivityTrendResponse,
    PlayerActivityTrendListResponse,
    AnalyticsDateRangeFilter,
    PartnerAgentAnalyticsResponse,
    PartnerAffiliateAnalyticsResponse,
)
from services.control_panel import GameAnalyticsService
from api.dependencies import get_db, get_current_user

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics & Reporting"],
    responses={
        404: {"description": "Analytics data not found"},
        500: {"description": "Internal server error"}
    }
)


def get_analytics_service() -> GameAnalyticsService:
    return GameAnalyticsService()


@router.get("/overview", response_model=OverallStatisticsResponse)
async def get_overall_statistics(
    start_date: datetime = Query(None),
    end_date: datetime = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameAnalyticsService = Depends(get_analytics_service)
):
    """Get overall platform statistics"""
    try:
        stats = await service.get_overall_statistics(db, start_date, end_date)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/games/{game_id}/performance", response_model=GamePerformanceResponse)
async def get_game_performance(
    game_id: int,
    start_date: datetime = Query(None),
    end_date: datetime = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameAnalyticsService = Depends(get_analytics_service)
):
    """Get game performance metrics"""
    try:
        performance = await service.get_game_performance(db, game_id, start_date, end_date)
        return performance
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/games/top/volume", response_model=TopGamesListResponse)
async def get_top_games_by_volume(
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameAnalyticsService = Depends(get_analytics_service)
):
    """Get top games by wagered volume"""
    try:
        games = await service.get_top_games_by_volume(db, limit)
        return TopGamesListResponse(games=games)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/players/{player_id}/performance", response_model=PlayerPerformanceResponse)
async def get_player_performance(
    player_id: int,
    start_date: datetime = Query(None),
    end_date: datetime = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameAnalyticsService = Depends(get_analytics_service)
):
    """Get player performance metrics"""
    try:
        performance = await service.get_player_performance(db, player_id, start_date, end_date)
        return performance
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/daily", response_model=DailyStatisticsListResponse)
async def get_daily_statistics(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameAnalyticsService = Depends(get_analytics_service)
):
    """Get daily statistics for the past N days"""
    try:
        stats = await service.get_daily_statistics(db, days)
        return DailyStatisticsListResponse(days=days, statistics=stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/player-activity", response_model=PlayerActivityTrendListResponse)
async def get_player_activity_trend(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameAnalyticsService = Depends(get_analytics_service)
):
    """Get player activity trend over time"""
    try:
        trends = await service.get_player_activity_trend(db, days)
        return PlayerActivityTrendListResponse(days=days, trends=trends)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profit-loss/summary")
async def get_profit_loss_summary(
    game_id: int = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameAnalyticsService = Depends(get_analytics_service)
):
    """Get profit/loss rule summary"""
    try:
        summary = await service.get_profit_loss_summary(db, game_id)
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/partners/agents", response_model=PartnerAgentAnalyticsResponse)
async def partner_agents_overview(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameAnalyticsService = Depends(get_analytics_service),
):
    """Aggregated analytics for agents and their commissions."""
    try:
        return await service.get_agent_partner_analytics(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/partners/affiliates", response_model=PartnerAffiliateAnalyticsResponse)
async def partner_affiliates_overview(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameAnalyticsService = Depends(get_analytics_service),
):
    """Aggregated analytics for affiliates, commissions, and payouts."""
    try:
        return await service.get_affiliate_partner_analytics(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

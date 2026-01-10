"""
Profit/Loss API Router
Endpoints for managing profit/loss rules
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from api.v1.control_panel.profit_loss.schemas import (
    ProfitLossRuleCreate, ProfitLossRuleUpdate, ProfitLossRuleResponse,
    RuleListResponse, ProfitLossPlayerRuleCreate, ProfitLossPlayerRuleUpdate,
    ProfitLossPlayerRuleResponse, PlayerRuleListResponse, EffectiveSettingsResponse,
    RuleSummaryResponse, BulkRuleUpdate
)
from services.control_panel import ProfitLossService
from api.dependencies import get_db, get_current_user

router = APIRouter(
    prefix="/profit-loss",
    tags=["Profit/Loss Management"],
    responses={
        400: {"description": "Invalid rule configuration"},
        404: {"description": "Rule not found"},
        500: {"description": "Internal server error"}
    }
)


def get_profit_loss_service() -> ProfitLossService:
    return ProfitLossService()


# Game-level rules

@router.post("/rules", response_model=ProfitLossRuleResponse, status_code=201)
async def create_rule(
    rule: ProfitLossRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: ProfitLossService = Depends(get_profit_loss_service)
):
    """Create a new profit/loss rule"""
    try:
        created_rule = await service.create_rule(
            db,
            game_id=rule.game_id,
            rule_name=rule.rule_name,
            rule_type=rule.rule_type,
            house_edge_adjustment=rule.house_edge_adjustment,
            payout_multiplier=rule.payout_multiplier,
            loss_cap=rule.loss_cap,
            min_amount=rule.min_amount,
            max_amount=rule.max_amount,
            win_streak_threshold=rule.win_streak_threshold,
            loss_streak_threshold=rule.loss_streak_threshold,
            priority=rule.priority,
            player_id=rule.player_id,
            user_id=current_user.id
        )
        return created_rule
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rules", response_model=RuleListResponse)
async def list_rules(
    game_id: int = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: ProfitLossService = Depends(get_profit_loss_service)
):
    """List profit/loss rules"""
    try:
        if not game_id:
            raise HTTPException(status_code=400, detail="game_id is required")
        
        rules = await service.list_rules_for_game(db, game_id, active_only)
        return RuleListResponse(
            total=len(rules),
            skip=skip,
            limit=limit,
            rules=rules
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rules/{rule_id}", response_model=ProfitLossRuleResponse)
async def get_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: ProfitLossService = Depends(get_profit_loss_service)
):
    """Get a specific rule by ID"""
    try:
        rule = await service.get_rule(db, rule_id)
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        return rule
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/rules/{rule_id}", response_model=ProfitLossRuleResponse)
async def update_rule(
    rule_id: int,
    updates: ProfitLossRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: ProfitLossService = Depends(get_profit_loss_service)
):
    """Update a profit/loss rule"""
    try:
        update_data = updates.dict(exclude_unset=True)
        updated_rule = await service.update_rule(db, rule_id, **update_data)
        return updated_rule
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: ProfitLossService = Depends(get_profit_loss_service)
):
    """Delete a profit/loss rule"""
    try:
        deleted = await service.delete_rule(db, rule_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Rule not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/rules/{rule_id}/activate", response_model=ProfitLossRuleResponse)
async def activate_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: ProfitLossService = Depends(get_profit_loss_service)
):
    """Activate a rule"""
    try:
        rule = await service.activate_rule(db, rule_id)
        return rule
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/rules/{rule_id}/deactivate", response_model=ProfitLossRuleResponse)
async def deactivate_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: ProfitLossService = Depends(get_profit_loss_service)
):
    """Deactivate a rule"""
    try:
        rule = await service.deactivate_rule(db, rule_id)
        return rule
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Player-specific rules

@router.post("/player-rules", response_model=ProfitLossPlayerRuleResponse, status_code=201)
async def create_player_rule(
    rule: ProfitLossPlayerRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: ProfitLossService = Depends(get_profit_loss_service)
):
    """Create a player-specific profit/loss rule"""
    try:
        created_rule = await service.create_player_rule(
            db,
            player_id=rule.player_id,
            game_id=rule.game_id,
            custom_house_edge=rule.custom_house_edge,
            daily_loss_limit=rule.daily_loss_limit,
            weekly_loss_limit=rule.weekly_loss_limit,
            max_payout_multiplier=rule.max_payout_multiplier,
            start_date=rule.start_date,
            end_date=rule.end_date,
            user_id=current_user.id
        )
        return created_rule
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/player-rules/{rule_id}", response_model=ProfitLossPlayerRuleResponse)
async def get_player_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: ProfitLossService = Depends(get_profit_loss_service)
):
    """Get a player-specific rule"""
    try:
        rule = await service.get_player_rule(db, rule_id)
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        return rule
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/players/{player_id}/rules", response_model=PlayerRuleListResponse)
async def list_player_rules(
    player_id: int,
    game_id: int = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: ProfitLossService = Depends(get_profit_loss_service)
):
    """List rules for a specific player"""
    try:
        rules = await service.list_player_rules(db, player_id, game_id, active_only)
        return PlayerRuleListResponse(
            total=len(rules),
            skip=skip,
            limit=limit,
            rules=rules
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/player-rules/{rule_id}", response_model=ProfitLossPlayerRuleResponse)
async def update_player_rule(
    rule_id: int,
    updates: ProfitLossPlayerRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: ProfitLossService = Depends(get_profit_loss_service)
):
    """Update a player-specific rule"""
    try:
        update_data = updates.dict(exclude_unset=True)
        updated_rule = await service.update_player_rule(
            db, rule_id, current_user.id, **update_data
        )
        return updated_rule
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/player-rules/{rule_id}", status_code=204)
async def delete_player_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: ProfitLossService = Depends(get_profit_loss_service)
):
    """Delete a player-specific rule"""
    try:
        deleted = await service.delete_player_rule(db, rule_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Rule not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/players/{player_id}/games/{game_id}/effective-settings", response_model=EffectiveSettingsResponse)
async def get_effective_settings(
    player_id: int,
    game_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: ProfitLossService = Depends(get_profit_loss_service)
):
    """Get effective profit/loss settings for a player and game"""
    try:
        settings = await service.get_effective_settings(db, player_id, game_id)
        return settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary", response_model=RuleSummaryResponse)
async def get_rules_summary(
    game_id: int = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: ProfitLossService = Depends(get_profit_loss_service)
):
    """Get profit/loss rules summary"""
    try:
        summary = await service.get_effective_settings(db, game_id=game_id) if game_id else {}
        return RuleSummaryResponse(
            total_rules=len(summary.get('game_rules', [])),
            active_rules=sum(1 for r in summary.get('game_rules', [])),
            inactive_rules=0,
            rules_by_type={}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

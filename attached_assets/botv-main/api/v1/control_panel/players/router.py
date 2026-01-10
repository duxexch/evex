"""
Players API Router
Endpoints for managing player accounts and balances
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from decimal import Decimal
from datetime import datetime

from api.v1.control_panel.players.schemas import (
    PlayerBalanceResponse, BalanceTransactionResponse,
    PlayerStatisticsResponse, PlayerBanRequest, PlayerUnbanRequest,
    DepositRequest, WithdrawalRequest, AdjustmentRequest,
    TransactionHistoryResponse, PlayerListResponse, TopPlayersResponse,
    PlayerBatchOperationRequest
)
from services.control_panel import PlayerManagementService
from api.dependencies import get_db, get_current_user

router = APIRouter(
    prefix="/players",
    tags=["Players Management"],
    responses={
        400: {"description": "Invalid player data"},
        404: {"description": "Player not found"},
        500: {"description": "Internal server error"}
    }
)


def get_player_service() -> PlayerManagementService:
    return PlayerManagementService()


@router.get("/", response_model=PlayerListResponse)
async def list_players(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    banned_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: PlayerManagementService = Depends(get_player_service)
):
    """List all players with balances"""
    try:
        players = await service.list_all_players(db, skip, limit, banned_only)
        return PlayerListResponse(
            total=len(players),
            skip=skip,
            limit=limit,
            players=players
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{player_id}", response_model=PlayerBalanceResponse)
async def get_player_balance(
    player_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: PlayerManagementService = Depends(get_player_service)
):
    """Get player balance information"""
    try:
        balance = await service.get_player_balance(db, player_id)
        if not balance:
            # Create initial balance if not exists
            balance = await service.create_player_balance(db, player_id)
        return balance
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{player_id}/statistics", response_model=PlayerStatisticsResponse)
async def get_player_statistics(
    player_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: PlayerManagementService = Depends(get_player_service)
):
    """Get player statistics"""
    try:
        stats = await service.get_player_statistics(db, player_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{player_id}/deposit", response_model=BalanceTransactionResponse)
async def deposit(
    player_id: int,
    request: DepositRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: PlayerManagementService = Depends(get_player_service)
):
    """Deposit funds to player account"""
    try:
        transaction = await service.adjust_balance(
            db, player_id, request.amount, 'deposit',
            reference_id=request.reference_id,
            created_by=current_user.id
        )
        return transaction
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{player_id}/withdraw", response_model=BalanceTransactionResponse)
async def withdraw(
    player_id: int,
    request: WithdrawalRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: PlayerManagementService = Depends(get_player_service)
):
    """Withdraw funds from player account"""
    try:
        # Check balance
        balance = await service.get_player_balance(db, player_id)
        if not balance or balance.current_balance < request.amount:
            raise HTTPException(status_code=400, detail="Insufficient balance")
        
        transaction = await service.adjust_balance(
            db, player_id, -request.amount, 'withdrawal',
            reference_id=request.reference_id,
            created_by=current_user.id
        )
        return transaction
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{player_id}/adjust", response_model=BalanceTransactionResponse)
async def adjust_balance(
    player_id: int,
    request: AdjustmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: PlayerManagementService = Depends(get_player_service)
):
    """Adjust player balance"""
    try:
        transaction = await service.adjust_balance(
            db, player_id, request.amount, 'adjustment',
            description=request.description,
            reference_id=request.reference_id,
            created_by=current_user.id
        )
        return transaction
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{player_id}/transactions", response_model=TransactionHistoryResponse)
async def get_transaction_history(
    player_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    transaction_type: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: PlayerManagementService = Depends(get_player_service)
):
    """Get player transaction history"""
    try:
        transactions = await service.get_balance_transactions(
            db, player_id, skip, limit, transaction_type
        )
        return TransactionHistoryResponse(
            total=len(transactions),
            skip=skip,
            limit=limit,
            transactions=transactions
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{player_id}/ban", response_model=PlayerBalanceResponse)
async def ban_player(
    player_id: int,
    request: PlayerBanRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: PlayerManagementService = Depends(get_player_service)
):
    """Ban a player"""
    try:
        balance = await service.ban_player(
            db, player_id, request.reason, request.ban_until
        )
        return balance
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{player_id}/unban", response_model=PlayerBalanceResponse)
async def unban_player(
    player_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: PlayerManagementService = Depends(get_player_service)
):
    """Unban a player"""
    try:
        balance = await service.unban_player(db, player_id)
        return balance
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check/banned/{player_id}")
async def check_player_banned(
    player_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: PlayerManagementService = Depends(get_player_service)
):
    """Check if player is banned"""
    try:
        is_banned = await service.is_player_banned(db, player_id)
        return {"player_id": player_id, "is_banned": is_banned}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/top/volume", response_model=List[TopPlayersResponse])
async def get_top_players_by_volume(
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: PlayerManagementService = Depends(get_player_service)
):
    """Get top players by wagered volume"""
    try:
        players = await service.get_top_players_by_volume(db, limit)
        return players
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-operation")
async def batch_player_operation(
    request: PlayerBatchOperationRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: PlayerManagementService = Depends(get_player_service)
):
    """Perform batch operation on players"""
    try:
        results = []
        for player_id in request.player_ids:
            try:
                if request.operation == 'ban':
                    await service.ban_player(db, player_id, request.reason or 'Batch ban')
                    results.append({'player_id': player_id, 'status': 'success'})
                elif request.operation == 'unban':
                    await service.unban_player(db, player_id)
                    results.append({'player_id': player_id, 'status': 'success'})
            except Exception as e:
                results.append({'player_id': player_id, 'status': 'error', 'error': str(e)})
        
        return {'operation': request.operation, 'results': results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

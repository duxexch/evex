"""
Games API Router
Endpoints for managing games in the control panel
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from decimal import Decimal

from api.v1.control_panel.games.schemas import (
    GameCreate, GameUpdate, GameResponse, GameListResponse,
    GameDetailResponse, GameStatisticsResponse, GameStatusUpdate,
    GameConfigurationCreate, GameConfigurationResponse
)
from services.control_panel import GameManagementService
from api.dependencies import get_db, get_current_user

router = APIRouter(
    prefix="/games",
    tags=["Games Management"],
    responses={
        400: {"description": "Invalid game data"},
        404: {"description": "Game not found"},
        500: {"description": "Internal server error"}
    }
)

# Service dependencies
def get_game_service() -> GameManagementService:
    return GameManagementService()


@router.post("/", response_model=GameResponse, status_code=201)
async def create_game(
    game: GameCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameManagementService = Depends(get_game_service)
):
    """Create a new game"""
    try:
        created_game = await service.create_game(
            db,
            name=game.name,
            description=game.description,
            game_type=game.type,
            min_bet=game.min_bet,
            max_bet=game.max_bet,
            house_edge=game.house_edge,
            rtp=game.rtp,
            algorithm_mode=game.algorithm_mode,
            user_id=current_user.id
        )
        return created_game
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=GameListResponse)
async def list_games(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameManagementService = Depends(get_game_service)
):
    """List all games with pagination"""
    try:
        games = await service.list_games(db, skip=skip, limit=limit, status=status)
        game_models = [
            GameResponse.model_validate(game, from_attributes=True)
            for game in games
        ]
        return GameListResponse(
            total=len(game_models),
            skip=skip,
            limit=limit,
            games=game_models
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{game_id}", response_model=GameDetailResponse)
async def get_game(
    game_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameManagementService = Depends(get_game_service)
):
    """Get game details by ID"""
    try:
        game = await service.get_game(db, game_id)
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")
        
        configs = await service.list_game_configurations(db, game_id)
        game_model = GameDetailResponse.model_validate(
            game, from_attributes=True
        )
        return game_model.model_copy(update={"configurations": configs})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{game_id}", response_model=GameResponse)
async def update_game(
    game_id: int,
    updates: GameUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameManagementService = Depends(get_game_service)
):
    """Update game settings"""
    try:
        update_data = updates.dict(exclude_unset=True)
        updated_game = await service.update_game(db, game_id, current_user.id, **update_data)
        return updated_game
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{game_id}", status_code=204)
async def delete_game(
    game_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameManagementService = Depends(get_game_service)
):
    """Delete a game"""
    try:
        deleted = await service.delete_game(db, game_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Game not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{game_id}/status", response_model=GameResponse)
async def update_game_status(
    game_id: int,
    status_update: GameStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameManagementService = Depends(get_game_service)
):
    """Update game status"""
    try:
        updated_game = await service.set_game_status(
            db, game_id, status_update.status, current_user.id
        )
        return updated_game
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{game_id}/statistics", response_model=GameStatisticsResponse)
async def get_game_statistics(
    game_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameManagementService = Depends(get_game_service)
):
    """Get game statistics"""
    try:
        stats = await service.get_game_statistics(db, game_id)
        return stats
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Game Configuration endpoints

@router.post("/{game_id}/configurations", response_model=GameConfigurationResponse, status_code=201)
async def set_game_configuration(
    game_id: int,
    config: GameConfigurationCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameManagementService = Depends(get_game_service)
):
    """Set or update game configuration"""
    try:
        game_config = await service.set_game_configuration(
            db, game_id, config.config_key, config.config_value,
            config.data_type, current_user.id
        )
        return game_config
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{game_id}/configurations/{config_key}", response_model=GameConfigurationResponse)
async def get_game_configuration(
    game_id: int,
    config_key: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameManagementService = Depends(get_game_service)
):
    """Get game configuration by key"""
    try:
        config = await service.get_game_configuration(db, game_id, config_key)
        if not config:
            raise HTTPException(status_code=404, detail="Configuration not found")
        return config
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{game_id}/configurations", response_model=List[GameConfigurationResponse])
async def list_game_configurations(
    game_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: GameManagementService = Depends(get_game_service)
):
    """List all configurations for a game"""
    try:
        configs = await service.list_game_configurations(db, game_id)
        return configs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

"""
Penalty Shootout API Endpoints
FastAPI routes for game management and gameplay
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from models.penalty_shootout import PenaltyShotDirection, PenaltyShotOutcome
from services.games.penalty_shootout_service import PenaltyShootoutService
from database import get_db
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# SCHEMAS
# ============================================================================

class PenaltyGameCreateRequest(BaseModel):
    """Create a new Penalty Shootout game"""
    name: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=10, max_length=1000)
    min_bet: Decimal = Field(..., gt=0, decimal_places=2)
    max_bet: Decimal = Field(..., gt=0, decimal_places=2)
    min_rounds: int = Field(default=1, ge=1, le=10)
    max_rounds: int = Field(default=5, ge=1, le=10)
    goal_multiplier: Decimal = Field(default=2.0, gt=0)
    keeper_save_probability: Decimal = Field(default=30.0, ge=0, le=100)
    icon_path: Optional[str] = None


class PenaltyGameResponse(BaseModel):
    """Game response"""
    id: int
    name: str
    description: str
    min_bet_amount: Decimal
    max_bet_amount: Decimal
    min_rounds: int
    max_rounds: int
    goal_multiplier: Decimal
    keeper_save_probability: Decimal
    icon_path: Optional[str]
    is_active: bool
    total_sessions: int
    total_goals_scored: int
    total_shots_taken: int

    class Config:
        from_attributes = True


class SessionCreateRequest(BaseModel):
    """Create a new game session"""
    game_id: int
    num_rounds: int = Field(..., ge=1, le=10)


class SessionResponse(BaseModel):
    """Session response"""
    id: int
    session_id: str
    player_id: int
    game_id: int
    num_rounds: int
    rounds_completed: int
    total_bet_amount: Decimal
    total_winnings: Decimal
    is_active: bool
    is_completed: bool

    class Config:
        from_attributes = True


class TakeShotRequest(BaseModel):
    """Take a shot in the game"""
    session_id: str
    bet_amount: Decimal = Field(..., gt=0, decimal_places=2)
    shot_direction: str = Field(..., regex="^(left|center|right)$")


class RoundResponse(BaseModel):
    """Round result"""
    round_number: int
    outcome: str
    shot_direction: str
    keeper_jump: str
    keeper_reaction: str
    bet_amount: Decimal
    win_amount: Decimal
    multiplier: Decimal
    new_balance: Decimal
    is_session_completed: bool
    session_profit_loss: Optional[Decimal] = None


# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter(prefix="/api/v1/penalty-shootout", tags=["Penalty Shootout"])


# ============================================================================
# GAME MANAGEMENT
# ============================================================================

@router.post(
    "/games",
    response_model=PenaltyGameResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_game(
    request: PenaltyGameCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = None  # TODO: Add JWT auth
):
    """
    Create a new Penalty Shootout game
    
    Requires admin privileges
    """
    try:
        if not current_user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        # TODO: Add admin check
        
        service = PenaltyShootoutService(db)
        game = await service.create_game(
            name=request.name,
            description=request.description,
            min_bet=request.min_bet,
            max_bet=request.max_bet,
            min_rounds=request.min_rounds,
            max_rounds=request.max_rounds,
            goal_multiplier=request.goal_multiplier,
            keeper_save_probability=request.keeper_save_probability,
            admin_id=current_user_id,
            icon_path=request.icon_path
        )
        
        return game
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating game: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/games", response_model=List[PenaltyGameResponse])
async def list_games(
    db: AsyncSession = Depends(get_db)
):
    """Get all active Penalty Shootout games"""
    try:
        service = PenaltyShootoutService(db)
        games = await service.get_active_games()
        return games
        
    except Exception as e:
        logger.error(f"Error listing games: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/games/{game_id}", response_model=PenaltyGameResponse)
async def get_game(
    game_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific game by ID"""
    try:
        service = PenaltyShootoutService(db)
        game = await service.get_game(game_id)
        
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")
        
        return game
        
    except Exception as e:
        logger.error(f"Error getting game: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# SESSION MANAGEMENT
# ============================================================================

@router.post(
    "/sessions",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_session(
    request: SessionCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = None  # TODO: Add JWT auth
):
    """
    Create a new Penalty Shootout session
    
    User specifies number of rounds (1-5)
    """
    try:
        if not current_user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        service = PenaltyShootoutService(db)
        session = await service.create_session(
            player_id=current_user_id,
            game_id=request.game_id,
            num_rounds=request.num_rounds
        )
        
        return session
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = None
):
    """Get session details"""
    try:
        if not current_user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        service = PenaltyShootoutService(db)
        session = await service.get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify ownership
        if session.player_id != current_user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        return session
        
    except Exception as e:
        logger.error(f"Error getting session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# GAMEPLAY
# ============================================================================

@router.post("/sessions/{session_id}/shoot", response_model=RoundResponse)
async def take_shot(
    session_id: str,
    request: TakeShotRequest,
    db: AsyncSession = Depends(get_db),
    current_user_id: int = None
):
    """
    Take a shot in the Penalty Shootout game
    
    1. Validates bet amount and player balance
    2. Deducts bet from balance
    3. Simulates keeper AI
    4. Determines outcome
    5. Credits winnings if goal
    6. Returns result with new balance
    """
    try:
        if not current_user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        # Verify session matches current user
        service = PenaltyShootoutService(db)
        session = await service.get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session.player_id != current_user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Convert direction string to enum
        try:
            shot_direction = PenaltyShotDirection[request.shot_direction.upper()]
        except KeyError:
            raise HTTPException(
                status_code=400,
                detail="Invalid direction. Must be 'left', 'center', or 'right'"
            )
        
        # Execute shot
        round_record, result_details = await service.take_shot(
            session_id=session_id,
            bet_amount=request.bet_amount,
            shot_direction=shot_direction
        )
        
        return RoundResponse(**result_details)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error taking shot: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# STATISTICS
# ============================================================================

@router.get("/games/{game_id}/stats")
async def get_game_stats(
    game_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get game statistics"""
    try:
        service = PenaltyShootoutService(db)
        game = await service.get_game(game_id)
        
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")
        
        return {
            "game_id": game.id,
            "name": game.name,
            "total_sessions": game.total_sessions,
            "total_shots_taken": game.total_shots_taken,
            "total_goals_scored": game.total_goals_scored,
            "goal_rate": float(game.total_goals_scored / game.total_shots_taken * 100) if game.total_shots_taken > 0 else 0,
            "total_bets": str(game.total_bets_amount),
            "total_winnings": str(game.total_winnings_amount),
            "house_profit": str(game.total_bets_amount - game.total_winnings_amount) if game.total_bets_amount else "0.00"
        }
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/my-sessions", response_model=List[SessionResponse])
async def get_my_sessions(
    db: AsyncSession = Depends(get_db),
    current_user_id: int = None,
    limit: int = 10
):
    """Get current user's sessions"""
    try:
        if not current_user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        from sqlalchemy import select, desc
        from models.penalty_shootout import PenaltyShootoutSession
        
        result = await db.execute(
            select(PenaltyShootoutSession)
            .where(PenaltyShootoutSession.player_id == current_user_id)
            .order_by(desc(PenaltyShootoutSession.start_time))
            .limit(limit)
        )
        sessions = list(result.scalars().all())
        
        return sessions
        
    except Exception as e:
        logger.error(f"Error getting user sessions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

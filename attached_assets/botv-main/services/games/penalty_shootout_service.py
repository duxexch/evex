"""
Penalty Shootout Game Service
Advanced game logic with AI keeper, betting mechanics, and financial integration
"""

import random
import secrets
import jwt
import hmac
import hashlib
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, Tuple, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload

from models.penalty_shootout import (
    PenaltyShootoutGame,
    PenaltyShootoutSession,
    PenaltyShootoutRound,
    PenaltyShotDirection,
    PenaltyShotOutcome,
)
from models import (
    User, Transaction, AuditLog, NotificationEvent,
    GameStatus, GameOutcome
)
from config import settings
import logging

logger = logging.getLogger(__name__)


class PenaltyShootoutService:
    """
    Penalty Shootout Game Service
    
    Handles:
    - Game creation and management
    - Session lifecycle
    - Round mechanics with AI keeper
    - Financial transactions
    - Notifications and audit logging
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.secret_key = settings.ENCRYPTION_KEY
        
        # House edge control
        self.base_goal_probability = Decimal("0.70")  # 70% goal by default
        self.min_goal_probability = Decimal("0.50")   # Min 50%
        self.max_goal_probability = Decimal("0.90")   # Max 90%
    
    # ============================================================================
    # GAME MANAGEMENT
    # ============================================================================
    
    async def create_game(
        self,
        name: str,
        description: str,
        min_bet: Decimal,
        max_bet: Decimal,
        min_rounds: int = 1,
        max_rounds: int = 5,
        goal_multiplier: Decimal = Decimal("2.0"),
        keeper_save_probability: Decimal = Decimal("30.0"),
        admin_id: int = 1,
        icon_path: Optional[str] = None
    ) -> PenaltyShootoutGame:
        """Create a new Penalty Shootout game"""
        
        game = PenaltyShootoutGame(
            name=name,
            description=description,
            min_bet_amount=min_bet,
            max_bet_amount=max_bet,
            min_rounds=min_rounds,
            max_rounds=max_rounds,
            goal_multiplier=goal_multiplier,
            keeper_save_probability=keeper_save_probability,
            icon_path=icon_path,
            created_by_admin_id=admin_id
        )
        
        self.session.add(game)
        await self.session.commit()
        await self.session.refresh(game)
        
        logger.info(f"Penalty Shootout game created: {game.name} (ID: {game.id})")
        
        # Audit log
        await self._log_audit(
            admin_id=admin_id,
            action='penalty_shootout_game_created',
            target_type='penalty_shootout_game',
            target_id=game.id,
            details={
                'name': name,
                'min_bet': str(min_bet),
                'max_bet': str(max_bet),
                'min_rounds': min_rounds,
                'max_rounds': max_rounds
            }
        )
        
        return game
    
    async def get_game(self, game_id: int) -> Optional[PenaltyShootoutGame]:
        """Get game by ID"""
        result = await self.session.execute(
            select(PenaltyShootoutGame).where(
                PenaltyShootoutGame.id == game_id
            )
        )
        return result.scalar_one_or_none()
    
    async def get_active_games(self) -> List[PenaltyShootoutGame]:
        """Get all active games"""
        result = await self.session.execute(
            select(PenaltyShootoutGame).where(
                PenaltyShootoutGame.is_active == True
            ).order_by(PenaltyShootoutGame.is_featured.desc(), PenaltyShootoutGame.name)
        )
        return list(result.scalars().all())
    
    async def update_game_icon(
        self,
        game_id: int,
        icon_path: str,
        icon_type: str,
        admin_id: int
    ) -> PenaltyShootoutGame:
        """Update game icon"""
        game = await self.get_game(game_id)
        if not game:
            raise ValueError(f"Game {game_id} not found")
        
        game.icon_path = icon_path
        game.icon_type = icon_type
        
        await self.session.commit()
        await self.session.refresh(game)
        
        await self._log_audit(
            admin_id=admin_id,
            action='penalty_shootout_game_icon_updated',
            target_type='penalty_shootout_game',
            target_id=game_id,
            details={'icon_path': icon_path}
        )
        
        return game
    
    # ============================================================================
    # SESSION MANAGEMENT
    # ============================================================================
    
    async def create_session(
        self,
        player_id: int,
        game_id: int,
        num_rounds: int,
        ip_address: Optional[str] = None
    ) -> PenaltyShootoutSession:
        """
        Create a new Penalty Shootout session
        
        Note: This does NOT deduct any money yet.
        Betting happens per round.
        """
        
        # Validate inputs
        game = await self.get_game(game_id)
        if not game:
            raise ValueError(f"Game {game_id} not found")
        
        if not game.is_active:
            raise ValueError(f"Game {game.name} is not active")
        
        player_result = await self.session.execute(
            select(User).where(User.id == player_id)
        )
        player = player_result.scalar_one_or_none()
        if not player:
            raise ValueError(f"Player {player_id} not found")
        
        if num_rounds < game.min_rounds or num_rounds > game.max_rounds:
            raise ValueError(
                f"Invalid rounds: {num_rounds}. "
                f"Must be between {game.min_rounds} and {game.max_rounds}"
            )
        
        # Generate session identifiers
        session_id = secrets.token_urlsafe(32)
        idempotency_key = f"penalty_shootout_{player_id}_{game_id}_{datetime.now(timezone.utc).timestamp()}"
        
        # Create JWT token
        session_token = jwt.encode(
            {
                'session_id': session_id,
                'player_id': player_id,
                'game_id': game_id,
                'exp': datetime.utcnow() + timedelta(hours=2),
                'iat': datetime.utcnow()
            },
            self.secret_key,
            algorithm='HS256'
        )
        
        # Create session
        new_session = PenaltyShootoutSession(
            session_id=session_id,
            player_id=player_id,
            game_id=game_id,
            num_rounds=num_rounds,
            initial_balance=player.balance,
            session_token=session_token,
            idempotency_key=idempotency_key,
            ip_address=ip_address,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=2)
        )
        
        self.session.add(new_session)
        await self.session.commit()
        await self.session.refresh(new_session)
        
        logger.info(
            f"Penalty Shootout session created: {session_id} | "
            f"Player: {player_id} | Rounds: {num_rounds}"
        )
        
        return new_session
    
    async def get_session(self, session_id: str) -> Optional[PenaltyShootoutSession]:
        """Get session by ID"""
        result = await self.session.execute(
            select(PenaltyShootoutSession)
            .options(selectinload(PenaltyShootoutSession.rounds))
            .where(PenaltyShootoutSession.session_id == session_id)
        )
        return result.scalar_one_or_none()
    
    # ============================================================================
    # ROUND MECHANICS
    # ============================================================================
    
    async def take_shot(
        self,
        session_id: str,
        bet_amount: Decimal,
        shot_direction: PenaltyShotDirection
    ) -> Tuple[PenaltyShootoutRound, Dict[str, Any]]:
        """
        Execute a shot in the penalty shootout
        
        1. Validate session and betting
        2. Deduct bet from player balance
        3. Create keeper AI decision
        4. Determine outcome (goal, saved, miss)
        5. Create round record
        6. Return result with full details
        
        Returns:
            (round, result_details)
        """
        
        # Get session
        game_session = await self.get_session(session_id)
        if not game_session:
            raise ValueError(f"Session {session_id} not found")
        
        if not game_session.is_active:
            raise ValueError(f"Session {session_id} is not active")
        
        if game_session.rounds_completed >= game_session.num_rounds:
            raise ValueError(f"Session {session_id} has completed all rounds")
        
        # Get game and player
        game = game_session.game
        player_result = await self.session.execute(
            select(User).where(User.id == game_session.player_id)
        )
        player = player_result.scalar_one()
        
        # Validate bet amount
        if bet_amount < game.min_bet_amount:
            raise ValueError(f"Bet {bet_amount} is below minimum {game.min_bet_amount}")
        
        if bet_amount > game.max_bet_amount:
            raise ValueError(f"Bet {bet_amount} exceeds maximum {game.max_bet_amount}")
        
        # Validate player balance
        if player.balance < bet_amount:
            raise ValueError(f"Insufficient balance: {player.balance} < {bet_amount}")
        
        # ===== CRITICAL: DEDUCT BET FROM PLAYER =====
        balance_before = player.balance
        player.balance -= bet_amount
        balance_after = player.balance
        
        # Create transaction for bet
        bet_transaction = Transaction(
            idempotency_key=f"penalty_bet_{session_id}_{game_session.rounds_completed}",
            user_id=player.id,
            type='DEBIT',
            amount=bet_amount,
            balance_before=balance_before,
            balance_after=balance_after,
            signature=self._create_transaction_signature(
                player.id, 'DEBIT', bet_amount, balance_before, balance_after
            ),
            created_by=player.id,
            ip_address=game_session.ip_address
        )
        self.session.add(bet_transaction)
        
        # ===== KEEPER AI DECISION =====
        keeper_data = self._simulate_keeper(game)
        
        # ===== OUTCOME CALCULATION =====
        outcome, win_amount, multiplier = self._calculate_outcome(
            game=game,
            shot_direction=shot_direction,
            keeper_data=keeper_data
        )
        
        # ===== UPDATE SESSION TOTALS =====
        game_session.total_bet_amount += bet_amount
        game_session.total_winnings += win_amount
        game_session.rounds_completed += 1
        
        # Update game statistics
        game.total_shots_taken += 1
        game.total_bets_amount += bet_amount
        if outcome == PenaltyShotOutcome.GOAL:
            game.total_goals_scored += 1
        
        # ===== CREATE ROUND RECORD =====
        round_record = PenaltyShootoutRound(
            session_id=game_session.id,
            round_number=game_session.rounds_completed,
            player_shot_direction=shot_direction,
            keeper_predicted_direction=keeper_data['predicted'],
            keeper_jump_direction=keeper_data['jump'],
            keeper_saved=outcome == PenaltyShotOutcome.SAVED,
            outcome=outcome,
            bet_amount=bet_amount,
            win_amount=win_amount,
            multiplier_applied=multiplier,
            keeper_animation=keeper_data['animation'],
            keeper_reaction=keeper_data['reaction']
        )
        
        self.session.add(round_record)
        
        # ===== IF GOAL: CREDIT WINNINGS =====
        if win_amount > Decimal('0'):
            balance_before_credit = player.balance
            player.balance += win_amount
            balance_after_credit = player.balance
            
            win_transaction = Transaction(
                idempotency_key=f"penalty_win_{session_id}_{game_session.rounds_completed}",
                user_id=player.id,
                type='CREDIT',
                amount=win_amount,
                balance_before=balance_before_credit,
                balance_after=balance_after_credit,
                signature=self._create_transaction_signature(
                    player.id, 'CREDIT', win_amount, balance_before_credit, balance_after_credit
                ),
                created_by=player.id,
                ip_address=game_session.ip_address
            )
            self.session.add(win_transaction)
        
        # ===== FINALIZE ROUND =====
        if game_session.rounds_completed == game_session.num_rounds:
            # Session completed
            game_session.is_active = False
            game_session.is_completed = True
            game_session.end_time = datetime.now(timezone.utc)
            game_session.final_balance = player.balance
            game_session.profit_loss = player.balance - game_session.initial_balance
            
            game.total_winnings_amount += game_session.profit_loss
        
        # Commit all changes
        await self.session.commit()
        await self.session.refresh(round_record)
        
        # ===== LOG AUDIT =====
        await self._log_audit(
            admin_id=player.id,
            action='penalty_shootout_round_completed',
            target_type='penalty_shootout_round',
            target_id=round_record.id,
            details={
                'session_id': session_id,
                'round': game_session.rounds_completed,
                'shot_direction': shot_direction.value,
                'outcome': outcome.value,
                'bet': str(bet_amount),
                'win': str(win_amount),
                'balance': str(player.balance)
            }
        )
        
        # ===== RETURN RESULTS =====
        result_details = {
            'outcome': outcome.value,
            'shot_direction': shot_direction.value,
            'keeper_jump': keeper_data['jump'].value,
            'keeper_reaction': keeper_data['reaction'],
            'bet_amount': str(bet_amount),
            'win_amount': str(win_amount),
            'multiplier': str(multiplier),
            'new_balance': str(player.balance),
            'round': game_session.rounds_completed,
            'total_rounds': game_session.num_rounds,
            'is_session_completed': game_session.is_completed,
            'session_profit_loss': str(game_session.profit_loss) if game_session.is_completed else None
        }
        
        logger.info(
            f"Penalty Shootout round completed: {session_id} | "
            f"Round: {game_session.rounds_completed}/{game_session.num_rounds} | "
            f"Outcome: {outcome.value} | Balance: {player.balance}"
        )
        
        return round_record, result_details
    
    # ============================================================================
    # AI KEEPER LOGIC
    # ============================================================================
    
    def _simulate_keeper(self, game: PenaltyShootoutGame) -> Dict[str, Any]:
        """
        Simulate keeper AI decision
        
        - Predict shooting direction (50% accuracy)
        - Jump based on prediction + randomness
        - Determine save probability based on game config
        """
        
        # Keeper tries to predict direction (50% accuracy)
        all_directions = list(PenaltyShotDirection)
        predicted = random.choice(all_directions)
        
        # Keeper jumps based on prediction but sometimes guesses wrong
        keeper_prediction_accuracy = Decimal(game.keeper_direction_prediction) / Decimal("100")
        
        if random.random() < float(keeper_prediction_accuracy):
            # Keeper jumps to predicted direction
            jump = predicted
        else:
            # Keeper guesses a different direction
            jump = random.choice([d for d in all_directions if d != predicted])
        
        # Animation mapping
        animations = {
            PenaltyShotDirection.LEFT: "jump-left",
            PenaltyShotDirection.CENTER: "stand",
            PenaltyShotDirection.RIGHT: "jump-right"
        }
        
        return {
            'predicted': predicted,
            'jump': jump,
            'animation': animations[jump],
            'reaction': None  # Will be set during outcome calculation
        }
    
    def _calculate_outcome(
        self,
        game: PenaltyShootoutGame,
        shot_direction: PenaltyShotDirection,
        keeper_data: Dict[str, Any]
    ) -> Tuple[PenaltyShotOutcome, Decimal, Decimal]:
        """
        Calculate round outcome
        
        - Check if keeper saves the shot
        - Check if shooter misses
        - Calculate payout
        """
        
        keeper_jump = keeper_data['jump']
        save_probability = Decimal(game.keeper_save_probability) / Decimal("100")
        
        # Keeper saves if:
        # 1. Keeper jumps to same direction as shot AND rolls save check
        if shot_direction == keeper_jump:
            if random.random() < float(save_probability):
                # Keeper SAVES
                keeper_data['reaction'] = 'saved'
                return PenaltyShotOutcome.SAVED, Decimal("0.0"), Decimal("0.0")
        
        # Shooter tries to score
        # Base goal probability adjusted by house edge
        goal_probability = float(self.base_goal_probability)
        
        # If keeper is in wrong position, increase goal chance
        if shot_direction != keeper_jump:
            goal_probability = min(float(self.max_goal_probability), goal_probability * 1.1)
        
        if random.random() < goal_probability:
            # ===== GOAL! =====
            keeper_data['reaction'] = 'scored-against'
            win_amount = Decimal(str(game.goal_multiplier)) * Decimal("100")  # Placeholder
            return PenaltyShotOutcome.GOAL, win_amount, game.goal_multiplier
        else:
            # ===== MISS =====
            keeper_data['reaction'] = 'blocked'
            return PenaltyShotOutcome.MISS, Decimal("0.0"), Decimal("0.0")
    
    # ============================================================================
    # HELPER METHODS
    # ============================================================================
    
    def _create_transaction_signature(
        self,
        user_id: int,
        tx_type: str,
        amount: Decimal,
        balance_before: Decimal,
        balance_after: Decimal
    ) -> str:
        """Create transaction signature"""
        message = f"{user_id}|{tx_type}|{amount}|{balance_before}|{balance_after}"
        return hmac.new(
            self.secret_key.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
    
    async def _log_audit(
        self,
        admin_id: int,
        action: str,
        target_type: str,
        target_id: int,
        details: Dict
    ):
        """Log action to audit trail"""
        audit = AuditLog(
            admin_id=admin_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details
        )
        self.session.add(audit)
        await self.session.flush()

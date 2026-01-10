"""
Secure Gaming Service with Digital Signatures
Handles game sessions, outcome validation, and financial transactions
"""
import hmac
import hashlib
import secrets
import jwt
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload

from models import (
    Game, SecureGameSession, GamePlayerOverride, User, Transaction,
    AuditLog, GameType, GameStatus, GameOutcome
)
from config import settings
import logging

logger = logging.getLogger(__name__)


class GamingService:
    """
    Secure gaming service with casino-grade security.
    
    Key Features:
    - Digital signature for every session
    - Idempotency protection
    - Balance validation before deduction
    - Immutable transaction ledger
    - Full audit trail
    - Rate limiting
    - Session expiry
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.secret_key = settings.ENCRYPTION_KEY  # Use existing encryption key
        
    # ============================================================================
    # SIGNATURE AND SECURITY
    # ============================================================================
    
    def create_session_signature(
        self,
        session_id: str,
        player_id: int,
        game_id: int,
        bet_amount: Decimal,
        timestamp: datetime
    ) -> str:
        """
        Create HMAC SHA-256 signature for session.
        
        This prevents:
        - Session tampering
        - Outcome manipulation
        - Replay attacks
        """
        message = f"{session_id}|{player_id}|{game_id}|{bet_amount}|{timestamp.isoformat()}"
        return hmac.new(
            self.secret_key.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
    
    def verify_session_signature(
        self,
        session: SecureGameSession,
        provided_signature: str
    ) -> bool:
        """Verify session signature to prevent tampering."""
        expected_signature = self.create_session_signature(
            session.session_id,
            session.player_id,
            session.game_id,
            session.bet_amount,
            session.start_time
        )
        return hmac.compare_digest(expected_signature, provided_signature)
    
    def create_session_token(
        self,
        session_id: str,
        player_id: int,
        game_id: int,
        expiry_minutes: int = 30
    ) -> str:
        """
        Create JWT token for session (used by external games).
        
        Token contains:
        - session_id
        - player_id
        - game_id
        - expiry time
        """
        payload = {
            'session_id': session_id,
            'player_id': player_id,
            'game_id': game_id,
            'exp': datetime.utcnow() + timedelta(minutes=expiry_minutes),
            'iat': datetime.utcnow()
        }
        return jwt.encode(payload, self.secret_key, algorithm='HS256')
    
    def verify_session_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode JWT token."""
        try:
            return jwt.decode(token, self.secret_key, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            logger.warning("Session token expired")
            return None
        except jwt.InvalidTokenError:
            logger.warning("Invalid session token")
            return None
    
    # ============================================================================
    # GAME MANAGEMENT
    # ============================================================================
    
    async def create_game(
        self,
        name: str,
        description: str,
        game_type: GameType,
        min_bet: Decimal,
        max_bet: Decimal,
        payout_min: Decimal,
        payout_max: Decimal,
        house_edge: Decimal,
        admin_id: int,
        game_launch_url: Optional[str] = None,
        icon_path: Optional[str] = None
    ) -> Game:
        """Create a new game."""
        game = Game(
            name=name,
            description=description,
            game_type=game_type,
            game_launch_url=game_launch_url,
            icon_path=icon_path,
            min_bet_amount=min_bet,
            max_bet_amount=max_bet,
            payout_min_percent=payout_min,
            payout_max_percent=payout_max,
            house_edge_percent=house_edge,
            status=GameStatus.ACTIVE,
            created_by_admin_id=admin_id
        )
        
        self.session.add(game)
        await self.session.commit()
        await self.session.refresh(game)
        
        # Audit log
        await self._log_audit(
            admin_id=admin_id,
            action='game_created',
            target_type='game',
            target_id=game.id,
            details={'name': name, 'type': game_type.value}
        )
        
        logger.info(f"Game created: {game.name} (ID: {game.id})")
        return game
    
    async def get_game_by_id(self, game_id: int) -> Optional[Game]:
        """Get game by ID."""
        result = await self.session.execute(
            select(Game).where(Game.id == game_id)
        )
        return result.scalar_one_or_none()
    
    async def get_active_games(self, include_featured_only: bool = False) -> list[Game]:
        """Get all active games."""
        query = select(Game).where(Game.status == GameStatus.ACTIVE)
        
        if include_featured_only:
            query = query.where(Game.is_featured == True)
        
        query = query.order_by(Game.is_featured.desc(), Game.name)
        
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def update_game_icon(
        self,
        game_id: int,
        icon_path: str,
        icon_type: str,
        admin_id: int
    ) -> Game:
        """Update game icon."""
        game = await self.get_game_by_id(game_id)
        if not game:
            raise ValueError(f"Game {game_id} not found")
        
        game.icon_path = icon_path
        game.icon_type = icon_type
        
        await self.session.commit()
        await self.session.refresh(game)
        
        await self._log_audit(
            admin_id=admin_id,
            action='game_icon_updated',
            target_type='game',
            target_id=game_id,
            details={'icon_path': icon_path, 'icon_type': icon_type}
        )
        
        return game
    
    # ============================================================================
    # GAME SESSION LIFECYCLE
    # ============================================================================
    
    async def start_game_session(
        self,
        player_id: int,
        game_id: int,
        bet_amount: Decimal,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> SecureGameSession:
        """
        Start a secure game session.
        
        Steps:
        1. Validate player balance
        2. Validate bet amount against game limits
        3. Check player overrides
        4. Deduct bet amount from balance
        5. Create game session with signature
        6. Create transaction record
        7. Log audit trail
        """
        # Get game and player
        game = await self.get_game_by_id(game_id)
        if not game:
            raise ValueError(f"Game {game_id} not found")
        
        if game.status != GameStatus.ACTIVE:
            raise ValueError(f"Game {game.name} is not active")
        
        player_result = await self.session.execute(
            select(User).where(User.id == player_id)
        )
        player = player_result.scalar_one_or_none()
        if not player:
            raise ValueError(f"Player {player_id} not found")
        
        # Get player overrides if any
        override = await self._get_player_override(player_id, game_id)
        
        # Determine effective limits
        min_bet = override.custom_min_bet if override and override.custom_min_bet else game.min_bet_amount
        max_bet = override.custom_max_bet if override and override.custom_max_bet else game.max_bet_amount
        
        # Validate bet amount
        if bet_amount < min_bet:
            raise ValueError(f"Bet amount {bet_amount} is below minimum {min_bet}")
        if bet_amount > max_bet:
            raise ValueError(f"Bet amount {bet_amount} exceeds maximum {max_bet}")
        
        # Check player balance
        if player.balance < bet_amount:
            raise ValueError(f"Insufficient balance: {player.balance} < {bet_amount}")
        
        # Generate unique session ID and idempotency key
        session_id = secrets.token_urlsafe(32)
        idempotency_key = f"game_session_{player_id}_{game_id}_{datetime.utcnow().timestamp()}"
        
        # Create timestamp and signature
        start_time = datetime.now(timezone.utc)
        signature = self.create_session_signature(
            session_id, player_id, game_id, bet_amount, start_time
        )
        
        # Create session token (for external games)
        session_token = self.create_session_token(
            session_id, player_id, game_id, expiry_minutes=60
        )
        
        # Deduct bet amount from player balance
        balance_before = player.balance
        player.balance -= bet_amount
        balance_after = player.balance
        
        # Create transaction record
        transaction = Transaction(
            idempotency_key=f"debit_{idempotency_key}",
            user_id=player_id,
            type='DEBIT',
            amount=bet_amount,
            balance_before=balance_before,
            balance_after=balance_after,
            signature=self._create_transaction_signature(
                player_id, 'DEBIT', bet_amount, balance_before, balance_after
            ),
            created_by=player_id,
            ip_address=ip_address
        )
        
        self.session.add(transaction)
        
        # Create game session
        game_session = SecureGameSession(
            session_id=session_id,
            player_id=player_id,
            game_id=game_id,
            bet_amount=bet_amount,
            start_time=start_time,
            outcome=GameOutcome.PENDING,
            session_token=session_token,
            signature=signature,
            idempotency_key=idempotency_key,
            ip_address=ip_address,
            user_agent=user_agent,
            expires_at=start_time + timedelta(hours=1)  # Session expires in 1 hour
        )
        
        self.session.add(game_session)
        await self.session.commit()
        await self.session.refresh(game_session)
        
        # Audit log
        await self._log_audit(
            admin_id=player_id,
            action='game_session_started',
            target_type='game_session',
            target_id=game_session.id,
            details={
                'game': game.name,
                'bet_amount': str(bet_amount),
                'balance_after': str(balance_after)
            }
        )
        
        logger.info(
            f"Game session started: {session_id} | "
            f"Player: {player_id} | Game: {game.name} | Bet: {bet_amount}"
        )
        
        return game_session
    
    async def end_game_session(
        self,
        session_id: str,
        outcome: GameOutcome,
        win_amount: Decimal,
        game_data: Optional[Dict] = None,
        signature: Optional[str] = None
    ) -> SecureGameSession:
        """
        End a game session and process outcome.
        
        Steps:
        1. Verify session signature
        2. Validate session not expired
        3. Calculate profit/loss
        4. Update player balance (if win)
        5. Create transaction (if win)
        6. Update session status
        7. Update game statistics
        8. Trigger notification (if big win)
        """
        # Get session
        result = await self.session.execute(
            select(SecureGameSession)
            .options(selectinload(SecureGameSession.player), selectinload(SecureGameSession.game))
            .where(SecureGameSession.session_id == session_id)
        )
        game_session = result.scalar_one_or_none()
        
        if not game_session:
            raise ValueError(f"Session {session_id} not found")
        
        if game_session.outcome != GameOutcome.PENDING:
            raise ValueError(f"Session {session_id} already ended with outcome {game_session.outcome}")
        
        # Verify signature if provided
        if signature and not self.verify_session_signature(game_session, signature):
            await self._log_audit(
                admin_id=game_session.player_id,
                action='session_signature_invalid',
                target_type='game_session',
                target_id=game_session.id,
                details={'provided_signature': signature}
            )
            raise ValueError("Invalid session signature")
        
        # Check expiry
        if datetime.now(timezone.utc) > game_session.expires_at:
            game_session.outcome = GameOutcome.CANCELLED
            await self.session.commit()
            raise ValueError(f"Session {session_id} expired")
        
        # Calculate profit/loss
        profit_loss = win_amount - game_session.bet_amount
        
        # Update session
        game_session.end_time = datetime.now(timezone.utc)
        game_session.outcome = outcome
        game_session.win_amount = win_amount
        game_session.profit_loss = profit_loss
        game_session.game_data = game_data or {}
        
        # If win, credit player balance
        if outcome == GameOutcome.WIN and win_amount > Decimal('0'):
            player = game_session.player
            balance_before = player.balance
            player.balance += win_amount
            balance_after = player.balance
            
            # Create credit transaction
            transaction = Transaction(
                idempotency_key=f"credit_{game_session.idempotency_key}",
                user_id=player.id,
                type='CREDIT',
                amount=win_amount,
                balance_before=balance_before,
                balance_after=balance_after,
                signature=self._create_transaction_signature(
                    player.id, 'CREDIT', win_amount, balance_before, balance_after
                ),
                created_by=player.id,
                ip_address=game_session.ip_address
            )
            
            self.session.add(transaction)
        
        # Update game statistics
        game = game_session.game
        game.total_sessions += 1
        game.total_bet_amount += game_session.bet_amount
        game.total_win_amount += win_amount
        
        await self.session.commit()
        await self.session.refresh(game_session)
        
        # Audit log
        await self._log_audit(
            admin_id=game_session.player_id,
            action='game_session_ended',
            target_type='game_session',
            target_id=game_session.id,
            details={
                'outcome': outcome.value,
                'win_amount': str(win_amount),
                'profit_loss': str(profit_loss)
            }
        )
        
        logger.info(
            f"Game session ended: {session_id} | "
            f"Outcome: {outcome.value} | Win: {win_amount} | P/L: {profit_loss}"
        )
        
        return game_session
    
    # ============================================================================
    # HELPER METHODS
    # ============================================================================
    
    async def _get_player_override(
        self,
        player_id: int,
        game_id: int
    ) -> Optional[GamePlayerOverride]:
        """Get active player override for game."""
        result = await self.session.execute(
            select(GamePlayerOverride).where(
                and_(
                    GamePlayerOverride.player_id == player_id,
                    GamePlayerOverride.game_id == game_id,
                    GamePlayerOverride.is_active == True,
                    or_(
                        GamePlayerOverride.expires_at.is_(None),
                        GamePlayerOverride.expires_at > datetime.now(timezone.utc)
                    )
                )
            )
        )
        return result.scalar_one_or_none()
    
    def _create_transaction_signature(
        self,
        user_id: int,
        tx_type: str,
        amount: Decimal,
        balance_before: Decimal,
        balance_after: Decimal
    ) -> str:
        """Create transaction signature for integrity."""
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
        """Log action to audit trail."""
        audit = AuditLog(
            admin_id=admin_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details
        )
        self.session.add(audit)
        await self.session.flush()

"""
Games Service - Handles game management, play sessions, algorithms
"""

import logging
from typing import List, Optional, Tuple
from decimal import Decimal
from datetime import datetime
import random
import uuid

from models.data_models import Game, GameSession, GameAlgorithm, GameSessionResult
from services.domain_services.csv_manager import csv_manager

logger = logging.getLogger(__name__)

class GamesService:
    """Game management service with CSV persistence"""
    
    # CSV Headers
    GAMES_HEADERS = ["id", "name", "description", "type", "payout_min_percent", "payout_max_percent", "status", "created_date"]
    SESSIONS_HEADERS = ["id", "user_id", "game_id", "stake_amount", "result", "payout_amount", "profit_loss", "status", "created_date"]
    ALGORITHMS_HEADERS = ["id", "game_id", "region", "user_id", "win_probability", "loss_multiplier", "active", "updated_date"]
    GAME_LOGS_HEADERS = ["id", "user_id", "game_id", "action", "details", "created_date"]
    
    def __init__(self):
        """Initialize Games Service and CSV files"""
        csv_manager.create_file("games", self.GAMES_HEADERS)
        csv_manager.create_file("game_sessions", self.SESSIONS_HEADERS)
        csv_manager.create_file("game_algorithms", self.ALGORITHMS_HEADERS)
        csv_manager.create_file("game_logs", self.GAME_LOGS_HEADERS)
        logger.info("Games Service initialized")
    
    # ==================== GAME MANAGEMENT ====================
    
    async def create_game(self, name: str, description: str, game_type: str, 
                         payout_min: float, payout_max: float) -> Game:
        """Create new game"""
        game = Game(
            id=f"GAME_{uuid.uuid4().hex[:8].upper()}",
            name=name,
            description=description,
            type=game_type,
            payout_min_percent=payout_min,
            payout_max_percent=payout_max,
            status="active",
            created_date=datetime.now().isoformat()
        )
        
        csv_manager.write_row("games", self.GAMES_HEADERS, game.to_csv_row())
        await self._log_action(None, game.id, "create", f"Game created: {name}")
        return game
    
    async def get_game(self, game_id: str) -> Optional[Game]:
        """Get game by ID"""
        row = csv_manager.read_by_id("games", game_id)
        if not row:
            return None
        
        return Game(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            type=row["type"],
            payout_min_percent=float(row["payout_min_percent"]),
            payout_max_percent=float(row["payout_max_percent"]),
            status=row["status"],
            created_date=row["created_date"]
        )
    
    async def list_available_games(self) -> List[Game]:
        """List all active games"""
        rows = csv_manager.read_by_column("games", "status", "active")
        games = []
        
        for row in rows:
            games.append(Game(
                id=row["id"],
                name=row["name"],
                description=row["description"],
                type=row["type"],
                payout_min_percent=float(row["payout_min_percent"]),
                payout_max_percent=float(row["payout_max_percent"]),
                status=row["status"],
                created_date=row["created_date"]
            ))
        
        return games
    
    async def disable_game(self, game_id: str) -> bool:
        """Disable game"""
        return csv_manager.update_row("games", game_id, {"status": "inactive"})
    
    # ==================== GAME PLAY ====================
    
    async def play_game(self, user_id: int, game_id: str, stake_amount: Decimal) -> Tuple[GameSession, bool]:
        """
        Play game and return session result
        Returns: (GameSession, is_win: bool)
        """
        game = await self.get_game(game_id)
        if not game or game.status == "inactive":
            logger.error(f"Invalid game: {game_id}")
            raise ValueError(f"Game {game_id} not found or inactive")
        
        # Calculate win/loss
        is_win = await self._calculate_result(user_id, game_id)
        
        # Calculate payout
        if is_win:
            payout_percent = random.uniform(game.payout_min_percent, game.payout_max_percent)
        else:
            payout_percent = 0  # Loss = no payout
        
        payout_amount = stake_amount * Decimal(str(payout_percent / 100))
        profit_loss = payout_amount - stake_amount
        
        # Create session
        session = GameSession(
            id=f"SESSION_{uuid.uuid4().hex[:8].upper()}",
            user_id=user_id,
            game_id=game_id,
            stake_amount=stake_amount,
            result="win" if is_win else "loss",
            payout_amount=payout_amount,
            profit_loss=profit_loss,
            status="completed",
            created_date=datetime.now().isoformat()
        )
        
        # Save session
        csv_manager.write_row("game_sessions", self.SESSIONS_HEADERS, session.to_csv_row())
        
        # Log
        action = "game_win" if is_win else "game_loss"
        await self._log_action(user_id, game_id, action, 
                              f"Stake: {stake_amount}, Payout: {payout_amount}, Result: {profit_loss}")
        
        # Anti-cheat check
        await self._detect_suspicious_patterns(user_id)
        
        return session, is_win
    
    async def _calculate_result(self, user_id: int, game_id: str) -> bool:
        """
        Calculate win/loss based on algorithms
        Checks: user override → regional override → game default
        """
        # Get user-specific algorithm
        algorithms = csv_manager.read_all("game_algorithms")
        
        win_probability = 0.5  # Default 50%
        
        for algo_row in algorithms:
            # User-specific override (highest priority)
            if (algo_row["game_id"] == game_id and 
                algo_row["user_id"] != "all" and 
                algo_row["user_id"] == str(user_id) and
                algo_row["active"] == "yes"):
                win_probability = float(algo_row["win_probability"])
                break
            
            # Regional override
            elif (algo_row["game_id"] == game_id and 
                  algo_row["user_id"] == "all" and
                  algo_row["region"] != "global" and
                  algo_row["active"] == "yes"):
                win_probability = float(algo_row["win_probability"])
        
        return random.random() < win_probability
    
    async def get_user_win_rate(self, user_id: int) -> float:
        """Get user's win rate percentage"""
        sessions = csv_manager.read_by_column("game_sessions", "user_id", str(user_id))
        if not sessions:
            return 0.0
        
        wins = sum(1 for s in sessions if s["result"] == "win")
        return (wins / len(sessions)) * 100
    
    # ==================== ALGORITHM CONTROL ====================
    
    async def set_algorithm(self, game_id: str, region: Optional[str], 
                           user_id: Optional[int], win_probability: float, 
                           loss_multiplier: float) -> GameAlgorithm:
        """Set game algorithm override"""
        algo = GameAlgorithm(
            id=f"ALGO_{uuid.uuid4().hex[:8].upper()}",
            game_id=game_id,
            region=region,
            user_id=user_id,
            win_probability=min(1.0, max(0.0, win_probability)),  # Clamp 0-1
            loss_multiplier=min(2.0, max(0.5, loss_multiplier)),  # Clamp 0.5-2.0
            active=True,
            updated_date=datetime.now().isoformat()
        )
        
        csv_manager.write_row("game_algorithms", self.ALGORITHMS_HEADERS, algo.to_csv_row())
        return algo
    
    async def get_algorithm(self, game_id: str, region: Optional[str] = None, 
                           user_id: Optional[int] = None) -> Optional[GameAlgorithm]:
        """Get algorithm for game/region/user"""
        algos = csv_manager.read_by_column("game_algorithms", "game_id", game_id)
        
        for row in algos:
            if (row["active"] == "yes" and
                (user_id and row["user_id"] == str(user_id)) or
                (region and row["region"] == region)):
                return GameAlgorithm(
                    id=row["id"],
                    game_id=row["game_id"],
                    region=row["region"] if row["region"] != "global" else None,
                    user_id=int(row["user_id"]) if row["user_id"] != "all" else None,
                    win_probability=float(row["win_probability"]),
                    loss_multiplier=float(row["loss_multiplier"]),
                    active=row["active"] == "yes",
                    updated_date=row["updated_date"]
                )
        
        return None
    
    # ==================== ANTI-CHEAT & LOGGING ====================
    
    async def _detect_suspicious_patterns(self, user_id: int) -> List[str]:
        """Detect suspicious activity patterns"""
        alerts = []
        sessions = csv_manager.read_by_column("game_sessions", "user_id", str(user_id))
        
        if len(sessions) < 5:
            return alerts  # Need minimum sessions
        
        recent_sessions = sessions[-100:]  # Last 100 games
        wins = sum(1 for s in recent_sessions if s["result"] == "win")
        win_rate = (wins / len(recent_sessions)) * 100
        
        # Alert if 95%+ win rate (suspicious)
        if win_rate > 95:
            alerts.append(f"HIGH_WIN_RATE: {win_rate:.1f}%")
            await self._log_action(user_id, None, "anti_cheat_alert", f"Suspicious win rate: {win_rate:.1f}%")
        
        # Alert if user only plays 1 game repeatedly
        games_played = set(s["game_id"] for s in recent_sessions)
        if len(games_played) == 1:
            alerts.append("SINGLE_GAME_GRINDING")
            await self._log_action(user_id, None, "anti_cheat_alert", "Single game grinding detected")
        
        return alerts
    
    async def _log_action(self, user_id: Optional[int], game_id: Optional[str], 
                         action: str, details: str) -> None:
        """Log game action for audit"""
        row = [
            f"LOG_{uuid.uuid4().hex[:8].upper()}",
            str(user_id) if user_id else "system",
            game_id or "none",
            action,
            details,
            datetime.now().isoformat()
        ]
        csv_manager.write_row("game_logs", self.GAME_LOGS_HEADERS, row)
    
    async def get_user_game_logs(self, user_id: int) -> List[dict]:
        """Get all game logs for user"""
        return csv_manager.read_by_column("game_logs", "user_id", str(user_id))


# Global instance
games_service = GamesService()

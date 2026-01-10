"""
Flying Plane Game Handler
Simple 2D plane avoidance game using Phase 1 GamesService
"""

import logging
import random
import math
from decimal import Decimal
from datetime import datetime
from typing import Dict, Tuple, List

logger = logging.getLogger(__name__)

# Game configuration
GAME_WIDTH = 20
GAME_HEIGHT = 10
PLANE_START_X = 2
PLANE_START_Y = 5
OBSTACLE_WIDTH = 2
OBSTACLE_HEIGHT = 1

class FlyingPlaneGame:
    """
    Flying Plane Game Engine
    
    Rules:
    - Plane flies horizontally
    - Player avoids obstacles
    - Obstacles move from right to left
    - Speed increases with score (every 100 points)
    - Game ends when plane hits obstacle
    """
    
    def __init__(self, user_id: int, stake_amount: Decimal):
        """Initialize a new game session"""
        self.user_id = user_id
        self.stake_amount = stake_amount
        
        # Game state
        self.plane_x = PLANE_START_X
        self.plane_y = PLANE_START_Y
        self.score = 0
        self.time_steps = 0
        
        # Game difficulty
        self.base_speed = 1.0  # obstacles per time step
        self.current_speed = self.base_speed
        self.max_speed = 5.0
        
        # Obstacles (list of (x, y) tuples)
        self.obstacles: List[Tuple[int, int]] = []
        self.next_obstacle_at = 5  # spawn next obstacle after 5 steps
        
        # Game status
        self.is_playing = True
        self.collision_detected = False
        self.game_over_reason = None
        
        logger.info(f"Flying Plane game started for user {user_id}, stake: {stake_amount}")
    
    def move_plane_up(self) -> bool:
        """Move plane up"""
        if self.plane_y > 0:
            self.plane_y -= 1
            return True
        return False
    
    def move_plane_down(self) -> bool:
        """Move plane down"""
        if self.plane_y < GAME_HEIGHT - 1:
            self.plane_y += 1
            return True
        return False
    
    def update_game_step(self) -> None:
        """Advance game by one time step"""
        if not self.is_playing:
            return
        
        self.time_steps += 1
        
        # Update difficulty based on score
        self.current_speed = min(
            self.base_speed + (self.score // 100) * 0.5,
            self.max_speed
        )
        
        # Spawn new obstacle
        if self.time_steps >= self.next_obstacle_at:
            self._spawn_obstacle()
            self.next_obstacle_at = self.time_steps + int(10 / self.current_speed)
        
        # Move obstacles
        self.obstacles = [
            (x - 1, y) for x, y in self.obstacles
            if x > 0  # Remove off-screen obstacles
        ]
        
        # Increment score for surviving
        self.score += 1
        
        # Check collision
        if self._check_collision():
            self.is_playing = False
            self.collision_detected = True
            self.game_over_reason = "Collision with obstacle"
            logger.warning(f"Game over: {self.game_over_reason} (User: {self.user_id})")
    
    def _spawn_obstacle(self) -> None:
        """Spawn new obstacle at right side of screen"""
        obstacle_y = random.randint(0, GAME_HEIGHT - OBSTACLE_HEIGHT)
        self.obstacles.append((GAME_WIDTH - OBSTACLE_WIDTH, obstacle_y))
        logger.debug(f"Obstacle spawned at y={obstacle_y}")
    
    def _check_collision(self) -> bool:
        """Check if plane collides with any obstacle"""
        for obs_x, obs_y in self.obstacles:
            # Simple bounding box collision
            if (self.plane_x < obs_x + OBSTACLE_WIDTH and
                self.plane_x + 1 > obs_x and
                self.plane_y < obs_y + OBSTACLE_HEIGHT and
                self.plane_y + 1 > obs_y):
                return True
        return False
    
    def get_game_state(self) -> Dict:
        """Get current game state for display"""
        return {
            "user_id": self.user_id,
            "score": self.score,
            "time_steps": self.time_steps,
            "plane_position": (self.plane_x, self.plane_y),
            "obstacles": self.obstacles,
            "current_speed": round(self.current_speed, 2),
            "is_playing": self.is_playing,
            "collision_detected": self.collision_detected,
            "game_over_reason": self.game_over_reason
        }
    
    def end_game(self) -> Dict:
        """End game and calculate results"""
        self.is_playing = False
        
        # Calculate payout based on score
        # Win if score > 500 (arbitrary threshold)
        is_win = self.score >= 500
        
        # Payout calculation
        if is_win:
            # Winner: 100-150% payout
            payout_percent = random.uniform(100, 150)
        else:
            # Loser: 0% payout (lose stake)
            payout_percent = 0
        
        payout_amount = self.stake_amount * Decimal(str(payout_percent / 100))
        profit_loss = payout_amount - self.stake_amount
        
        result = {
            "user_id": self.user_id,
            "final_score": self.score,
            "total_time_steps": self.time_steps,
            "is_win": is_win,
            "payout_percent": payout_percent,
            "stake_amount": self.stake_amount,
            "payout_amount": payout_amount,
            "profit_loss": profit_loss,
            "max_speed_reached": round(self.current_speed, 2),
            "ended_at": datetime.now().isoformat()
        }
        
        logger.info(f"Game ended: user={self.user_id}, score={self.score}, "
                   f"win={is_win}, payout={payout_amount}")
        
        return result


class FlyingPlaneGameSession:
    """
    Game session manager for multiplayer support
    Tracks all active game sessions
    """
    
    def __init__(self):
        self.active_games: Dict[int, FlyingPlaneGame] = {}
    
    def create_session(self, user_id: int, stake_amount: Decimal) -> FlyingPlaneGame:
        """Create new game session for user"""
        if user_id in self.active_games:
            logger.warning(f"User {user_id} already has active game, terminating previous")
            self.end_session(user_id)
        
        game = FlyingPlaneGame(user_id, stake_amount)
        self.active_games[user_id] = game
        return game
    
    def get_session(self, user_id: int) -> FlyingPlaneGame:
        """Get active session for user"""
        return self.active_games.get(user_id)
    
    def end_session(self, user_id: int) -> Dict:
        """End session and return results"""
        if user_id not in self.active_games:
            logger.warning(f"No active session for user {user_id}")
            return None
        
        game = self.active_games[user_id]
        result = game.end_game()
        del self.active_games[user_id]
        return result
    
    def is_playing(self, user_id: int) -> bool:
        """Check if user has active game"""
        return user_id in self.active_games and self.active_games[user_id].is_playing


# Global session manager
flying_plane_sessions = FlyingPlaneGameSession()


async def handle_flying_plane_command(user_id: int, stakes: Decimal, session_maker) -> Dict:
    """
    Main handler for flying plane game command
    
    Flow:
    1. Create game session
    2. User plays game (simplified in this version - just runs 20 steps)
    3. Calculate results and update GamesService
    4. Return game result
    """
    
    logger.info(f"Flying plane game started for user {user_id}")
    
    # Create game session
    game = flying_plane_sessions.create_session(user_id, stakes)
    
    # Simulate game play (20 time steps)
    # In a real implementation, this would be interactive
    for _ in range(20):
        # Simulate random player input
        action = random.choice(['up', 'down', 'up', 'down', 'none'])
        
        if action == 'up':
            game.move_plane_up()
        elif action == 'down':
            game.move_plane_down()
        
        game.update_game_step()
        
        if not game.is_playing:
            break
    
    # End game and get results
    result = flying_plane_sessions.end_session(user_id)
    
    # Store in GamesService - use the actual game ID
    try:
        from services.domain_services.games_service import games_service
        
        # Find the Flying Plane game ID
        from services.domain_services.csv_manager import csv_manager
        games_list = csv_manager.read_all("games")
        flying_plane_id = None
        for game_record in games_list:
            if "Flying" in game_record.get('name', '') or "flying" in game_record.get('name', ''):
                flying_plane_id = game_record.get('id')
                break
        
        if not flying_plane_id:
            logger.error("Flying Plane game not found in games.csv")
            return result
        
        # Log game session to GamesService
        session_record, is_win = await games_service.play_game(
            user_id=user_id,
            game_id=flying_plane_id,
            stake_amount=stakes
        )
        
        logger.info(f"Game session recorded: {session_record.id}")
        
        # Add detailed score to CSV
        csv_manager.write_row(
            "flying_plane_scores",
            ["session_id", "user_id", "score", "time_steps", "payout_percent", "is_win", "created_date"],
            [
                session_record.id,
                str(user_id),
                str(result["final_score"]),
                str(result["total_time_steps"]),
                str(result["payout_percent"]),
                "yes" if result["is_win"] else "no",
                datetime.now().isoformat()
            ]
        )
        
        # Anti-cheat: Log suspicious scores
        if result["final_score"] > 1000:
            await games_service._log_action(
                user_id, flying_plane_id, "anti_cheat_alert",
                f"Suspiciously high score: {result['final_score']}"
            )
        
    except Exception as e:
        logger.error(f"Error storing game session: {e}")
    
    return result


def initialize_flying_plane_game():
    """Initialize flying plane game in GamesService"""
    import asyncio
    
    async def init():
        try:
            from services.domain_services.games_service import games_service
            from services.domain_services.csv_manager import csv_manager
            
            # Create flying_plane_scores CSV if not exists
            if not csv_manager.file_exists("flying_plane_scores"):
                csv_manager.create_file(
                    "flying_plane_scores",
                    ["session_id", "user_id", "score", "time_steps", "payout_percent", "is_win", "created_date"]
                )
                logger.info("Flying plane scores CSV created")
        
        except Exception as e:
            logger.error(f"Error initializing Flying Plane game: {e}")
    
    # Run async init
    try:
        asyncio.run(init())
    except RuntimeError:
        # Event loop already running
        logger.info("Skipping async init (event loop already running)")

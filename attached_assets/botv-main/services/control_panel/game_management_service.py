"""
Game Management Service
Handles CRUD operations and management for games in the control panel
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from decimal import Decimal
from datetime import datetime

from models.control_panel import Game, GameConfiguration


class GameManagementService:
    """Service for managing games in the control panel"""
    
    def __init__(self):
        pass
    
    async def create_game(
        self, 
        session: AsyncSession, 
        name: str,
        description: str = None,
        game_type: str = None,
        min_bet: Decimal = Decimal('1.00'),
        max_bet: Decimal = Decimal('10000.00'),
        house_edge: Decimal = Decimal('5.00'),
        rtp: Decimal = Decimal('95.00'),
        algorithm_mode: str = 'FIXED_HOUSE_EDGE',
        user_id: int = None
    ) -> Game:
        """Create a new game"""
        # Check for duplicates
        existing = await session.execute(
            select(Game).where(Game.name == name)
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Game '{name}' already exists")
        
        # Create game
        game = Game(
            name=name,
            description=description,
            type=game_type,
            min_bet=min_bet,
            max_bet=max_bet,
            house_edge=house_edge,
            rtp=rtp,
            algorithm_mode=algorithm_mode,
            status='active',
            created_by=user_id,
            updated_by=user_id
        )
        
        session.add(game)
        await session.flush()
        await session.commit()
        await session.refresh(game)
        
        return game
    
    async def get_game(self, session: AsyncSession, game_id: int) -> Optional[Game]:
        """Get game by ID"""
        result = await session.execute(
            select(Game).where(Game.id == game_id)
        )
        return result.scalar_one_or_none()
    
    async def get_game_by_name(self, session: AsyncSession, name: str) -> Optional[Game]:
        """Get game by name"""
        result = await session.execute(
            select(Game).where(Game.name == name)
        )
        return result.scalar_one_or_none()
    
    async def list_games(
        self, 
        session: AsyncSession, 
        skip: int = 0, 
        limit: int = 100,
        status: str = None
    ) -> List[Game]:
        """List all games with pagination and optional filtering"""
        query = select(Game).order_by(Game.created_at.desc())
        
        if status:
            query = query.where(Game.status == status)
        
        query = query.offset(skip).limit(limit)
        result = await session.execute(query)
        return list(result.scalars().all())
    
    async def update_game(
        self, 
        session: AsyncSession, 
        game_id: int, 
        user_id: int,
        **updates
    ) -> Optional[Game]:
        """Update game settings"""
        game = await self.get_game(session, game_id)
        if not game:
            raise ValueError(f"Game {game_id} not found")
        
        # Update fields
        for field, value in updates.items():
            if hasattr(game, field) and value is not None:
                setattr(game, field, value)
        
        game.updated_by = user_id
        game.updated_at = datetime.utcnow()
        
        await session.commit()
        await session.refresh(game)
        
        return game
    
    async def delete_game(self, session: AsyncSession, game_id: int) -> bool:
        """Delete a game"""
        game = await self.get_game(session, game_id)
        if not game:
            return False
        
        await session.delete(game)
        await session.commit()
        return True
    
    async def set_game_status(
        self, 
        session: AsyncSession, 
        game_id: int, 
        status: str,
        user_id: int
    ) -> Optional[Game]:
        """Set game status (active, inactive, maintenance)"""
        game = await self.get_game(session, game_id)
        if not game:
            raise ValueError(f"Game {game_id} not found")
        
        game.status = status
        game.updated_by = user_id
        game.updated_at = datetime.utcnow()
        
        await session.commit()
        await session.refresh(game)
        
        return game
    
    async def increment_play_count(
        self, 
        session: AsyncSession, 
        game_id: int,
        volume: Decimal = Decimal('0')
    ) -> None:
        """Increment game play count and volume"""
        await session.execute(
            update(Game)
            .where(Game.id == game_id)
            .values(
                play_count=Game.play_count + 1,
                total_volume=Game.total_volume + volume
            )
        )
        await session.commit()
    
    async def get_game_statistics(self, session: AsyncSession, game_id: int) -> Dict[str, Any]:
        """Get game statistics"""
        game = await self.get_game(session, game_id)
        if not game:
            raise ValueError(f"Game {game_id} not found")
        
        return {
            'game_id': game.id,
            'name': game.name,
            'play_count': game.play_count,
            'total_volume': float(game.total_volume),
            'status': game.status,
            'house_edge': float(game.house_edge),
            'rtp': float(game.rtp)
        }
    
    async def set_game_configuration(
        self,
        session: AsyncSession,
        game_id: int,
        config_key: str,
        config_value: str,
        data_type: str = 'string',
        user_id: int = None
    ) -> GameConfiguration:
        """Set or update game configuration"""
        # Check if configuration exists
        result = await session.execute(
            select(GameConfiguration)
            .where(
                GameConfiguration.game_id == game_id,
                GameConfiguration.config_key == config_key
            )
        )
        config = result.scalar_one_or_none()
        
        if config:
            # Update existing
            config.config_value = config_value
            config.data_type = data_type
            config.updated_by = user_id
            config.updated_at = datetime.utcnow()
        else:
            # Create new
            config = GameConfiguration(
                game_id=game_id,
                config_key=config_key,
                config_value=config_value,
                data_type=data_type,
                updated_by=user_id
            )
            session.add(config)
        
        await session.commit()
        await session.refresh(config)
        return config
    
    async def get_game_configuration(
        self,
        session: AsyncSession,
        game_id: int,
        config_key: str
    ) -> Optional[GameConfiguration]:
        """Get game configuration by key"""
        result = await session.execute(
            select(GameConfiguration)
            .where(
                GameConfiguration.game_id == game_id,
                GameConfiguration.config_key == config_key
            )
        )
        return result.scalar_one_or_none()
    
    async def list_game_configurations(
        self,
        session: AsyncSession,
        game_id: int
    ) -> List[GameConfiguration]:
        """List all configurations for a game"""
        result = await session.execute(
            select(GameConfiguration)
            .where(GameConfiguration.game_id == game_id)
            .order_by(GameConfiguration.config_key)
        )
        return list(result.scalars().all())

"""
Games API Schemas
Request/response models for game management endpoints
"""
from pydantic import BaseModel, Field, field_validator, field_serializer, ConfigDict
from typing import Optional, List
from decimal import Decimal
from datetime import datetime


class GameConfigurationBase(BaseModel):
    """Base model for game configuration"""
    config_key: str = Field(..., min_length=1, max_length=100)
    config_value: Optional[str] = None
    data_type: Optional[str] = Field(None, pattern="^(string|int|float|boolean|json)$")


class GameConfigurationCreate(GameConfigurationBase):
    """Create game configuration"""
    pass


class GameConfigurationResponse(GameConfigurationBase):
    """Game configuration response"""
    id: int
    game_id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class GameBase(BaseModel):
    """Base model for games"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    type: Optional[str] = Field(None, max_length=50)
    min_bet: Decimal = Field(Decimal('1.00'), ge=Decimal('0.01'))
    max_bet: Decimal = Field(Decimal('10000.00'), gt=Decimal('0'))
    house_edge: Decimal = Field(Decimal('5.00'), ge=Decimal('0'), le=Decimal('100'))
    rtp: Decimal = Field(Decimal('95.00'), ge=Decimal('0'), le=Decimal('100'))
    algorithm_mode: str = Field('FIXED_HOUSE_EDGE', max_length=50)
    is_featured: bool = False
    
    @field_validator('max_bet')
    @classmethod
    def max_bet_greater_than_min(cls, v, info):
        if 'min_bet' in info.data and v <= info.data['min_bet']:
            raise ValueError('max_bet must be greater than min_bet')
        return v


class GameCreate(GameBase):
    """Create game request"""
    pass


class GameUpdate(BaseModel):
    """Update game request"""
    description: Optional[str] = None
    type: Optional[str] = None
    min_bet: Optional[Decimal] = None
    max_bet: Optional[Decimal] = None
    house_edge: Optional[Decimal] = None
    rtp: Optional[Decimal] = None
    algorithm_mode: Optional[str] = None
    is_featured: Optional[bool] = None
    status: Optional[str] = Field(None, pattern="^(active|inactive|maintenance)$")


class GameResponse(GameBase):
    """Game response"""
    id: int
    status: str
    play_count: int = 0
    total_volume: Decimal = Decimal('0')
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_serializer('total_volume', 'min_bet', 'max_bet', 'house_edge', 'rtp')
    def serialize_decimal(self, value: Decimal) -> float:
        return float(value)


class GameDetailResponse(GameResponse):
    """Detailed game response with configurations"""
    configurations: List[GameConfigurationResponse] = []


class GameListResponse(BaseModel):
    """Game list response"""
    total: int
    skip: int
    limit: int
    games: List[GameResponse]


class GameStatisticsResponse(BaseModel):
    """Game statistics response"""
    game_id: int
    name: str
    play_count: int
    total_volume: float
    status: str
    house_edge: float
    rtp: float


class GameStatusUpdate(BaseModel):
    """Update game status"""
    status: str = Field(..., pattern="^(active|inactive|maintenance)$")


class BulkGameUpdate(BaseModel):
    """Bulk update games"""
    game_ids: List[int] = Field(..., min_length=1)
    updates: GameUpdate

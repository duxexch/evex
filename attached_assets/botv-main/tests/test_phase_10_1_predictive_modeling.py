import pytest
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from services.predictive_modeling_service import (
    PredictiveModelingService,
    PlayerValueTier,
)

# Import Base from models for type hints only
try:
    from models import Base
except ImportError:
    Base = declarative_base()


@pytest.fixture(scope="module")
async def engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def session_maker(engine):
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def session(session_maker):
    async with session_maker() as session:
        yield session


@pytest.fixture
async def service(session_maker):
    return PredictiveModelingService(session_maker)


@pytest.mark.asyncio
async def test_forecast_user_ltv_structure(service, session):
    forecast = await service.forecast_user_ltv(session, user_id=1, horizon_days=90)
    assert forecast.user_id == 1
    assert forecast.horizon_days >= 7
    assert isinstance(forecast.predicted_ltv, Decimal)
    assert forecast.lower_bound <= forecast.upper_bound


@pytest.mark.asyncio
async def test_forecast_revenue_projection(service, session):
    forecast = await service.forecast_revenue(session, horizon_days=30)
    assert forecast.horizon_days >= 7
    assert isinstance(forecast.projected_net, Decimal)
    assert isinstance(forecast.daily_projection, list)


@pytest.mark.asyncio
async def test_player_value_prediction(service, session):
    prediction = await service.predict_player_value(session, user_id=1)
    assert prediction.user_id == 1
    assert prediction.tier in PlayerValueTier
    assert isinstance(prediction.expected_monthly_value, Decimal)


@pytest.mark.asyncio
async def test_engagement_forecast(service, session):
    forecast = await service.forecast_engagement(session, user_id=1, horizon_days=14)
    assert forecast.user_id == 1
    assert forecast.horizon_days >= 3
    assert isinstance(forecast.predicted_sessions, int)


@pytest.mark.asyncio
async def test_global_insights(service, session):
    insights = await service.generate_global_insights(session, horizon_days=30, top_n=5)
    assert insights.revenue_forecast.horizon_days >= 7
    assert isinstance(insights.top_value_users, list)
    assert isinstance(insights.at_risk_users, list)
    assert "high_volume_sessions" in insights.engagement_hotspots

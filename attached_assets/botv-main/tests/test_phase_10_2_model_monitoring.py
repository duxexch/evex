import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from services.model_monitoring_service import ModelMonitoringService


@pytest.fixture(scope="module")
async def engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                CREATE TABLE game_rounds (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    bet_amount NUMERIC,
                    payout_amount NUMERIC,
                    result TEXT,
                    created_at DATETIME
                )
                """
            )
        )
        now = datetime.utcnow()
        rows = [
            (1, 100.0, 60.0, "WIN", now - timedelta(days=1)),
            (1, 150.0, 0.0, "LOSS", now - timedelta(days=2)),
            (2, 6000.0, 3000.0, "WIN", now - timedelta(days=1)),
            (3, 12000.0, 2000.0, "WIN", now - timedelta(days=3)),
        ]
        for user_id, bet, payout, result, created in rows:
            await conn.execute(
                text(
                    """
                    INSERT INTO game_rounds (user_id, bet_amount, payout_amount, result, created_at)
                    VALUES (:user_id, :bet, :payout, :result, :created)
                    """
                ),
                {
                    "user_id": user_id,
                    "bet": bet,
                    "payout": payout,
                    "result": result,
                    "created": created,
                },
            )
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
async def service():
    return ModelMonitoringService()


@pytest.mark.asyncio
async def test_feature_stats(service, session):
    stats = await service.get_feature_stats(session, "bet_amount", 7)
    assert stats.count >= 4
    assert stats.mean > Decimal(0)
    assert stats.max >= stats.min


@pytest.mark.asyncio
async def test_drift_detection(service, session):
    result = await service.detect_drift(session, "bet_amount", baseline_mean=50.0, baseline_std=10.0, period_days=7)
    assert result.feature == "bet_amount"
    assert result.drift_status in {"stable", "monitor", "drift"}


@pytest.mark.asyncio
async def test_segment_performance(service, session):
    segments = await service.segment_performance(session, 30)
    assert set(segments.keys()) == {"vip", "high", "medium", "low"}
    total_listed = sum(len(v) for v in segments.values())
    assert total_listed >= 3

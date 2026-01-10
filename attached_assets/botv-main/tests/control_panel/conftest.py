"""
Conftest for control panel tests.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from models import Base, User
from api.main import app  # Adjust import based on your FastAPI app location


@pytest.fixture
async def async_session():
    """Create async test database session."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session_maker() as session:
        yield session
    
    await engine.dispose()


@pytest.fixture
async def test_user(async_session):
    """Create test user."""
    user = User(
        telegram_id=123456789,
        username="test_user",
        full_name="Test User",
        phone="+1234567890",
        balance=1000.0
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
async def async_client(async_session):
    """Create async HTTP client for testing."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
def notification_service(async_session):
    """Create NotificationService instance."""
    from services.control_panel.notification_service import NotificationService
    return NotificationService(async_session)

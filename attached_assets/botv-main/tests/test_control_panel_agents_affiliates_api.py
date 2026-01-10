import os
import sys
from pathlib import Path
from decimal import Decimal

import pytest
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import Table, Column, Integer, Boolean, text

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.v1.control_panel import router as control_panel_router
from api.v1.control_panel.agents import router as agents_router
from api.v1.control_panel.affiliates import router as affiliates_router
from api.dependencies import get_db
from api.auth_utils import get_current_user
from models import Base, User

# Minimal environment defaults
os.environ.setdefault("BOT_TOKEN", "dummy-token-for-api-mode")
os.environ.setdefault("ADMIN_USER_IDS", "1")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")
os.environ.setdefault("ENCRYPTION_KEY", "test-encryption-key")


class DummyUser:
    def __init__(self, user_id: int = 1):
        self.id = user_id
        self.is_active = True


class AllowAllRBAC:
    async def has_permission(self, session, user_id: int, permission: str) -> bool:
        return True


@pytest.fixture
async def app_client(tmp_path):
    """Create a FastAPI test client with isolated DB and permissive RBAC."""
    db_path = tmp_path / "control_panel.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"

    engine = create_async_engine(
        db_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    # Ensure users table exists for FKs when metadata is empty
    if "users" not in Base.metadata.tables:
        Table(
            "users",
            Base.metadata,
            Column("id", Integer, primary_key=True, autoincrement=True),
            Column("is_active", Boolean, default=True),
        )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Seed a couple of users for FK constraints
    async with session_maker() as session:
        session.add_all(
            [
                User(telegram_id=1001, username="agent_user", first_name="Agent"),
                User(telegram_id=1002, username="affiliate_user", first_name="Affiliate"),
                User(telegram_id=1003, username="referred_user", first_name="Referred"),
            ]
        )
        await session.commit()

    async def override_get_db():
        async with session_maker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def override_get_current_user():
        return DummyUser()

    def override_rbac():
        return AllowAllRBAC()

    app = FastAPI()
    app.include_router(control_panel_router)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[agents_router.get_rbac_service] = override_rbac
    app.dependency_overrides[affiliates_router.get_rbac_service] = override_rbac

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    await engine.dispose()


@pytest.mark.anyio
async def test_agent_commission_flow(app_client: AsyncClient):
    create_resp = await app_client.post(
        "/control-panel/agents/",
        json={
            "name": "Agent One",
            "agent_code": "AG001",
            "email": "a@example.com",
            "phone": "+1000000000",
            "commission_rate_deposit": "0.02",
            "commission_rate_withdraw": "0.01",
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    agent_id = create_resp.json()["id"]

    commission_resp = await app_client.post(
        f"/control-panel/agents/{agent_id}/commission",
        json={
            "transaction_amount": "1000.00",
            "tx_type": "deposit",
            "transaction_id": 123,
        },
    )
    assert commission_resp.status_code == 201, commission_resp.text
    commission = commission_resp.json()
    assert float(commission["amount"]) == pytest.approx(20.0)
    assert commission["status"] == "calculated"

    stats_resp = await app_client.get(f"/control-panel/agents/{agent_id}/stats")
    assert stats_resp.status_code == 200, stats_resp.text
    stats = stats_resp.json()
    assert stats["agent_id"] == agent_id


@pytest.mark.anyio
async def test_affiliate_commission_and_payout_flow(app_client: AsyncClient):
    create_resp = await app_client.post(
        "/control-panel/affiliates/",
        json={
            "user_id": 2,  # affiliate_user
            "name": "Affiliate One",
            "commission_type": "percentage",
            "commission_rate": "5.0",
            "tier": "bronze",
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    affiliate_id = create_resp.json()["id"]

    referral_resp = await app_client.post(
        f"/control-panel/affiliates/{affiliate_id}/referrals",
        json={"referred_user_id": 3},
    )
    assert referral_resp.status_code == 201, referral_resp.text

    commission_resp = await app_client.post(
        f"/control-panel/affiliates/{affiliate_id}/commissions",
        json={
            "transaction_amount": "1000.00",
            "transaction_id": 456,
            "tx_type": "deposit",
        },
    )
    assert commission_resp.status_code == 201, commission_resp.text
    commission = commission_resp.json()
    assert float(commission["commission_amount"]) == pytest.approx(50.0)
    commission_id = commission["id"]

    for target in ["pending", "approved", "payable", "paid"]:
        transition_resp = await app_client.post(
            f"/control-panel/affiliates/commissions/{commission_id}/transition",
            json={"target": target, "admin_id": 1},
        )
        assert transition_resp.status_code == 200, transition_resp.text

    payout_req = await app_client.post(
        f"/control-panel/affiliates/{affiliate_id}/payouts",
        json={"amount": "10.00", "currency": "SAR"},
    )
    assert payout_req.status_code == 201, payout_req.text
    payout_id = payout_req.json()["id"]

    approve_resp = await app_client.post(f"/control-panel/affiliates/payouts/{payout_id}/approve")
    assert approve_resp.status_code == 200, approve_resp.text

    pay_resp = await app_client.post(f"/control-panel/affiliates/payouts/{payout_id}/pay")
    assert pay_resp.status_code == 200, pay_resp.text

    stats_resp = await app_client.get(f"/control-panel/affiliates/{affiliate_id}/stats")
    assert stats_resp.status_code == 200, stats_resp.text
    stats = stats_resp.json()
    assert stats["affiliate_id"] == affiliate_id
    assert stats["total_referrals"] >= 1


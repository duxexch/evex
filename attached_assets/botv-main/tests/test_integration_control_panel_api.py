import os
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text, Table, Column, Integer, Boolean
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure project root is on the import path for API modules
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.v1.control_panel import router as control_panel_router
from api.dependencies import get_db
from api.auth_utils import get_current_user
from models import Base

# Minimal environment defaults required by config
os.environ.setdefault("BOT_TOKEN", "dummy-token-for-api-mode")
os.environ.setdefault("ADMIN_USER_IDS", "1")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")
os.environ.setdefault("ENCRYPTION_KEY", "test-encryption-key")


class DummyUser:
    """Simple user stub for dependency override"""

    def __init__(self, user_id: int = 1):
        self.id = user_id
        self.is_active = True


@pytest.fixture
async def app_client(tmp_path):
    """Create a FastAPI test client with isolated SQLite DB."""
    db_path = tmp_path / "control_panel.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"

    engine = create_async_engine(
        db_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    # Inject a minimal users table into this metadata to satisfy FK references
    if "users" not in Base.metadata.tables:
        Table(
            "users",
            Base.metadata,
            Column("id", Integer, primary_key=True, autoincrement=True),
            Column("is_active", Boolean, default=True),
        )

    # Reset schema per test for isolation
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

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

    app = FastAPI()
    app.include_router(control_panel_router)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    await engine.dispose()


@pytest.mark.anyio
async def test_create_and_get_game(app_client: AsyncClient):
    payload = {
        "name": "Test Game",
        "description": "Demo game",
        "type": "slots",
        "min_bet": 1.0,
        "max_bet": 100.0,
        "house_edge": 5.0,
        "rtp": 95.0,
        "algorithm_mode": "FIXED_HOUSE_EDGE",
        "is_featured": False,
    }

    create_resp = await app_client.post("/control-panel/games/", json=payload)
    assert create_resp.status_code == 201, create_resp.text
    created = create_resp.json()
    game_id = created["id"]

    get_resp = await app_client.get(f"/control-panel/games/{game_id}")
    assert get_resp.status_code == 200, get_resp.text
    detail = get_resp.json()
    assert detail["name"] == payload["name"]
    assert detail["status"] == "active"


@pytest.mark.anyio
async def test_list_games(app_client: AsyncClient):
    base_payload = {
        "description": "Demo",
        "type": "slots",
        "min_bet": 1.0,
        "max_bet": 100.0,
        "house_edge": 5.0,
        "rtp": 95.0,
        "algorithm_mode": "FIXED_HOUSE_EDGE",
    }

    for idx in range(2):
        payload = {**base_payload, "name": f"Game {idx}"}
        resp = await app_client.post("/control-panel/games/", json=payload)
        assert resp.status_code == 201, resp.text

    list_resp = await app_client.get("/control-panel/games/?skip=0&limit=10")
    assert list_resp.status_code == 200, list_resp.text
    data = list_resp.json()
    assert data["total"] == 2
    assert len(data["games"]) == 2


@pytest.mark.anyio
async def test_update_status_and_configuration(app_client: AsyncClient):
    create_resp = await app_client.post(
        "/control-panel/games/",
        json={
            "name": "Config Game",
            "description": "Needs config",
            "type": "card",
            "min_bet": 2.0,
            "max_bet": 200.0,
            "house_edge": 4.0,
            "rtp": 96.0,
            "algorithm_mode": "FIXED_HOUSE_EDGE",
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    game_id = create_resp.json()["id"]

    status_resp = await app_client.patch(
        f"/control-panel/games/{game_id}/status",
        json={"status": "inactive"},
    )
    assert status_resp.status_code == 200, status_resp.text
    assert status_resp.json()["status"] == "inactive"

    config_resp = await app_client.post(
        f"/control-panel/games/{game_id}/configurations",
        json={"config_key": "max_rounds", "config_value": "50", "data_type": "int"},
    )
    assert config_resp.status_code == 201, config_resp.text

    get_config_resp = await app_client.get(
        f"/control-panel/games/{game_id}/configurations/max_rounds"
    )
    assert get_config_resp.status_code == 200, get_config_resp.text
    config = get_config_resp.json()
    assert config["config_key"] == "max_rounds"
    assert config["config_value"] == "50"


@pytest.mark.anyio
async def test_profit_loss_rule_flow(app_client: AsyncClient):
    game_resp = await app_client.post(
        "/control-panel/games/",
        json={
            "name": "Rule Game",
            "description": "For rules",
            "type": "slots",
            "min_bet": 1.0,
            "max_bet": 100.0,
            "house_edge": 5.0,
            "rtp": 95.0,
            "algorithm_mode": "FIXED_HOUSE_EDGE",
        },
    )
    assert game_resp.status_code == 201, game_resp.text
    game_id = game_resp.json()["id"]

    rule_resp = await app_client.post(
        "/control-panel/profit-loss/rules",
        json={
            "game_id": game_id,
            "rule_type": "house_edge_adjustment",
            "house_edge_adjustment": 0.5,
            "payout_multiplier": 1.1,
            "loss_cap": 10.0,
            "priority": 10,
        },
    )
    assert rule_resp.status_code == 201, rule_resp.text
    rule_id = rule_resp.json()["id"]

    list_resp = await app_client.get(
        f"/control-panel/profit-loss/rules?game_id={game_id}&active_only=true"
    )
    assert list_resp.status_code == 200, list_resp.text
    rules_payload = list_resp.json()
    assert rules_payload["total"] == 1
    assert len(rules_payload["rules"]) == 1

    get_resp = await app_client.get(f"/control-panel/profit-loss/rules/{rule_id}")
    assert get_resp.status_code == 200, get_resp.text
    assert get_resp.json()["rule_type"] == "house_edge_adjustment"

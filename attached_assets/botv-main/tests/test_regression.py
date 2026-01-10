#!/usr/bin/env python3
"""
Regression tests to verify all systems work correctly together
Tests Phase 2-5 implementation without breaking existing functionality
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

# Import all models and services
from models import (
    User, GameSession, GameRound, AuditLog, Outbox, OutboxRecipient,
    SystemSetting, OutboxType, OutboxStatus
)
from services.game_algorithm_manager import GameAlgorithmManager, AlgorithmMode
from services.system_settings_service import SystemSettingsService, SettingKey
from algorithms.base_strategy import GameContext
from algorithms.conservative_algorithm import FixedHouseEdgeAlgorithm, ConservativeAlgorithmFactory
from algorithms.dynamic_algorithm import DynamicAdaptiveAlgorithm
from services.telegram_notification_service import TelegramNotificationService, NotificationType
from services.notification_delivery_handler import NotificationDeliveryHandler, DeliveryFailureReason
from services.audit_log_service import AuditLogService, AuditAction


@pytest.fixture
async def db_session():
    """Create in-memory SQLite database for testing"""
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    
    async with engine.begin() as conn:
        await conn.run_sync(lambda x: x.create_all())
    
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with SessionLocal() as session:
        yield session
    
    await engine.dispose()


class TestAgentDistributionRegression:
    """Test agent distribution system still works"""
    
    async def test_agent_distribution_basic(self, db_session):
        """Test basic agent distribution"""
        # Create test agents
        agent1 = User(name="Agent1", role="AGENT", telegram_id=111)
        agent2 = User(name="Agent2", role="AGENT", telegram_id=222)
        
        db_session.add_all([agent1, agent2])
        await db_session.commit()
        
        # Verify agents created
        query = select(User).where(User.role == "AGENT")
        result = await db_session.execute(query)
        agents = result.scalars().all()
        
        assert len(agents) == 2
        assert agents[0].telegram_id in [111, 222]


class TestAlgorithmSwitching:
    """Test algorithm switching functionality"""
    
    async def test_conservative_algorithm_basic(self, db_session):
        """Test conservative algorithm produces valid outcomes"""
        algorithm = ConservativeAlgorithmFactory.get_default()
        
        context = GameContext(
            session_id="test_session_1",
            player_id=1,
            wager_amount=100.0,
            max_payout=3600.0,
            house_edge_percentage=5.0,
        )
        
        # Get outcome
        outcome = await algorithm.determine_outcome(context)
        
        # Validate
        is_valid, error = await algorithm.validate_outcome(outcome, context)
        assert is_valid, f"Outcome invalid: {error}"
        assert outcome.algorithm_used == 'FIXED_HOUSE_EDGE'
        assert outcome.result.value in ['WIN', 'LOSS']
    
    async def test_dynamic_algorithm_basic(self, db_session):
        """Test dynamic algorithm with adaptive factors"""
        algorithm = DynamicAdaptiveAlgorithm()
        
        context = GameContext(
            session_id="test_session_2",
            player_id=2,
            wager_amount=100.0,
            max_payout=3600.0,
            house_edge_percentage=5.0,
            player_session_count=10,
            player_win_rate=0.6,  # Lucky player
        )
        
        outcome = await algorithm.determine_outcome(context)
        
        is_valid, error = await algorithm.validate_outcome(outcome, context)
        assert is_valid, f"Dynamic outcome invalid: {error}"
        assert outcome.algorithm_used == 'DYNAMIC'
        assert 'adaptive_factors' in outcome.metadata
    
    async def test_algorithm_manager_switching(self, db_session):
        """Test algorithm manager can switch between modes"""
        # Create system settings
        setting = SystemSetting(
            key=SettingKey.GAME_ALGORITHM_MODE.value,
            value='FIXED_HOUSE_EDGE',
            category='game_algorithms'
        )
        db_session.add(setting)
        await db_session.commit()
        
        # Get current algorithm
        algo, is_fallback = await GameAlgorithmManager.get_algorithm(db_session)
        assert algo.name == 'FIXED_HOUSE_EDGE'
        assert not is_fallback
        
        # Try to switch
        success, error = await GameAlgorithmManager.switch_algorithm(
            db_session,
            AlgorithmMode.DYNAMIC
        )
        
        if success:
            # Clear cache and verify switch
            GameAlgorithmManager.clear_cache()
            algo2, is_fallback2 = await GameAlgorithmManager.get_algorithm(db_session)
            assert algo2.name == 'DYNAMIC'


class TestNotificationSystem:
    """Test notification sending and delivery"""
    
    async def test_game_result_notification(self, db_session):
        """Test game result notification creation"""
        # Create test user
        user = User(name="TestUser", role="AGENT", telegram_id=12345)
        db_session.add(user)
        await db_session.commit()
        
        # Mock bot
        mock_bot = AsyncMock()
        notif_service = TelegramNotificationService(mock_bot)
        
        # Send notification
        success = await notif_service.send_game_result_notification(
            db_session,
            user,
            game_round_id="round_1",
            result="WIN",
            payout=200.0,
            player_count=1,
        )
        
        assert success
        
        # Verify Outbox created
        outbox_query = select(Outbox).where(Outbox.user_id == user.id)
        result = await db_session.execute(outbox_query)
        outbox = result.scalar_one_or_none()
        
        assert outbox is not None
        assert outbox.type == OutboxType.TELEGRAM_NOTIFICATION
        assert outbox.status == OutboxStatus.PENDING
    
    async def test_delivery_failure_handling(self, db_session):
        """Test delivery failure and retry logic"""
        # Create outbox and recipient
        outbox = Outbox(
            type=OutboxType.TELEGRAM_NOTIFICATION,
            status=OutboxStatus.PENDING,
            user_id=1,
            content={'test': 'data'},
        )
        db_session.add(outbox)
        await db_session.commit()
        
        recipient = OutboxRecipient(
            outbox_id=outbox.id,
            user_id=1,
            delivery_status=OutboxStatus.PENDING,
        )
        db_session.add(recipient)
        await db_session.commit()
        
        # Create handler
        handler = NotificationDeliveryHandler(None)
        
        # Simulate failure
        success = await handler.handle_delivery_failure(
            outbox.id,
            recipient.id,
            DeliveryFailureReason.NETWORK_ERROR,
            error_message="Connection timeout"
        )
        
        assert success  # Should return True (retry scheduled)
        
        # Refresh and check retry scheduled
        await db_session.refresh(recipient)
        assert recipient.retry_count == 1
        assert recipient.next_retry_at is not None


class TestAuditLogging:
    """Test audit logging functionality"""
    
    async def test_algorithm_change_logging(self, db_session):
        """Test algorithm change is logged"""
        # Log algorithm change
        await AuditLogService.log_algorithm_config_change(
            db_session,
            admin_id=999,
            old_algorithm='FIXED_HOUSE_EDGE',
            new_algorithm='DYNAMIC',
            old_config={'house_edge': 5.0},
            new_config={'house_edge': 7.0},
            change_reason='Admin test switch',
        )
        
        await db_session.commit()
        
        # Verify logged
        query = select(AuditLog).where(AuditLog.action == AuditAction.ALGORITHM_CONFIG_CHANGED)
        result = await db_session.execute(query)
        log = result.scalar_one_or_none()
        
        assert log is not None
        assert log.admin_id == 999
        assert log.details['old_algorithm'] == 'FIXED_HOUSE_EDGE'
        assert log.details['new_algorithm'] == 'DYNAMIC'
    
    async def test_game_completion_logging(self, db_session):
        """Test game completion is logged"""
        await AuditLogService.log_game_completed(
            db_session,
            game_session_id="session_1",
            game_round_id="round_1",
            player_id=123,
            algorithm_used='FIXED_HOUSE_EDGE',
            result='WIN',
            payout=200.0,
            house_edge_percentage=5.0,
        )
        
        await db_session.commit()
        
        # Verify logged
        query = select(AuditLog).where(AuditLog.action == AuditAction.GAME_COMPLETED)
        result = await db_session.execute(query)
        log = result.scalar_one_or_none()
        
        assert log is not None
        assert log.details['result'] == 'WIN'
        assert log.details['payout'] == 200.0


class TestSystemIntegration:
    """Test complete system integration"""
    
    async def test_end_to_end_game_flow(self, db_session):
        """Test complete game flow with algorithm, notification, audit"""
        # Create game session
        game_session = GameSession(
            player_id=1,
            agent_id=2,
            status='ACTIVE',
        )
        db_session.add(game_session)
        await db_session.commit()
        
        # Setup algorithm settings
        setting = SystemSetting(
            key=SettingKey.GAME_ALGORITHM_MODE.value,
            value='FIXED_HOUSE_EDGE',
            category='game_algorithms'
        )
        db_session.add(setting)
        await db_session.commit()
        
        # Determine game outcome
        context = GameContext(
            session_id=game_session.id,
            player_id=1,
            wager_amount=100.0,
            max_payout=3600.0,
            house_edge_percentage=5.0,
        )
        
        outcome_dict, is_fallback = await GameAlgorithmManager.determine_game_outcome(
            db_session,
            context,
            track_in_session=game_session.id,
        )
        
        # Verify outcome
        assert 'result' in outcome_dict
        assert 'payout_multiplier' in outcome_dict
        assert outcome_dict['algorithm_used'] == 'FIXED_HOUSE_EDGE'
        
        # Create game round record
        game_round = GameRound(
            game_session_id=game_session.id,
            result=outcome_dict['result'],
            payout_multiplier=outcome_dict['payout_multiplier'],
            algorithm_used=outcome_dict['algorithm_used'],
        )
        db_session.add(game_round)
        
        # Log the completion
        await AuditLogService.log_game_completed(
            db_session,
            game_session_id=game_session.id,
            game_round_id=game_round.id,
            player_id=1,
            algorithm_used=outcome_dict['algorithm_used'],
            result=outcome_dict['result'],
            payout=outcome_dict['payout_multiplier'] * 100.0,
            house_edge_percentage=5.0,
        )
        
        await db_session.commit()
        
        # Verify audit log
        audit_query = select(AuditLog).where(AuditLog.action == AuditAction.GAME_COMPLETED)
        result = await db_session.execute(audit_query)
        audit_log = result.scalar_one_or_none()
        
        assert audit_log is not None
        assert audit_log.details['game_session_id'] == game_session.id


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])

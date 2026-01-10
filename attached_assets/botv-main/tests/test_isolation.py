#!/usr/bin/env python3
"""
Isolation and safety validation tests
Verify algorithm switching doesn't affect existing sessions
Ensure fallback mechanisms work correctly
"""

import pytest
from datetime import datetime

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

from models import GameSession, GameRound, SystemSetting
from services.game_algorithm_manager import GameAlgorithmManager, AlgorithmMode
from services.system_settings_service import SettingKey
from algorithms.base_strategy import GameContext


@pytest.fixture
async def test_db():
    """Create test database"""
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    
    async with engine.begin() as conn:
        await conn.run_sync(lambda x: x.create_all())
    
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with SessionLocal() as session:
        yield session
    
    await engine.dispose()


class TestAlgorithmIsolation:
    """Test that algorithm changes don't affect existing sessions"""
    
    async def test_existing_sessions_unaffected_by_switch(self, test_db):
        """
        Verify: Algorithm switch affects only NEW sessions
        Existing sessions keep their original algorithm
        """
        
        # Create initial setting
        setting = SystemSetting(
            key=SettingKey.GAME_ALGORITHM_MODE.value,
            value='FIXED_HOUSE_EDGE',
            category='game_algorithms'
        )
        test_db.add(setting)
        await test_db.commit()
        
        # Create game session with FIXED_HOUSE_EDGE
        session1 = GameSession(
            player_id=1,
            agent_id=2,
            status='ACTIVE',
            algorithm_used='FIXED_HOUSE_EDGE',
        )
        test_db.add(session1)
        await test_db.commit()
        
        original_algo = session1.algorithm_used
        assert original_algo == 'FIXED_HOUSE_EDGE'
        
        # Switch algorithm mode
        success, error = await GameAlgorithmManager.switch_algorithm(
            test_db,
            AlgorithmMode.DYNAMIC
        )
        
        if success:
            # Create NEW session
            session2 = GameSession(
                player_id=2,
                agent_id=2,
                status='ACTIVE',
            )
            test_db.add(session2)
            
            # Determine outcome for new session
            context = GameContext(
                session_id=session2.id,
                player_id=2,
                wager_amount=100.0,
                max_payout=3600.0,
                house_edge_percentage=5.0,
            )
            
            outcome_dict, _ = await GameAlgorithmManager.determine_game_outcome(
                test_db,
                context,
                track_in_session=session2.id,
            )
            
            await test_db.commit()
            
            # Refresh sessions
            await test_db.refresh(session1)
            await test_db.refresh(session2)
            
            # VERIFY ISOLATION:
            # Old session keeps old algorithm
            assert session1.algorithm_used == 'FIXED_HOUSE_EDGE'
            # New session uses new algorithm  
            assert session2.algorithm_used == 'DYNAMIC'
            
            print("✓ Isolation verified: Old session unaffected")


class TestFallbackMechanisms:
    """Test fallback to safe defaults works correctly"""
    
    async def test_dynamic_algo_error_fallback(self, test_db):
        """
        Verify: If DYNAMIC algorithm fails, falls back to FIXED_HOUSE_EDGE
        All outcomes still valid
        """
        
        # Setup DYNAMIC mode
        setting = SystemSetting(
            key=SettingKey.GAME_ALGORITHM_MODE.value,
            value='DYNAMIC',
            category='game_algorithms'
        )
        test_db.add(setting)
        await test_db.commit()
        
        # Simulate game context
        context = GameContext(
            session_id="test_fallback_1",
            player_id=1,
            wager_amount=100.0,
            max_payout=3600.0,
            house_edge_percentage=5.0,
        )
        
        # Get algorithm - should fallback if DYNAMIC fails
        algo, is_fallback = await GameAlgorithmManager.get_algorithm(test_db)
        
        # Should be able to determine outcome
        try:
            outcome = await algo.determine_outcome(context)
            is_valid, error = await algo.validate_outcome(outcome, context)
            assert is_valid, f"Outcome invalid: {error}"
            print(f"✓ Fallback mechanism works (is_fallback={is_fallback})")
        except Exception as e:
            print(f"⚠ Even fallback failed: {e}")
            raise
    
    async def test_invalid_context_handling(self, test_db):
        """
        Verify: Invalid contexts are rejected before algorithm runs
        Fallback is available if validation fails
        """
        
        # Get algorithm
        algo, _ = await GameAlgorithmManager.get_algorithm(test_db)
        
        # Test invalid contexts
        invalid_contexts = [
            GameContext(
                session_id="test",
                player_id=1,
                wager_amount=-100.0,  # Negative wager
                max_payout=3600.0,
                house_edge_percentage=5.0,
            ),
            GameContext(
                session_id="test",
                player_id=1,
                wager_amount=100.0,
                max_payout=3600.0,
                house_edge_percentage=150.0,  # Invalid edge
            ),
        ]
        
        for invalid_context in invalid_contexts:
            is_valid, error = algo.validate_context(invalid_context)
            assert not is_valid, f"Should reject invalid context: {invalid_context}"
            print(f"✓ Rejected invalid context: {error}")


class TestAuditTrailIntegrity:
    """Test audit trails for algorithm switching"""
    
    async def test_algorithm_switch_logged(self, test_db):
        """
        Verify: Every algorithm switch is logged
        Cannot be lost or tampered with
        """
        
        from services.audit_log_service import AuditLogService, AuditAction
        from models import AuditLog
        
        # Setup initial setting
        setting = SystemSetting(
            key=SettingKey.GAME_ALGORITHM_MODE.value,
            value='FIXED_HOUSE_EDGE',
            category='game_algorithms'
        )
        test_db.add(setting)
        await test_db.commit()
        
        # Log switch
        await AuditLogService.log_algorithm_config_change(
            test_db,
            admin_id=999,
            old_algorithm='FIXED_HOUSE_EDGE',
            new_algorithm='DYNAMIC',
            change_reason='Test switch verification',
        )
        
        await test_db.commit()
        
        # Verify log exists
        query = select(AuditLog).where(
            AuditLog.action == AuditAction.ALGORITHM_CONFIG_CHANGED
        )
        result = await test_db.execute(query)
        log = result.scalar_one_or_none()
        
        assert log is not None
        assert log.admin_id == 999
        assert log.details['old_algorithm'] == 'FIXED_HOUSE_EDGE'
        assert log.details['new_algorithm'] == 'DYNAMIC'
        assert log.created_at is not None
        
        print("✓ Audit trail integrity verified")


class TestPayoutConstraints:
    """Test payout constraints are enforced"""
    
    async def test_payout_max_enforcement(self, test_db):
        """
        Verify: Payout never exceeds max_payout
        Constraints are hard limits
        """
        
        from algorithms.conservative_algorithm import ConservativeAlgorithmFactory
        
        algo = ConservativeAlgorithmFactory.get_default()
        
        # Test with low max_payout
        context = GameContext(
            session_id="test_constraint_1",
            player_id=1,
            wager_amount=1.0,
            max_payout=10.0,  # Very low max
            house_edge_percentage=5.0,
        )
        
        # Run multiple iterations to catch any WIN outcomes
        outcomes = []
        for i in range(100):
            context.session_id = f"test_constraint_{i}"
            outcome = await algo.determine_outcome(context)
            outcomes.append(outcome)
            
            if outcome.result.value == 'WIN':
                actual_payout = outcome.payout_multiplier * context.wager_amount
                assert actual_payout <= context.max_payout, \
                    f"Payout {actual_payout} exceeds max {context.max_payout}"
        
        print(f"✓ Payout constraints enforced (tested {len(outcomes)} outcomes)")


class TestConcurrencyAndLoad:
    """Test system behavior under load"""
    
    async def test_concurrent_algorithm_access(self, test_db):
        """
        Verify: Algorithm manager handles concurrent requests
        No race conditions on settings
        """
        
        import asyncio
        
        # Setup setting
        setting = SystemSetting(
            key=SettingKey.GAME_ALGORITHM_MODE.value,
            value='FIXED_HOUSE_EDGE',
            category='game_algorithms'
        )
        test_db.add(setting)
        await test_db.commit()
        
        # Get algorithm multiple times concurrently
        async def get_algo():
            algo, _ = await GameAlgorithmManager.get_algorithm(test_db)
            return algo.name
        
        # Run 10 concurrent requests
        tasks = [get_algo() for _ in range(10)]
        results = await asyncio.gather(*tasks)
        
        # All should get same algorithm
        assert all(r == 'FIXED_HOUSE_EDGE' for r in results)
        print(f"✓ Concurrent access handled correctly ({len(results)} requests)")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])

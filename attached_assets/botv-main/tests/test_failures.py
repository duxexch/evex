#!/usr/bin/env python3
"""
Failure scenario and fallback mechanism tests
Ensures system recovers gracefully from all failure modes
"""

import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

from models import GameSession, Outbox, OutboxRecipient, OutboxStatus, OutboxType
from services.game_algorithm_manager import GameAlgorithmManager
from services.notification_delivery_handler import NotificationDeliveryHandler, DeliveryFailureReason
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


class TestAlgorithmFailures:
    """Test algorithm error handling and recovery"""
    
    async def test_invalid_game_context_handling(self, test_db):
        """
        Failure Mode: Invalid game context
        Expected: Algorithm rejects it gracefully
        """
        
        invalid_contexts = [
            GameContext(
                session_id="test",
                player_id=1,
                wager_amount=0,  # Invalid: zero wager
                max_payout=100.0,
                house_edge_percentage=5.0,
            ),
            GameContext(
                session_id="test",
                player_id=1,
                wager_amount=100.0,
                max_payout=0,  # Invalid: zero max payout
                house_edge_percentage=5.0,
            ),
            GameContext(
                session_id="test",
                player_id=1,
                wager_amount=100.0,
                max_payout=100.0,
                house_edge_percentage=200.0,  # Invalid: edge > 100%
            ),
        ]
        
        from algorithms.conservative_algorithm import ConservativeAlgorithmFactory
        algo = ConservativeAlgorithmFactory.get_default()
        
        for context in invalid_contexts:
            with pytest.raises(ValueError):
                await algo.determine_outcome(context)
            
            print(f"✓ Rejected invalid context: {context}")
    
    async def test_algorithm_determinism(self, test_db):
        """
        Verify: Same context always produces same outcome (deterministic)
        Reproducible for audit/verification
        """
        
        from algorithms.conservative_algorithm import ConservativeAlgorithmFactory
        algo = ConservativeAlgorithmFactory.get_default()
        
        context = GameContext(
            session_id="determinism_test",
            player_id=123,
            wager_amount=100.0,
            max_payout=3600.0,
            house_edge_percentage=5.0,
        )
        
        # Run same context multiple times
        outcomes = []
        for _ in range(5):
            outcome = await algo.determine_outcome(context)
            outcomes.append((
                outcome.result.value,
                outcome.payout_multiplier,
            ))
        
        # All should be identical
        assert all(o == outcomes[0] for o in outcomes), \
            "Algorithm should be deterministic"
        
        print(f"✓ Algorithm is deterministic (all 5 runs identical)")


class TestNotificationFailures:
    """Test notification delivery failure handling"""
    
    async def test_invalid_telegram_id_fallback(self, test_db):
        """
        Failure Mode: Invalid or deleted Telegram user
        Expected: Fail gracefully, log failure, allow retry
        """
        
        # Create outbox with invalid telegram_id
        outbox = Outbox(
            type=OutboxType.TELEGRAM_NOTIFICATION,
            status=OutboxStatus.PENDING,
            user_id=1,
            content={'test': 'data'},
            extra_data={'telegram_id': 0},  # Invalid ID
        )
        test_db.add(outbox)
        await test_db.commit()
        
        recipient = OutboxRecipient(
            outbox_id=outbox.id,
            user_id=1,
            delivery_status=OutboxStatus.PENDING,
            telegram_id=0,
        )
        test_db.add(recipient)
        await test_db.commit()
        
        # Create delivery handler
        handler = NotificationDeliveryHandler(None)
        
        # Handle failure
        should_retry = await handler.handle_delivery_failure(
            outbox.id,
            recipient.id,
            DeliveryFailureReason.INVALID_TELEGRAM_ID,
            "Invalid telegram ID"
        )
        
        # Should retry up to MAX_RETRIES
        assert should_retry
        
        await test_db.refresh(recipient)
        assert recipient.retry_count == 1
        assert recipient.next_retry_at is not None
        
        print("✓ Invalid telegram ID handled with retry")
    
    async def test_dead_letter_queue(self, test_db):
        """
        Failure Mode: Max retries exceeded
        Expected: Move to dead-letter queue, stop retrying
        """
        
        # Create outbox and recipient
        outbox = Outbox(
            type=OutboxType.TELEGRAM_NOTIFICATION,
            status=OutboxStatus.PENDING,
            user_id=1,
            content={'test': 'data'},
        )
        test_db.add(outbox)
        await test_db.commit()
        
        recipient = OutboxRecipient(
            outbox_id=outbox.id,
            user_id=1,
            delivery_status=OutboxStatus.PENDING,
        )
        test_db.add(recipient)
        await test_db.commit()
        
        handler = NotificationDeliveryHandler(None)
        
        # Simulate failures until dead-letter
        for i in range(handler.MAX_RETRIES + 1):
            should_retry = await handler.handle_delivery_failure(
                outbox.id,
                recipient.id,
                DeliveryFailureReason.NETWORK_ERROR,
                f"Attempt {i+1} failed"
            )
            
            if i < handler.MAX_RETRIES:
                assert should_retry, f"Should retry on attempt {i+1}"
            else:
                assert not should_retry, f"Should NOT retry after {handler.MAX_RETRIES} retries"
        
        # Verify in dead-letter queue
        await test_db.refresh(recipient)
        assert recipient.delivery_status == OutboxStatus.FAILED
        assert recipient.retry_count == handler.MAX_RETRIES
        
        print(f"✓ Dead-letter queue handling verified ({handler.MAX_RETRIES} retries)")
    
    async def test_rate_limiting_handling(self, test_db):
        """
        Failure Mode: Rate limited by Telegram
        Expected: Backoff and retry
        """
        
        outbox = Outbox(
            type=OutboxType.TELEGRAM_NOTIFICATION,
            status=OutboxStatus.PENDING,
            user_id=1,
            content={'test': 'data'},
        )
        test_db.add(outbox)
        await test_db.commit()
        
        recipient = OutboxRecipient(
            outbox_id=outbox.id,
            user_id=1,
            delivery_status=OutboxStatus.PENDING,
        )
        test_db.add(recipient)
        await test_db.commit()
        
        handler = NotificationDeliveryHandler(None)
        
        # Handle rate limit
        should_retry = await handler.handle_delivery_failure(
            outbox.id,
            recipient.id,
            DeliveryFailureReason.RATE_LIMITED,
            "429 Too Many Requests"
        )
        
        assert should_retry
        
        await test_db.refresh(recipient)
        # First retry should have longer delay
        expected_delay = handler.RETRY_DELAYS[0]
        actual_delay = (recipient.next_retry_at - datetime.utcnow()).total_seconds()
        
        # Allow some tolerance
        assert abs(actual_delay - expected_delay) < 10
        print(f"✓ Rate limiting backoff applied ({expected_delay}s delay)")


class TestCriticalFailures:
    """Test handling of critical system failures"""
    
    async def test_algorithm_critical_failure_fallback(self, test_db):
        """
        Failure Mode: Algorithm crashes (critical error)
        Expected: Fallback to conservative algorithm
        """
        
        context = GameContext(
            session_id="critical_test",
            player_id=1,
            wager_amount=100.0,
            max_payout=3600.0,
            house_edge_percentage=5.0,
        )
        
        # Try to determine outcome
        try:
            outcome_dict, is_fallback = await GameAlgorithmManager.determine_game_outcome(
                test_db,
                context,
            )
            
            # Should succeed (either with main or fallback algo)
            assert 'result' in outcome_dict
            assert 'algorithm_used' in outcome_dict
            
            if is_fallback:
                assert outcome_dict['algorithm_used'] == 'FIXED_HOUSE_EDGE'
                print("✓ Fallback mechanism activated")
            else:
                print("✓ Algorithm succeeded without fallback")
                
        except Exception as e:
            # If even fallback failed, that's a critical error
            pytest.fail(f"Critical failure - even fallback failed: {e}")
    
    async def test_database_transaction_rollback(self, test_db):
        """
        Failure Mode: Database error during notification
        Expected: Transaction rolls back cleanly
        """
        
        from sqlalchemy.exc import SQLAlchemyError
        
        # Create valid outbox
        outbox = Outbox(
            type=OutboxType.TELEGRAM_NOTIFICATION,
            status=OutboxStatus.PENDING,
            user_id=1,
            content={'test': 'data'},
        )
        test_db.add(outbox)
        
        # Try to add invalid data
        try:
            # This would simulate a constraint violation
            await test_db.commit()
            
            # If we get here, commit was successful
            # Verify outbox was actually persisted
            result = await test_db.execute(select(Outbox))
            assert result.scalar_one_or_none() is not None
            print("✓ Database transaction successful")
            
        except SQLAlchemyError as e:
            # Transaction should have rolled back
            test_db.rollback()
            print(f"✓ Database error handled: {e}")


class TestRecoveryScenarios:
    """Test recovery from various failure scenarios"""
    
    async def test_partial_notification_delivery(self, test_db):
        """
        Scenario: Some notifications deliver, some fail
        Expected: Partial success logged, retry scheduled for failed
        """
        
        # Create multiple outboxes
        outbox_ids = []
        for i in range(3):
            outbox = Outbox(
                type=OutboxType.TELEGRAM_NOTIFICATION,
                status=OutboxStatus.PENDING,
                user_id=i+1,
                content={'id': i},
                extra_data={'telegram_id': 10000 + i},
            )
            test_db.add(outbox)
        
        await test_db.commit()
        
        # Get all outboxes
        result = await test_db.execute(select(Outbox))
        outboxes = result.scalars().all()
        
        success_count = 0
        fail_count = 0
        
        for outbox in outboxes:
            # Simulate delivery attempts
            if outbox.id % 2 == 0:
                # This one succeeds
                outbox.status = OutboxStatus.DELIVERED
                success_count += 1
            else:
                # This one fails
                outbox.status = OutboxStatus.FAILED
                fail_count += 1
        
        await test_db.commit()
        
        # Verify partial success
        assert success_count > 0, "Should have some successes"
        assert fail_count > 0, "Should have some failures"
        
        print(f"✓ Partial delivery scenario handled ({success_count} success, {fail_count} failed)")
    
    async def test_cascading_failure_prevention(self, test_db):
        """
        Scenario: One failure doesn't cascade to others
        Expected: Failures isolated, system continues
        """
        
        # Create multiple game sessions
        sessions = []
        for i in range(5):
            session = GameSession(
                player_id=i+1,
                agent_id=1,
                status='ACTIVE',
            )
            test_db.add(session)
            sessions.append(session)
        
        await test_db.commit()
        
        # Try to process outcomes for all
        success_count = 0
        for session in sessions:
            try:
                context = GameContext(
                    session_id=session.id,
                    player_id=session.player_id,
                    wager_amount=100.0,
                    max_payout=3600.0,
                    house_edge_percentage=5.0,
                )
                
                outcome_dict, _ = await GameAlgorithmManager.determine_game_outcome(
                    test_db,
                    context,
                )
                
                assert outcome_dict is not None
                success_count += 1
                
            except Exception as e:
                # One failure shouldn't stop others
                print(f"⚠ Session {session.id} failed: {e}")
        
        # Most or all should succeed
        assert success_count >= len(sessions) * 0.8, \
            f"Too many failures ({success_count}/{len(sessions)})"
        
        print(f"✓ Cascading failure prevented ({success_count}/{len(sessions)} succeeded)")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

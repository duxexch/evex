#!/usr/bin/env python3
"""
Notification delivery failure handling and retry logic
Ensures reliable notification delivery with fallback mechanisms
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update

from models import Outbox, OutboxRecipient, OutboxStatus, AuditLog


class DeliveryFailureReason(str, Enum):
    """Reasons for delivery failure"""
    INVALID_TELEGRAM_ID = "INVALID_TELEGRAM_ID"
    BOT_BLOCKED = "BOT_BLOCKED"
    USER_DELETED = "USER_DELETED"
    RATE_LIMITED = "RATE_LIMITED"
    NETWORK_ERROR = "NETWORK_ERROR"
    TIMEOUT = "TIMEOUT"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


class NotificationDeliveryHandler:
    """Handles delivery failures and retries for notifications"""
    
    # Retry configuration
    MAX_RETRIES = 3
    RETRY_DELAYS = [5 * 60, 30 * 60, 2 * 60 * 60]  # 5min, 30min, 2hours
    DEAD_LETTER_QUEUE_EXPIRY = 7 * 24 * 60 * 60  # 7 days
    
    def __init__(self, session_maker):
        """Initialize with session maker"""
        self.session_maker = session_maker
    
    async def handle_delivery_failure(
        self,
        outbox_id: str,
        recipient_id: str,
        reason: DeliveryFailureReason,
        error_message: str = "",
    ) -> bool:
        """
        Handle notification delivery failure with retry logic
        
        Args:
            outbox_id: Outbox record ID
            recipient_id: OutboxRecipient record ID
            reason: Reason for failure
            error_message: Detailed error message
            
        Returns:
            True if message will be retried, False if dead-lettered
        """
        
        async with self.session_maker() as session:
            try:
                # Get recipient
                recipient = await session.get(OutboxRecipient, recipient_id)
                if not recipient:
                    return False
                
                # Increment retry count
                recipient.retry_count = (recipient.retry_count or 0) + 1
                recipient.last_error = error_message
                recipient.last_error_reason = reason.value
                
                # Check if should retry
                if recipient.retry_count <= self.MAX_RETRIES:
                    # Schedule retry
                    retry_delay = self.RETRY_DELAYS[min(
                        recipient.retry_count - 1,
                        len(self.RETRY_DELAYS) - 1
                    )]
                    
                    recipient.delivery_status = OutboxStatus.PENDING
                    recipient.next_retry_at = datetime.utcnow() + timedelta(seconds=retry_delay)
                    
                    # Log retry
                    await self._log_delivery_retry(
                        session,
                        outbox_id,
                        recipient_id,
                        recipient.retry_count,
                        retry_delay,
                        error_message
                    )
                    
                    await session.commit()
                    return True
                else:
                    # Dead-letter: move to failed queue
                    recipient.delivery_status = OutboxStatus.FAILED
                    recipient.delivery_completed_at = datetime.utcnow()
                    
                    # Log dead-letter
                    await self._log_dead_letter(
                        session,
                        outbox_id,
                        recipient_id,
                        reason,
                        error_message
                    )
                    
                    # Update parent Outbox if all recipients failed
                    await self._update_outbox_status(session, outbox_id)
                    
                    await session.commit()
                    return False
                    
            except Exception as e:
                print(f"Error handling delivery failure: {e}")
                return False
    
    async def process_scheduled_retries(self, max_per_batch: int = 20) -> Dict[str, int]:
        """
        Process notifications scheduled for retry
        
        Args:
            max_per_batch: Max retries to process
            
        Returns:
            Statistics dictionary
        """
        
        stats = {
            'processed': 0,
            'ready_for_retry': 0,
            'still_waiting': 0,
            'errors': 0,
        }
        
        async with self.session_maker() as session:
            try:
                # Find recipients ready for retry
                now = datetime.utcnow()
                retry_query = (
                    select(OutboxRecipient)
                    .where(
                        and_(
                            OutboxRecipient.delivery_status == OutboxStatus.PENDING,
                            OutboxRecipient.retry_count > 0,
                            OutboxRecipient.next_retry_at <= now
                        )
                    )
                    .limit(max_per_batch)
                )
                
                result = await session.execute(retry_query)
                recipients_to_retry = result.scalars().all()
                
                stats['ready_for_retry'] = len(recipients_to_retry)
                
                for recipient in recipients_to_retry:
                    # Return to PENDING for retry
                    recipient.delivery_status = OutboxStatus.PENDING
                    recipient.next_retry_at = None
                    
                    stats['processed'] += 1
                
                await session.commit()
                
            except Exception as e:
                print(f"Error processing retries: {e}")
                stats['errors'] += 1
        
        return stats
    
    async def cleanup_dead_letter_queue(self) -> Dict[str, int]:
        """
        Clean up expired messages in dead-letter queue
        
        Returns:
            Statistics dictionary
        """
        
        stats = {
            'cleaned': 0,
            'errors': 0,
        }
        
        async with self.session_maker() as session:
            try:
                # Find expired failed messages
                cutoff_time = datetime.utcnow() - timedelta(
                    seconds=self.DEAD_LETTER_QUEUE_EXPIRY
                )
                
                # Find Outboxes to delete
                failed_query = (
                    select(Outbox)
                    .where(
                        and_(
                            Outbox.status == OutboxStatus.FAILED,
                            Outbox.created_at < cutoff_time
                        )
                    )
                )
                
                result = await session.execute(failed_query)
                failed_outboxes = result.scalars().all()
                
                for outbox in failed_outboxes:
                    # Delete associated recipients
                    delete_recipients = (
                        update(OutboxRecipient)
                        .where(OutboxRecipient.outbox_id == outbox.id)
                        .values(deleted_at=datetime.utcnow())
                    )
                    await session.execute(delete_recipients)
                    
                    # Mark outbox as cleaned
                    outbox.deleted_at = datetime.utcnow()
                    stats['cleaned'] += 1
                
                await session.commit()
                
            except Exception as e:
                print(f"Error cleaning dead-letter queue: {e}")
                stats['errors'] += 1
        
        return stats
    
    async def get_delivery_status(self, outbox_id: str) -> Dict:
        """
        Get detailed delivery status of notification
        
        Args:
            outbox_id: Outbox record ID
            
        Returns:
            Delivery status dictionary
        """
        
        async with self.session_maker() as session:
            # Get outbox
            outbox = await session.get(Outbox, outbox_id)
            if not outbox:
                return {'error': 'Not found'}
            
            # Get recipients
            recipients_query = select(OutboxRecipient).where(
                OutboxRecipient.outbox_id == outbox_id
            )
            result = await session.execute(recipients_query)
            recipients = result.scalars().all()
            
            status = {
                'outbox_id': outbox_id,
                'status': outbox.status.value,
                'created_at': outbox.created_at.isoformat(),
                'total_recipients': len(recipients),
                'recipients': []
            }
            
            for recipient in recipients:
                recipient_status = {
                    'user_id': recipient.user_id,
                    'delivery_status': recipient.delivery_status.value,
                    'retry_count': recipient.retry_count or 0,
                    'last_error_reason': recipient.last_error_reason,
                }
                if recipient.next_retry_at:
                    recipient_status['next_retry'] = recipient.next_retry_at.isoformat()
                status['recipients'].append(recipient_status)
            
            return status
    
    async def _log_delivery_retry(
        self,
        session: AsyncSession,
        outbox_id: str,
        recipient_id: str,
        retry_count: int,
        retry_delay: int,
        error_message: str,
    ):
        """Log delivery retry attempt"""
        
        try:
            log = AuditLog(
                action='NOTIFICATION_RETRY',
                admin_id=None,
                details={
                    'outbox_id': outbox_id,
                    'recipient_id': recipient_id,
                    'retry_count': retry_count,
                    'retry_delay_seconds': retry_delay,
                    'error_message': error_message,
                }
            )
            session.add(log)
        except Exception as e:
            print(f"Error logging retry: {e}")
    
    async def _log_dead_letter(
        self,
        session: AsyncSession,
        outbox_id: str,
        recipient_id: str,
        reason: DeliveryFailureReason,
        error_message: str,
    ):
        """Log message moved to dead-letter queue"""
        
        try:
            log = AuditLog(
                action='NOTIFICATION_DEAD_LETTER',
                admin_id=None,
                details={
                    'outbox_id': outbox_id,
                    'recipient_id': recipient_id,
                    'failure_reason': reason.value,
                    'error_message': error_message,
                }
            )
            session.add(log)
        except Exception as e:
            print(f"Error logging dead-letter: {e}")
    
    async def _update_outbox_status(self, session: AsyncSession, outbox_id: str):
        """
        Update parent Outbox status based on recipient statuses
        """
        
        try:
            recipients_query = select(OutboxRecipient).where(
                OutboxRecipient.outbox_id == outbox_id
            )
            result = await session.execute(recipients_query)
            recipients = result.scalars().all()
            
            if not recipients:
                return
            
            # Check if all failed
            all_failed = all(
                r.delivery_status == OutboxStatus.FAILED
                for r in recipients
            )
            
            if all_failed:
                outbox = await session.get(Outbox, outbox_id)
                if outbox:
                    outbox.status = OutboxStatus.FAILED
                    outbox.delivered_at = datetime.utcnow()
            
        except Exception as e:
            print(f"Error updating outbox status: {e}")

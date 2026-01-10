#!/usr/bin/env python3
"""
Telegram notification service for agents
Handles push notifications for game events and algorithm changes
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
import asyncio
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models import User, Outbox, OutboxType, OutboxStatus, OutboxRecipient


class NotificationType(str, Enum):
    """Types of notifications that can be sent"""
    GAME_STARTED = "GAME_STARTED"
    GAME_RESULT = "GAME_RESULT"
    COMMISSION_EARNED = "COMMISSION_EARNED"
    ALGORITHM_CHANGE = "ALGORITHM_CHANGE"
    SYSTEM_ALERT = "SYSTEM_ALERT"
    BONUS_CREDITED = "BONUS_CREDITED"


class TelegramNotificationService:
    """Service for sending notifications via Telegram"""
    
    def __init__(self, bot):
        """Initialize with bot instance"""
        self.bot = bot
        self.rate_limit = 30  # Max notifications per agent per minute
    
    async def send_game_result_notification(
        self,
        session: AsyncSession,
        agent_user: User,
        game_round_id: str,
        result: str,
        payout: float,
        player_count: int = 1,
    ) -> bool:
        """
        Send game result notification to agent
        
        Args:
            session: Database session
            agent_user: User object for agent
            game_round_id: ID of completed game round
            result: Result (WIN/LOSS/DRAW)
            payout: Payout amount
            player_count: Number of players in round
            
        Returns:
            True if notification was queued
        """
        
        try:
            if not agent_user.telegram_id:
                return False
            
            # Create Outbox record for notification
            outbox = Outbox(
                type=OutboxType.TELEGRAM_NOTIFICATION,
                status=OutboxStatus.PENDING,
                user_id=agent_user.id,
                content={
                    'notification_type': NotificationType.GAME_RESULT,
                    'game_round_id': game_round_id,
                    'result': result,
                    'payout': payout,
                    'player_count': player_count,
                    'timestamp': datetime.utcnow().isoformat(),
                },
                priority=1,  # Normal priority
                extra_data={
                    'telegram_id': agent_user.telegram_id,
                    'notification_type': 'game_result',
                }
            )
            
            session.add(outbox)
            await session.flush()
            
            # Create recipient record
            recipient = OutboxRecipient(
                outbox_id=outbox.id,
                user_id=agent_user.id,
                delivery_status=OutboxStatus.PENDING,
                telegram_id=agent_user.telegram_id,
            )
            session.add(recipient)
            
            return True
            
        except Exception as e:
            print(f"Error queueing game result notification: {e}")
            return False
    
    async def send_commission_notification(
        self,
        session: AsyncSession,
        agent_user: User,
        amount: float,
        source: str = "player_losses",
        sub_agents: int = 0,
    ) -> bool:
        """
        Send commission earned notification to agent
        
        Args:
            session: Database session
            agent_user: User object for agent
            amount: Commission amount
            source: Source of commission
            sub_agents: Number of sub-agents if applicable
            
        Returns:
            True if notification was queued
        """
        
        try:
            if not agent_user.telegram_id:
                return False
            
            outbox = Outbox(
                type=OutboxType.TELEGRAM_NOTIFICATION,
                status=OutboxStatus.PENDING,
                user_id=agent_user.id,
                content={
                    'notification_type': NotificationType.COMMISSION_EARNED,
                    'amount': amount,
                    'source': source,
                    'sub_agents': sub_agents,
                    'timestamp': datetime.utcnow().isoformat(),
                },
                priority=2,  # High priority
                extra_data={
                    'telegram_id': agent_user.telegram_id,
                    'notification_type': 'commission',
                }
            )
            
            session.add(outbox)
            await session.flush()
            
            recipient = OutboxRecipient(
                outbox_id=outbox.id,
                user_id=agent_user.id,
                delivery_status=OutboxStatus.PENDING,
                telegram_id=agent_user.telegram_id,
            )
            session.add(recipient)
            
            return True
            
        except Exception as e:
            print(f"Error queueing commission notification: {e}")
            return False
    
    async def send_algorithm_change_notification(
        self,
        session: AsyncSession,
        agent_ids: List[int],
        old_algorithm: str,
        new_algorithm: str,
    ) -> int:
        """
        Broadcast algorithm change notification to all agents
        
        Args:
            session: Database session
            agent_ids: List of agent user IDs
            old_algorithm: Previous algorithm name
            new_algorithm: New algorithm name
            
        Returns:
            Number of notifications queued
        """
        
        count = 0
        try:
            # Get all agents
            agents_query = select(User).where(User.id.in_(agent_ids))
            result = await session.execute(agents_query)
            agents = result.scalars().all()
            
            for agent in agents:
                if not agent.telegram_id:
                    continue
                
                outbox = Outbox(
                    type=OutboxType.TELEGRAM_NOTIFICATION,
                    status=OutboxStatus.PENDING,
                    user_id=agent.id,
                    content={
                        'notification_type': NotificationType.ALGORITHM_CHANGE,
                        'old_algorithm': old_algorithm,
                        'new_algorithm': new_algorithm,
                        'timestamp': datetime.utcnow().isoformat(),
                    },
                    priority=2,  # High priority
                    extra_data={
                        'telegram_id': agent.telegram_id,
                        'notification_type': 'algorithm_change',
                        'broadcast': True,
                    }
                )
                
                session.add(outbox)
                await session.flush()
                
                recipient = OutboxRecipient(
                    outbox_id=outbox.id,
                    user_id=agent.id,
                    delivery_status=OutboxStatus.PENDING,
                    telegram_id=agent.telegram_id,
                )
                session.add(recipient)
                count += 1
            
            return count
            
        except Exception as e:
            print(f"Error broadcasting algorithm change: {e}")
            return count
    
    async def process_pending_notifications(
        self,
        session: AsyncSession,
        max_per_batch: int = 10
    ) -> Dict[str, int]:
        """
        Process pending notifications from Outbox
        
        Args:
            session: Database session
            max_per_batch: Maximum notifications to process per batch
            
        Returns:
            Dictionary with delivery statistics
        """
        
        stats = {
            'processed': 0,
            'delivered': 0,
            'failed': 0,
            'rate_limited': 0,
        }
        
        try:
            # Get pending notifications
            pending_query = (
                select(Outbox)
                .where(Outbox.type == OutboxType.TELEGRAM_NOTIFICATION)
                .where(Outbox.status == OutboxStatus.PENDING)
                .limit(max_per_batch)
            )
            result = await session.execute(pending_query)
            pending = result.scalars().all()
            
            for outbox in pending:
                try:
                    telegram_id = outbox.extra_data.get('telegram_id')
                    if not telegram_id:
                        continue
                    
                    # Format notification message
                    message = await self._format_notification(outbox)
                    
                    # Send via Telegram
                    success = await self._send_telegram_message(
                        telegram_id,
                        message
                    )
                    
                    if success:
                        # Update status
                        outbox.status = OutboxStatus.DELIVERED
                        outbox.delivered_at = datetime.utcnow()
                        stats['delivered'] += 1
                        
                        # Update recipient
                        recipient_query = select(OutboxRecipient).where(
                            OutboxRecipient.outbox_id == outbox.id
                        )
                        recipient_result = await session.execute(recipient_query)
                        recipient = recipient_result.scalar_one_or_none()
                        if recipient:
                            recipient.delivery_status = OutboxStatus.DELIVERED
                            recipient.delivered_at = datetime.utcnow()
                    else:
                        outbox.status = OutboxStatus.FAILED
                        stats['failed'] += 1
                    
                    stats['processed'] += 1
                    
                except Exception as e:
                    print(f"Error sending notification {outbox.id}: {e}")
                    outbox.status = OutboxStatus.FAILED
                    stats['failed'] += 1
                    stats['processed'] += 1
            
            await session.commit()
            
        except Exception as e:
            print(f"Error processing notifications: {e}")
        
        return stats
    
    async def _format_notification(self, outbox: Outbox) -> str:
        """
        Format Outbox content into Telegram message
        
        Args:
            outbox: Outbox record
            
        Returns:
            Formatted message string
        """
        
        content = outbox.content or {}
        notif_type = content.get('notification_type')
        
        if notif_type == NotificationType.GAME_RESULT:
            result = content.get('result', 'UNKNOWN')
            payout = content.get('payout', 0)
            emoji = '🎉' if result == 'WIN' else '❌'
            return (
                f"{emoji} *Game Result*\n"
                f"Result: `{result}`\n"
                f"Payout: `{payout}`"
            )
        
        elif notif_type == NotificationType.COMMISSION_EARNED:
            amount = content.get('amount', 0)
            source = content.get('source', 'unknown')
            return (
                f"💰 *Commission Earned*\n"
                f"Amount: `{amount}`\n"
                f"Source: `{source}`"
            )
        
        elif notif_type == NotificationType.ALGORITHM_CHANGE:
            old = content.get('old_algorithm', '?')
            new = content.get('new_algorithm', '?')
            return (
                f"⚙️ *Algorithm Changed*\n"
                f"Old: `{old}`\n"
                f"New: `{new}`"
            )
        
        elif notif_type == NotificationType.SYSTEM_ALERT:
            alert = content.get('alert_text', 'System alert')
            return f"⚠️ *System Alert*\n{alert}"
        
        else:
            return "📬 New notification"
    
    async def _send_telegram_message(self, telegram_id: int, message: str) -> bool:
        """
        Send message via Telegram bot
        
        Args:
            telegram_id: Telegram user ID
            message: Message text
            
        Returns:
            True if successful
        """
        
        try:
            await self.bot.send_message(
                chat_id=telegram_id,
                text=message,
                parse_mode='Markdown'
            )
            return True
        except Exception as e:
            print(f"Error sending Telegram message to {telegram_id}: {e}")
            return False

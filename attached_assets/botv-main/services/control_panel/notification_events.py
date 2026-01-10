"""
Event handlers for automatic notification triggers.

This module integrates the notification system with critical business events:
- Agent commission state changes (approval, payment, rejection)
- Affiliate payout state changes (approval, payment, rejection)
- Transaction alerts
- System events
"""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from models import (
    Commission, CommissionState,
    AffiliatePayout, AffiliatePayoutStatus,
    Transaction,
    NotificationPriority, NotificationType
)
from services.control_panel.notification_service import NotificationService


class NotificationEventHandler:
    """
    Handles automatic notification creation for critical business events.
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.notification_service = NotificationService(session)
    
    async def on_commission_approved(
        self,
        commission: Commission,
        approver_id: Optional[int] = None
    ) -> None:
        """
        Triggered when agent commission is approved.
        
        Args:
            commission: The approved commission
            approver_id: ID of the admin who approved
        """
        await self.notification_service.create_and_broadcast(
            user_id=commission.agent.user_id if commission.agent else None,
            title="تمت الموافقة على العمولة",
            body=f"تمت الموافقة على عمولة بقيمة {commission.commission_amount} {commission.currency}",
            notification_type=NotificationType.AGENT_COMMISSION_APPROVED,
            priority=NotificationPriority.HIGH,
            action_url=f"/control-panel/commissions/{commission.id}",
            actor_id=approver_id,
            idempotency_key=f"commission_approved_{commission.id}"
        )
    
    async def on_commission_paid(
        self,
        commission: Commission,
        payer_id: Optional[int] = None
    ) -> None:
        """
        Triggered when agent commission is paid.
        
        Args:
            commission: The paid commission
            payer_id: ID of the admin who processed payment
        """
        await self.notification_service.create_and_broadcast(
            user_id=commission.agent.user_id if commission.agent else None,
            title="تم دفع العمولة",
            body=f"تم دفع عمولة بقيمة {commission.commission_amount} {commission.currency} إلى حسابك",
            notification_type=NotificationType.AGENT_COMMISSION_PAID,
            priority=NotificationPriority.HIGH,
            action_url=f"/control-panel/commissions/{commission.id}",
            actor_id=payer_id,
            idempotency_key=f"commission_paid_{commission.id}"
        )
    
    async def on_commission_rejected(
        self,
        commission: Commission,
        rejector_id: Optional[int] = None,
        reason: Optional[str] = None
    ) -> None:
        """
        Triggered when agent commission is rejected.
        
        Args:
            commission: The rejected commission
            rejector_id: ID of the admin who rejected
            reason: Reason for rejection
        """
        body = f"تم رفض عمولة بقيمة {commission.commission_amount} {commission.currency}"
        if reason:
            body += f"\nالسبب: {reason}"
        
        await self.notification_service.create_and_broadcast(
            user_id=commission.agent.user_id if commission.agent else None,
            title="تم رفض العمولة",
            body=body,
            notification_type=NotificationType.AGENT_COMMISSION_REJECTED,
            priority=NotificationPriority.CRITICAL,
            action_url=f"/control-panel/commissions/{commission.id}",
            actor_id=rejector_id,
            idempotency_key=f"commission_rejected_{commission.id}"
        )
    
    async def on_affiliate_payout_approved(
        self,
        payout: AffiliatePayout,
        approver_id: Optional[int] = None
    ) -> None:
        """
        Triggered when affiliate payout is approved.
        
        Args:
            payout: The approved payout
            approver_id: ID of the admin who approved
        """
        await self.notification_service.create_and_broadcast(
            user_id=payout.affiliate.user_id if payout.affiliate else None,
            title="تمت الموافقة على طلب السحب",
            body=f"تمت الموافقة على طلب سحب بقيمة {payout.amount} {payout.currency}",
            notification_type=NotificationType.AFFILIATE_PAYOUT_APPROVED,
            priority=NotificationPriority.HIGH,
            action_url=f"/control-panel/payouts/{payout.id}",
            actor_id=approver_id,
            idempotency_key=f"payout_approved_{payout.id}"
        )
    
    async def on_affiliate_payout_paid(
        self,
        payout: AffiliatePayout,
        payer_id: Optional[int] = None
    ) -> None:
        """
        Triggered when affiliate payout is paid.
        
        Args:
            payout: The paid payout
            payer_id: ID of the admin who processed payment
        """
        await self.notification_service.create_and_broadcast(
            user_id=payout.affiliate.user_id if payout.affiliate else None,
            title="تم تحويل المبلغ",
            body=f"تم تحويل مبلغ {payout.amount} {payout.currency} إلى حسابك",
            notification_type=NotificationType.AFFILIATE_PAYOUT_PAID,
            priority=NotificationPriority.HIGH,
            action_url=f"/control-panel/payouts/{payout.id}",
            actor_id=payer_id,
            idempotency_key=f"payout_paid_{payout.id}"
        )
    
    async def on_affiliate_payout_rejected(
        self,
        payout: AffiliatePayout,
        rejector_id: Optional[int] = None,
        reason: Optional[str] = None
    ) -> None:
        """
        Triggered when affiliate payout is rejected.
        
        Args:
            payout: The rejected payout
            rejector_id: ID of the admin who rejected
            reason: Reason for rejection
        """
        body = f"تم رفض طلب سحب بقيمة {payout.amount} {payout.currency}"
        if reason:
            body += f"\nالسبب: {reason}"
        
        await self.notification_service.create_and_broadcast(
            user_id=payout.affiliate.user_id if payout.affiliate else None,
            title="تم رفض طلب السحب",
            body=body,
            notification_type=NotificationType.AFFILIATE_PAYOUT_REJECTED,
            priority=NotificationPriority.CRITICAL,
            action_url=f"/control-panel/payouts/{payout.id}",
            actor_id=rejector_id,
            idempotency_key=f"payout_rejected_{payout.id}"
        )
    
    async def on_transaction_alert(
        self,
        transaction: Transaction,
        alert_type: str,
        description: str,
        user_id: Optional[int] = None
    ) -> None:
        """
        Triggered for transaction alerts (fraud detection, large amounts, etc.)
        
        Args:
            transaction: The transaction that triggered alert
            alert_type: Type of alert (fraud, large_amount, etc.)
            description: Alert description
            user_id: Optional specific user to notify (default: all admins)
        """
        priority = NotificationPriority.CRITICAL if alert_type == "fraud" else NotificationPriority.HIGH
        
        await self.notification_service.create_and_broadcast(
            user_id=user_id,
            title=f"تنبيه معاملة: {alert_type}",
            body=description,
            notification_type=NotificationType.TRANSACTION_ALERT,
            priority=priority,
            action_url=f"/control-panel/transactions/{transaction.id}",
            idempotency_key=f"transaction_alert_{transaction.id}_{alert_type}"
        )
    
    async def on_system_alert(
        self,
        title: str,
        body: str,
        priority: NotificationPriority = NotificationPriority.HIGH,
        user_id: Optional[int] = None
    ) -> None:
        """
        Triggered for system-wide alerts.
        
        Args:
            title: Alert title
            body: Alert body
            priority: Alert priority
            user_id: Optional specific user (default: broadcast to all)
        """
        await self.notification_service.create_and_broadcast(
            user_id=user_id,
            title=title,
            body=body,
            notification_type=NotificationType.SYSTEM_ALERT,
            priority=priority
        )
    
    async def on_user_action_required(
        self,
        user_id: int,
        title: str,
        body: str,
        action_url: str,
        priority: NotificationPriority = NotificationPriority.HIGH
    ) -> None:
        """
        Triggered when user action is required.
        
        Args:
            user_id: User who needs to take action
            title: Notification title
            body: Notification body
            action_url: URL for action
            priority: Notification priority
        """
        await self.notification_service.create_and_broadcast(
            user_id=user_id,
            title=title,
            body=body,
            notification_type=NotificationType.USER_ACTION_REQUIRED,
            priority=priority,
            action_url=action_url
        )


# Usage example in commission service:
"""
# In AgentService.approve_commission():
async def approve_commission(self, commission_id: int, approver_id: int) -> Commission:
    commission = await self.get_commission_by_id(commission_id)
    commission.state = CommissionState.APPROVED
    commission.approved_at = datetime.utcnow()
    commission.approved_by_id = approver_id
    
    await self.session.commit()
    await self.session.refresh(commission)
    
    # Trigger notification
    event_handler = NotificationEventHandler(self.session)
    await event_handler.on_commission_approved(commission, approver_id)
    
    return commission


# In AffiliateService.approve_payout():
async def approve_payout(self, payout_id: int, approver_id: int) -> AffiliatePayout:
    payout = await self.get_payout_by_id(payout_id)
    payout.status = AffiliatePayoutStatus.APPROVED
    payout.approved_at = datetime.utcnow()
    payout.approved_by_id = approver_id
    
    await self.session.commit()
    await self.session.refresh(payout)
    
    # Trigger notification
    event_handler = NotificationEventHandler(self.session)
    await event_handler.on_affiliate_payout_approved(payout, approver_id)
    
    return payout
"""

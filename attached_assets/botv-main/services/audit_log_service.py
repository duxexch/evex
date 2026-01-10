#!/usr/bin/env python3
"""
AuditLog Service - Centralized audit logging for all sensitive operations
Ensures immutable, traceable records of all system changes
"""

from typing import Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from models import AuditLog


class AuditAction:
    """Standard audit action types"""
    
    # Agent Distribution Actions
    AGENT_ASSIGNED_MANUAL = "AGENT_ASSIGNED_MANUAL"
    AGENT_ASSIGNED_ROUND_ROBIN = "AGENT_ASSIGNED_ROUND_ROBIN"
    AGENT_ASSIGNED_LOAD_BASED = "AGENT_ASSIGNED_LOAD_BASED"
    AGENT_ASSIGNMENT_TIMEOUT = "AGENT_ASSIGNMENT_TIMEOUT"
    AGENT_ASSIGNMENT_FAILED = "AGENT_ASSIGNMENT_FAILED"
    
    # Distribution Mode Changes
    DISTRIBUTION_MODE_CHANGED = "DISTRIBUTION_MODE_CHANGED"
    DISTRIBUTION_MODE_SWITCH_FAILED = "DISTRIBUTION_MODE_SWITCH_FAILED"
    
    # Game Algorithm Actions
    ALGORITHM_CONFIG_CHANGED = "ALGORITHM_CONFIG_CHANGED"
    ALGORITHM_SWITCH_INITIATED = "ALGORITHM_SWITCH_INITIATED"
    ALGORITHM_SWITCH_FAILED = "ALGORITHM_SWITCH_FAILED"
    GAME_SESSION_CREATED = "GAME_SESSION_CREATED"
    GAME_ROUND_COMPLETED = "GAME_ROUND_COMPLETED"
    
    # System Settings
    SYSTEM_SETTING_CHANGED = "SYSTEM_SETTING_CHANGED"
    FEATURE_FLAG_ENABLED = "FEATURE_FLAG_ENABLED"
    FEATURE_FLAG_DISABLED = "FEATURE_FLAG_DISABLED"
    
    # Notification Actions
    AGENT_NOTIFICATION_SENT = "AGENT_NOTIFICATION_SENT"
    AGENT_NOTIFICATION_FAILED = "AGENT_NOTIFICATION_FAILED"

    # Predictive Analytics
    PREDICTIVE_INFERENCE_RUN = "PREDICTIVE_INFERENCE_RUN"


class AuditLogService:
    """Service for logging audit events"""
    
    @staticmethod
    async def log_agent_assignment(
        session: AsyncSession,
        admin_id: int,
        request_id: int,
        assigned_agent_id: int,
        strategy: str,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        """
        Log an agent assignment action
        
        Args:
            session: Database session
            admin_id: Admin ID (for MANUAL), or system ID for AUTO modes
            request_id: Outbox request ID being assigned
            assigned_agent_id: Agent ID assigned to
            strategy: Assignment strategy used
            details: Additional context
            ip_address: Request IP address
            
        Returns:
            AuditLog entry
        """
        
        # Determine action based on strategy
        if strategy == 'MANUAL':
            action = AuditAction.AGENT_ASSIGNED_MANUAL
        elif strategy == 'AUTO_ROUND_ROBIN':
            action = AuditAction.AGENT_ASSIGNED_ROUND_ROBIN
        elif strategy == 'AUTO_LOAD_BASED':
            action = AuditAction.AGENT_ASSIGNED_LOAD_BASED
        else:
            action = AuditAction.AGENT_ASSIGNED_MANUAL
        
        audit_entry = AuditLog(
            admin_id=admin_id,
            action=action,
            target_type='REQUEST',
            target_id=request_id,
            details={
                'assigned_agent_id': assigned_agent_id,
                'strategy': strategy,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                **(details or {})
            },
            ip_address=ip_address,
        )
        
        session.add(audit_entry)
        await session.flush()
        
        return audit_entry
    
    @staticmethod
    async def log_distribution_mode_change(
        session: AsyncSession,
        admin_id: int,
        old_mode: str,
        new_mode: str,
        change_reason: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        """
        Log a distribution mode switch
        
        Args:
            session: Database session
            admin_id: Admin making the change
            old_mode: Previous mode
            new_mode: New mode
            change_reason: Why the change was made
            ip_address: Admin's IP address
            
        Returns:
            AuditLog entry
        """
        
        audit_entry = AuditLog(
            admin_id=admin_id,
            action=AuditAction.DISTRIBUTION_MODE_CHANGED,
            target_type='SYSTEM_CONFIG',
            target_id=None,
            details={
                'old_mode': old_mode,
                'new_mode': new_mode,
                'change_reason': change_reason,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'affected_sessions': 0,  # Only affects NEW requests
            },
            ip_address=ip_address,
        )
        
        session.add(audit_entry)
        await session.flush()
        
        return audit_entry
    
    @staticmethod
    async def log_algorithm_config_change(
        session: AsyncSession,
        admin_id: int,
        old_algorithm: str,
        new_algorithm: str,
        old_config: Optional[Dict[str, Any]] = None,
        new_config: Optional[Dict[str, Any]] = None,
        change_reason: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        """
        Log a game algorithm configuration change
        
        Args:
            session: Database session
            admin_id: Admin making the change
            old_algorithm: Previous algorithm
            new_algorithm: New algorithm
            old_config: Previous configuration
            new_config: New configuration
            change_reason: Why the change was made
            ip_address: Admin's IP address
            
        Returns:
            AuditLog entry
        """
        
        audit_entry = AuditLog(
            admin_id=admin_id,
            action=AuditAction.ALGORITHM_CONFIG_CHANGED,
            target_type='GAME_ALGORITHM',
            target_id=None,
            details={
                'old_algorithm': old_algorithm,
                'new_algorithm': new_algorithm,
                'old_config': old_config,
                'new_config': new_config,
                'change_reason': change_reason,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'affected_sessions': 0,  # Only affects NEW sessions
            },
            ip_address=ip_address,
        )
        
        session.add(audit_entry)
        await session.flush()
        
        return audit_entry
    
    @staticmethod
    async def log_game_round_completed(
        session: AsyncSession,
        user_id: int,
        session_id: int,
        round_number: int,
        algorithm_used: str,
        result: str,
        bet_amount: float,
        payout_amount: float,
        additional_details: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        """
        Log a game round completion
        
        Args:
            session: Database session
            user_id: Player ID
            session_id: Game session ID
            round_number: Round number
            algorithm_used: Algorithm that calculated outcome
            result: WIN, LOSS, DRAW
            bet_amount: Bet amount
            payout_amount: Payout amount
            additional_details: Extra context
            
        Returns:
            AuditLog entry
        """
        
        audit_entry = AuditLog(
            admin_id=user_id,  # Log player as "admin" for game events
            action=AuditAction.GAME_ROUND_COMPLETED,
            target_type='GAME_ROUND',
            target_id=session_id,
            details={
                'round_number': round_number,
                'algorithm_used': algorithm_used,
                'result': result,
                'bet_amount': str(bet_amount),
                'payout_amount': str(payout_amount),
                'timestamp': datetime.now(timezone.utc).isoformat(),
                **(additional_details or {})
            },
            ip_address=None,  # Not applicable for game events
        )
        
        session.add(audit_entry)
        await session.flush()
        
        return audit_entry
    
    @staticmethod
    async def log_notification_sent(
        session: AsyncSession,
        admin_id: int,
        request_id: int,
        agent_id: int,
        notification_type: str,
        delivery_status: str,
        error_message: Optional[str] = None,
    ) -> AuditLog:
        """
        Log agent notification delivery
        
        Args:
            session: Database session
            admin_id: Admin system ID
            request_id: Request being notified about
            agent_id: Agent being notified
            notification_type: Type of notification
            delivery_status: SUCCESS, FAILED, TIMEOUT
            error_message: Error details if failed
            
        Returns:
            AuditLog entry
        """
        
        action = (
            AuditAction.AGENT_NOTIFICATION_SENT 
            if delivery_status == 'SUCCESS' 
            else AuditAction.AGENT_NOTIFICATION_FAILED
        )
        
        audit_entry = AuditLog(
            admin_id=admin_id,
            action=action,
            target_type='NOTIFICATION',
            target_id=request_id,
            details={
                'agent_id': agent_id,
                'notification_type': notification_type,
                'delivery_status': delivery_status,
                'error_message': error_message,
                'timestamp': datetime.now(timezone.utc).isoformat(),
            },
            ip_address=None,
        )
        
        session.add(audit_entry)
        await session.flush()
        
        return audit_entry
    
    @staticmethod
    async def log_feature_flag_change(
        session: AsyncSession,
        admin_id: int,
        flag_name: str,
        new_value: bool,
        change_reason: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        """
        Log a feature flag toggle
        
        Args:
            session: Database session
            admin_id: Admin making the change
            flag_name: Feature flag name
            new_value: New value (enabled/disabled)
            change_reason: Why the change was made
            ip_address: Admin's IP address
            
        Returns:
            AuditLog entry
        """
        
        action = (
            AuditAction.FEATURE_FLAG_ENABLED 
            if new_value 
            else AuditAction.FEATURE_FLAG_DISABLED
        )
        
        audit_entry = AuditLog(
            admin_id=admin_id,
            action=action,
            target_type='FEATURE_FLAG',
            target_id=None,
            details={
                'flag_name': flag_name,
                'new_value': new_value,
                'change_reason': change_reason,
                'timestamp': datetime.now(timezone.utc).isoformat(),
            },
            ip_address=ip_address,
        )
        
        session.add(audit_entry)
        await session.flush()
        
        return audit_entry

    @staticmethod
    async def log_predictive_inference(
        session: AsyncSession,
        admin_id: int,
        model_name: str,
        target_type: str,
        target_id: Optional[int],
        parameters: Optional[Dict[str, Any]] = None,
        metrics: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        audit_entry = AuditLog(
            admin_id=admin_id,
            action=AuditAction.PREDICTIVE_INFERENCE_RUN,
            target_type=target_type,
            target_id=target_id,
            details={
                'model_name': model_name,
                'parameters': parameters or {},
                'metrics': metrics or {},
                'timestamp': datetime.now(timezone.utc).isoformat(),
            },
            ip_address=ip_address,
        )
        session.add(audit_entry)
        await session.flush()
        return audit_entry

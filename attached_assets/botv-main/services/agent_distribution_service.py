#!/usr/bin/env python3
"""
Agent Distribution Service - Assigns financial requests to agents
Supports three strategies: MANUAL, AUTO_ROUND_ROBIN, AUTO_LOAD_BASED
All strategies are pluggable and switchable via SystemSettings
"""

from typing import Optional, Dict, List, Tuple
from datetime import datetime, timezone
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from models import Agent, Outbox, OutboxStatus, AgentStatus, AuditLog
from services.system_settings_service import SystemSettingsService, SettingKey
from services.audit_log_service import AuditLogService, AuditAction


class AgentDistributionStrategy:
    """Base class for agent distribution strategies"""
    
    async def assign(
        self,
        session: AsyncSession,
        request_id: int,
        admin_id: Optional[int] = None,
        ip_address: Optional[str] = None,
    ) -> Tuple[int, str]:
        """
        Assign a request to an agent
        
        Returns: (agent_id, strategy_name)
        """
        raise NotImplementedError


class ManualAssignmentStrategy(AgentDistributionStrategy):
    """Admin explicitly chooses the agent"""
    
    async def assign(
        self,
        session: AsyncSession,
        request_id: int,
        admin_id: Optional[int] = None,
        selected_agent_id: Optional[int] = None,
        ip_address: Optional[str] = None,
    ) -> Tuple[int, str]:
        """
        Manual assignment - admin selects agent
        
        Args:
            session: Database session
            request_id: Outbox request ID
            admin_id: Admin making the selection
            selected_agent_id: Agent ID to assign (must be provided by admin)
            ip_address: Admin's IP address
            
        Returns: (agent_id, 'MANUAL')
        
        Raises:
            ValueError: If selected_agent_id not provided or invalid
        """
        
        if not selected_agent_id:
            raise ValueError("selected_agent_id required for MANUAL assignment")
        
        # Verify agent exists and is active
        query = select(Agent).where(
            and_(
                Agent.id == selected_agent_id,
                Agent.is_active == True,
                Agent.status == AgentStatus.ACTIVE
            )
        )
        result = await session.execute(query)
        agent = result.scalar_one_or_none()
        
        if not agent:
            raise ValueError(f"Agent {selected_agent_id} not found or inactive")
        
        # Log assignment
        await AuditLogService.log_agent_assignment(
            session=session,
            admin_id=admin_id or -1,  # -1 for system
            request_id=request_id,
            assigned_agent_id=agent.id,
            strategy='MANUAL',
            details={'selected_by_admin': True},
            ip_address=ip_address,
        )
        
        return agent.id, 'MANUAL'


class RoundRobinStrategy(AgentDistributionStrategy):
    """Fair rotation across active agents"""
    
    async def assign(
        self,
        session: AsyncSession,
        request_id: int,
        admin_id: Optional[int] = None,
        ip_address: Optional[str] = None,
    ) -> Tuple[int, str]:
        """
        Round-robin assignment - rotate through agents
        
        Returns: (agent_id, 'AUTO_ROUND_ROBIN')
        
        Raises:
            ValueError: If no active agents available
        """
        
        # Get all active agents
        query = select(Agent).where(
            and_(
                Agent.is_active == True,
                Agent.status == AgentStatus.ACTIVE
            )
        ).order_by(Agent.id)
        
        result = await session.execute(query)
        agents = result.scalars().all()
        
        if not agents:
            raise ValueError("No active agents available for assignment")
        
        # Get current round-robin pointer
        current_pointer = await SystemSettingsService.get_setting(
            session,
            SettingKey.AGENT_RR_POINTER,
            default=0
        )
        current_pointer = int(current_pointer)
        
        # Calculate next index
        next_index = (current_pointer + 1) % len(agents)
        selected_agent = agents[next_index]
        
        # Atomically update pointer
        await SystemSettingsService.set_setting(
            session,
            key=SettingKey.AGENT_RR_POINTER,
            value=str(next_index),
            admin_id=admin_id,
        )
        
        # Log assignment
        await AuditLogService.log_agent_assignment(
            session=session,
            admin_id=admin_id or -1,
            request_id=request_id,
            assigned_agent_id=selected_agent.id,
            strategy='AUTO_ROUND_ROBIN',
            details={
                'rotation_index': next_index,
                'total_agents': len(agents),
                'previous_pointer': current_pointer,
            },
            ip_address=ip_address,
        )
        
        return selected_agent.id, 'AUTO_ROUND_ROBIN'


class LoadBasedStrategy(AgentDistributionStrategy):
    """Assign to agent with lowest load"""
    
    async def assign(
        self,
        session: AsyncSession,
        request_id: int,
        admin_id: Optional[int] = None,
        ip_address: Optional[str] = None,
    ) -> Tuple[int, str]:
        """
        Load-based assignment - select least-loaded agent
        
        Returns: (agent_id, 'AUTO_LOAD_BASED')
        
        Raises:
            ValueError: If no active agents available
        """
        
        # Get all active agents
        query = select(Agent).where(
            and_(
                Agent.is_active == True,
                Agent.status == AgentStatus.ACTIVE
            )
        ).order_by(Agent.id)
        
        result = await session.execute(query)
        agents = result.scalars().all()
        
        if not agents:
            raise ValueError("No active agents available for assignment")
        
        # Calculate load for each agent
        load_method = await SystemSettingsService.get_setting(
            session,
            SettingKey.AGENT_LOAD_METHOD,
            default='PENDING_COUNT'
        )
        
        load_scores = await self._calculate_loads(session, agents, load_method)
        
        # Select agent with lowest score
        selected_agent_id = min(load_scores, key=load_scores.get)
        selected_agent = next(a for a in agents if a.id == selected_agent_id)
        
        # Log assignment
        await AuditLogService.log_agent_assignment(
            session=session,
            admin_id=admin_id or -1,
            request_id=request_id,
            assigned_agent_id=selected_agent.id,
            strategy='AUTO_LOAD_BASED',
            details={
                'load_scores': {str(aid): score for aid, score in load_scores.items()},
                'load_calculation_method': load_method,
            },
            ip_address=ip_address,
        )
        
        return selected_agent.id, 'AUTO_LOAD_BASED'
    
    async def _calculate_loads(
        self,
        session: AsyncSession,
        agents: List[Agent],
        method: str,
    ) -> Dict[int, float]:
        """
        Calculate load score for each agent
        
        Args:
            session: Database session
            agents: List of agents to evaluate
            method: Load calculation method (PENDING_COUNT, etc.)
            
        Returns:
            Dict mapping agent_id to load_score
        """
        
        load_scores = {}
        
        if method == 'PENDING_COUNT':
            # Count pending requests for each agent
            for agent in agents:
                query = select(func.count(Outbox.id)).where(
                    and_(
                        Outbox.assigned_agent_id == agent.id,
                        Outbox.status.in_([OutboxStatus.PENDING, OutboxStatus.PROCESSING])
                    )
                )
                result = await session.execute(query)
                pending_count = result.scalar() or 0
                
                # Get weight multiplier
                weight = float(await SystemSettingsService.get_setting(
                    session,
                    SettingKey.AGENT_LOAD_WEIGHT_PENDING,
                    default=10.0
                ))
                
                load_scores[agent.id] = pending_count * weight
        
        else:
            # Fallback: use pending count
            for agent in agents:
                query = select(func.count(Outbox.id)).where(
                    and_(
                        Outbox.assigned_agent_id == agent.id,
                        Outbox.status.in_([OutboxStatus.PENDING, OutboxStatus.PROCESSING])
                    )
                )
                result = await session.execute(query)
                pending_count = result.scalar() or 0
                load_scores[agent.id] = pending_count * 10
        
        return load_scores


class AgentDistributionService:
    """Main service for agent distribution"""
    
    _strategies = {
        'MANUAL': ManualAssignmentStrategy(),
        'AUTO_ROUND_ROBIN': RoundRobinStrategy(),
        'AUTO_LOAD_BASED': LoadBasedStrategy(),
    }
    
    @staticmethod
    async def assign_request(
        session: AsyncSession,
        request_id: int,
        admin_id: Optional[int] = None,
        selected_agent_id: Optional[int] = None,
        ip_address: Optional[str] = None,
    ) -> int:
        """
        Assign a financial request to an agent
        
        Args:
            session: Database session
            request_id: Outbox request ID
            admin_id: Admin ID (for MANUAL assignments)
            selected_agent_id: Selected agent (for MANUAL assignments)
            ip_address: Request IP address
            
        Returns:
            Agent ID assigned
            
        Raises:
            ValueError: If assignment fails
        """
        
        # Get current distribution mode
        mode = await SystemSettingsService.get_setting(
            session,
            SettingKey.AGENT_DISTRIBUTION_MODE,
            default='MANUAL'
        )
        
        # Get strategy
        strategy = AgentDistributionService._strategies.get(mode)
        if not strategy:
            # Fallback to MANUAL
            mode = 'MANUAL'
            strategy = AgentDistributionService._strategies['MANUAL']
        
        # Assign using strategy
        agent_id, strategy_used = await strategy.assign(
            session=session,
            request_id=request_id,
            admin_id=admin_id,
            selected_agent_id=selected_agent_id if mode == 'MANUAL' else None,
            ip_address=ip_address,
        )
        
        # Update outbox with assignment
        query = select(Outbox).where(Outbox.id == request_id)
        result = await session.execute(query)
        outbox = result.scalar_one_or_none()
        
        if outbox:
            outbox.assigned_agent_id = agent_id
            outbox.assignment_strategy = strategy_used
            outbox.assignment_timestamp = datetime.now(timezone.utc)
            await session.flush()
        
        return agent_id
    
    @staticmethod
    async def get_active_agents(session: AsyncSession) -> List[Agent]:
        """Get all active agents"""
        query = select(Agent).where(
            and_(
                Agent.is_active == True,
                Agent.status == AgentStatus.ACTIVE
            )
        ).order_by(Agent.name)
        
        result = await session.execute(query)
        return result.scalars().all()

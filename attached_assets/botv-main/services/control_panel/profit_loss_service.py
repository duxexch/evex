"""
Profit/Loss Service
Manages profit/loss rules and player-specific adjustments
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from decimal import Decimal
from datetime import datetime, date

from models.control_panel import ProfitLossRule, ProfitLossPlayerRule


class ProfitLossService:
    """Service for managing profit/loss rules"""
    
    def __init__(self):
        pass
    
    async def create_rule(
        self,
        session: AsyncSession,
        game_id: int,
        rule_name: str,
        rule_type: str,
        house_edge_adjustment: Decimal = Decimal('0'),
        payout_multiplier: Decimal = Decimal('1.0'),
        loss_cap: Decimal = None,
        min_amount: Decimal = None,
        max_amount: Decimal = None,
        win_streak_threshold: int = None,
        loss_streak_threshold: int = None,
        priority: int = 100,
        player_id: int = None,
        user_id: int = None
    ) -> ProfitLossRule:
        """Create a new profit/loss rule"""
        rule = ProfitLossRule(
            game_id=game_id,
            player_id=player_id,
            rule_name=rule_name,
            rule_type=rule_type,
            house_edge_adjustment=house_edge_adjustment,
            payout_multiplier=payout_multiplier,
            loss_cap=loss_cap,
            min_amount=min_amount,
            max_amount=max_amount,
            win_streak_threshold=win_streak_threshold,
            loss_streak_threshold=loss_streak_threshold,
            priority=priority,
            is_active=True,
            created_by=user_id
        )
        
        session.add(rule)
        await session.commit()
        await session.refresh(rule)
        
        return rule
    
    async def get_rule(
        self,
        session: AsyncSession,
        rule_id: int
    ) -> Optional[ProfitLossRule]:
        """Get a specific rule by ID"""
        result = await session.execute(
            select(ProfitLossRule).where(ProfitLossRule.id == rule_id)
        )
        return result.scalar_one_or_none()
    
    async def list_rules_for_game(
        self,
        session: AsyncSession,
        game_id: int,
        active_only: bool = True
    ) -> List[ProfitLossRule]:
        """List all rules for a specific game"""
        query = select(ProfitLossRule).where(ProfitLossRule.game_id == game_id)
        
        if active_only:
            query = query.where(ProfitLossRule.is_active == True)
        
        query = query.order_by(ProfitLossRule.priority.asc())
        result = await session.execute(query)
        return list(result.scalars().all())
    
    async def update_rule(
        self,
        session: AsyncSession,
        rule_id: int,
        **updates
    ) -> Optional[ProfitLossRule]:
        """Update a profit/loss rule"""
        rule = await self.get_rule(session, rule_id)
        if not rule:
            raise ValueError(f"Rule {rule_id} not found")
        
        for field, value in updates.items():
            if hasattr(rule, field) and value is not None:
                setattr(rule, field, value)
        
        rule.updated_at = datetime.utcnow()
        
        await session.commit()
        await session.refresh(rule)
        
        return rule
    
    async def delete_rule(
        self,
        session: AsyncSession,
        rule_id: int
    ) -> bool:
        """Delete a profit/loss rule"""
        rule = await self.get_rule(session, rule_id)
        if not rule:
            return False
        
        await session.delete(rule)
        await session.commit()
        return True
    
    async def activate_rule(
        self,
        session: AsyncSession,
        rule_id: int
    ) -> Optional[ProfitLossRule]:
        """Activate a rule"""
        return await self.update_rule(session, rule_id, is_active=True)
    
    async def deactivate_rule(
        self,
        session: AsyncSession,
        rule_id: int
    ) -> Optional[ProfitLossRule]:
        """Deactivate a rule"""
        return await self.update_rule(session, rule_id, is_active=False)
    
    # Player-specific rules
    
    async def create_player_rule(
        self,
        session: AsyncSession,
        player_id: int,
        game_id: int = None,
        custom_house_edge: Decimal = None,
        daily_loss_limit: Decimal = None,
        weekly_loss_limit: Decimal = None,
        max_payout_multiplier: Decimal = None,
        start_date: date = None,
        end_date: date = None,
        user_id: int = None
    ) -> ProfitLossPlayerRule:
        """Create player-specific profit/loss rule"""
        rule = ProfitLossPlayerRule(
            player_id=player_id,
            game_id=game_id,
            custom_house_edge=custom_house_edge,
            daily_loss_limit=daily_loss_limit,
            weekly_loss_limit=weekly_loss_limit,
            max_payout_multiplier=max_payout_multiplier,
            start_date=start_date,
            end_date=end_date,
            is_active=True,
            updated_by=user_id
        )
        
        session.add(rule)
        await session.commit()
        await session.refresh(rule)
        
        return rule
    
    async def get_player_rule(
        self,
        session: AsyncSession,
        rule_id: int
    ) -> Optional[ProfitLossPlayerRule]:
        """Get a specific player rule by ID"""
        result = await session.execute(
            select(ProfitLossPlayerRule).where(ProfitLossPlayerRule.id == rule_id)
        )
        return result.scalar_one_or_none()
    
    async def list_player_rules(
        self,
        session: AsyncSession,
        player_id: int,
        game_id: int = None,
        active_only: bool = True
    ) -> List[ProfitLossPlayerRule]:
        """List all rules for a specific player"""
        query = select(ProfitLossPlayerRule).where(
            ProfitLossPlayerRule.player_id == player_id
        )
        
        if game_id is not None:
            query = query.where(
                or_(
                    ProfitLossPlayerRule.game_id == game_id,
                    ProfitLossPlayerRule.game_id == None
                )
            )
        
        if active_only:
            query = query.where(ProfitLossPlayerRule.is_active == True)
            # Check date range
            today = date.today()
            query = query.where(
                or_(
                    ProfitLossPlayerRule.start_date == None,
                    ProfitLossPlayerRule.start_date <= today
                )
            ).where(
                or_(
                    ProfitLossPlayerRule.end_date == None,
                    ProfitLossPlayerRule.end_date >= today
                )
            )
        
        result = await session.execute(query)
        return list(result.scalars().all())
    
    async def update_player_rule(
        self,
        session: AsyncSession,
        rule_id: int,
        user_id: int = None,
        **updates
    ) -> Optional[ProfitLossPlayerRule]:
        """Update a player-specific rule"""
        rule = await self.get_player_rule(session, rule_id)
        if not rule:
            raise ValueError(f"Player rule {rule_id} not found")
        
        for field, value in updates.items():
            if hasattr(rule, field) and value is not None:
                setattr(rule, field, value)
        
        rule.updated_by = user_id
        rule.updated_at = datetime.utcnow()
        
        await session.commit()
        await session.refresh(rule)
        
        return rule
    
    async def delete_player_rule(
        self,
        session: AsyncSession,
        rule_id: int
    ) -> bool:
        """Delete a player-specific rule"""
        rule = await self.get_player_rule(session, rule_id)
        if not rule:
            return False
        
        await session.delete(rule)
        await session.commit()
        return True
    
    async def get_effective_settings(
        self,
        session: AsyncSession,
        player_id: int,
        game_id: int
    ) -> Dict[str, Any]:
        """Get effective profit/loss settings for a player and game"""
        # Get player-specific rules
        player_rules = await self.list_player_rules(
            session, 
            player_id, 
            game_id=game_id, 
            active_only=True
        )
        
        # Get game rules
        game_rules = await self.list_rules_for_game(
            session, 
            game_id, 
            active_only=True
        )
        
        # Combine and prioritize player rules over game rules
        effective = {
            'custom_house_edge': None,
            'daily_loss_limit': None,
            'weekly_loss_limit': None,
            'max_payout_multiplier': None,
            'game_rules': []
        }
        
        # Apply player rules (highest priority)
        for rule in player_rules:
            if rule.custom_house_edge is not None:
                effective['custom_house_edge'] = float(rule.custom_house_edge)
            if rule.daily_loss_limit is not None:
                effective['daily_loss_limit'] = float(rule.daily_loss_limit)
            if rule.weekly_loss_limit is not None:
                effective['weekly_loss_limit'] = float(rule.weekly_loss_limit)
            if rule.max_payout_multiplier is not None:
                effective['max_payout_multiplier'] = float(rule.max_payout_multiplier)
        
        # Add game rules
        for rule in game_rules:
            effective['game_rules'].append({
                'rule_id': rule.id,
                'rule_name': rule.rule_name,
                'rule_type': rule.rule_type,
                'house_edge_adjustment': float(rule.house_edge_adjustment),
                'payout_multiplier': float(rule.payout_multiplier),
                'priority': rule.priority
            })
        
        return effective

"""
RBAC Service
Role-Based Access Control for control panel
"""
from typing import List, Optional, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime

from models.control_panel import RolePermission, UserRole


class RBACService:
    """Service for Role-Based Access Control"""
    
    # Predefined roles and permissions
    ROLES = {
        'SUPER_ADMIN': [
            'game:create', 'game:read', 'game:update', 'game:delete',
            'player:read', 'player:update', 'player:ban', 'player:unban',
            'profit_loss:create', 'profit_loss:read', 'profit_loss:update', 'profit_loss:delete',
            'analytics:read', 'audit:read',
            'role:create', 'role:read', 'role:update', 'role:delete',
            'agent:create', 'agent:read', 'agent:update', 'agent:commission', 'agent:stats',
            'affiliate:create', 'affiliate:read', 'affiliate:update', 'affiliate:referral', 'affiliate:commission', 'affiliate:payout', 'affiliate:stats',
            'notification:view', 'notification:manage', 'notification:send', 'notification:approve'
        ],
        'GAME_MANAGER': [
            'game:read', 'game:update',
            'profit_loss:read', 'profit_loss:update',
            'analytics:read',
            'notification:view'
        ],
        'PLAYER_SUPPORT': [
            'player:read', 'player:update',
            'analytics:read',
            'notification:view'
        ],
        'ANALYST': [
            'game:read', 'player:read',
            'analytics:read', 'audit:read',
            'notification:view'
        ],
        'PARTNER_MANAGER': [
            'agent:read', 'agent:update', 'agent:commission', 'agent:stats',
            'affiliate:read', 'affiliate:update', 'affiliate:referral', 'affiliate:commission', 'affiliate:payout', 'affiliate:stats',
            'notification:view', 'notification:manage'
        ]
    }
    
    def __init__(self):
        pass
    
    async def initialize_roles(self, session: AsyncSession) -> None:
        """Initialize default roles and permissions"""
        for role_name, permissions in self.ROLES.items():
            for permission in permissions:
                # Check if role-permission exists
                result = await session.execute(
                    select(RolePermission).where(
                        and_(
                            RolePermission.role_name == role_name,
                            RolePermission.permission == permission
                        )
                    )
                )
                existing = result.scalar_one_or_none()
                
                if not existing:
                    role_perm = RolePermission(
                        role_name=role_name,
                        permission=permission,
                        description=f"{permission} for {role_name}",
                        is_active=True
                    )
                    session.add(role_perm)
        
        await session.commit()
    
    async def create_role_permission(
        self,
        session: AsyncSession,
        role_name: str,
        permission: str,
        description: str = None
    ) -> RolePermission:
        """Create a new role-permission mapping"""
        # Check if exists
        result = await session.execute(
            select(RolePermission).where(
                and_(
                    RolePermission.role_name == role_name,
                    RolePermission.permission == permission
                )
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            return existing
        
        role_perm = RolePermission(
            role_name=role_name,
            permission=permission,
            description=description,
            is_active=True
        )
        
        session.add(role_perm)
        await session.commit()
        await session.refresh(role_perm)
        
        return role_perm
    
    async def assign_role_to_user(
        self,
        session: AsyncSession,
        user_id: int,
        role_name: str,
        scope_game_ids: str = None,
        assigned_by: int = None
    ) -> UserRole:
        """Assign a role to a user"""
        # Check if already assigned
        result = await session.execute(
            select(UserRole).where(
                and_(
                    UserRole.user_id == user_id,
                    UserRole.role_name == role_name
                )
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            # Update if exists
            existing.is_active = True
            existing.scope_game_ids = scope_game_ids
            await session.commit()
            await session.refresh(existing)
            return existing
        
        user_role = UserRole(
            user_id=user_id,
            role_name=role_name,
            is_active=True,
            scope_game_ids=scope_game_ids,
            assigned_by=assigned_by
        )
        
        session.add(user_role)
        await session.commit()
        await session.refresh(user_role)
        
        return user_role
    
    async def revoke_role_from_user(
        self,
        session: AsyncSession,
        user_id: int,
        role_name: str
    ) -> bool:
        """Revoke a role from a user"""
        result = await session.execute(
            select(UserRole).where(
                and_(
                    UserRole.user_id == user_id,
                    UserRole.role_name == role_name
                )
            )
        )
        user_role = result.scalar_one_or_none()
        
        if not user_role:
            return False
        
        user_role.is_active = False
        await session.commit()
        return True
    
    async def get_user_roles(
        self,
        session: AsyncSession,
        user_id: int
    ) -> List[UserRole]:
        """Get all active roles for a user"""
        result = await session.execute(
            select(UserRole).where(
                and_(
                    UserRole.user_id == user_id,
                    UserRole.is_active == True
                )
            )
        )
        return list(result.scalars().all())
    
    async def get_user_permissions(
        self,
        session: AsyncSession,
        user_id: int
    ) -> Set[str]:
        """Get all permissions for a user based on their roles"""
        user_roles = await self.get_user_roles(session, user_id)
        
        if not user_roles:
            return set()
        
        role_names = [ur.role_name for ur in user_roles]
        
        # Get permissions for all roles
        result = await session.execute(
            select(RolePermission).where(
                and_(
                    RolePermission.role_name.in_(role_names),
                    RolePermission.is_active == True
                )
            )
        )
        permissions = result.scalars().all()
        
        return set(p.permission for p in permissions)
    
    async def has_permission(
        self,
        session: AsyncSession,
        user_id: int,
        permission: str
    ) -> bool:
        """Check if user has a specific permission"""
        permissions = await self.get_user_permissions(session, user_id)
        return permission in permissions
    
    async def list_all_roles(
        self,
        session: AsyncSession
    ) -> List[str]:
        """List all available roles"""
        result = await session.execute(
            select(RolePermission.role_name).distinct()
        )
        return list(result.scalars().all())
    
    async def list_permissions_for_role(
        self,
        session: AsyncSession,
        role_name: str
    ) -> List[RolePermission]:
        """List all permissions for a specific role"""
        result = await session.execute(
            select(RolePermission).where(
                and_(
                    RolePermission.role_name == role_name,
                    RolePermission.is_active == True
                )
            )
        )
        return list(result.scalars().all())
    
    async def list_users_with_role(
        self,
        session: AsyncSession,
        role_name: str
    ) -> List[UserRole]:
        """List all users with a specific role"""
        result = await session.execute(
            select(UserRole).where(
                and_(
                    UserRole.role_name == role_name,
                    UserRole.is_active == True
                )
            )
        )
        return list(result.scalars().all())

"""
Tests for RBAC Service
"""
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from models.control_panel import RolePermission, UserRole, Base
from services.control_panel import RBACService


@pytest.fixture
async def async_session():
    """Create an async session for testing"""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session_maker() as session:
        yield session
    
    await engine.dispose()


@pytest.mark.asyncio
class TestRBACService:
    """Test RBACService"""
    
    async def test_initialize_roles(self, async_session):
        """Test initializing default roles"""
        service = RBACService()
        
        await service.initialize_roles(async_session)
        
        # Check roles were created
        roles = await service.list_all_roles(async_session)
        assert len(roles) > 0
        assert 'SUPER_ADMIN' in roles
        assert 'GAME_MANAGER' in roles
    
    async def test_create_role_permission(self, async_session):
        """Test creating a role permission"""
        service = RBACService()
        
        perm = await service.create_role_permission(
            async_session,
            role_name="TEST_ROLE",
            permission="test:read",
            description="Test permission"
        )
        
        assert perm.role_name == "TEST_ROLE"
        assert perm.permission == "test:read"
    
    async def test_assign_role_to_user(self, async_session):
        """Test assigning a role to a user"""
        service = RBACService()
        
        # Create role first
        await service.create_role_permission(
            async_session,
            role_name="TEST_ROLE",
            permission="test:read"
        )
        
        # Assign to user
        user_role = await service.assign_role_to_user(
            async_session,
            user_id=1,
            role_name="TEST_ROLE"
        )
        
        assert user_role.user_id == 1
        assert user_role.role_name == "TEST_ROLE"
        assert user_role.is_active == True
    
    async def test_get_user_roles(self, async_session):
        """Test getting user roles"""
        service = RBACService()
        
        # Create roles
        for i in range(2):
            await service.create_role_permission(
                async_session,
                role_name=f"ROLE_{i}",
                permission=f"perm_{i}"
            )
            
            await service.assign_role_to_user(
                async_session,
                user_id=1,
                role_name=f"ROLE_{i}"
            )
        
        roles = await service.get_user_roles(async_session, user_id=1)
        
        assert len(roles) == 2
    
    async def test_get_user_permissions(self, async_session):
        """Test getting user permissions"""
        service = RBACService()
        
        # Create role with permissions
        await service.create_role_permission(
            async_session,
            role_name="TEST_ROLE",
            permission="perm:read"
        )
        
        await service.create_role_permission(
            async_session,
            role_name="TEST_ROLE",
            permission="perm:write"
        )
        
        # Assign to user
        await service.assign_role_to_user(
            async_session,
            user_id=1,
            role_name="TEST_ROLE"
        )
        
        permissions = await service.get_user_permissions(async_session, user_id=1)
        
        assert "perm:read" in permissions
        assert "perm:write" in permissions
    
    async def test_has_permission(self, async_session):
        """Test checking if user has permission"""
        service = RBACService()
        
        # Setup
        await service.create_role_permission(
            async_session,
            role_name="TEST_ROLE",
            permission="test:read"
        )
        
        await service.assign_role_to_user(
            async_session,
            user_id=1,
            role_name="TEST_ROLE"
        )
        
        # Check has permission
        has_perm = await service.has_permission(
            async_session,
            user_id=1,
            permission="test:read"
        )
        
        assert has_perm == True
        
        # Check doesn't have permission
        no_perm = await service.has_permission(
            async_session,
            user_id=1,
            permission="test:write"
        )
        
        assert no_perm == False
    
    async def test_revoke_role_from_user(self, async_session):
        """Test revoking role from user"""
        service = RBACService()
        
        # Setup
        await service.create_role_permission(
            async_session,
            role_name="TEST_ROLE",
            permission="test:read"
        )
        
        await service.assign_role_to_user(
            async_session,
            user_id=1,
            role_name="TEST_ROLE"
        )
        
        # Revoke
        revoked = await service.revoke_role_from_user(
            async_session,
            user_id=1,
            role_name="TEST_ROLE"
        )
        
        assert revoked == True
        
        # Check revoked
        roles = await service.get_user_roles(async_session, user_id=1)
        assert len(roles) == 0
    
    async def test_list_users_with_role(self, async_session):
        """Test listing users with a role"""
        service = RBACService()
        
        # Create role
        await service.create_role_permission(
            async_session,
            role_name="TEST_ROLE",
            permission="test:read"
        )
        
        # Assign to multiple users
        for user_id in range(1, 4):
            await service.assign_role_to_user(
                async_session,
                user_id=user_id,
                role_name="TEST_ROLE"
            )
        
        users = await service.list_users_with_role(
            async_session,
            role_name="TEST_ROLE"
        )
        
        assert len(users) == 3
    
    async def test_scoped_role_assignment(self, async_session):
        """Test assigning role with game scope"""
        service = RBACService()
        
        # Create role
        await service.create_role_permission(
            async_session,
            role_name="GAME_MANAGER",
            permission="game:manage"
        )
        
        # Assign with scope
        user_role = await service.assign_role_to_user(
            async_session,
            user_id=1,
            role_name="GAME_MANAGER",
            scope_game_ids="1,2,3"
        )
        
        assert user_role.scope_game_ids == "1,2,3"

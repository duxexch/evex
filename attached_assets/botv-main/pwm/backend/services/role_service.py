from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pwm.backend.models.role import Role
from pwm.backend.schemas.schemas import RoleCreate, RoleUpdate


class RoleService:
    """Role service for business logic"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_role_by_id(self, role_id: int) -> Role:
        """Get role by ID"""
        result = await self.session.execute(
            select(Role).where(Role.id == role_id).options(selectinload(Role.permissions))
        )
        return result.scalar_one_or_none()
    
    async def get_role_by_name(self, name: str) -> Role:
        """Get role by name"""
        result = await self.session.execute(
            select(Role).where(Role.name == name).options(selectinload(Role.permissions))
        )
        return result.scalar_one_or_none()
    
    async def get_all_roles(self, skip: int = 0, limit: int = 10) -> list[Role]:
        """Get all roles with pagination"""
        result = await self.session.execute(
            select(Role)
            .options(selectinload(Role.permissions))
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()
    
    async def create_role(self, role_data: RoleCreate) -> Role:
        """Create a new role"""
        # Check if role exists
        existing_role = await self.get_role_by_name(role_data.name)
        if existing_role:
            raise ValueError("Role already exists")
        
        role = Role(
            name=role_data.name,
            description=role_data.description
        )
        self.session.add(role)
        await self.session.commit()
        await self.session.refresh(role)
        return role
    
    async def update_role(self, role_id: int, role_data: RoleUpdate) -> Role:
        """Update role"""
        role = await self.get_role_by_id(role_id)
        if not role:
            raise ValueError("Role not found")
        
        if role_data.name:
            role.name = role_data.name
        if role_data.description is not None:
            role.description = role_data.description
        
        self.session.add(role)
        await self.session.commit()
        await self.session.refresh(role)
        return role
    
    async def delete_role(self, role_id: int) -> bool:
        """Delete role"""
        role = await self.get_role_by_id(role_id)
        if not role:
            raise ValueError("Role not found")
        
        await self.session.delete(role)
        await self.session.commit()
        return True

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pwm.backend.models.user import User
from pwm.backend.core.security import hash_password, verify_password
from pwm.backend.schemas.schemas import UserCreate, UserUpdate


class UserService:
    """User service for business logic"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_user_by_id(self, user_id: int) -> User:
        """Get user by ID"""
        result = await self.session.execute(
            select(User).where(User.id == user_id).options(selectinload(User.role))
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_username(self, username: str) -> User:
        """Get user by username"""
        result = await self.session.execute(
            select(User).where(User.username == username).options(selectinload(User.role))
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_email(self, email: str) -> User:
        """Get user by email"""
        result = await self.session.execute(
            select(User).where(User.email == email).options(selectinload(User.role))
        )
        return result.scalar_one_or_none()
    
    async def get_all_users(self, skip: int = 0, limit: int = 10) -> list[User]:
        """Get all users with pagination"""
        result = await self.session.execute(
            select(User)
            .options(selectinload(User.role))
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()
    
    async def create_user(self, user_data: UserCreate) -> User:
        """Create a new user"""
        # Check if user exists
        existing_user = await self.get_user_by_username(user_data.username)
        if existing_user:
            raise ValueError("Username already exists")
        
        existing_email = await self.get_user_by_email(user_data.email)
        if existing_email:
            raise ValueError("Email already exists")
        
        # Create user
        user = User(
            username=user_data.username,
            email=user_data.email,
            full_name=user_data.full_name,
            hashed_password=hash_password(user_data.password),
            is_active=True,
            is_admin=False
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user
    
    async def update_user(self, user_id: int, user_data: UserUpdate) -> User:
        """Update user"""
        user = await self.get_user_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        
        if user_data.full_name:
            user.full_name = user_data.full_name
        if user_data.email:
            user.email = user_data.email
        
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user
    
    async def delete_user(self, user_id: int) -> bool:
        """Delete user"""
        user = await self.get_user_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        
        await self.session.delete(user)
        await self.session.commit()
        return True
    
    async def authenticate_user(self, username: str, password: str) -> User:
        """Authenticate user"""
        user = await self.get_user_by_username(username)
        if not user or not verify_password(password, user.hashed_password):
            return None
        return user

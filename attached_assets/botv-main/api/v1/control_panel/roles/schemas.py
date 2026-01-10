"""
RBAC API Schemas
Request/response models for role and permission management endpoints
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Set
from datetime import datetime


class PermissionBase(BaseModel):
    """Base model for permission"""
    permission: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=255)


class PermissionCreate(PermissionBase):
    """Create permission"""
    role_name: str = Field(..., min_length=1, max_length=50)


class PermissionResponse(PermissionBase):
    """Permission response"""
    id: int
    role_name: str
    is_active: bool
    
    model_config = ConfigDict(from_attributes=True)


class RoleBase(BaseModel):
    """Base model for role"""
    role_name: str = Field(..., min_length=1, max_length=50)


class RoleCreate(RoleBase):
    """Create role"""
    permissions: List[str] = Field(..., min_length=1)


class RoleResponse(BaseModel):
    """Role response"""
    role_name: str
    permissions: List[PermissionResponse]


class RoleListResponse(BaseModel):
    """Role list response"""
    roles: List[str]


class UserRoleBase(BaseModel):
    """Base model for user role assignment"""
    user_id: int
    role_name: str = Field(..., min_length=1, max_length=50)


class UserRoleCreate(UserRoleBase):
    """Create user role assignment"""
    scope_game_ids: Optional[str] = Field(None, max_length=500)


class UserRoleUpdate(BaseModel):
    """Update user role assignment"""
    is_active: Optional[bool] = None
    scope_game_ids: Optional[str] = None


class UserRoleResponse(UserRoleBase):
    """User role response"""
    id: int
    is_active: bool
    scope_game_ids: Optional[str] = None
    assigned_at: datetime
    assigned_by: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)


class UserRoleListResponse(BaseModel):
    """User role list response"""
    user_id: int
    roles: List[UserRoleResponse]


class UserPermissionsResponse(BaseModel):
    """User permissions response"""
    user_id: int
    permissions: List[str]


class RevokeRoleRequest(BaseModel):
    """Revoke role request"""
    role_name: str


class ScopedRoleRequest(BaseModel):
    """Create scoped role assignment"""
    user_id: int
    role_name: str
    scope_game_ids: List[int]


class BulkRoleAssignmentRequest(BaseModel):
    """Bulk role assignment"""
    user_ids: List[int] = Field(..., min_length=1)
    role_name: str
    scope_game_ids: Optional[List[int]] = None


class RolePermissionListResponse(BaseModel):
    """Role permission list response"""
    role_name: str
    total_permissions: int
    permissions: List[PermissionResponse]


class UsersWithRoleResponse(BaseModel):
    """Users with specific role"""
    role_name: str
    total_users: int
    users: List[UserRoleResponse]

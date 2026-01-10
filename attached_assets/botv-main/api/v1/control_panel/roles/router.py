"""
Roles/RBAC API Router
Endpoints for role and permission management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from api.v1.control_panel.roles.schemas import (
    PermissionCreate, PermissionResponse, RoleCreate, RoleResponse,
    RoleListResponse, UserRoleCreate, UserRoleUpdate, UserRoleResponse,
    UserRoleListResponse, UserPermissionsResponse, RevokeRoleRequest,
    ScopedRoleRequest, BulkRoleAssignmentRequest, RolePermissionListResponse,
    UsersWithRoleResponse
)
from services.control_panel import RBACService
from api.dependencies import get_db, get_current_user

router = APIRouter(prefix="/roles", tags=["rbac"])


def get_rbac_service() -> RBACService:
    return RBACService()


@router.post("/initialize", status_code=200)
async def initialize_roles(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: RBACService = Depends(get_rbac_service)
):
    """Initialize default roles and permissions"""
    try:
        await service.initialize_roles(db)
        return {"message": "Roles initialized successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list", response_model=RoleListResponse)
async def list_roles(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: RBACService = Depends(get_rbac_service)
):
    """List all available roles"""
    try:
        roles = await service.list_all_roles(db)
        return RoleListResponse(roles=roles)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{role_name}/permissions", response_model=RolePermissionListResponse)
async def get_role_permissions(
    role_name: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: RBACService = Depends(get_rbac_service)
):
    """Get all permissions for a specific role"""
    try:
        permissions = await service.list_permissions_for_role(db, role_name)
        return RolePermissionListResponse(
            role_name=role_name,
            total_permissions=len(permissions),
            permissions=permissions
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{role_name}/permissions", response_model=PermissionResponse, status_code=201)
async def create_permission(
    role_name: str,
    permission: PermissionCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: RBACService = Depends(get_rbac_service)
):
    """Create a new permission for a role"""
    try:
        created_perm = await service.create_role_permission(
            db, role_name, permission.permission, permission.description
        )
        return created_perm
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# User role assignment endpoints

@router.post("/users/{user_id}/assign", response_model=UserRoleResponse, status_code=201)
async def assign_role_to_user(
    user_id: int,
    request: UserRoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: RBACService = Depends(get_rbac_service)
):
    """Assign a role to a user"""
    try:
        user_role = await service.assign_role_to_user(
            db, user_id, request.role_name, request.scope_game_ids, current_user.id
        )
        return user_role
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}/roles", response_model=UserRoleListResponse)
async def get_user_roles(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: RBACService = Depends(get_rbac_service)
):
    """Get all roles assigned to a user"""
    try:
        roles = await service.get_user_roles(db, user_id)
        return UserRoleListResponse(user_id=user_id, roles=roles)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}/permissions", response_model=UserPermissionsResponse)
async def get_user_permissions(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: RBACService = Depends(get_rbac_service)
):
    """Get all permissions for a user"""
    try:
        permissions = await service.get_user_permissions(db, user_id)
        return UserPermissionsResponse(user_id=user_id, permissions=list(permissions))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/{user_id}/check-permission")
async def check_user_permission(
    user_id: int,
    permission: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: RBACService = Depends(get_rbac_service)
):
    """Check if user has a specific permission"""
    try:
        has_perm = await service.has_permission(db, user_id, permission)
        return {"user_id": user_id, "permission": permission, "has_permission": has_perm}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/users/{user_id}/roles/{role_name}", status_code=204)
async def revoke_role_from_user(
    user_id: int,
    role_name: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: RBACService = Depends(get_rbac_service)
):
    """Revoke a role from a user"""
    try:
        revoked = await service.revoke_role_from_user(db, user_id, role_name)
        if not revoked:
            raise HTTPException(status_code=404, detail="User role not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{role_name}/users", response_model=UsersWithRoleResponse)
async def get_users_with_role(
    role_name: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: RBACService = Depends(get_rbac_service)
):
    """List all users with a specific role"""
    try:
        users = await service.list_users_with_role(db, role_name)
        return UsersWithRoleResponse(
            role_name=role_name,
            total_users=len(users),
            users=users
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/batch-assign")
async def batch_assign_roles(
    request: BulkRoleAssignmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    service: RBACService = Depends(get_rbac_service)
):
    """Assign a role to multiple users"""
    try:
        scope_game_ids = ','.join(str(id) for id in request.scope_game_ids) if request.scope_game_ids else None
        
        results = []
        for user_id in request.user_ids:
            try:
                await service.assign_role_to_user(
                    db, user_id, request.role_name, scope_game_ids, current_user.id
                )
                results.append({'user_id': user_id, 'status': 'success'})
            except Exception as e:
                results.append({'user_id': user_id, 'status': 'error', 'error': str(e)})
        
        return {'role_name': request.role_name, 'results': results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

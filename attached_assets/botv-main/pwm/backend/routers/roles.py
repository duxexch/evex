from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pwm.backend.core.database import get_db
from pwm.backend.schemas.schemas import RoleResponse, RoleCreate, RoleUpdate
from pwm.backend.services.role_service import RoleService

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("/", response_model=list[RoleResponse])
async def get_roles(
    skip: int = 0,
    limit: int = 10,
    session: AsyncSession = Depends(get_db)
):
    """Get all roles"""
    service = RoleService(session)
    roles = await service.get_all_roles(skip=skip, limit=limit)
    return roles


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: int,
    session: AsyncSession = Depends(get_db)
):
    """Get role by ID"""
    service = RoleService(session)
    role = await service.get_role_by_id(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    return role


@router.post("/", response_model=RoleResponse)
async def create_role(
    role_data: RoleCreate,
    session: AsyncSession = Depends(get_db)
):
    """Create new role"""
    service = RoleService(session)
    try:
        role = await service.create_role(role_data)
        return role
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: int,
    role_data: RoleUpdate,
    session: AsyncSession = Depends(get_db)
):
    """Update role"""
    service = RoleService(session)
    try:
        role = await service.update_role(role_id, role_data)
        return role
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{role_id}")
async def delete_role(
    role_id: int,
    session: AsyncSession = Depends(get_db)
):
    """Delete role"""
    service = RoleService(session)
    try:
        await service.delete_role(role_id)
        return {"message": "Role deleted successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

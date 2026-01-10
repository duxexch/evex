"""Agents API Router"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from api.dependencies import get_db, get_current_user
from services.control_panel.agent_service import AgentService
from services.control_panel import RBACService
from api.v1.control_panel.agents.schemas import (
    AgentCreate,
    AgentResponse,
    AgentStatusUpdate,
    CommissionPreviewRequest,
    CommissionCreateRequest,
    CommissionResponse,
    CommissionTransitionRequest,
)

router = APIRouter(prefix="/agents", tags=["Agents"])


def get_service() -> AgentService:
    return AgentService()


def get_rbac_service() -> RBACService:
    return RBACService()


def require_permission(permission: str):
    async def checker(
        db: AsyncSession = Depends(get_db),
        current_user=Depends(get_current_user),
        rbac: RBACService = Depends(get_rbac_service),
    ):
        allowed = await rbac.has_permission(db, current_user.id, permission)
        if not allowed:
            raise HTTPException(status_code=403, detail="Permission denied")
        return current_user

    return checker


@router.post("/", response_model=AgentResponse, status_code=201)
async def create_agent(
    request: AgentCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agent:create")),
    service: AgentService = Depends(get_service),
):
    try:
        agent = await service.create_agent(
            db,
            name=request.name,
            agent_code=request.agent_code,
            email=request.email,
            phone=request.phone,
            commission_rate_deposit=request.commission_rate_deposit,
            commission_rate_withdraw=request.commission_rate_withdraw,
            daily_limit=request.daily_limit,
            monthly_limit=request.monthly_limit,
        )
        return agent
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=list[AgentResponse])
async def list_agents(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agent:read")),
    service: AgentService = Depends(get_service),
):
    agents = await service.list_agents(db)
    return agents


@router.patch("/{agent_id}/status", response_model=AgentResponse)
async def update_agent_status(
    agent_id: int,
    request: AgentStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agent:update")),
    service: AgentService = Depends(get_service),
):
    try:
        agent = await service.update_status(db, agent_id, request.status)
        return agent
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{agent_id}/commission/preview")
async def preview_commission(
    agent_id: int,
    request: CommissionPreviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agent:commission")),
    service: AgentService = Depends(get_service),
):
    try:
        return await service.preview_commission(db, agent_id, request.transaction_amount, request.tx_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{agent_id}/commission", response_model=CommissionResponse, status_code=201)
async def create_commission(
    agent_id: int,
    request: CommissionCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agent:commission")),
    service: AgentService = Depends(get_service),
):
    try:
        commission = await service.calculate_commission(
            db,
            agent_id=agent_id,
            transaction_id=request.transaction_id,
            transaction_amount=request.transaction_amount,
            tx_type=request.tx_type,
            idempotency_key=request.idempotency_key,
        )
        return commission
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/commissions/{commission_id}/transition", response_model=CommissionResponse)
async def transition_commission(
    commission_id: int,
    request: CommissionTransitionRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agent:commission")),
    service: AgentService = Depends(get_service),
):
    try:
        commission = await service.transition_commission(
            db,
            commission_id=commission_id,
            target=request.target,
            admin_id=request.admin_id,
            payout_id=request.payout_id,
        )
        return commission
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{agent_id}/stats")
async def agent_stats(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("agent:stats")),
    service: AgentService = Depends(get_service),
):
    try:
        return await service.get_agent_stats(db, agent_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


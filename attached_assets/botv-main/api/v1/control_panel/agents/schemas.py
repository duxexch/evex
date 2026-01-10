from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional
from models import AgentStatus, CommissionState


class AgentCreate(BaseModel):
    name: str
    agent_code: str
    email: Optional[str] = None
    phone: Optional[str] = None
    commission_rate_deposit: Decimal = Field(default=Decimal("0.02"))
    commission_rate_withdraw: Decimal = Field(default=Decimal("0.01"))
    daily_limit: Decimal = Field(default=Decimal("100000.00"))
    monthly_limit: Decimal = Field(default=Decimal("1000000.00"))


class AgentResponse(BaseModel):
    id: int
    name: str
    agent_code: str
    status: AgentStatus

    class Config:
        from_attributes = True


class AgentStatusUpdate(BaseModel):
    status: AgentStatus


class CommissionPreviewRequest(BaseModel):
    transaction_amount: Decimal
    tx_type: str


class CommissionCreateRequest(BaseModel):
    transaction_amount: Decimal
    tx_type: str
    transaction_id: int
    idempotency_key: Optional[str] = None


class CommissionResponse(BaseModel):
    id: int
    agent_id: int
    transaction_id: int
    amount: Decimal
    rate: Decimal
    status: CommissionState

    class Config:
        from_attributes = True


class CommissionTransitionRequest(BaseModel):
    target: CommissionState
    admin_id: Optional[int] = None
    payout_id: Optional[int] = None


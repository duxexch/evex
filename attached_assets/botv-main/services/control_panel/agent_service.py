"""Agent service for lifecycle, commissions, and payouts"""
from typing import Optional, List
from decimal import Decimal
from datetime import datetime, timezone
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models import Agent, Commission, CommissionState, Wallet, WalletPurpose, WalletTransaction, AgentStatus


class AgentService:
    """Manage agents and their commission lifecycle"""

    def __init__(self):
        pass

    # ----------------- Agent CRUD -----------------
    async def create_agent(
        self,
        session: AsyncSession,
        name: str,
        agent_code: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        commission_rate_deposit: Decimal = Decimal("0.02"),
        commission_rate_withdraw: Decimal = Decimal("0.01"),
        daily_limit: Decimal = Decimal("100000.00"),
        monthly_limit: Decimal = Decimal("1000000.00"),
    ) -> Agent:
        exists = await session.execute(select(Agent).where(Agent.agent_code == agent_code))
        if exists.scalar_one_or_none():
            raise ValueError("Agent code already exists")

        agent = Agent(
            name=name,
            agent_code=agent_code,
            email=email,
            phone=phone,
            commission_rate_deposit=commission_rate_deposit,
            commission_rate_withdraw=commission_rate_withdraw,
            daily_commission_limit=daily_limit,
            monthly_commission_limit=monthly_limit,
            status=AgentStatus.ACTIVE,
            is_active=True,
        )
        session.add(agent)
        await session.flush()
        return agent

    async def list_agents(self, session: AsyncSession) -> List[Agent]:
        result = await session.execute(select(Agent).order_by(Agent.created_at.desc()))
        return list(result.scalars().all())

    async def get_agent(self, session: AsyncSession, agent_id: int) -> Optional[Agent]:
        result = await session.execute(select(Agent).where(Agent.id == agent_id))
        return result.scalar_one_or_none()

    async def update_status(self, session: AsyncSession, agent_id: int, status: AgentStatus) -> Agent:
        agent = await self.get_agent(session, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        agent.status = status
        agent.is_active = status == AgentStatus.ACTIVE
        agent.updated_at = datetime.now(timezone.utc)
        await session.flush()
        return agent

    async def set_commission_rates(
        self,
        session: AsyncSession,
        agent_id: int,
        deposit_rate: Decimal,
        withdraw_rate: Decimal,
    ) -> Agent:
        agent = await self.get_agent(session, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        agent.commission_rate_deposit = deposit_rate
        agent.commission_rate_withdraw = withdraw_rate
        agent.updated_at = datetime.now(timezone.utc)
        await session.flush()
        return agent

    # ----------------- Commission lifecycle -----------------
    def _pick_rate(self, agent: Agent, tx_type: str) -> Decimal:
        if tx_type == "deposit":
            return agent.commission_rate_deposit
        if tx_type == "withdrawal":
            return agent.commission_rate_withdraw
        raise ValueError("Unsupported transaction type")

    async def calculate_commission(
        self,
        session: AsyncSession,
        agent_id: int,
        transaction_id: int,
        transaction_amount: Decimal,
        tx_type: str,
        idempotency_key: Optional[str] = None,
    ) -> Commission:
        agent = await self.get_agent(session, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        if agent.status in {AgentStatus.SUSPENDED, AgentStatus.BLOCKED, AgentStatus.INACTIVE}:
            raise ValueError("Agent not eligible for commissions")

        rate = self._pick_rate(agent, tx_type)
        amount = (transaction_amount * rate).quantize(Decimal("0.01"))

        commission = Commission(
            agent_id=agent.id,
            transaction_id=transaction_id,
            amount=amount,
            rate=rate,
            status=CommissionState.CALCULATED,
            idempotency_key=idempotency_key or str(uuid.uuid4()),
            calculated_at=datetime.now(timezone.utc),
        )
        session.add(commission)
        await session.flush()
        return commission

    async def transition_commission(
        self,
        session: AsyncSession,
        commission_id: int,
        target: CommissionState,
        admin_id: Optional[int] = None,
        payout_id: Optional[int] = None,
    ) -> Commission:
        result = await session.execute(select(Commission).where(Commission.id == commission_id))
        commission = result.scalar_one_or_none()
        if not commission:
            raise ValueError("Commission not found")

        # allowed transitions
        allowed = {
            CommissionState.CALCULATED: {CommissionState.PENDING, CommissionState.REJECTED},
            CommissionState.PENDING: {CommissionState.APPROVED, CommissionState.REJECTED},
            CommissionState.APPROVED: {CommissionState.PAYABLE, CommissionState.REJECTED},
            CommissionState.PAYABLE: {CommissionState.PAID, CommissionState.REJECTED},
        }
        if commission.status in allowed and target not in allowed[commission.status]:
            raise ValueError(f"Invalid transition {commission.status} -> {target}")

        commission.status = target
        now = datetime.now(timezone.utc)
        if target == CommissionState.PENDING:
            commission.updated_at = now
        if target == CommissionState.APPROVED:
            commission.approved_at = now
            commission.approved_by = admin_id
        if target == CommissionState.PAYABLE:
            commission.payable_at = now
        if target == CommissionState.PAID:
            commission.paid_at = now
            commission.payout_id = payout_id
            await self._credit_commission_wallet(session, commission)
        await session.flush()
        return commission

    # ----------------- Wallet helpers -----------------
    async def _get_or_create_wallet(
        self,
        session: AsyncSession,
        user_id: int,
        currency: str = "SAR",
        purpose: WalletPurpose = WalletPurpose.COMMISSION,
    ) -> Wallet:
        result = await session.execute(
            select(Wallet).where(
                Wallet.user_id == user_id,
                Wallet.currency == currency,
                Wallet.purpose == purpose,
            )
        )
        wallet = result.scalar_one_or_none()
        if wallet:
            return wallet
        wallet = Wallet(
            user_id=user_id,
            currency=currency,
            purpose=purpose,
            balance=Decimal("0.00"),
            total_commission=Decimal("0.00"),
            total_payouts=Decimal("0.00"),
            is_active=True,
        )
        session.add(wallet)
        await session.flush()
        return wallet

    async def _credit_commission_wallet(self, session: AsyncSession, commission: Commission) -> None:
        wallet = await self._get_or_create_wallet(session, user_id=commission.agent_id)
        wallet.balance += commission.amount
        wallet.total_commission += commission.amount
        wallet.updated_at = datetime.utcnow()

        tx = WalletTransaction(
            wallet_id=wallet.id,
            type="commission",
            amount=commission.amount,
            reference_id=str(commission.transaction_id),
            reference_type="commission",
            idempotency_key=commission.idempotency_key,
            status="completed",
            created_at=datetime.utcnow(),
        )
        session.add(tx)
        await session.flush()

    # ----------------- Analytics helpers -----------------
    async def get_agent_stats(self, session: AsyncSession, agent_id: int) -> dict:
        agent = await self.get_agent(session, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        return {
            "agent_id": agent.id,
            "status": agent.status.value,
            "total_deposits_processed": float(agent.total_deposits_processed),
            "total_withdrawals_processed": float(agent.total_withdrawals_processed),
            "total_commission_earned": float(agent.total_commission_earned),
            "risk_score": float(agent.risk_score),
            "velocity_flagged": agent.velocity_flagged,
        }

    async def preview_commission(self, session: AsyncSession, agent_id: int, transaction_amount: Decimal, tx_type: str) -> dict:
        agent = await self.get_agent(session, agent_id)
        if not agent:
            raise ValueError("Agent not found")
        rate = self._pick_rate(agent, tx_type)
        amount = (transaction_amount * rate).quantize(Decimal("0.01"))
        return {"agent_id": agent_id, "rate": float(rate), "amount": float(amount), "currency": "SAR"}


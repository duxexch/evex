#!/usr/bin/env python3
"""
Financial services routes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from datetime import datetime, timezone

from api.schemas import (
    DepositRequest, WithdrawalRequest, ComplaintRequest, 
    TransactionResponse
)
from api.auth_utils import get_current_user
from models import User, Outbox, OutboxType, OutboxStatus

router = APIRouter()


async def get_db():
    """Placeholder for dependency injection"""
    from api.main import async_session_maker
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@router.post("/deposit")
async def create_deposit(
    request: DepositRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Create a deposit request"""
    outbox = Outbox(
        user_id=current_user.id,
        type=OutboxType.DEPOSIT,
        status=OutboxStatus.PENDING,
        content=f"Deposit request: {request.amount} via {request.payment_method}",
        extra_data={
            "amount": request.amount,
            "payment_method": request.payment_method,
            "receipt_url": request.receipt_url,
            "notes": request.notes
        }
    )
    
    session.add(outbox)
    await session.commit()
    
    return {
        "message": "Deposit request created successfully",
        "request_id": outbox.id,
        "status": outbox.status.value
    }


@router.post("/withdraw")
async def create_withdrawal(
    request: WithdrawalRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Create a withdrawal request"""
    outbox = Outbox(
        user_id=current_user.id,
        type=OutboxType.WITHDRAWAL,
        status=OutboxStatus.PENDING,
        content=f"Withdrawal request: {request.amount}",
        extra_data={
            "amount": request.amount,
            "account_details": request.account_details,
            "notes": request.notes
        }
    )
    
    session.add(outbox)
    await session.commit()
    
    return {
        "message": "Withdrawal request created successfully",
        "request_id": outbox.id,
        "status": outbox.status.value
    }


@router.post("/complaint")
async def create_complaint(
    request: ComplaintRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Create a complaint"""
    outbox = Outbox(
        user_id=current_user.id,
        type=OutboxType.COMPLAINT,
        status=OutboxStatus.PENDING,
        content=f"{request.subject}: {request.description}",
        extra_data={
            "subject": request.subject,
            "description": request.description,
            "attachment_url": request.attachment_url
        }
    )
    
    session.add(outbox)
    await session.commit()
    
    return {
        "message": "Complaint created successfully",
        "request_id": outbox.id,
        "status": outbox.status.value
    }


@router.get("/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Get user transactions"""
    result = await session.execute(
        select(Outbox)
        .where(Outbox.user_id == current_user.id)
        .order_by(Outbox.created_at.desc())
    )
    transactions = result.scalars().all()
    
    return [
        TransactionResponse(
            id=t.id,
            type=t.type.value,
            amount=t.extra_data.get("amount") if t.extra_data else None,
            status=t.status.value,
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        for t in transactions
    ]

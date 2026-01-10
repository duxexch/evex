#!/usr/bin/env python3
"""
Settings routes
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from api.schemas import LanguageResponse, CountryResponse
from api.auth_utils import get_current_user
from models import User, Language, Country

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


@router.get("/languages", response_model=List[LanguageResponse])
async def get_languages(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Get available languages"""
    result = await session.execute(
        select(Language).where(Language.is_active == True)
    )
    languages = result.scalars().all()
    
    return [LanguageResponse.model_validate(lang) for lang in languages]


@router.get("/countries", response_model=List[CountryResponse])
async def get_countries(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Get available countries"""
    result = await session.execute(
        select(Country).where(Country.is_active == True)
    )
    countries = result.scalars().all()
    
    return [CountryResponse.model_validate(country) for country in countries]

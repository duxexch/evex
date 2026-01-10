#!/usr/bin/env python3
"""
✅ DATABASE MIGRATION - CSV to SQLAlchemy
Safely migrates data from legacy CSV files to PostgreSQL database
"""

import asyncio
import csv
import logging
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from models import Base, User, Language, Country

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


async def migrate_database(database_url: str):
    """
    Migrate from CSV to SQLAlchemy database
    """
    
    # Create engine
    engine = create_async_engine(
        database_url,
        echo=False,
        pool_size=10,
        max_overflow=20
    )
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ تم إنشاء جميع الجداول")
    
    # Create session maker
    async_session = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with async_session() as session:
        # 1. Create default languages
        logger.info("📝 إضافة اللغات...")
        languages = [
            Language(
                code='ar',
                name='Arabic',
                native_name='العربية',
                rtl=True,
                is_active=True
            ),
            Language(
                code='en',
                name='English',
                native_name='English',
                rtl=False,
                is_active=True
            )
        ]
        session.add_all(languages)
        await session.commit()
        logger.info(f"✅ تمت إضافة {len(languages)} لغات")
        
        # 2. Create default countries
        logger.info("📝 إضافة الدول...")
        countries = [
            Country(code='SA', name='Saudi Arabia', native_name='المملكة العربية السعودية', phone_prefix='+966'),
            Country(code='AE', name='United Arab Emirates', native_name='الإمارات العربية المتحدة', phone_prefix='+971'),
            Country(code='EG', name='Egypt', native_name='مصر', phone_prefix='+20'),
            Country(code='KW', name='Kuwait', native_name='الكويت', phone_prefix='+965'),
            Country(code='QA', name='Qatar', native_name='قطر', phone_prefix='+974'),
            Country(code='BH', name='Bahrain', native_name='البحرين', phone_prefix='+973'),
            Country(code='OM', name='Oman', native_name='عمان', phone_prefix='+968'),
            Country(code='JO', name='Jordan', native_name='الأردن', phone_prefix='+962'),
            Country(code='LB', name='Lebanon', native_name='لبنان', phone_prefix='+961'),
            Country(code='IQ', name='Iraq', native_name='العراق', phone_prefix='+964'),
            Country(code='SY', name='Syria', native_name='سوريا', phone_prefix='+963'),
            Country(code='MA', name='Morocco', native_name='المغرب', phone_prefix='+212'),
            Country(code='TN', name='Tunisia', native_name='تونس', phone_prefix='+216'),
            Country(code='DZ', name='Algeria', native_name='الجزائر', phone_prefix='+213'),
            Country(code='LY', name='Libya', native_name='ليبيا', phone_prefix='+218'),
            Country(code='US', name='United States', native_name='الولايات المتحدة', phone_prefix='+1'),
            Country(code='TR', name='Turkey', native_name='تركيا', phone_prefix='+90'),
        ]
        session.add_all(countries)
        await session.commit()
        logger.info(f"✅ تمت إضافة {len(countries)} دول")
        
        # 3. Migrate users from CSV
        logger.info("📝 ترحيل المستخدمين من CSV...")
        users_file = Path('users.csv')
        
        if users_file.exists():
            migrated_users = 0
            try:
                with open(users_file, 'r', encoding='utf-8-sig') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        # Skip if telegram_id exists
                        existing = await session.execute(
                            Base.metadata.tables['users'].select().where(
                                Base.metadata.tables['users'].c.telegram_id == int(row['telegram_id'])
                            )
                        )
                        if existing.fetchone():
                            continue
                        
                        user = User(
                            telegram_id=int(row['telegram_id']),
                            first_name=row.get('name', 'Unknown')[:255],
                            language_code=row.get('language', 'ar'),
                            country_code=row.get('country', 'SA'),
                            is_active=row.get('is_banned', 'no') != 'yes',
                            is_banned=row.get('is_banned', 'no') == 'yes',
                            balance=Decimal(row.get('balance', '0')) or Decimal('0.00'),
                            created_at=datetime.fromisoformat(row.get('date', datetime.now().isoformat()))
                        )
                        
                        # Handle phone encryption later
                        # For now, just store plaintext temporarily
                        
                        session.add(user)
                        migrated_users += 1
                        
                        # Batch commit
                        if migrated_users % 100 == 0:
                            await session.commit()
                            logger.info(f"  • تم ترحيل {migrated_users} مستخدم...")
                
                await session.commit()
                logger.info(f"✅ تم ترحيل {migrated_users} مستخدم من CSV")
                
            except Exception as e:
                await session.rollback()
                logger.error(f"❌ خطأ في ترحيل المستخدمين: {e}")
        else:
            logger.warning(f"⚠️  لم يتم العثور على {users_file}")
    
    await engine.dispose()
    logger.info("✅ انتهت المرحلة الأولى من الترحيل بنجاح!")


if __name__ == "__main__":
    import sys
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    database_url = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./langsense.db"
    )
    
    asyncio.run(migrate_database(database_url))

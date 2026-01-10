#!/usr/bin/env python3
"""
Database initialization and setup utilities
"""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from services.database_migration_service import (
    DatabaseInitializer,
    DatabaseHealthCheck,
    MigrationManager,
)
from services.extended_config_schema import get_settings


logger = logging.getLogger(__name__)


async def initialize_database(db_url: Optional[str] = None) -> bool:
    """
    Initialize application database
    
    Args:
        db_url: Database URL (uses config if not provided)
        
    Returns:
        True if initialization successful
    """
    if not db_url:
        settings = get_settings()
        db_url = settings.database.url
    
    initializer = DatabaseInitializer(db_url)
    return await initializer.initialize()


async def check_database_status(db_url: Optional[str] = None) -> dict:
    """
    Check database status
    
    Args:
        db_url: Database URL (uses config if not provided)
        
    Returns:
        Database status dictionary
    """
    if not db_url:
        settings = get_settings()
        db_url = settings.database.url
    
    initializer = DatabaseInitializer(db_url)
    return await initializer.check_status()


async def check_database_health(db_url: Optional[str] = None) -> dict:
    """
    Perform comprehensive database health check
    
    Args:
        db_url: Database URL (uses config if not provided)
        
    Returns:
        Health check result dictionary
    """
    if not db_url:
        settings = get_settings()
        db_url = settings.database.url
    
    health_check = DatabaseHealthCheck(db_url)
    
    # Check connectivity
    connected, conn_error = await health_check.check_connectivity()
    
    # Check tables
    tables_exist, missing_tables = await health_check.check_tables()
    
    # Check indexes
    indexes_exist, missing_indexes = await health_check.check_indexes()
    
    return {
        'connectivity': {
            'ok': connected,
            'error': conn_error,
        },
        'tables': {
            'ok': tables_exist,
            'missing': missing_tables,
        },
        'indexes': {
            'ok': indexes_exist,
            'missing': missing_indexes,
        },
        'overall_healthy': connected and tables_exist and indexes_exist,
    }


async def apply_pending_migrations(db_url: Optional[str] = None) -> tuple:
    """
    Apply all pending migrations
    
    Args:
        db_url: Database URL (uses config if not provided)
        
    Returns:
        (success, applied_migrations) tuple
    """
    if not db_url:
        settings = get_settings()
        db_url = settings.database.url
    
    manager = MigrationManager(db_url)
    await manager.initialize()
    
    try:
        return await manager.apply_all_pending()
    finally:
        await manager.close()


async def get_migration_status(db_url: Optional[str] = None) -> dict:
    """
    Get current migration status
    
    Args:
        db_url: Database URL (uses config if not provided)
        
    Returns:
        Migration status dictionary
    """
    if not db_url:
        settings = get_settings()
        db_url = settings.database.url
    
    manager = MigrationManager(db_url)
    await manager.initialize()
    
    try:
        current = await manager.get_current_version()
        pending = await manager.list_pending_migrations()
        history = await manager.get_migration_history()
        
        return {
            'current_version': current,
            'pending_migrations': pending,
            'total_applied': len(history),
            'migration_history': [(v, ts.isoformat()) for v, ts in history],
        }
    finally:
        await manager.close()

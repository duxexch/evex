#!/usr/bin/env python3
"""
Database migration and initialization
Alembic-integrated schema management
"""

from typing import List, Dict, Optional, Tuple
from pathlib import Path
import logging
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker


logger = logging.getLogger(__name__)


class MigrationManager:
    """Manage database migrations"""
    
    def __init__(self, db_url: str):
        """
        Initialize migration manager
        
        Args:
            db_url: Database URL
        """
        self.db_url = db_url
        self.migrations_dir = Path(__file__).parent.parent / "migrations"
        self.engine = None
        self.session_maker: Optional[async_sessionmaker] = None
    
    async def initialize(self):
        """Initialize engine and session maker"""
        self.engine = create_async_engine(self.db_url, echo=False)
        self.session_maker = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
    
    async def create_migrations_table(self) -> bool:
        """
        Create alembic_version table if not exists
        
        Returns:
            True if created or exists, False on error
        """
        try:
            async with self.engine.connect() as connection:
                await connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS alembic_version (
                        version_num VARCHAR(32) NOT NULL,
                        PRIMARY KEY (version_num)
                    )
                """))
                await connection.commit()
            
            logger.info("Migrations table ready")
            return True
        except Exception as e:
            logger.error(f"Failed to create migrations table: {e}")
            return False
    
    async def get_current_version(self) -> Optional[str]:
        """
        Get current migration version
        
        Returns:
            Current version string or None
        """
        try:
            async with self.session_maker() as session:
                result = await session.execute(
                    text("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1")
                )
                row = result.fetchone()
                return row[0] if row else None
        except Exception as e:
            logger.warning(f"Could not get current version: {e}")
            return None
    
    async def get_migration_history(self) -> List[Tuple[str, datetime]]:
        """
        Get migration history
        
        Returns:
            List of (version, timestamp) tuples
        """
        try:
            async with self.session_maker() as session:
                result = await session.execute(
                    text("SELECT version_num FROM alembic_version ORDER BY version_num DESC")
                )
                versions = [row[0] for row in result.fetchall()]
                return [(v, datetime.utcnow()) for v in versions]
        except Exception as e:
            logger.warning(f"Could not get migration history: {e}")
            return []
    
    async def record_migration(self, version: str) -> bool:
        """
        Record migration as applied
        
        Args:
            version: Migration version
            
        Returns:
            True if recorded
        """
        try:
            async with self.session_maker() as session:
                await session.execute(
                    text("INSERT INTO alembic_version (version_num) VALUES (:version)"),
                    {"version": version},
                )
                await session.commit()
            
            logger.info(f"Recorded migration: {version}")
            return True
        except Exception as e:
            logger.error(f"Failed to record migration: {e}")
            return False
    
    async def list_pending_migrations(self) -> List[str]:
        """
        List pending migrations
        
        Returns:
            List of pending migration filenames
        """
        if not self.migrations_dir.exists():
            return []
        
        applied = set(await self.get_migration_history())
        applied_versions = set(v[0] for v in applied)
        
        pending = []
        for migration_file in sorted(self.migrations_dir.glob("*.sql")):
            version = migration_file.stem
            if version not in applied_versions:
                pending.append(version)
        
        return pending
    
    async def apply_migration(self, migration_file: str) -> bool:
        """
        Apply single migration
        
        Args:
            migration_file: Migration file path or name
            
        Returns:
            True if applied
        """
        try:
            if isinstance(migration_file, str) and not migration_file.endswith('.sql'):
                migration_file = f"{migration_file}.sql"
            
            migration_path = self.migrations_dir / migration_file
            
            if not migration_path.exists():
                logger.error(f"Migration file not found: {migration_path}")
                return False
            
            with open(migration_path, 'r') as f:
                sql = f.read()
            
            async with self.session_maker() as session:
                await session.execute(text(sql))
                await session.commit()
            
            logger.info(f"Applied migration: {migration_file}")
            return True
        except Exception as e:
            logger.error(f"Failed to apply migration {migration_file}: {e}")
            return False
    
    async def apply_all_pending(self) -> Tuple[bool, List[str]]:
        """
        Apply all pending migrations
        
        Returns:
            (all_applied, applied_list) tuple
        """
        pending = await self.list_pending_migrations()
        
        if not pending:
            logger.info("No pending migrations")
            return True, []
        
        applied = []
        for migration in pending:
            if await self.apply_migration(migration):
                if await self.record_migration(migration):
                    applied.append(migration)
                else:
                    logger.error(f"Could not record migration: {migration}")
                    return False, applied
            else:
                logger.error(f"Failed to apply migration: {migration}")
                return False, applied
        
        return True, applied
    
    async def validate_schema(self) -> Tuple[bool, List[str]]:
        """
        Validate database schema
        
        Returns:
            (valid, issues) tuple
        """
        issues = []
        
        try:
            async with self.session_maker() as session:
                # Check for required tables
                required_tables = ['users', 'games', 'transactions']
                
                for table in required_tables:
                    result = await session.execute(
                        text(f"""
                            SELECT EXISTS(
                                SELECT 1 FROM information_schema.tables 
                                WHERE table_name = '{table}'
                            )
                        """)
                    )
                    
                    exists = result.scalar()
                    if not exists:
                        issues.append(f"Missing table: {table}")
            
            return len(issues) == 0, issues
        except Exception as e:
            return False, [str(e)]
    
    async def close(self):
        """Close database connections"""
        if self.engine:
            await self.engine.dispose()


class DatabaseInitializer:
    """Initialize fresh database"""
    
    def __init__(self, db_url: str):
        """
        Initialize database initializer
        
        Args:
            db_url: Database URL
        """
        self.db_url = db_url
        self.migration_manager = MigrationManager(db_url)
    
    async def initialize(self) -> bool:
        """
        Initialize complete database
        
        Returns:
            True if successful
        """
        try:
            logger.info("Starting database initialization...")
            
            # Initialize migration manager
            await self.migration_manager.initialize()
            
            # Create migrations tracking table
            if not await self.migration_manager.create_migrations_table():
                return False
            
            # Apply all migrations
            all_applied, applied_list = await self.migration_manager.apply_all_pending()
            
            if not all_applied:
                logger.error("Failed to apply all migrations")
                return False
            
            # Validate schema
            schema_valid, issues = await self.migration_manager.validate_schema()
            
            if not schema_valid:
                logger.warning(f"Schema validation issues: {issues}")
            
            logger.info(f"Database initialization complete. Applied {len(applied_list)} migrations")
            return True
        
        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            return False
        finally:
            await self.migration_manager.close()
    
    async def check_status(self) -> Dict[str, any]:
        """
        Check database status
        
        Returns:
            Status dictionary
        """
        try:
            await self.migration_manager.initialize()
            
            # Get current version
            current_version = await self.migration_manager.get_current_version()
            
            # Get pending migrations
            pending = await self.migration_manager.list_pending_migrations()
            
            # Get history
            history = await self.migration_manager.get_migration_history()
            
            # Validate schema
            valid, issues = await self.migration_manager.validate_schema()
            
            return {
                'initialized': current_version is not None,
                'current_version': current_version,
                'pending_migrations': pending,
                'applied_migrations': len(history),
                'schema_valid': valid,
                'schema_issues': issues,
            }
        
        except Exception as e:
            return {
                'initialized': False,
                'error': str(e),
            }
        finally:
            await self.migration_manager.close()


class DatabaseHealthCheck:
    """Health check for database"""
    
    def __init__(self, db_url: str):
        """
        Initialize database health check
        
        Args:
            db_url: Database URL
        """
        self.db_url = db_url
    
    async def check_connectivity(self) -> Tuple[bool, Optional[str]]:
        """
        Check database connectivity
        
        Returns:
            (connected, error_message) tuple
        """
        try:
            engine = create_async_engine(self.db_url, echo=False)
            
            async with engine.connect() as connection:
                result = await connection.execute(text("SELECT 1"))
                if result.scalar() is None:
                    return False, "Connection test returned null"
            
            await engine.dispose()
            return True, None
        
        except Exception as e:
            return False, str(e)
    
    async def check_tables(self) -> Tuple[bool, List[str]]:
        """
        Check required tables exist
        
        Returns:
            (all_exist, missing_tables) tuple
        """
        try:
            engine = create_async_engine(self.db_url, echo=False)
            
            required_tables = [
                'users',
                'games',
                'transactions',
                'notifications',
                'audit_logs',
            ]
            
            missing = []
            
            async with engine.connect() as connection:
                for table in required_tables:
                    result = await connection.execute(
                        text(f"""
                            SELECT EXISTS(
                                SELECT 1 FROM information_schema.tables 
                                WHERE table_name = '{table}'
                            )
                        """)
                    )
                    
                    if not result.scalar():
                        missing.append(table)
            
            await engine.dispose()
            return len(missing) == 0, missing
        
        except Exception as e:
            logger.warning(f"Table check failed: {e}")
            return False, []
    
    async def check_indexes(self) -> Tuple[bool, List[str]]:
        """
        Check critical indexes exist
        
        Returns:
            (all_exist, missing_indexes) tuple
        """
        try:
            engine = create_async_engine(self.db_url, echo=False)
            
            critical_indexes = [
                ('users', 'users_id_pk'),
                ('games', 'games_user_id_idx'),
                ('transactions', 'transactions_user_id_idx'),
            ]
            
            missing = []
            
            async with engine.connect() as connection:
                for table, index in critical_indexes:
                    result = await connection.execute(
                        text(f"""
                            SELECT EXISTS(
                                SELECT 1 FROM information_schema.statistics
                                WHERE table_name = '{table}' AND index_name = '{index}'
                            )
                        """)
                    )
                    
                    if not result.scalar():
                        missing.append(f"{table}.{index}")
            
            await engine.dispose()
            return len(missing) == 0, missing
        
        except Exception as e:
            logger.warning(f"Index check failed: {e}")
            return False, []

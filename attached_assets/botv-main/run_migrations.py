#!/usr/bin/env python3
"""
Manual migration script to run Phase 2 migrations
"""

import asyncio
import sys
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import DATABASE_URL


async def run_migrations():
    """Run all Phase 2 migrations in order"""
    
    print(f"🔄 Connecting to database: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    try:
        async with engine.begin() as conn:
            print("\n✅ Connected to database successfully!")
            
            # Check if alembic_version table exists
            result = await conn.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='alembic_version'
            """))
            alembic_exists = result.fetchone() is not None
            
            if not alembic_exists:
                print("\n📋 Creating alembic_version table...")
                await conn.execute(text("""
                    CREATE TABLE alembic_version (
                        version_num VARCHAR(32) NOT NULL,
                        CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                    )
                """))
            
            # Check current version
            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            current = result.fetchone()
            current_version = current[0] if current else None
            print(f"\n📍 Current migration version: {current_version or 'None'}")
            
            # Migration 1: Games table
            if current_version is None or current_version == '001':
                print("\n🔧 Running migration: 20260103_174400_create_games_table")
                
                # Check if games table exists
                result = await conn.execute(text("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name='games'
                """))
                games_exists = result.fetchone() is not None
                
                if not games_exists:
                    await conn.execute(text("""
                        CREATE TABLE games (
                            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                            name VARCHAR(100) NOT NULL UNIQUE,
                            description TEXT,
                            type VARCHAR(50),
                            status VARCHAR(20) NOT NULL DEFAULT 'active',
                            min_bet NUMERIC(15, 2) NOT NULL DEFAULT 1.00,
                            max_bet NUMERIC(15, 2) NOT NULL DEFAULT 10000.00,
                            house_edge NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
                            rtp NUMERIC(5, 2) NOT NULL DEFAULT 95.00,
                            play_count INTEGER NOT NULL DEFAULT 0,
                            total_volume NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
                            is_active BOOLEAN NOT NULL DEFAULT 1,
                            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            created_by INTEGER,
                            updated_by INTEGER
                        )
                    """))
                    
                    await conn.execute(text("""
                        CREATE INDEX ix_games_name ON games (name)
                    """))
                    
                    await conn.execute(text("""
                        CREATE INDEX ix_games_status ON games (status)
                    """))
                    
                    # Game configurations table
                    await conn.execute(text("""
                        CREATE TABLE game_configurations (
                            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                            game_id INTEGER NOT NULL,
                            config_key VARCHAR(100) NOT NULL,
                            config_value TEXT NOT NULL,
                            data_type VARCHAR(20) NOT NULL DEFAULT 'string',
                            description TEXT,
                            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY(game_id) REFERENCES games (id) ON DELETE CASCADE,
                            UNIQUE (game_id, config_key)
                        )
                    """))
                    
                    await conn.execute(text("""
                        CREATE INDEX ix_game_configurations_game_id ON game_configurations (game_id)
                    """))
                    
                    print("✅ Games tables created successfully!")
                else:
                    print("⏭️  Games table already exists, skipping...")
                
                # Update version
                if current_version is None:
                    await conn.execute(text("""
                        INSERT INTO alembic_version (version_num) VALUES ('20260103_174400')
                    """))
                else:
                    await conn.execute(text("""
                        UPDATE alembic_version SET version_num = '20260103_174400'
                    """))
            
            # Migration 2: Profit/Loss tables
            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            current = result.fetchone()
            current_version = current[0] if current else None
            
            if current_version == '20260103_174400':
                print("\n🔧 Running migration: 20260103_174401_create_profit_loss_tables")
                
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS profit_loss_rules (
                        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                        game_id INTEGER NOT NULL,
                        rule_type VARCHAR(50) NOT NULL,
                        adjustment_value NUMERIC(10, 2) NOT NULL,
                        priority INTEGER NOT NULL DEFAULT 1,
                        is_active BOOLEAN NOT NULL DEFAULT 1,
                        description TEXT,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        created_by INTEGER,
                        updated_by INTEGER,
                        FOREIGN KEY(game_id) REFERENCES games (id) ON DELETE CASCADE
                    )
                """))
                
                await conn.execute(text("""
                    CREATE INDEX ix_profit_loss_rules_game_id ON profit_loss_rules (game_id)
                """))
                
                await conn.execute(text("""
                    CREATE INDEX ix_profit_loss_rules_is_active ON profit_loss_rules (is_active)
                """))
                
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS profit_loss_player_rules (
                        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                        player_id INTEGER NOT NULL,
                        game_id INTEGER NOT NULL,
                        rule_type VARCHAR(50) NOT NULL,
                        adjustment_value NUMERIC(10, 2) NOT NULL,
                        start_date DATE NOT NULL,
                        end_date DATE,
                        is_active BOOLEAN NOT NULL DEFAULT 1,
                        description TEXT,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        created_by INTEGER,
                        updated_by INTEGER,
                        FOREIGN KEY(game_id) REFERENCES games (id) ON DELETE CASCADE
                    )
                """))
                
                await conn.execute(text("""
                    CREATE INDEX ix_profit_loss_player_rules_player_id ON profit_loss_player_rules (player_id)
                """))
                
                await conn.execute(text("""
                    CREATE INDEX ix_profit_loss_player_rules_game_id ON profit_loss_player_rules (game_id)
                """))
                
                print("✅ Profit/Loss tables created successfully!")
                
                await conn.execute(text("""
                    UPDATE alembic_version SET version_num = '20260103_174401'
                """))
            
            # Migration 3: RBAC tables
            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            current = result.fetchone()
            current_version = current[0] if current else None
            
            if current_version == '20260103_174401':
                print("\n🔧 Running migration: 20260103_174402_create_rbac_tables")
                
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS role_permissions (
                        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                        role_name VARCHAR(50) NOT NULL,
                        permission VARCHAR(100) NOT NULL,
                        description TEXT,
                        is_active BOOLEAN NOT NULL DEFAULT 1,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE (role_name, permission)
                    )
                """))
                
                await conn.execute(text("""
                    CREATE INDEX ix_role_permissions_role_name ON role_permissions (role_name)
                """))
                
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS user_roles (
                        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        role_name VARCHAR(50) NOT NULL,
                        scope_game_ids TEXT,
                        is_active BOOLEAN NOT NULL DEFAULT 1,
                        assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        assigned_by INTEGER,
                        UNIQUE (user_id, role_name)
                    )
                """))
                
                await conn.execute(text("""
                    CREATE INDEX ix_user_roles_user_id ON user_roles (user_id)
                """))
                
                await conn.execute(text("""
                    CREATE INDEX ix_user_roles_role_name ON user_roles (role_name)
                """))
                
                print("✅ RBAC tables created successfully!")
                
                await conn.execute(text("""
                    UPDATE alembic_version SET version_num = '20260103_174402'
                """))
            
            # Migration 4: Player balance tables
            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            current = result.fetchone()
            current_version = current[0] if current else None
            
            if current_version == '20260103_174402':
                print("\n🔧 Running migration: 20260103_174403_create_player_balance_tables")
                
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS player_balances (
                        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                        player_id INTEGER NOT NULL UNIQUE,
                        current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
                        total_deposited NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
                        total_withdrawn NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
                        total_wagered NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
                        total_winnings NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
                        is_banned BOOLEAN NOT NULL DEFAULT 0,
                        ban_reason TEXT,
                        banned_at TIMESTAMP,
                        banned_until TIMESTAMP,
                        banned_by INTEGER,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                
                await conn.execute(text("""
                    CREATE INDEX ix_player_balances_player_id ON player_balances (player_id)
                """))
                
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS balance_transactions (
                        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                        player_id INTEGER NOT NULL,
                        transaction_type VARCHAR(50) NOT NULL,
                        amount NUMERIC(15, 2) NOT NULL,
                        balance_before NUMERIC(15, 2) NOT NULL,
                        balance_after NUMERIC(15, 2) NOT NULL,
                        game_id INTEGER,
                        reference_id VARCHAR(100),
                        description TEXT,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        created_by INTEGER,
                        FOREIGN KEY(game_id) REFERENCES games (id)
                    )
                """))
                
                await conn.execute(text("""
                    CREATE INDEX ix_balance_transactions_player_id ON balance_transactions (player_id)
                """))
                
                await conn.execute(text("""
                    CREATE INDEX ix_balance_transactions_transaction_type ON balance_transactions (transaction_type)
                """))
                
                await conn.execute(text("""
                    CREATE INDEX ix_balance_transactions_created_at ON balance_transactions (created_at)
                """))
                
                print("✅ Player balance tables created successfully!")
                
                await conn.execute(text("""
                    UPDATE alembic_version SET version_num = '20260103_174403'
                """))
            
            # Final version check
            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            final_version = result.fetchone()[0]
            
            print(f"\n✅ All migrations completed successfully!")
            print(f"📍 Final database version: {final_version}")
            
    except Exception as e:
        print(f"\n❌ Error running migrations: {e}")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Running Phase 2 Database Migrations")
    print("=" * 60)
    asyncio.run(run_migrations())
    print("\n✅ Migration process completed!")

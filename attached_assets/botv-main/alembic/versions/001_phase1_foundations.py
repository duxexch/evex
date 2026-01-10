"""Phase 1 - Foundations: Agent Distribution & Game Algorithm Base Tables

Revision ID: 001
Revises:
Create Date: 2026-01-02 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    ✅ ZERO REGRESSION: All columns are NULLABLE
    ✅ BACKWARD COMPATIBLE: Existing code unaffected
    ✅ FAIL SAFE: Defaults provided
    """
    
    # Step 1: Add Agent Distribution columns to outbox table
    with op.batch_alter_table('outbox', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('assigned_agent_id', sa.Integer(), nullable=True, index=True)
        )
        batch_op.add_column(
            sa.Column('assignment_strategy', sa.String(50), nullable=True)
        )
        batch_op.add_column(
            sa.Column('assignment_timestamp', sa.DateTime(timezone=True), nullable=True)
        )
    
    # Step 2: Create system_settings table
    op.create_table(
        'system_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(100), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('category', sa.String(50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('data_type', sa.String(20), nullable=True, server_default='string'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_by_admin_id', sa.BigInteger(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key', name='uq_system_settings_key'),
    )
    op.create_index('idx_system_settings_category', 'system_settings', ['category'])
    op.create_index('idx_system_settings_updated', 'system_settings', ['updated_at'])
    
    # NOTE: Legacy game_sessions and game_rounds tables removed.
    # Use secure_game_sessions (created in 20260105_000001) for production gaming.
    # The old GameSession model is deprecated; use SecureGameSession instead.


def downgrade() -> None:
    """Rollback changes - safe to revert"""
    
    # NOTE: game_sessions and game_rounds tables are not created in upgrade(),
    # so no need to drop them in downgrade()
    
    # Drop system_settings
    op.drop_table('system_settings')
    
    # Remove outbox columns
    with op.batch_alter_table('outbox', schema=None) as batch_op:
        batch_op.drop_column('assignment_timestamp')
        batch_op.drop_column('assignment_strategy')
        batch_op.drop_column('assigned_agent_id')

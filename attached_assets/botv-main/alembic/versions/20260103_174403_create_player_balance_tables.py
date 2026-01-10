"""create player balance tables

Revision ID: 20260103_174403
Revises: 20260103_174402
Create Date: 2026-01-03 17:44:03

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260103_174403'
down_revision = '20260103_174402'
branch_labels = None
depends_on = None


def upgrade():
    # player_balances table
    op.create_table(
        'player_balances',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False, unique=True),
        sa.Column('current_balance', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('total_deposited', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('total_withdrawn', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('total_wagered', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('total_winnings', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('is_banned', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('ban_reason', sa.String(255), nullable=True),
        sa.Column('ban_until', sa.DateTime(), nullable=True),
        sa.Column('balance_at_month_start', sa.Numeric(15, 2), nullable=True),
        sa.Column('balance_at_week_start', sa.Numeric(15, 2), nullable=True),
        sa.Column('balance_at_day_start', sa.Numeric(15, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['player_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_player_balance_player', 'player_balances', ['player_id'])
    op.create_index('idx_player_balance_banned', 'player_balances', ['is_banned'])
    
    # balance_transactions table
    op.create_table(
        'balance_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('transaction_type', sa.String(50), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('game_id', sa.Integer(), nullable=True),
        sa.Column('game_session_id', sa.String(100), nullable=True),
        sa.Column('reference_id', sa.String(100), nullable=True),
        sa.Column('balance_before', sa.Numeric(15, 2), nullable=False),
        sa.Column('balance_after', sa.Numeric(15, 2), nullable=False),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('signature', sa.String(255), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['player_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['game_id'], ['games.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_balance_trans_player', 'balance_transactions', ['player_id'])
    op.create_index('idx_balance_trans_type', 'balance_transactions', ['transaction_type'])
    op.create_index('idx_balance_trans_created', 'balance_transactions', ['created_at'])
    op.create_index('idx_balance_trans_game', 'balance_transactions', ['game_id'])


def downgrade():
    op.drop_index('idx_balance_trans_game', 'balance_transactions')
    op.drop_index('idx_balance_trans_created', 'balance_transactions')
    op.drop_index('idx_balance_trans_type', 'balance_transactions')
    op.drop_index('idx_balance_trans_player', 'balance_transactions')
    op.drop_table('balance_transactions')
    
    op.drop_index('idx_player_balance_banned', 'player_balances')
    op.drop_index('idx_player_balance_player', 'player_balances')
    op.drop_table('player_balances')

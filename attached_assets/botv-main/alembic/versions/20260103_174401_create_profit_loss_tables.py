"""create profit loss tables

Revision ID: 20260103_174401
Revises: 20260103_174400
Create Date: 2026-01-03 17:44:01

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260103_174401'
down_revision = '20260103_174400'
branch_labels = None
depends_on = None


def upgrade():
    # profit_loss_rules table
    op.create_table(
        'profit_loss_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=True),
        sa.Column('rule_name', sa.String(100), nullable=True),
        sa.Column('rule_type', sa.String(50), nullable=False),
        sa.Column('min_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('max_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('win_streak_threshold', sa.Integer(), nullable=True),
        sa.Column('loss_streak_threshold', sa.Integer(), nullable=True),
        sa.Column('house_edge_adjustment', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.Column('payout_multiplier', sa.Numeric(5, 2), nullable=False, server_default='1.0'),
        sa.Column('loss_cap', sa.Numeric(15, 2), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['game_id'], ['games.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['player_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_profit_loss_game', 'profit_loss_rules', ['game_id'])
    op.create_index('idx_profit_loss_player', 'profit_loss_rules', ['player_id'])
    op.create_index('idx_profit_loss_active', 'profit_loss_rules', ['is_active', 'priority'])
    
    # profit_loss_player_rules table
    op.create_table(
        'profit_loss_player_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=True),
        sa.Column('custom_house_edge', sa.Numeric(5, 2), nullable=True),
        sa.Column('daily_loss_limit', sa.Numeric(15, 2), nullable=True),
        sa.Column('weekly_loss_limit', sa.Numeric(15, 2), nullable=True),
        sa.Column('max_payout_multiplier', sa.Numeric(5, 2), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['player_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['game_id'], ['games.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_player_rule_player', 'profit_loss_player_rules', ['player_id'])
    op.create_index('idx_player_rule_game', 'profit_loss_player_rules', ['game_id'])
    op.create_index('idx_player_rule_active', 'profit_loss_player_rules', ['is_active'])


def downgrade():
    op.drop_index('idx_player_rule_active', 'profit_loss_player_rules')
    op.drop_index('idx_player_rule_game', 'profit_loss_player_rules')
    op.drop_index('idx_player_rule_player', 'profit_loss_player_rules')
    op.drop_table('profit_loss_player_rules')
    
    op.drop_index('idx_profit_loss_active', 'profit_loss_rules')
    op.drop_index('idx_profit_loss_player', 'profit_loss_rules')
    op.drop_index('idx_profit_loss_game', 'profit_loss_rules')
    op.drop_table('profit_loss_rules')

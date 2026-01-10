"""create games table

Revision ID: 20260103_174400
Revises: 
Create Date: 2026-01-03 17:44:00

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '20260103_174400'
down_revision = '001'  # Revises Phase 1 foundations
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'games',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type', sa.String(50), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('min_bet', sa.Numeric(15, 2), nullable=False, server_default='1.00'),
        sa.Column('max_bet', sa.Numeric(15, 2), nullable=False, server_default='10000.00'),
        sa.Column('house_edge', sa.Numeric(5, 2), nullable=False, server_default='5.00'),
        sa.Column('rtp', sa.Numeric(5, 2), nullable=False, server_default='95.00'),
        sa.Column('algorithm_mode', sa.String(50), nullable=False, server_default='FIXED_HOUSE_EDGE'),
        sa.Column('is_featured', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('play_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_volume', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Game Configurations table
    op.create_table(
        'game_configurations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=False),
        sa.Column('config_key', sa.String(100), nullable=False),
        sa.Column('config_value', sa.Text(), nullable=True),
        sa.Column('data_type', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['game_id'], ['games.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('game_id', 'config_key', name='uk_game_config')
    )
    
    op.create_index('idx_games_status', 'games', ['status'])
    op.create_index('idx_games_created', 'games', ['created_at'])
    op.create_index('idx_game_config_game', 'game_configurations', ['game_id'])


def downgrade():
    op.drop_index('idx_game_config_game', 'game_configurations')
    op.drop_table('game_configurations')
    
    op.drop_index('idx_games_created', 'games')
    op.drop_index('idx_games_status', 'games')
    op.drop_table('games')

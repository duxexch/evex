"""create rbac tables

Revision ID: 20260103_174402
Revises: 20260103_174401
Create Date: 2026-01-03 17:44:02

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260103_174402'
down_revision = '20260103_174401'
branch_labels = None
depends_on = None


def upgrade():
    # role_permissions table
    op.create_table(
        'role_permissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('role_name', sa.String(50), nullable=False),
        sa.Column('permission', sa.String(100), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('role_name', 'permission', name='uk_role_permission'),
        sa.UniqueConstraint('role_name', name='uq_role_permissions_role_name'),
    )
    
    op.create_index('idx_role_perm_role', 'role_permissions', ['role_name'])
    op.create_index('idx_role_perm_active', 'role_permissions', ['is_active'])
    
    # user_roles table
    op.create_table(
        'user_roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role_name', sa.String(50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('scope_game_ids', sa.String(500), nullable=True),
        sa.Column('assigned_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('assigned_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_name'], ['role_permissions.role_name']),
        sa.ForeignKeyConstraint(['assigned_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'role_name', name='uk_user_role')
    )
    
    op.create_index('idx_user_role_user', 'user_roles', ['user_id'])
    op.create_index('idx_user_role_active', 'user_roles', ['is_active'])


def downgrade():
    op.drop_index('idx_user_role_active', 'user_roles')
    op.drop_index('idx_user_role_user', 'user_roles')
    op.drop_table('user_roles')
    
    op.drop_index('idx_role_perm_active', 'role_permissions')
    op.drop_index('idx_role_perm_role', 'role_permissions')
    op.drop_table('role_permissions')

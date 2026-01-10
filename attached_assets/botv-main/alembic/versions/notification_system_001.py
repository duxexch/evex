"""
Add notification and notification_event tables

Revision ID: notification_system_001
Revises: 20260105_000001_add_secure_game_sessions
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'notification_system_001'
down_revision = '20260105_000001_add_secure_game_sessions'
branch_labels = None
depends_on = None


def upgrade():
    """Create notification tables."""
    
    # Create enum types
    notification_priority = postgresql.ENUM(
        'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO',
        name='notificationpriority',
        create_type=True
    )
    notification_type = postgresql.ENUM(
        'AGENT_COMMISSION_APPROVED', 'AGENT_COMMISSION_PAID', 'AGENT_COMMISSION_REJECTED',
        'AFFILIATE_PAYOUT_APPROVED', 'AFFILIATE_PAYOUT_PAID', 'AFFILIATE_PAYOUT_REJECTED',
        'TRANSACTION_ALERT', 'SYSTEM_ALERT', 'USER_ACTION_REQUIRED', 'GENERAL',
        name='notificationtype',
        create_type=True
    )
    notification_status = postgresql.ENUM(
        'PENDING', 'DELIVERED', 'READ', 'INTERACTED', 'DISMISSED', 'FAILED',
        name='notificationstatus',
        create_type=True
    )
    
    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('notification_type', notification_type, nullable=False),
        sa.Column('priority', notification_priority, nullable=False, server_default='MEDIUM'),
        sa.Column('status', notification_status, nullable=False, server_default='PENDING'),
        sa.Column('action_url', sa.String(length=500), nullable=True),
        sa.Column('idempotency_key', sa.String(length=100), nullable=True),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('interacted_at', sa.DateTime(), nullable=True),
        sa.Column('dismissed_at', sa.DateTime(), nullable=True),
        sa.Column('event_id', sa.Integer(), nullable=True),
        sa.Column('actor_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'), onupdate=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for notifications
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_status', 'notifications', ['status'])
    op.create_index('ix_notifications_priority', 'notifications', ['priority'])
    op.create_index('ix_notifications_notification_type', 'notifications', ['notification_type'])
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])
    op.create_index('ix_notifications_idempotency_key', 'notifications', ['idempotency_key'], unique=True)
    op.create_index('ix_notifications_user_status', 'notifications', ['user_id', 'status'])
    op.create_index('ix_notifications_user_priority', 'notifications', ['user_id', 'priority'])
    op.create_index('ix_notifications_user_created', 'notifications', ['user_id', 'created_at'])
    op.create_index('ix_notifications_event_id', 'notifications', ['event_id'])
    op.create_index('ix_notifications_actor_id', 'notifications', ['actor_id'])
    
    # Create notification_events table
    op.create_table(
        'notification_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('notification_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('actor_id', sa.Integer(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['notification_id'], ['notifications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for notification_events
    op.create_index('ix_notification_events_notification_id', 'notification_events', ['notification_id'])
    op.create_index('ix_notification_events_event_type', 'notification_events', ['event_type'])
    op.create_index('ix_notification_events_actor_id', 'notification_events', ['actor_id'])
    op.create_index('ix_notification_events_created_at', 'notification_events', ['created_at'])


def downgrade():
    """Drop notification tables."""
    op.drop_index('ix_notification_events_created_at', table_name='notification_events')
    op.drop_index('ix_notification_events_actor_id', table_name='notification_events')
    op.drop_index('ix_notification_events_event_type', table_name='notification_events')
    op.drop_index('ix_notification_events_notification_id', table_name='notification_events')
    op.drop_table('notification_events')
    
    op.drop_index('ix_notifications_actor_id', table_name='notifications')
    op.drop_index('ix_notifications_event_id', table_name='notifications')
    op.drop_index('ix_notifications_user_created', table_name='notifications')
    op.drop_index('ix_notifications_user_priority', table_name='notifications')
    op.drop_index('ix_notifications_user_status', table_name='notifications')
    op.drop_index('ix_notifications_idempotency_key', table_name='notifications')
    op.drop_index('ix_notifications_created_at', table_name='notifications')
    op.drop_index('ix_notifications_notification_type', table_name='notifications')
    op.drop_index('ix_notifications_priority', table_name='notifications')
    op.drop_index('ix_notifications_status', table_name='notifications')
    op.drop_index('ix_notifications_user_id', table_name='notifications')
    op.drop_table('notifications')
    
    # Drop enums (PostgreSQL only)
    sa.Enum(name='notificationstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='notificationtype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='notificationpriority').drop(op.get_bind(), checkfirst=True)

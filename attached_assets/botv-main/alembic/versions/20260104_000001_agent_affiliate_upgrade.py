"""Agent & Affiliate governance upgrade

Revision ID: 20260104_000001_agent_affiliate_upgrade
Revises: 20260103_174403
Create Date: 2026-01-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260104_000001_agent_affiliate_upgrade'
down_revision = '20260103_174403'
branch_labels = None
depends_on = None


# Enums
commission_state_enum = sa.Enum(
    'calculated', 'pending', 'approved', 'payable', 'paid', 'rejected',
    name='commissionstate'
)
affiliate_tier_enum = sa.Enum('bronze', 'silver', 'gold', 'platinum', name='affiliatetier')
wallet_purpose_enum = sa.Enum('main', 'commission', 'escrow', name='walletpurpose')
agent_status_enum = sa.Enum('active', 'inactive', 'suspended', 'offline', 'blocked', name='agentstatus')


def upgrade():
    # Ensure agents table exists to allow alterations below (fresh DB bootstrap safety)
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table('agents'):
        op.create_table(
            'agents',
            sa.Column('id', sa.Integer(), primary_key=True),
        )

    # --- Agents ---
    with op.batch_alter_table('agents') as batch:
        batch.add_column(sa.Column('daily_commission_limit', sa.Numeric(15, 2), nullable=False, server_default='100000.00'))
        batch.add_column(sa.Column('monthly_commission_limit', sa.Numeric(15, 2), nullable=False, server_default='1000000.00'))
        batch.add_column(sa.Column('risk_score', sa.Numeric(5, 2), nullable=False, server_default='0.00'))
        batch.add_column(sa.Column('velocity_flagged', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column('last_reviewed_at', sa.DateTime(timezone=True), nullable=True))
    # extend agentstatus enum (PostgreSQL)
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TYPE agentstatus ADD VALUE IF NOT EXISTS 'blocked'")

    # --- Commissions ---
    commission_state_enum.create(op.get_bind(), checkfirst=True)
    with op.batch_alter_table('commissions') as batch:
        batch.add_column(sa.Column('status', commission_state_enum, nullable=False, server_default='calculated'))
        batch.add_column(sa.Column('calculated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')))
        batch.add_column(sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column('approved_by', sa.BigInteger(), nullable=True))
        batch.add_column(sa.Column('payable_at', sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column('payout_id', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('idempotency_key', sa.String(length=64), nullable=True))
        batch.add_column(sa.Column('notes', sa.Text(), nullable=True))
        batch.add_column(sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))
        # change FK agent_id to agents.id if not already
        batch.alter_column('agent_id', existing_type=sa.Integer(), existing_nullable=False, new_column_name='agent_id')
        batch.create_index('idx_commission_agent_status', ['agent_id', 'status'], unique=False)
        batch.create_index('idx_commission_transaction', ['transaction_id'], unique=False)

    # --- Wallets ---
    wallet_purpose_enum.create(op.get_bind(), checkfirst=True)
    with op.batch_alter_table('wallets') as batch:
        batch.add_column(sa.Column('purpose', wallet_purpose_enum, nullable=False, server_default='main'))
        batch.add_column(sa.Column('total_payouts', sa.Numeric(15, 2), nullable=False, server_default='0.0'))
        batch.add_column(sa.Column('daily_limit', sa.Numeric(15, 2), nullable=False, server_default='0.0'))
        batch.add_column(sa.Column('monthly_limit', sa.Numeric(15, 2), nullable=False, server_default='0.0'))

    # --- Wallet Transactions ---
    with op.batch_alter_table('wallet_transactions') as batch:
        batch.add_column(sa.Column('idempotency_key', sa.String(length=64), nullable=True))
        batch.add_column(sa.Column('reference_type', sa.String(length=50), nullable=True))
        batch.add_column(sa.Column('created_by', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('approved_by', sa.Integer(), nullable=True))

    # --- Affiliates ---
    affiliate_tier_enum.create(op.get_bind(), checkfirst=True)
    with op.batch_alter_table('affiliates') as batch:
        batch.add_column(sa.Column('referral_token', sa.String(length=64), nullable=True))
        batch.add_column(sa.Column('link_signature', sa.String(length=128), nullable=True))
        batch.add_column(sa.Column('tier', affiliate_tier_enum, nullable=False, server_default='bronze'))
        batch.add_column(sa.Column('tier_set_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('daily_payout_limit', sa.Numeric(15, 2), nullable=False, server_default='0.0'))
        batch.add_column(sa.Column('monthly_payout_limit', sa.Numeric(15, 2), nullable=False, server_default='0.0'))
        batch.add_column(sa.Column('escrow_balance', sa.Numeric(15, 2), nullable=False, server_default='0.0'))
        batch.create_unique_constraint('uq_affiliate_referral_token', ['referral_token'])

    # --- Affiliate Referrals ---
    with op.batch_alter_table('affiliate_referrals') as batch:
        batch.add_column(sa.Column('attributed_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('locked', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.create_unique_constraint('uq_affiliate_referral_user', ['affiliate_id', 'referred_user_id'])

    # --- Affiliate Commissions ---
    with op.batch_alter_table('affiliate_commissions') as batch:
        batch.add_column(sa.Column('status', commission_state_enum, nullable=False, server_default='calculated'))
        batch.add_column(sa.Column('idempotency_key', sa.String(length=64), nullable=True))
        batch.add_column(sa.Column('approved_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('approved_by', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('paid_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('payout_id', sa.Integer(), nullable=True))

    # --- Affiliate Payouts ---
    with op.batch_alter_table('affiliate_payouts') as batch:
        batch.add_column(sa.Column('idempotency_key', sa.String(length=64), nullable=True))
        batch.add_column(sa.Column('approved_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('approved_by', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('paid_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('failure_reason', sa.Text(), nullable=True))


def downgrade():
    # Reverse operations in safe order
    with op.batch_alter_table('affiliate_payouts') as batch:
        batch.drop_column('failure_reason')
        batch.drop_column('paid_at')
        batch.drop_column('approved_by')
        batch.drop_column('approved_at')
        batch.drop_column('idempotency_key')


    # Ensure dependent tables exist before altering
    if not inspector.has_table('commissions'):
        op.create_table(
            'commissions',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('agent_id', sa.Integer(), nullable=True),
            sa.Column('transaction_id', sa.Integer(), nullable=True),
        )
    if not inspector.has_table('wallets'):
        op.create_table(
            'wallets',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), nullable=True),
            sa.Column('balance', sa.Numeric(15, 2), nullable=False, server_default='0'),
        )
    if not inspector.has_table('wallet_transactions'):
        op.create_table(
            'wallet_transactions',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('wallet_id', sa.Integer(), nullable=True),
            sa.Column('amount', sa.Numeric(15, 2), nullable=True),
        )
    if not inspector.has_table('affiliates'):
        op.create_table(
            'affiliates',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), nullable=True),
        )
    if not inspector.has_table('affiliate_referrals'):
        op.create_table(
            'affiliate_referrals',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('affiliate_id', sa.Integer(), nullable=True),
            sa.Column('referred_user_id', sa.Integer(), nullable=True),
        )
    if not inspector.has_table('affiliate_commissions'):
        op.create_table(
            'affiliate_commissions',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('affiliate_id', sa.Integer(), nullable=True),
        )
    if not inspector.has_table('affiliate_payouts'):
        op.create_table(
            'affiliate_payouts',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('affiliate_id', sa.Integer(), nullable=True),
        )
    with op.batch_alter_table('affiliate_commissions') as batch:
        batch.drop_column('payout_id')
        batch.drop_column('paid_at')
        batch.drop_column('approved_by')
        batch.drop_column('approved_at')
        batch.drop_column('idempotency_key')
        batch.drop_column('status')

    with op.batch_alter_table('affiliate_referrals') as batch:
        batch.drop_constraint('uq_affiliate_referral_user', type_='unique')
        batch.drop_column('locked')
        batch.drop_column('attributed_at')

    with op.batch_alter_table('affiliates') as batch:
        batch.drop_constraint('uq_affiliate_referral_token', type_='unique')
        batch.drop_column('escrow_balance')
        batch.drop_column('monthly_payout_limit')
        batch.drop_column('daily_payout_limit')
        batch.drop_column('tier_set_at')
        batch.drop_column('tier')
        batch.drop_column('link_signature')
        batch.drop_column('referral_token')

    with op.batch_alter_table('wallet_transactions') as batch:
        batch.drop_column('approved_by')
        batch.drop_column('created_by')
        batch.drop_column('reference_type')
        batch.drop_column('idempotency_key')

    with op.batch_alter_table('wallets') as batch:
        batch.drop_column('monthly_limit')
        batch.drop_column('daily_limit')
        batch.drop_column('total_payouts')
        batch.drop_column('purpose')

    with op.batch_alter_table('commissions') as batch:
        batch.drop_index('idx_commission_transaction')
        batch.drop_index('idx_commission_agent_status')
        batch.drop_column('updated_at')
        batch.drop_column('notes')
        batch.drop_column('idempotency_key')
        batch.drop_column('payout_id')
        batch.drop_column('paid_at')
        batch.drop_column('payable_at')
        batch.drop_column('approved_by')
        batch.drop_column('approved_at')
        batch.drop_column('calculated_at')
        batch.drop_column('status')

    with op.batch_alter_table('agents') as batch:
        batch.drop_column('last_reviewed_at')
        batch.drop_column('velocity_flagged')
        batch.drop_column('risk_score')
        batch.drop_column('monthly_commission_limit')
        batch.drop_column('daily_commission_limit')

    # Drop enums
    commission_state_enum.drop(op.get_bind(), checkfirst=True)
    affiliate_tier_enum.drop(op.get_bind(), checkfirst=True)
    wallet_purpose_enum.drop(op.get_bind(), checkfirst=True)

"""Add secure_game_sessions table

Revision ID: 20260105_000001_add_secure_game_sessions
Revises: 20260104_000001_agent_affiliate_upgrade
Create Date: 2026-01-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260105_000001_add_secure_game_sessions"
down_revision = "20260104_000001_agent_affiliate_upgrade"
branch_labels = None
depends_on = None

# Reuse a named enum for game outcomes
outcome_enum = sa.Enum(
    "win", "lose", "cancelled", "pending", name="gameoutcome"
)

def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        outcome_enum.create(bind, checkfirst=True)

    op.create_table(
        "secure_game_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.String(length=64), nullable=False, unique=True),
        sa.Column("player_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("game_id", sa.Integer(), sa.ForeignKey("games.id"), nullable=False),
        sa.Column(
            "bet_amount",
            sa.Numeric(precision=15, scale=2),
            sa.CheckConstraint("bet_amount > 0", name="session_bet_positive"),
            nullable=False,
        ),
        sa.Column(
            "start_time",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "outcome",
            outcome_enum if bind.dialect.name == "postgresql" else sa.Enum("win", "lose", "cancelled", "pending", name="gameoutcome"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "win_amount",
            sa.Numeric(precision=15, scale=2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column(
            "profit_loss",
            sa.Numeric(precision=15, scale=2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column("session_token", sa.String(length=500), nullable=False),
        sa.Column("signature", sa.String(length=256), nullable=False),
        sa.Column("game_data", sa.JSON(), nullable=True),
        sa.Column("external_game_session_id", sa.String(length=100), nullable=True),
        sa.Column("webhook_received", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False, unique=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "outcome != 'win' OR win_amount > 0",
            name="check_win_amount_consistency",
        ),
    )

    op.create_index(
        "idx_game_session_player_game",
        "secure_game_sessions",
        ["player_id", "game_id"],
    )
    op.create_index(
        "idx_game_session_outcome_created",
        "secure_game_sessions",
        ["outcome", "start_time"],
    )
    op.create_index(
        "idx_game_session_expires",
        "secure_game_sessions",
        ["expires_at"],
    )
    op.create_index(
        "idx_game_session_session_id",
        "secure_game_sessions",
        ["session_id"],
        unique=True,
    )
    op.create_index(
        "idx_game_session_idempotency",
        "secure_game_sessions",
        ["idempotency_key"],
        unique=True,
    )


def downgrade():
    op.drop_table("secure_game_sessions")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        outcome_enum.drop(bind, checkfirst=True)

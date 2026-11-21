"""wave emails

Revision ID: a48c014c5c52
Revises: bacc30f7887b
Create Date: 2026-11-20 15:43:17.839871

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a48c014c5c52'
down_revision: Union[str, Sequence[str], None] = 'bacc30f7887b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("email_waves", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column("users", sa.Column("last_wave_email_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_wave_email_at")
    op.drop_column("users", "email_waves")

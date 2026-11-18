"""wave note

Revision ID: bacc30f7887b
Revises: 093167695f6d
Create Date: 2026-11-17 21:22:22.298178

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bacc30f7887b'
down_revision: Union[str, Sequence[str], None] = '093167695f6d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("waves", sa.Column("note", sa.String(length=140), nullable=True))


def downgrade() -> None:
    op.drop_column("waves", "note")

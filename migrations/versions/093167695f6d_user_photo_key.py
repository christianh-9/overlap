"""user photo key

Revision ID: 093167695f6d
Revises: 0558dd4aeb4a
Create Date: 2026-11-12 22:29:34.102865

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '093167695f6d'
down_revision: Union[str, Sequence[str], None] = '0558dd4aeb4a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("photo_key", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "photo_key")

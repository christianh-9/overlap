"""campus hours

Revision ID: 0558dd4aeb4a
Revises: 4c2839489071
Create Date: 2026-11-12 20:30:24.416803

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0558dd4aeb4a'
down_revision: Union[str, Sequence[str], None] = '4c2839489071'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "campus_hours",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("term", sa.String(length=16), nullable=False),
        sa.Column("weekday", sa.SmallInteger(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"],
            name=op.f("fk_campus_hours_user_id_users"), ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "term", "weekday", name=op.f("pk_campus_hours")),
    )



def downgrade() -> None:
    op.drop_table("campus_hours")

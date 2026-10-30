from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Block, User


def blocked_ids(db: Session, me: User) -> set[int]:

    rows = db.execute(
        select(Block.blocker_id, Block.blocked_id).where(
            or_(Block.blocker_id == me.id, Block.blocked_id == me.id)
        )
    )

    return {other for pair in rows for other in pair if other != me.id}

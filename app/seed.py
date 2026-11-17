from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Campus

CAMPUSES = [
    {
        "slug": "uci",
        "name": "UC Irvine",
        "email_domain": "uci.edu",
        "term_system": "quarter",
    },
    {"slug": "ucr", "name": "UC Riverside", "email_domain": "ucr.edu", "term_system": "quarter"},
]


def seed_campuses(db: Session) -> None:
    for data in CAMPUSES:
        if db.scalar(select(Campus).where(Campus.slug == data["slug"])) is None:
            db.add(Campus(**data))
    db.commit()

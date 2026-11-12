from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import current_user
from app.config import settings
from app.db import get_db
from app.matching import fmt, free_gaps, intersect, to_minutes, total_minutes
from app.models import Block, Course, Enrollment, Meeting, User, Wave
from app.schemas import MatchOut, ProfileOut
from app.terms import current_term

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("", response_model=list[MatchOut])
def matches(
    weekday: int | None = Query(None, ge=0, le=6, description="0 = Monday; defaults to today"),
    limit: int = Query(20, ge=1, le=100),
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if weekday is None:
        weekday = datetime.now(ZoneInfo(settings.timezone)).weekday()
    term = current_term()

    rows = db.execute(
        select(Enrollment.user_id, Meeting.start_time, Meeting.end_time)
        .join(Course, Course.id == Enrollment.course_id)
        .join(Meeting, Meeting.course_id == Course.id)
        .where(
            Course.campus_id == me.campus_id,
            Course.term == term,
            Meeting.weekday == weekday,
        )
    ).all()

    day_meetings: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for user_id, start, end in rows:
        day_meetings[user_id].append((to_minutes(start), to_minutes(end)))

    my_gaps = free_gaps(day_meetings.get(me.id, []), settings.min_gap_minutes)
    if not my_gaps:
        return []

    blocked = set(db.scalars(select(Block.blocked_id).where(Block.blocker_id == me.id)))
    blocked |= set(db.scalars(select(Block.blocker_id).where(Block.blocked_id == me.id)))

    candidates: dict[int, list[tuple[int, int]]] = {}
    for user_id, meetings in day_meetings.items():
        if user_id == me.id or user_id in blocked:
            continue

        windows = intersect(
            my_gaps, free_gaps(meetings, settings.min_gap_minutes), settings.min_overlap_minutes
        )
        if windows:
            candidates[user_id] = windows

    if not candidates:
        return []

    my_courses = set(
        db.scalars(
            select(Enrollment.course_id)
            .join(Course, Course.id == Enrollment.course_id)
            .where(Enrollment.user_id == me.id, Course.term == term)
        )
    )

    shared: dict[int, int] = defaultdict(int)
    for user_id, _course_id in db.execute(
        select(Enrollment.user_id, Enrollment.course_id).where(
            Enrollment.user_id.in_(candidates), Enrollment.course_id.in_(my_courses)
        )
    ):
        shared[user_id] += 1

    users = db.scalars(select(User).where(User.id.in_(candidates))).all()
    waved = set(db.scalars(select(Wave.recipient_id).where(Wave.sender_id == me.id)))
    results = []

    for user in users:
        windows = candidates[user.id]
        results.append(
            MatchOut(
                profile=ProfileOut.model_validate(user),
                windows=[f"{fmt(s)}-{fmt(e)}" for s, e in windows],
                overlap_minutes=total_minutes(windows),
                shared_courses=shared[user.id],
                same_major=bool(me.major) and user.major == me.major,
                same_transfer_school=bool(me.transfer_from)
                and user.transfer_from == me.transfer_from,
                waved=user.id in waved,
            )
        )

    results.sort(
        key=lambda m: (
            m.shared_courses,
            m.same_transfer_school,
            m.same_major,
            m.overlap_minutes,
        ),
        reverse=True,
    )
    return results[:limit]

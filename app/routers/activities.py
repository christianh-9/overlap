from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.auth import current_user
from app.db import get_db
from app.models import Activity, ActivityMember, Block, User
from app.schemas import ActivityIn, ActivityOut, ProfileOut

router = APIRouter(prefix="/activities", tags=["activities"])

MAX_DAYS_AHEAD = 7


def utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)


def blocked_ids(db: Session, me: User):
    rows = db.execute(
        select(Block.blocker_id, Block.blocked_id).where(
            or_(Block.blocker_id == me.id, Block.blocked_id == me.id)
        )
    )

    return {other for pair in rows for other in pair if other != me.id}


def to_out(activity: Activity, member_count: int, joined: bool) -> ActivityOut:
    return ActivityOut(
        id=activity.id,
        title=activity.title,
        location=activity.location,
        starts_at=utc(activity.starts_at),
        max_size=activity.max_size,
        creator=ProfileOut.model_validate(activity.creator),
        member_count=member_count,
        joined=joined,
    )


def get_visible(db: Session, me: User, activity_id: int) -> Activity:

    activity = db.get(Activity, activity_id)

    if (
        activity is None
        or activity.campus_id != me.campus_id
        or utc(activity.starts_at) < datetime.now(UTC)
        or activity.creator_id in blocked_ids(db, me)
    ):
        raise HTTPException(404, "Activity not found")
    return activity


@router.post("", response_model=ActivityOut, status_code=201)
def create_activity(
    body: ActivityIn, me: User = Depends(current_user), db: Session = Depends(get_db)
):
    now = datetime.now(UTC)
    starts_at = body.starts_at.astimezone(UTC)
    if not now < starts_at <= now + timedelta(days=MAX_DAYS_AHEAD):
        raise HTTPException(422, f"Start time must be within the next {MAX_DAYS_AHEAD} days")

    activity = Activity(
        campus_id=me.campus_id,
        creator_id=me.id,
        title=body.title,
        location=body.location,
        starts_at=starts_at,
        max_size=body.max_size,
    )

    db.add(activity)
    db.flush()
    db.add(ActivityMember(activity_id=activity.id, user_id=me.id))
    db.commit()
    db.refresh(activity)
    return to_out(activity, member_count=1, joined=True)


@router.get("", response_model=list[ActivityOut])
def list_activities(me: User = Depends(current_user), db: Session = Depends(get_db)):
    activities = db.scalars(
        select(Activity)
        .where(
            Activity.campus_id == me.campus_id,
            Activity.starts_at >= datetime.now(UTC),
            Activity.creator_id.not_in(blocked_ids(db, me)),
        )
        .order_by(Activity.starts_at)
        .options(selectinload(Activity.creator))
    ).all()
    ids = [a.id for a in activities]

    counts = dict(
        db.execute(
            select(ActivityMember.activity_id, func.count())
            .where(ActivityMember.activity_id.in_(ids))
            .group_by(ActivityMember.activity_id)
        ).all()
    )

    mine = set(
        db.scalars(
            select(ActivityMember.activity_id).where(
                ActivityMember.activity_id.in_(ids), ActivityMember.user_id == me.id
            )
        )
    )
    return [to_out(a, counts.get(a.id, 0), a.id in mine) for a in activities]


@router.post("/{activity_id}/join", response_model=ActivityOut)
def join_activity(
    activity_id: int, me: User = Depends(current_user), db: Session = Depends(get_db)
):
    get_visible(db, me, activity_id)

    activity = db.scalar(select(Activity).where(Activity.id == activity_id).with_for_update())

    count = db.scalar(select(func.count()).where(ActivityMember.activity_id == activity_id))
    if db.get(ActivityMember, (activity_id, me.id)) is None:
        if count >= activity.max_size:
            raise HTTPException(409, "Activity is full")
        db.add(ActivityMember(activity_id=activity_id, user_id=me.id))
        count += 1

    db.commit()
    return to_out(activity, count, joined=True)


@router.post("/{activity_id}/leave", status_code=204)
def leave_activity(
    activity_id: int, me: User = Depends(current_user), db: Session = Depends(get_db)
):
    activity = get_visible(db, me, activity_id)

    if activity.creator_id == me.id:
        raise HTTPException(400, "You created this activity. Cancel it instead.")
    membership = db.get(ActivityMember, (activity_id, me.id))
    if membership is not None:
        db.delete(membership)
        db.commit()


@router.delete("/{activity_id}", status_code=204)
def cancel_activity(
    activity_id: int, me: User = Depends(current_user), db: Session = Depends(get_db)
):
    activity = get_visible(db, me, activity_id)
    if activity.creator_id != me.id:
        raise HTTPException(403, "Only the creator can cancel this activity")
    db.delete(activity)
    db.commit()

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.auth import current_user
from app.blocking import blocked_ids
from app.config import settings
from app.db import get_db
from app.email import Notifier, get_notifier, try_send
from app.models import User, Wave
from app.schemas import ConnectionOut, ProfileOut, ReceivedWaveOut, WaveIn, WaveResult

router = APIRouter(prefix="/waves", tags=["waves"])

EMAIL_GAP = timedelta(hours=24)


def can_email(user: User) -> bool:
    last = user.last_wave_email_at
    if last is not None and last.tzinfo is None:
        last = last.replace(tzinfo=UTC)
    return user.email_waves and (last is None or datetime.now(UTC) - last > EMAIL_GAP)


def wave_email(sender: User, mutual: bool) -> tuple[str, str]:
    name = sender.display_name or "Someone"
    connections = f"{settings.site_url}/connections"
    if mutual:
        subject = f"You and {name} are connected on Overlap"
        text = f"{name} waved back, so you're connected. Their contact is on {connections}"
    else:
        subject = f"{name} waved at you on Overlap"
        text = f"{name} waved at you. See your waves and wave back: {connections}"
    text += f"\n\nTo stop these emails, turn them off in your profile: {settings.site_url}/profile"
    return subject, text


@router.post("/{user_id}", response_model=WaveResult)
def wave(
    user_id: int,
    background: BackgroundTasks,
    body: WaveIn | None = None,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    send: Notifier = Depends(get_notifier),
):
    other = db.get(User, user_id)
    if (
        other is None
        or other.id == me.id
        or other.campus_id != me.campus_id
        or other.id in blocked_ids(db, me)
    ):
        raise HTTPException(404, "User not found")

    existing = db.get(Wave, (me.id, user_id))
    mutual = db.get(Wave, (user_id, me.id)) is not None
    if existing is None:
        db.add(Wave(sender_id=me.id, recipient_id=user_id, note=body.note if body else None))
        if can_email(other):
            other.last_wave_email_at = datetime.now(UTC)
            background.add_task(try_send, send, other.email, *wave_email(me, mutual))
    elif body is not None:
        existing.note = body.note
    db.commit()
    return WaveResult(mutual=mutual)


@router.delete("/{user_id}", status_code=204)
def unwave(user_id: int, me: User = Depends(current_user), db: Session = Depends(get_db)):
    existing = db.get(Wave, (me.id, user_id))
    if existing is not None:
        db.delete(existing)
        db.commit()


@router.get("/connections", response_model=list[ConnectionOut])
def connections(me: User = Depends(current_user), db: Session = Depends(get_db)):
    mine, theirs = aliased(Wave), aliased(Wave)
    users = db.scalars(
        select(User)
        .join(mine, mine.recipient_id == User.id)
        .join(theirs, (theirs.sender_id == mine.recipient_id) & (theirs.recipient_id == me.id))
        .where(mine.sender_id == me.id, User.id.not_in(blocked_ids(db, me)))
        .order_by(User.display_name)
    ).all()
    return [ConnectionOut(profile=ProfileOut.model_validate(u), contact=u.contact) for u in users]


@router.get("/received", response_model=list[ReceivedWaveOut])
def received(me: User = Depends(current_user), db: Session = Depends(get_db)):
    waved_back = select(Wave.recipient_id).where(Wave.sender_id == me.id)

    rows = db.execute(
        select(User, Wave.note)
        .join(Wave, Wave.sender_id == User.id)
        .where(
            Wave.recipient_id == me.id,
            User.id.not_in(waved_back),
            User.id.not_in(blocked_ids(db, me)),
        )
        .order_by(Wave.created_at.desc())
    ).all()
    return [ReceivedWaveOut(profile=ProfileOut.model_validate(u), note=note) for u, note in rows]

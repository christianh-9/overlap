from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.models import Block, User, Report
from app.schemas import MeOut, ProfileOut, ProfileUpdate, ReportIn

router = APIRouter(tags=["profiles"])


def is_blocked(db: Session, a: int, b: int) -> bool:
    return (
        db.scalar(
            select(Block).where(
                or_(
                    (Block.blocker_id == a) & (Block.blocked_id == b),
                    (Block.blocker_id == b) & (Block.blocked_id == a),
                )
            )
        )
        is not None
    )


@router.get("/me", response_model=MeOut)
def get_me(me: User = Depends(current_user)):
    return me


@router.patch("/me", response_model=MeOut)
def update_me(body: ProfileUpdate, me: User = Depends(current_user), db: Session = Depends(get_db)):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(me, field, value)
    db.add(me)
    db.commit()
    return me


@router.get("/users/{user_id}", response_model=ProfileOut)
def get_user(user_id: int, me: User = Depends(current_user), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None or user.campus_id != me.campus_id or is_blocked(db, me.id, user_id):
        raise HTTPException(404, "User not found")
    return user


@router.post("/users/{user_id}/block", status_code=204)
def block_user(user_id: int, me: User = Depends(current_user), db: Session = Depends(get_db)):
    if user_id == me.id or db.get(User, user_id) is None:
        raise HTTPException(404, "User not found")
    if db.get(Block, (me.id, user_id)) is None:
        db.add(Block(blocker_id=me.id, blocked_id=user_id))
        db.commit()


@router.post("/users/{user_id}/report", status_code=201)
def report_user(
    user_id: int, body: ReportIn, me: User = Depends(current_user), db: Session = Depends(get_db)
):
    user = db.get(User, user_id)
    if user is None or user.id == me.id or user.campus_id != me.campus_id:
        raise HTTPException(404, "User not found")
    db.add(
        Report(
            reporter_id=me.id,
            reported_id=user.id,
            reported_email=user.email,
            reason=body.reason,
            details=body.details,
        )
    )
    if body.block and db.get(Block, (me.id, user_id)) is None:
        db.add(Block(blocker_id=me.id, blocked_id=user_id))
    db.commit()
    return {"reported": True}

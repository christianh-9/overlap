from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, BackgroundTasks
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.auth import current_user
from app.config import settings
from app.db import get_db
from app.email import Notifier, get_notifier, try_send
from app.models import Block, LoginCode, Report, User
from app.photos import MAX_BYTES, NotAnImage, Storage, get_storage, new_key, process
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


@router.delete("/me", status_code=204)
def delete_me(
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    storage: Storage | None = Depends(get_storage),
):
    photo = me.photo_key
    db.execute(delete(LoginCode).where(LoginCode.email == me.email))
    db.delete(me)
    db.commit()
    if photo and storage:
        storage.delete(photo)


@router.put("/me/photo", response_model=MeOut)
def set_photo(
    file: UploadFile = File(...),
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    storage: Storage | None = Depends(get_storage),
):
    if storage is None:
        raise HTTPException(503, "Photo uploads aren't set up")
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Photos can be up to 5 MB")
    try:
        photo = process(data)
    except NotAnImage:
        raise HTTPException(422, "That file isn't an image") from None
    key = new_key()
    storage.put(key, photo)
    old = me.photo_key
    me.photo_key = key
    db.commit()
    if old:
        storage.delete(old)
    return me


@router.delete("/me/photo", status_code=204)
def remove_photo(
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    storage: Storage | None = Depends(get_storage),
):
    old = me.photo_key
    if old is None:
        return
    me.photo_key = None
    db.commit()
    if storage:
        storage.delete(old)


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


@router.delete("/users/{user_id}/block", status_code=204)
def unblock_user(user_id: int, me: User = Depends(current_user), db: Session = Depends(get_db)):
    block = db.get(Block, (me.id, user_id))
    if block is not None:
        db.delete(block)
        db.commit()


@router.get("/blocks", response_model=list[ProfileOut])
def blocked_people(me: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(User)
        .join(Block, Block.blocked_id == User.id)
        .where(Block.blocker_id == me.id)
        .order_by(User.display_name)
    ).all()


@router.post("/users/{user_id}/report", status_code=201)
def report_user(
    user_id: int,
    body: ReportIn,
    background: BackgroundTasks,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    send: Notifier = Depends(get_notifier),
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
    text = f"A student was reported for {body.reason}. Review it: {settings.site_url}/admin"
    for admin in settings.admin_emails:
        background.add_task(try_send, send, admin, "New report on Overlap", text)
    return {"reported": True}

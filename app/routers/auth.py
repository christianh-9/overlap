from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import create_token, hash_code, new_code
from app.config import settings
from app.db import get_db
from app.models import Campus, LoginCode, User
from app.schemas import CodeRequest, CodeVerify, Token

router = APIRouter(prefix="/auth", tags=["auth"])


def campus_for(email: str, db: Session) -> Campus:
    domain = email.rsplit("@", 1)[1].lower()
    campus = db.scalar(select(Campus).where(Campus.email_domain == domain))
    if campus is None:
        raise HTTPException(400, "Use your campus email address")
    return campus


@router.post("/request-code")
def request_code(body: CodeRequest, db: Session = Depends(get_db)):
    email = body.email.lower()
    campus_for(email, db)
    code = new_code()

    db.add(
        LoginCode(
            email=email,
            code_hash=hash_code(email, code),
            expires_at=datetime.now(UTC) + timedelta(minutes=10),
        )
    )
    db.commit()
    # still need to send code by email
    if settings.dev_mode:
        return {"sent": True, "dev_code": code}
    return {"sent": True}


@router.post("/verify", response_model=Token)
def verify(body: CodeVerify, db: Session = Depends(get_db)):
    email = body.email.lower()
    campus = campus_for(email, db)
    login = db.scalar(
        select(LoginCode)
        .where(LoginCode.email == email, LoginCode.used.is_(False))
        .order_by(LoginCode.id.desc())
    )
    expires = login.expires_at if login else None
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)

    if (
        login is None
        or expires < datetime.now(UTC)
        or login.code_hash != hash_code(email, body.code)
    ):
        raise HTTPException(400, "Invalid or expired code")

    login.used = True
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, campus_id=campus.id)
        db.add(user)
    db.commit()

    return Token(access_token=create_token(user.id))

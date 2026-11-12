from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import create_token, hash_code, new_code
from app.config import settings
from app.db import get_db
from app.email import EmailFailed, Mailer, get_mailer
from app.models import BannedEmail, Campus, LoginCode, User
from app.schemas import CodeRequest, CodeSent, CodeVerify, Token

router = APIRouter(prefix="/auth", tags=["auth"])

CODE_TTL = timedelta(minutes=10)
MAX_ATTEMPTS = 5

EMAIL_LIMIT = (3, timedelta(minutes=15))
IP_LIMIT = (10, timedelta(hours=1))


def campus_for(email: str, db: Session) -> Campus:
    domain = email.rsplit("@", 1)[1].lower()
    campus = db.scalar(select(Campus).where(Campus.email_domain == domain))
    if campus is None:
        raise HTTPException(400, "Use your campus email address")
    return campus


def recent_codes(db: Session, column, value: str, window: timedelta) -> int:
    since = datetime.now(UTC) - window
    return db.scalar(select(func.count()).where(column == value, LoginCode.created_at >= since))


# exclude_none keeps production's response exactly {"sent": true}.
@router.post("/request-code", response_model=CodeSent, response_model_exclude_none=True)
def request_code(
    body: CodeRequest,
    request: Request,
    db: Session = Depends(get_db),
    send: Mailer = Depends(get_mailer),
):
    email = body.email.lower()
    campus_for(email, db)
    if db.get(BannedEmail, email) is not None:
        raise HTTPException(403, "This account has been suspended")
    ip = request.client.host if request.client else None

    limit, window = EMAIL_LIMIT
    if recent_codes(db, LoginCode.email, email, window) >= limit:
        raise HTTPException(429, "Too many codes requested. Try again in a few minutes.")
    limit, window = IP_LIMIT
    if ip and recent_codes(db, LoginCode.ip, ip, window) >= limit:
        raise HTTPException(429, "Too many codes requested. Try again later.")

    code = new_code()
    db.add(
        LoginCode(
            email=email,
            code_hash=hash_code(email, code),
            expires_at=datetime.now(UTC) + CODE_TTL,
            ip=ip,
        )
    )
    db.commit()

    if settings.dev_mode:
        return {"sent": True, "dev_code": code}
    try:
        send(email, code)
    except EmailFailed:
        raise HTTPException(502, "Couldn't send the email. Try again shortly.") from None
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

    if login is None or expires < datetime.now(UTC) or login.attempts >= MAX_ATTEMPTS:
        raise HTTPException(400, "Invalid or expired code")
    if login.code_hash != hash_code(email, body.code):
        login.attempts += 1
        db.commit()
        raise HTTPException(400, "Invalid or expired code")

    login.used = True
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, campus_id=campus.id)
        db.add(user)

    db.commit()
    return Token(access_token=create_token(user.id))

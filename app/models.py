from datetime import datetime, time

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Campus(Base):
    __tablename__ = "campuses"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(16), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    email_domain: Mapped[str] = mapped_column(String(64), unique=True)
    term_system: Mapped[str] = mapped_column(String(16))


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    campus_id: Mapped[int] = mapped_column(ForeignKey("campuses.id"), index=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    display_name: Mapped[str] = mapped_column(String(50), default="")
    major: Mapped[str | None] = mapped_column(String(100))
    grad_year: Mapped[str | None] = mapped_column(SmallInteger)
    is_transfer: Mapped[bool] = mapped_column(Boolean, default=False)
    transfer_from: Mapped[str | None] = mapped_column(String(100))
    home_city: Mapped[str | None] = mapped_column(String(100))
    contact: Mapped[str | None] = mapped_column(String(100))
    bio: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    campus: Mapped[Campus] = relationship()


class LoginCode(Base):
    __tablename__ = "login_code"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (UniqueConstraint("campus_id", "term", "course_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    campus_id: Mapped[int] = mapped_column(ForeignKey("campuses.id"), index=True)
    term: Mapped[str] = mapped_column(String(16))
    course_code: Mapped[str] = mapped_column(String(10))
    dept: Mapped[str] = mapped_column(String(20))
    number: Mapped[str] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(150), default="")

    meetings: Mapped[list["Meeting"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    weekday: Mapped[int] = mapped_column(SmallInteger)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    location: Mapped[str | None] = mapped_column(String(100))

    course: Mapped[Course] = relationship(back_populates="meetings")


class Enrollment(Base):
    __tablename__ = "enrollments"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True
    )


class Block(Base):
    __tablename__ = "blocks"

    blocker_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    blocked_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    campus_id: Mapped[int] = mapped_column(ForeignKey("campuses.id"), index=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(100))
    location: Mapped[str] = mapped_column(String(100))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    max_size: Mapped[int] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    creator: Mapped[User] = relationship()


class ActivityMember(Base):
    __tablename__ = "activity_members"

    activity_id: Mapped[int] = mapped_column(
        ForeignKey("activities.id", ondelete="CASCADE"), primary_key=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )


class Wave(Base):
    __tablename__ = "waves"

    sender_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )

    recipient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    reporter_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reported_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    reported_email: Mapped[str] = mapped_column(String(254))
    reason: Mapped[str] = mapped_column(String(20))
    details: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BannedEmail(Base):
    __tablename__ = "banned_emails"

    email: Mapped[str] = mapped_column(String(254), primary_key=True)
    banned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

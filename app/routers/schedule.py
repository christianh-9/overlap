from collections.abc import Callable
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.anteater import CourseNotFound, SectionData, SourceUnavailable, fetch_section
from app.auth import current_user
from app.config import settings
from app.db import get_db
from app.models import Course, Enrollment, Meeting, User
from app.schemas import CourseAdd, CourseOut

router = APIRouter(prefix="/schedule", tags=["schedule"])

Fetcher = Callable[[str, str], SectionData]


def get_fetcher() -> Fetcher:
    return fetch_section


@router.get("", response_model=list[CourseOut])
def my_schedule(me: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Course)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .where(Enrollment.user_id == me.id, Course.term == settings.current_term)
        .options(selectinload(Course.meetings))
    ).all()


@router.post("/courses", response_model=CourseOut, status_code=201)
def add_course(
    body: CourseAdd,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    fetch: Fetcher = Depends(get_fetcher),
):
    course = db.scalar(
        select(Course).where(
            Course.campus_id == me.campus_id,
            Course.term == settings.current_term,
            Course.course_code == body.course_code,
        )
    )

    if course is None:
        try:
            section = fetch(settings.current_term, body.course_code)
        except CourseNotFound:
            raise HTTPException(404, f"No section {body.course_code} this term") from None
        except SourceUnavailable:
            raise HTTPException(502, "UCI schedule unavailable, try again") from None
        course = Course(
            campus_id=me.campus_id,
            term=settings.current_term,
            course_code=body.course_code,
            dept=section.dept,
            number=section.number,
            title=section.title,
            meetings=[Meeting(**asdict(m)) for m in section.meetings],
        )

        db.add(course)
        db.flush()
    if db.get(Enrollment, (me.id, course.id)) is None:
        db.add(Enrollment(user_id=me.id, course_id=course.id))
    db.commit()
    db.refresh(course)
    return course


@router.delete("/courses/{course_id}", status_code=204)
def drop_course(course_id: int, me: User = Depends(current_user), db: Session = Depends(get_db)):
    enrollment = db.get(Enrollment, (me.id, course_id))
    if enrollment is None:
        raise HTTPException(404, "Not enrolled in that course")
    db.delete(enrollment)
    db.commit()

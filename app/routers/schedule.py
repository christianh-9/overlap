from collections.abc import Callable
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import anteater, ucr
from app.anteater import CourseNotFound, SectionData, SourceUnavailable
from app.auth import current_user
from app.db import get_db
from app.models import CampusHours, Course, Enrollment, Meeting, User
from app.schemas import CampusHoursIn, CampusHoursOut, CourseAdd, CourseOut
from app.terms import current_term

router = APIRouter(prefix="/schedule", tags=["schedule"])

Fetcher = Callable[[str, str], SectionData]

FETCHERS: dict[str, Fetcher] = {"uci": anteater.fetch_section, "ucr": ucr.fetch_section}


def get_fetcher(me: User = Depends(current_user)) -> Fetcher:
    return FETCHERS[me.campus.slug]


@router.get("", response_model=list[CourseOut])
def my_schedule(me: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Course)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .where(Enrollment.user_id == me.id, Course.term == current_term())
        .options(selectinload(Course.meetings))
    ).all()


@router.post("/courses", response_model=CourseOut, status_code=201)
def add_course(
    body: CourseAdd,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    fetch: Fetcher = Depends(get_fetcher),
):
    term = current_term()
    course = db.scalar(
        select(Course).where(
            Course.campus_id == me.campus_id,
            Course.term == term,
            Course.course_code == body.course_code,
        )
    )

    if course is None:
        try:
            section = fetch(term, body.course_code)
        except CourseNotFound:
            raise HTTPException(404, f"No section {body.course_code} this term") from None
        except SourceUnavailable:
            raise HTTPException(502, f"{me.campus.name} schedule unavailable, try again") from None
        course = Course(
            campus_id=me.campus_id,
            term=term,
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


@router.get("/hours", response_model=list[CampusHoursOut])
def my_hours(me: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(CampusHours)
        .where(CampusHours.user_id == me.id, CampusHours.term == current_term())
        .order_by(CampusHours.weekday)
    ).all()


@router.put("/hours/{weekday}", response_model=CampusHoursOut)
def set_hours(
    body: CampusHoursIn,
    weekday: int = Path(ge=0, le=6),
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    term = current_term()
    hours = db.get(CampusHours, (me.id, term, weekday))
    if hours is None:
        hours = CampusHours(user_id=me.id, term=term, weekday=weekday)
        db.add(hours)
    hours.start_time = body.start_time
    hours.end_time = body.end_time
    db.commit()
    return hours


@router.delete("/hours/{weekday}", status_code=204)
def clear_hours(
    weekday: int = Path(ge=0, le=6), me: User = Depends(current_user), db: Session = Depends(get_db)
):
    hours = db.get(CampusHours, (me.id, current_term(), weekday))
    if hours is not None:
        db.delete(hours)
        db.commit()

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.auth import current_user
from app.config import settings
from app.db import get_db
from app.models import BannedEmail, LoginCode, Report, User, Wave
from app.photos import Storage, get_storage
from app.schemas import AdminReportOut, ProfileOut, ReportOut, ResolveIn

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(me: User = Depends(current_user)) -> User:
    if me.email not in settings.admin_emails:
        raise HTTPException(403, "Admins only")
    return me


def admin_view(db: Session, report: Report) -> AdminReportOut:
    reported = db.get(User, report.reported_id) if report.reported_id else None
    reporter = db.get(User, report.reporter_id) if report.reporter_id else None
    wave = db.get(Wave, (reported.id, reporter.id)) if reported and reporter else None
    return AdminReportOut(
        **ReportOut.model_validate(report).model_dump(),
        reported=ProfileOut.model_validate(reported) if reported else None,
        contact=reported.contact if reported else None,
        note=wave.note if wave else None,
        reporter_name=reporter.display_name if reporter else None,
        campus=reported.campus.name if reported else None,
    )


@router.get("/reports", response_model=list[AdminReportOut])
def list_reports(
    status: str = Query("open"), _: User = Depends(require_admin), db: Session = Depends(get_db)
):
    reports = db.scalars(
        select(Report).where(Report.status == status).order_by(Report.created_at)
    ).all()
    return [admin_view(db, report) for report in reports]


@router.post("/reports/{report_id}/resolve", response_model=ReportOut)
def resolve_report(
    report_id: int,
    body: ResolveIn,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
    storage: Storage | None = Depends(get_storage),
):
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(404, "Report not found")
    reported = db.get(User, report.reported_id) if report.reported_id else None
    old_photo = None

    if body.action == "dismiss":
        report.status = "dismissed"
    elif body.action == "remove_photo":
        report.status = "photo_removed"
        if reported:
            old_photo, reported.photo_key = reported.photo_key, None
    else:
        db.execute(
            update(Report)
            .where(Report.reported_email == report.reported_email, Report.status == "open")
            .values(status="banned")
        )
        if db.get(BannedEmail, report.reported_email) is None:
            db.add(BannedEmail(email=report.reported_email))
        db.execute(delete(LoginCode).where(LoginCode.email == report.reported_email))
        if reported:
            old_photo = reported.photo_key
            db.delete(reported)
    db.commit()
    if old_photo and storage:
        storage.delete(old_photo)
    db.refresh(report)
    return report

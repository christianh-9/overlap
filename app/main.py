from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal, get_db
from app.routers import activities, admin, auth, matches, profiles, schedule, waves
from app.schemas import TermOut
from app.seed import seed_campuses
from app.terms import current_term, term_label


@asynccontextmanager
async def lifespan(app: FastAPI):
    with SessionLocal() as db:
        seed_campuses(db)
    yield


app = FastAPI(title="Overlap", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origin, allow_methods=["*"], allow_headers=["*"]
)
app.include_router(auth.router)
app.include_router(profiles.router)
app.include_router(schedule.router)
app.include_router(matches.router)
app.include_router(activities.router)
app.include_router(waves.router)
app.include_router(admin.router)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    # Every real request needs the database, so health means it answers too.
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(503, "Database unavailable") from None
    return {"ok": True}


@app.get("/term", response_model=TermOut)
def term():
    current = current_term()
    return TermOut(term=current, label=term_label(current))

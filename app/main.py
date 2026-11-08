from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import SessionLocal
from app.routers import activities, admin, auth, matches, profiles, schedule, waves
from app.seed import seed_campuses


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
def health():
    return {"ok": True}

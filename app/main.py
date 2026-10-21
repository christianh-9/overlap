from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import Base, SessionLocal, engine
from app.routers import auth, profiles
from app.seed import seed_campuses


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_campuses(db)
    yield


app = FastAPI(title="Overlap", lifespan=lifespan)
app.include_router(auth.router)
app.include_router(profiles.router)


@app.get("/health")
def health():
    return {"ok": True}

import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["DEV_MODE"] = "true"

from datetime import time

import pytest
from fastapi.testclient import TestClient

from app.anteater import CourseNotFound, MeetingData, SectionData
from app.db import Base, engine
from app.main import app
from app.routers.schedule import get_fetcher

FAKE_SECTIONS = {
    "34000": ("I&C SCI", "46", [(0, "09:00", "10:00")]),
    "44000": ("STATS", "67", [(0, "13:00", "14:00")]),
    "50000": ("MATH", "3A", [(0, "12:00", "12:50")]),
    "60000": ("BIO SCI", "93", [(0, "08:00", "11:00")]),
    "61000": ("CHEM", "1A", [(0, "11:20", "13:30")]),
}


def fake_fetch(term: str, code: str) -> SectionData:
    if code not in FAKE_SECTIONS:
        raise CourseNotFound(code)
    dept, number, meetings = FAKE_SECTIONS[code]
    return SectionData(
        course_code=code,
        dept=dept,
        number=number,
        title="",
        meetings=[
            MeetingData(d, time.fromisoformat(s), time.fromisoformat(e), None)
            for d, s, e in meetings
        ],
    )


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    app.dependency_overrides[get_fetcher] = lambda: fake_fetch
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def login(client):
    def _login(email: str) -> dict:
        code = client.post("/auth/request-code", json={"email": email}).json()["dev_code"]
        token = client.post("/auth/verify", json={"email": email, "code": code}).json()[
            "access_token"
        ]
        return {"Authorization": f"Bearer {token}"}

    return _login

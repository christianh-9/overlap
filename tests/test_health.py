from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import get_db
from app.main import app


def test_health_ok_when_database_answers(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_health_fails_when_database_is_down(client):
    unreachable = create_engine("sqlite:////nonexistent-dir/overlap.db")

    def broken_db():
        with Session(unreachable) as db:
            yield db

    app.dependency_overrides[get_db] = broken_db
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}

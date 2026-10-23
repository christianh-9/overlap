import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["DEV_MODE"] = "true"

import pytest
from fastapi.testclient import TestClient

from app.db import Base, engine
from app.main import app


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def login(client):
    def _login(email: str) -> dict:
        code = client.post("/auth/request-code", json={"email": email}).json()["dev_code"]
        token = client.post("/auth/verify", json={"email": email, "code": code}).json()[
            "access_token"
        ]
        return {"Authorization": f"Bearer {token}"}

    return _login

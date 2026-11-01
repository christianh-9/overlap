from app.config import settings


def request_code(client, email="alice@uci.edu"):
    return client.post("/auth/request-code", json={"email": email})


def verify(client, code, email="alice@uci.edu"):
    return client.post("/auth/verify", json={"email": email, "code": code})


def wrong(code: str) -> str:
    return f"{(int(code) + 1) % 1_000_000:06d}"


def test_production_mode_emails_the_code(client, outbox, monkeypatch):
    monkeypatch.setattr(settings, "dev_mode", False)
    r = request_code(client)
    assert r.json() == {"sent": True}
    to, code = outbox[0]
    assert to == "alice@uci.edu"
    assert verify(client, code).status_code == 200


def test_email_rate_limit(client):
    for _ in range(3):
        assert request_code(client).status_code == 200
    assert request_code(client).status_code == 429
    assert request_code(client, "bob@uci.edu").status_code == 200


def test_ip_rate_limit(client):
    for i in range(10):
        assert request_code(client, f"student{i}@uci.edu").status_code == 200
    assert request_code(client, "student10@uci.edu").status_code == 429


def test_code_locks_after_five_wrong_guesses(client):
    code = request_code(client).json()["dev_code"]
    for _ in range(5):
        assert verify(client, wrong(code)).status_code == 400
    assert verify(client, code).status_code == 400

import struct
import zlib
from datetime import UTC, datetime, timedelta

import jwt

from app.config import settings
from app.routers import auth


def test_expired_and_garbage_tokens_get_401(client):
    expired = jwt.encode(
        {"sub": "1", "exp": datetime.now(UTC) - timedelta(hours=1)},
        settings.jwt_secret,
        algorithm="HS256",
    )
    for token in [expired, "not-a-token"]:
        r = client.get("/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401


def png_header(width, height):
    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IEND", b"")


def test_huge_image_rejected_before_decoding(client, login, storage):
    alice = login("alice@uci.edu")
    data = png_header(13_000, 13_000)
    files = {"file": ("big.png", data, "image/png")}
    assert client.put("/me/photo", headers=alice, files=files).status_code == 413
    assert storage.files == {}


def test_duplicate_reports_are_ignored(client, login):
    alice = login("alice@uci.edu")
    admin = login("admin@uci.edu")
    bob = login("bob@uci.edu")
    bob_id = client.get("/me", headers=bob).json()["id"]
    for _ in range(3):
        r = client.post(f"/users/{bob_id}/report", headers=alice, json={"reason": "spam"})
        assert r.status_code == 201
    assert len(client.get("/admin/reports", headers=admin).json()) == 1


def test_admins_are_emailed_only_when_the_queue_was_empty(client, login, sent):
    alice = login("alice@uci.edu")
    carol = login("carol@uci.edu")
    bob = login("bob@uci.edu")
    bob_id = client.get("/me", headers=bob).json()["id"]
    client.post(f"/users/{bob_id}/report", headers=alice, json={"reason": "spam"})
    client.post(f"/users/{bob_id}/report", headers=carol, json={"reason": "spam"})
    assert len(sent) == 1


def test_sign_in_codes_have_a_global_cap(client, monkeypatch):
    monkeypatch.setattr(auth, "GLOBAL_LIMIT", (2, timedelta(hours=1)))
    for email in ["a@uci.edu", "b@uci.edu"]:
        assert client.post("/auth/request-code", json={"email": email}).status_code == 200
    assert client.post("/auth/request-code", json={"email": "c@uci.edu"}).status_code == 429


def test_banned_email_cannot_use_an_earlier_code(client, login):
    alice = login("alice@uci.edu")
    admin = login("admin@uci.edu")
    bob = login("bob@uci.edu")
    bob_id = client.get("/me", headers=bob).json()["id"]
    code = client.post("/auth/request-code", json={"email": "bob@uci.edu"}).json()["dev_code"]

    client.post(f"/users/{bob_id}/report", headers=alice, json={"reason": "spam"})
    report_id = client.get("/admin/reports", headers=admin).json()[0]["id"]
    client.post(f"/admin/reports/{report_id}/resolve", headers=admin, json={"action": "ban"})

    r = client.post("/auth/verify", json={"email": "bob@uci.edu", "code": code})
    assert r.status_code == 403

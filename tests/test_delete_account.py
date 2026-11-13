from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import LoginCode, Report


def meetup(title: str, max_size: int = 4) -> dict:
    starts = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
    return {
        "title": title,
        "location": "Science Library",
        "starts_at": starts,
        "max_size": max_size,
    }


def setup_alice_with_everything(client, login):
    alice = login("alice@uci.edu")
    bob = login("bob@uci.edu")
    carol = login("carol@uci.edu")
    client.patch("/me", headers=alice, json={"display_name": "Alice", "contact": "IG @alice"})
    client.patch("/me", headers=bob, json={"display_name": "Bob"})
    alice_id = client.get("/me", headers=alice).json()["id"]
    bob_id = client.get("/me", headers=bob).json()["id"]
    carol_id = client.get("/me", headers=carol).json()["id"]

    client.post("/schedule/courses", headers=alice, json={"course_code": "34000"})
    client.post(f"/waves/{bob_id}", headers=alice)
    client.post(f"/waves/{alice_id}", headers=bob)
    client.post(f"/users/{carol_id}/block", headers=alice)
    client.post("/activities", headers=alice, json=meetup("Alice's study group"))
    bobs = client.post("/activities", headers=bob, json=meetup("Bob's lunch", max_size=2)).json()
    client.post(f"/activities/{bobs['id']}/join", headers=alice)
    client.post(f"/users/{carol_id}/report", headers=alice, json={"reason": "spam", "block": False})
    return alice, bob, carol, bobs["id"]


def test_delete_account_removes_everything_tied_to_it(client, login):
    alice, bob, carol, bobs_meetup = setup_alice_with_everything(client, login)
    assert client.get("/waves/connections", headers=bob).json() != []

    assert client.delete("/me", headers=alice).status_code == 204

    assert client.get("/me", headers=alice).status_code == 401
    assert client.get("/waves/connections", headers=bob).json() == []
    assert client.get("/waves/received", headers=bob).json() == []

    titles = {a["title"]: a for a in client.get("/activities", headers=bob).json()}
    assert "Alice's study group" not in titles
    assert titles["Bob's lunch"]["member_count"] == 1

    with SessionLocal() as db:
        codes = select(func.count()).where(LoginCode.email == "alice@uci.edu")
        assert db.scalar(codes) == 0
        report = db.scalar(select(Report))
        assert report is not None
        assert report.reporter_id is None


def test_deleted_email_can_sign_up_fresh(client, login):
    alice = login("alice@uci.edu")
    client.patch("/me", headers=alice, json={"display_name": "Alice"})
    client.delete("/me", headers=alice)

    again = login("alice@uci.edu")
    assert client.get("/me", headers=again).json()["display_name"] == ""
    assert client.get("/schedule", headers=again).json() == []

from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.models import CampusHours


def hours(start, end):
    return {"start_time": start, "end_time": end}


def test_set_update_and_clear_hours(client, login):
    alice = login("alice@uci.edu")
    assert (
        client.put("/schedule/hours/0", headers=alice, json=hours("08:00", "17:00")).status_code
        == 200
    )
    client.put("/schedule/hours/0", headers=alice, json=hours("09:00", "15:00"))
    assert client.get("/schedule/hours", headers=alice).json() == [
        {"weekday": 0, "start_time": "09:00:00", "end_time": "15:00:00"}
    ]

    assert client.delete("/schedule/hours/0", headers=alice).status_code == 204
    assert client.get("/schedule/hours", headers=alice).json() == []
    assert client.delete("/schedule/hours/0", headers=alice).status_code == 204


def test_rejects_bad_windows(client, login):
    alice = login("alice@uci.edu")
    assert (
        client.put("/schedule/hours/0", headers=alice, json=hours("17:00", "08:00")).status_code
        == 422
    )
    assert (
        client.put("/schedule/hours/0", headers=alice, json=hours("08:00", "08:20")).status_code
        == 422
    )
    assert (
        client.put("/schedule/hours/7", headers=alice, json=hours("08:00", "17:00")).status_code
        == 422
    )


def test_hours_belong_to_a_term(client, login, monkeypatch):
    alice = login("alice@uci.edu")
    client.put("/schedule/hours/0", headers=alice, json=hours("08:00", "17:00"))
    monkeypatch.setattr(settings, "current_term", "2027-winter")
    assert client.get("/schedule/hours", headers=alice).json() == []


def test_hours_count_in_matching(client, login):
    alice = login("alice@uci.edu")
    bob = login("bob@uci.edu")
    client.patch("/me", headers=bob, json={"display_name": "Bob"})
    client.post("/schedule/courses", headers=alice, json={"course_code": "34000"})
    client.post("/schedule/courses", headers=alice, json={"course_code": "44000"})

    client.put("/schedule/hours/0", headers=bob, json=hours("16:00", "18:00"))
    assert client.get("/matches?weekday=0", headers=alice).json() == []

    client.put("/schedule/hours/0", headers=alice, json=hours("08:00", "17:00"))
    found = client.get("/matches?weekday=0", headers=alice).json()
    assert [m["profile"]["display_name"] for m in found] == ["Bob"]
    assert found[0]["windows"] == ["16:00-17:00"]


def test_deleting_account_removes_hours(client, login):
    alice = login("alice@uci.edu")
    client.put("/schedule/hours/0", headers=alice, json=hours("08:00", "17:00"))
    client.delete("/me", headers=alice)
    with SessionLocal() as db:
        assert db.scalars(select(CampusHours)).all() == []

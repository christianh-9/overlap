def course(code, dept, number, *meetings):
    return {
        "course_code": code,
        "dept": dept,
        "number": number,
        "meetings": [{"weekday": 0, "start_time": s, "end_time": e} for s, e in meetings],
    }


def test_rejects_non_campus_email(client):
    r = client.post("/auth/request-code", json={"email": "someone@gmail.com"})
    assert r.status_code == 400


def test_wrong_code_rejected(client):
    code = client.post("/auth/request-code", json={"email": "a@uci.edu"}).json()["dev_code"]
    wrong = f"{(int(code) + 1) % 1_000_000:06d}"
    r = client.post("/auth/verify", json={"email": "a@uci.edu", "code": wrong})
    assert r.status_code == 400


def test_full_flow(client, login):
    alice = login("alice@uci.edu")
    bob = login("bob@uci.edu")
    carol = login("carol@uci.edu")

    profiles = [
        (
            alice,
            {"display_name": "Alice", "is_transfer": True, "transfer_from": "Orange Coast College"},
        ),
        (
            bob,
            {"display_name": "Bob", "is_transfer": True, "transfer_from": "Orange Coast College"},
        ),
        (carol, {"display_name": "Carol"}),
    ]

    for headers, body in profiles:
        assert client.patch("/me", headers=headers, json=body).status_code == 200

    schedules = [
        (alice, course("34000", "ICS", "46", ("09:00", "10:00"))),
        (alice, course("44000", "STATS", "67", ("13:00", "14:00"))),
        (bob, course("34000", "ICS", "46", ("09:00", "10:00"))),
        (bob, course("50000", "MATH", "3A", ("12:00", "12:50"))),
        (carol, course("60000", "BIO", "93", ("08:00", "11:00"))),
        (carol, course("61000", "CHEM", "1A", ("11:20", "13:30"))),
    ]

    for headers, body in schedules:
        assert client.post("/schedule/courses", headers=headers, json=body).status_code == 201

    r = client.get("/matches?weekday=0", headers=alice)
    assert r.status_code == 200
    data = r.json()
    assert [m["profile"]["display_name"] for m in data] == ["Bob"]
    assert data[0]["windows"] == ["10:00-12:00"]
    assert data[0]["shared_courses"] == 1
    assert data[0]["same_transfer_school"] is True
    assert "email" not in data[0]["profile"]

    # Blocking removes Bob from Alice's matches, and Alice from Bob's.
    bob_id = data[0]["profile"]["id"]
    assert client.post(f"/users/{bob_id}/block", headers=alice).status_code == 204
    assert client.get("/matches?weekday=0", headers=alice).json() == []
    assert client.get("/matches?weekday=0", headers=bob).json() == []

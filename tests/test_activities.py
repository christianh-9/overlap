from datetime import UTC, datetime, timedelta


def in_hours(hours: float) -> str:
    return (datetime.now(UTC) + timedelta(hours=hours)).isoformat()


def new_activity(**overrides) -> dict:
    body = {
        "title": "Pickup basketball",
        "location": "ARC courts",
        "starts_at": in_hours(2),
        "max_size": 2,
    }

    return body | overrides


def test_create_and_listen(client, login):
    alice = login("alice@uci.edu")
    bob = login("bob@uci.edu")

    r = client.post("/activities", headers=alice, json=new_activity())

    assert r.status_code == 201
    assert r.json()["member_count"] == 1
    assert r.json()["joined"] is True

    feed = client.get("/activities", headers=bob).json()

    assert [a["title"] for a in feed] == ["Pickup basketball"]
    assert feed[0]["joined"] is False


def test_start_time_rules(client, login):
    alice = login("alice@uci.edu")
    for starts_at in [in_hours(-1), in_hours(24 * 8)]:
        r = client.post("/activities", headers=alice, json=new_activity(starts_at=starts_at))
        assert r.status_code == 422

        naive = datetime.now().replace(microsecond=0).isoformat()
        r = client.post("/activities", headers=alice, json=new_activity(starts_at=naive))
        assert r.status_code == 422


def test_join_until_full(client, login):

    alice = login("alice@uci.edu")
    bob = login("bob@uci.edu")
    carol = login("carol@uci.edu")
    activity_id = client.post("/activities", headers=alice, json=new_activity()).json()["id"]

    r = client.post(f"/activities/{activity_id}/join", headers=bob)

    assert r.status_code == 200
    assert r.json()["member_count"] == 2

    assert client.post(f"/activities/{activity_id}/join", headers=bob).status_code == 200
    assert client.post(f"/activities/{activity_id}/join", headers=carol).status_code == 409

    assert client.post(f"/activities/{activity_id}/leave", headers=bob).status_code == 204
    assert client.post(f"/activities/{activity_id}/join", headers=carol).status_code == 200


def test_only_creator_cancels(client, login):
    alice = login("alice@uci.edu")
    bob = login("bob@uci.edu")
    activity_id = client.post("/activities", headers=alice, json=new_activity()).json()["id"]

    assert client.post(f"/activities/{activity_id}/leave", headers=alice).status_code == 400
    assert client.delete(f"/activities/{activity_id}", headers=bob).status_code == 403
    assert client.delete(f"/activities/{activity_id}", headers=alice).status_code == 204
    assert client.get("/activities", headers=bob).json() == []


def test_blocked_creator_hidden(client, login):
    alice = login("alice@uci.edu")
    bob = login("bob@uci.edu")
    activity_id = client.post("/activities", headers=alice, json=new_activity()).json()["id"]
    bob_id = client.get("/me", headers=bob).json()["id"]

    client.post(f"/users/{bob_id}/block", headers=alice)
    assert client.get("/activities", headers=bob).json() == []
    assert client.post(f"/activities/{activity_id}/join", headers=bob).status_code == 404

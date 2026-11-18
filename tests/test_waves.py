def setup_pair(client, login):
    alice = login("alice@uci.edu")
    bob = login("bob@uci.edu")
    client.patch("/me", headers=alice, json={"display_name": "Alice", "contact": "IG @alice"})
    client.patch("/me", headers=bob, json={"display_name": "Bob", "contact": "Discord bob"})
    alice_id = client.get("/me", headers=alice).json()["id"]
    bob_id = client.get("/me", headers=bob).json()["id"]
    return alice, bob, alice_id, bob_id


def test_contact_is_private(client, login):
    alice, bob, alice_id, _ = setup_pair(client, login)
    assert client.get("/me", headers=alice).json()["contact"] == "IG @alice"
    assert "contact" not in client.get(f"/users/{alice_id}", headers=bob).json()


def test_one_way_wave_is_not_a_connection(client, login):
    alice, bob, _, bob_id = setup_pair(client, login)

    r = client.post(f"/waves/{bob_id}", headers=alice)
    assert r.status_code == 200
    assert r.json() == {"mutual": False}
    assert client.get("/waves/connections", headers=alice).json() == []

    received = client.get("/waves/received", headers=bob).json()
    assert [w["profile"]["display_name"] for w in received] == ["Alice"]


def test_mutual_wave_shares_contact(client, login):
    alice, bob, alice_id, bob_id = setup_pair(client, login)
    client.post(f"/waves/{bob_id}", headers=alice)

    assert client.post(f"/waves/{alice_id}", headers=bob).json() == {"mutual": True}
    assert client.get("/waves/connections", headers=alice).json()[0]["contact"] == "Discord bob"
    assert client.get("/waves/connections", headers=bob).json()[0]["contact"] == "IG @alice"
    # Once Bob waves back, Alice leaves his received list.
    assert client.get("/waves/received", headers=bob).json() == []


def test_unwave_breaks_connection(client, login):
    alice, bob, alice_id, bob_id = setup_pair(client, login)
    client.post(f"/waves/{bob_id}", headers=alice)
    client.post(f"/waves/{alice_id}", headers=bob)

    assert client.delete(f"/waves/{bob_id}", headers=alice).status_code == 204
    assert client.get("/waves/connections", headers=bob).json() == []


def test_cannot_wave_self_or_blocked(client, login):
    alice, bob, alice_id, bob_id = setup_pair(client, login)
    assert client.post(f"/waves/{alice_id}", headers=alice).status_code == 404

    client.post(f"/waves/{bob_id}", headers=alice)
    client.post(f"/waves/{alice_id}", headers=bob)
    client.post(f"/users/{bob_id}/block", headers=alice)
    assert client.post(f"/waves/{alice_id}", headers=bob).status_code == 404
    assert client.get("/waves/connections", headers=bob).json() == []


def test_wave_with_a_note(client, login):
    alice, bob, _, bob_id = setup_pair(client, login)
    client.post(f"/waves/{bob_id}", headers=alice, json={"note": "  At the SRC until 2  "})
    assert client.get("/waves/received", headers=bob).json()[0]["note"] == "At the SRC until 2"


def test_add_a_note_after_waving(client, login):
    alice, bob, _, bob_id = setup_pair(client, login)
    client.post(f"/waves/{bob_id}", headers=alice)
    assert client.get("/waves/received", headers=bob).json()[0]["note"] is None

    client.post(f"/waves/{bob_id}", headers=alice, json={"note": "Study at 2?"})
    assert client.get("/waves/received", headers=bob).json()[0]["note"] == "Study at 2?"


def test_blank_note_is_no_note(client, login):
    alice, bob, _, bob_id = setup_pair(client, login)
    client.post(f"/waves/{bob_id}", headers=alice, json={"note": "   "})
    assert client.get("/waves/received", headers=bob).json()[0]["note"] is None


def test_note_is_at_most_140_characters(client, login):
    alice, _, _, bob_id = setup_pair(client, login)
    r = client.post(f"/waves/{bob_id}", headers=alice, json={"note": "x" * 141})
    assert r.status_code == 422


def test_taking_back_a_wave_drops_the_note(client, login):
    alice, bob, _, bob_id = setup_pair(client, login)
    client.post(f"/waves/{bob_id}", headers=alice, json={"note": "Study at 2?"})
    client.delete(f"/waves/{bob_id}", headers=alice)
    client.post(f"/waves/{bob_id}", headers=alice)
    assert client.get("/waves/received", headers=bob).json()[0]["note"] is None


def test_match_card_shows_my_note(client, login):
    alice, bob, _, bob_id = setup_pair(client, login)
    for headers, codes in [(alice, ["34000", "44000"]), (bob, ["34000", "50000"])]:
        for code in codes:
            client.post("/schedule/courses", headers=headers, json={"course_code": code})
    client.post(f"/waves/{bob_id}", headers=alice, json={"note": "Study at 2?"})

    [match] = client.get("/matches?weekday=0", headers=alice).json()
    assert (match["waved"], match["note"]) == (True, "Study at 2?")

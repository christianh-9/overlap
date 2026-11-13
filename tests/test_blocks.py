def setup_pair(client, login):
    alice = login("alice@uci.edu")
    bob = login("bob@uci.edu")
    client.patch("/me", headers=alice, json={"display_name": "Alice"})
    client.patch("/me", headers=bob, json={"display_name": "Bob"})
    alice_id = client.get("/me", headers=alice).json()["id"]
    bob_id = client.get("/me", headers=bob).json()["id"]
    return alice, bob, alice_id, bob_id


def test_lists_only_people_you_blocked(client, login):
    alice, bob, alice_id, bob_id = setup_pair(client, login)
    assert client.get("/blocks", headers=alice).json() == []

    client.post(f"/users/{bob_id}/block", headers=alice)
    blocked = client.get("/blocks", headers=alice).json()
    assert [p["display_name"] for p in blocked] == ["Bob"]
    assert client.get("/blocks", headers=bob).json() == []


def test_unblock_makes_them_visible_again(client, login):
    alice, bob, alice_id, bob_id = setup_pair(client, login)
    client.post(f"/users/{bob_id}/block", headers=alice)
    assert client.get(f"/users/{alice_id}", headers=bob).status_code == 404

    assert client.delete(f"/users/{bob_id}/block", headers=alice).status_code == 204
    assert client.get("/blocks", headers=alice).json() == []
    assert client.get(f"/users/{alice_id}", headers=bob).status_code == 200
    assert client.post(f"/waves/{alice_id}", headers=bob).status_code == 200


def test_unblock_only_removes_your_own_block(client, login):
    alice, bob, alice_id, bob_id = setup_pair(client, login)
    client.post(f"/users/{bob_id}/block", headers=alice)
    client.post(f"/users/{alice_id}/block", headers=bob)

    client.delete(f"/users/{bob_id}/block", headers=alice)
    assert client.get(f"/users/{bob_id}", headers=alice).status_code == 404


def test_unblocking_someone_not_blocked_is_harmless(client, login):
    alice, _, _, bob_id = setup_pair(client, login)
    assert client.delete(f"/users/{bob_id}/block", headers=alice).status_code == 204

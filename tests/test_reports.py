def setup(client, login):
    alice = login("alice@uci.edu")
    bob = login("bob@uci.edu")
    admin = login("admin@uci.edu")
    bob_id = client.get("/me", headers=bob).json()["id"]
    return alice, bob, admin, bob_id


def report(client, headers, user_id, **overrides):
    body = {"reason": "harassment", "details": "Kept messaging after I said no"} | overrides
    return client.post(f"/users/{user_id}/report", headers=headers, json=body)


def test_report_blocks_by_default(client, login):
    alice, _, _, bob_id = setup(client, login)
    assert report(client, alice, bob_id).status_code == 201
    assert client.get(f"/users/{bob_id}", headers=alice).status_code == 404


def test_report_without_blocking(client, login):
    alice, _, _, bob_id = setup(client, login)
    assert report(client, alice, bob_id, block=False).status_code == 201
    assert client.get(f"/users/{bob_id}", headers=alice).status_code == 200


def test_invalid_reason_rejected(client, login):
    alice, _, _, bob_id = setup(client, login)
    assert report(client, alice, bob_id, reason="annoying").status_code == 422


def test_only_admins_see_reports(client, login):
    alice, _, admin, bob_id = setup(client, login)
    report(client, alice, bob_id)
    assert client.get("/admin/reports", headers=alice).status_code == 403

    reports = client.get("/admin/reports", headers=admin).json()
    assert [r["reported_email"] for r in reports] == ["bob@uci.edu"]


def test_dismiss(client, login):
    alice, _, admin, bob_id = setup(client, login)
    report(client, alice, bob_id)
    report_id = client.get("/admin/reports", headers=admin).json()[0]["id"]

    r = client.post(
        f"/admin/reports/{report_id}/resolve", headers=admin, json={"action": "dismiss"}
    )
    assert r.json()["status"] == "dismissed"
    assert client.get("/admin/reports", headers=admin).json() == []


def test_ban_removes_account_and_blocks_signup(client, login):
    alice, bob, admin, bob_id = setup(client, login)
    report(client, alice, bob_id)
    report_id = client.get("/admin/reports", headers=admin).json()[0]["id"]

    r = client.post(f"/admin/reports/{report_id}/resolve", headers=admin, json={"action": "ban"})
    assert r.json()["status"] == "banned"
    # The report survives the account deletion.
    assert r.json()["reported_email"] == "bob@uci.edu"

    assert client.get("/me", headers=bob).status_code == 401
    r = client.post("/auth/request-code", json={"email": "bob@uci.edu"})
    assert r.status_code == 403


def test_me_says_who_is_an_admin(client, login):
    alice, _, admin, _ = setup(client, login)
    assert client.get("/me", headers=admin).json()["is_admin"] is True
    assert client.get("/me", headers=alice).json()["is_admin"] is False


def test_admin_sees_the_evidence(client, login):
    alice, bob, admin, bob_id = setup(client, login)
    alice_id = client.get("/me", headers=alice).json()["id"]
    client.patch("/me", headers=alice, json={"display_name": "Alice"})
    client.patch("/me", headers=bob, json={"display_name": "Bob", "contact": "IG @bob"})
    client.post(f"/waves/{alice_id}", headers=bob, json={"note": "Something rude"})
    report(client, alice, bob_id)

    [r] = client.get("/admin/reports", headers=admin).json()
    assert r["reported"]["display_name"] == "Bob"
    assert (r["contact"], r["note"]) == ("IG @bob", "Something rude")
    assert (r["reporter_name"], r["campus"]) == ("Alice", "UC Irvine")


def test_deleted_account_still_listed(client, login):
    alice, bob, admin, bob_id = setup(client, login)
    report(client, alice, bob_id)
    client.delete("/me", headers=bob)

    [r] = client.get("/admin/reports", headers=admin).json()
    assert r["reported"] is None
    assert r["reported_email"] == "bob@uci.edu"


def test_new_report_emails_admins(client, login, sent):
    alice, _, _, bob_id = setup(client, login)
    report(client, alice, bob_id)

    [(to, subject, text)] = sent
    assert (to, subject) == ("admin@uci.edu", "New report on Overlap")
    assert "/admin" in text
    assert "Kept messaging" not in text

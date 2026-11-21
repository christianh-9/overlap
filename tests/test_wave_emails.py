from datetime import UTC, datetime, timedelta

from app.db import SessionLocal
from app.models import User


def setup(client, login):
    alice = login("alice@uci.edu")
    bob = login("bob@uci.edu")
    client.patch("/me", headers=alice, json={"display_name": "Alice"})
    client.patch("/me", headers=bob, json={"display_name": "Bob"})
    alice_id = client.get("/me", headers=alice).json()["id"]
    bob_id = client.get("/me", headers=bob).json()["id"]
    return alice, bob, alice_id, bob_id


def test_new_wave_emails_the_recipient(client, login, sent):
    alice, _, _, bob_id = setup(client, login)
    client.post(f"/waves/{bob_id}", headers=alice, json={"note": "Lunch at 12?"})

    [(to, subject, text)] = sent
    assert to == "bob@uci.edu"
    assert subject == "Alice waved at you on Overlap"
    assert "/connections" in text
    assert "Lunch" not in text


def test_waving_back_sends_the_connected_email(client, login, sent):
    alice, bob, alice_id, bob_id = setup(client, login)
    client.post(f"/waves/{bob_id}", headers=alice)
    client.post(f"/waves/{alice_id}", headers=bob)

    assert sent[-1][:2] == ("alice@uci.edu", "You and Bob are connected on Overlap")


def test_at_most_one_email_a_day(client, login, sent):
    alice, _, _, bob_id = setup(client, login)
    carol = login("carol@uci.edu")
    client.post(f"/waves/{bob_id}", headers=alice)
    client.post(f"/waves/{bob_id}", headers=carol)
    assert len(sent) == 1

    with SessionLocal() as db:
        bob = db.get(User, bob_id)
        bob.last_wave_email_at = datetime.now(UTC) - timedelta(hours=25)
        db.commit()
    client.delete(f"/waves/{bob_id}", headers=carol)
    client.post(f"/waves/{bob_id}", headers=carol)
    assert len(sent) == 2


def test_turned_off_means_no_emails(client, login, sent):
    alice, bob, _, bob_id = setup(client, login)
    r = client.patch("/me", headers=bob, json={"email_waves": False})
    assert r.json()["email_waves"] is False
    client.post(f"/waves/{bob_id}", headers=alice)
    assert sent == []


def test_adding_a_note_sends_nothing_new(client, login, sent):
    alice, _, _, bob_id = setup(client, login)
    client.post(f"/waves/{bob_id}", headers=alice)
    client.post(f"/waves/{bob_id}", headers=alice, json={"note": "Lunch at 12?"})
    assert len(sent) == 1

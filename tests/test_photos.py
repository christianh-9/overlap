from io import BytesIO

from PIL import Image

from app.main import app
from app.photos import MAX_BYTES, get_storage


def jpeg(size=(800, 600)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, (200, 80, 40)).save(buffer, "JPEG")
    return buffer.getvalue()


def upload(client, headers, data, name="me.jpg"):
    return client.put("/me/photo", headers=headers, files={"file": (name, data, "image/jpeg")})


def test_upload_stores_a_small_webp(client, login, storage):
    alice = login("alice@uci.edu")
    response = upload(client, alice, jpeg())
    assert response.status_code == 200
    assert response.json()["photo_url"].endswith(".webp")

    [(key, data)] = storage.files.items()
    assert key.startswith("photos/")
    stored = Image.open(BytesIO(data))
    assert (stored.format, stored.size) == ("WEBP", (256, 256))


def test_others_see_the_photo(client, login, storage):
    alice = login("alice@uci.edu")
    bob = login("bob@uci.edu")
    alice_id = client.get("/me", headers=alice).json()["id"]
    assert client.get(f"/users/{alice_id}", headers=bob).json()["photo_url"] is None

    upload(client, alice, jpeg())
    assert client.get(f"/users/{alice_id}", headers=bob).json()["photo_url"] is not None


def test_new_photo_replaces_the_old_one(client, login, storage):
    alice = login("alice@uci.edu")
    first = upload(client, alice, jpeg()).json()["photo_url"]
    second = upload(client, alice, jpeg((300, 300))).json()["photo_url"]
    assert first != second
    assert len(storage.files) == 1


def test_rejects_files_that_arent_images(client, login, storage):
    alice = login("alice@uci.edu")
    assert upload(client, alice, b"not really a jpg").status_code == 422
    assert storage.files == {}


def test_rejects_large_files(client, login, storage):
    alice = login("alice@uci.edu")
    assert upload(client, alice, b"0" * (MAX_BYTES + 1)).status_code == 413
    assert storage.files == {}


def test_remove_photo(client, login, storage):
    alice = login("alice@uci.edu")
    upload(client, alice, jpeg())
    assert client.delete("/me/photo", headers=alice).status_code == 204
    assert client.get("/me", headers=alice).json()["photo_url"] is None
    assert storage.files == {}


def test_uploads_off_without_a_bucket(client, login):
    app.dependency_overrides[get_storage] = lambda: None
    alice = login("alice@uci.edu")
    assert upload(client, alice, jpeg()).status_code == 503

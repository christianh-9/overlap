import re

import httpx
import pytest

from app.config import settings
from app.email import EmailFailed, send_login_code


def test_login_email_request(monkeypatch):
    sent = {}

    def fake_post(url, headers, json):
        sent.update(url=url, headers=headers, json=json)
        return httpx.Response(200, request=httpx.Request("POST", url))

    monkeypatch.setattr(settings, "resend_api_key", "test-key")
    monkeypatch.setattr(httpx, "post", fake_post)

    send_login_code("alice@uci.edu", "123456")

    assert sent["headers"]["Authorization"] == "Bearer test-key"
    assert sent["json"]["to"] == ["alice@uci.edu"]
    assert "123456" in sent["json"]["subject"]
    assert re.fullmatch(r".+ <[^<>]+@[^<>]+>", sent["json"]["from"])


def test_login_email_failure_raises(monkeypatch):
    def fake_post(url, headers, json):
        return httpx.Response(500, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)

    with pytest.raises(EmailFailed):
        send_login_code("alice@uci.edu", "123456")

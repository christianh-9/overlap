import pytest
from pydantic import ValidationError

from app.config import Settings


def test_host_database_urls_get_psycopg_driver():
    for url in ["postgres://u:p@host/db", "postgresql://u:p@host/db"]:
        settings = Settings(database_url=url, _env_file=None)
        assert settings.database_url == "postgresql+psycopg://u:p@host/db"


def test_production_requires_real_secret():
    with pytest.raises(ValidationError):
        Settings(dev_mode=False, jwt_secret="short", resend_api_key="re_x", _env_file=None)


def test_production_requires_email_key():
    with pytest.raises(ValidationError):
        Settings(dev_mode=False, jwt_secret="x" * 32, _env_file=None)


def test_valid_production_settings():
    settings = Settings(dev_mode=False, jwt_secret="x" * 32, resend_api_key="re_x", _env_file=None)
    assert settings.dev_mode is False

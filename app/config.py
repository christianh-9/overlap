from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET = "dev-only-secret-not-for-production-use"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://overlap:overlap@localhost:5432/overlap"
    jwt_secret: str = "dev-only-secret-not-for-production-use"
    jwt_ttl_hours: int = 24 * 7
    dev_mode: bool = False
    current_term: str | None = None
    min_gap_minutes: int = 30
    min_overlap_minutes: int = 30
    timezone: str = "America/Los_Angeles"
    admin_emails: list[str] = []
    resend_api_key: str = ""
    email_from: str = "Overlap <onboarding@resend.dev>"
    site_url: str = "http://localhost:5173"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-2"
    photo_bucket: str = ""

    cors_origin: list[str] = ["http://localhost:5173"]
    cors_origin_regex: str | None = None

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, url: str) -> str:
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url.removeprefix(prefix)

        return url

    @model_validator(mode="after")
    def check_production(self):
        if self.dev_mode:
            return self
        if self.jwt_secret == DEV_SECRET or len(self.jwt_secret) < 32:
            raise ValueError("Set JWT_SECRET to a random string of 32+ characters")
        if not self.resend_api_key:
            raise ValueError("Set RESEND_API_KEY so login codes can be emailed")

        return self


settings = Settings()

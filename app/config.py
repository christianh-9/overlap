from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://overlap:overlap@localhost:5432/overlap"
    jwt_secret: str = "dev-only-secret-not-for-production-use"
    jwt_ttl_hours: int = 24 * 7
    dev_mode: bool = True
    current_term: str = "2026-fall"
    min_gap_minutes: int = 30
    min_overlap_minutes: int = 30
    timezone: str = "America/Los_Angeles"
    admin_emails: list[str] = []


settings = Settings()

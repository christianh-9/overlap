from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_viles=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://overlap:overlap@localhost:5432/overlap"
    jwt_secret: str = "dev-only-secret"
    jwt_ttl_hours: int = 24 * 7
    dev_mode: bool = True
    current_term: str = "2026-fall"
    min_gap_minutes: int = 30
    min_overlap_minutes: int = 30
    timezone: str = "America/Los_Angeles"


settings = Settings()

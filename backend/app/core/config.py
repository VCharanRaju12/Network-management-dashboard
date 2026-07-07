from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "Cloud Network Management Dashboard"
    API_V1_PREFIX: str = "/api"

    # Security
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://netdash:netdash@postgres:5432/netdash"

    # Redis (used for websocket pub/sub + celery-style broker later)
    REDIS_URL: str = "redis://redis:6379/0"

    # Polling
    DEFAULT_POLL_INTERVAL_SECONDS: int = 30

    class Config:
        env_file = ".env"


settings = Settings()

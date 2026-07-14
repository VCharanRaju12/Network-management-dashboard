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

    # Encrypts snmp_community and any other device credentials at rest in
    # the database. Must be a valid Fernet key (44 url-safe base64 chars).
    # This default is a real, working key so local dev works out of the
    # box — generate your own for anything beyond local dev:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    CREDENTIAL_ENCRYPTION_KEY: str = "OloammpEtjFOpKutsR5HM3liEnNhu9Ean8X-qhRfedI="

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://netdash:netdash@postgres:5432/netdash"

    # Redis (used for websocket pub/sub + celery-style broker later)
    REDIS_URL: str = "redis://redis:6379/0"

    # CORS — comma-separated list of allowed origins. Defaults cover local
    # dev (Vite on 5173); set this explicitly for any real deployment.
    CORS_ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Polling
    DEFAULT_POLL_INTERVAL_SECONDS: int = 30

    # Alerting — all optional. If unset, notify_status_change() silently
    # no-ops (logs at debug level) instead of erroring, so this feature is
    # opt-in and never blocks the poller if you haven't configured it.
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_ADDRESS: str | None = None
    ALERT_EMAIL_TO: str | None = None  # comma-separated if multiple
    ALERT_WEBHOOK_URL: str | None = None  # e.g. a Slack incoming webhook URL
    # Minimum seconds between alerts for the same device — prevents a
    # flapping device (online/offline/online repeatedly) from spamming
    # your inbox/webhook on every single transition.
    ALERT_COOLDOWN_SECONDS: int = 300

    class Config:
        env_file = ".env"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ALLOWED_ORIGINS.split(",") if origin.strip()]


settings = Settings()

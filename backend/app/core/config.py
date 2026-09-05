from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MedRelease"
    database_url: str = "sqlite:///./medrelease.db"
    jwt_secret_key: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # Comma separated list of allowed origins, e.g. "https://app.example.com,http://localhost:5173"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # GitHub integration
    github_mode: str = "demo"  # "demo" or "real"
    github_token: str | None = None
    github_repo_owner: str | None = None
    github_repo_name: str | None = None

    # Seeding
    auto_seed: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

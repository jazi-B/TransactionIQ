from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_FILES = [ROOT_DIR / ".env", ROOT_DIR / "backend" / ".env"]


def load_env_files() -> None:
    for env_file in ENV_FILES:
        if not env_file.exists():
            continue

        for line in env_file.read_text(encoding="utf-8").splitlines():
            raw = line.strip()
            if not raw or raw.startswith("#") or "=" not in raw:
                continue

            key, value = raw.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'").strip("`")
            os.environ.setdefault(key, value)


@dataclass(frozen=True)
class AppConfig:
    supabase_url: str
    supabase_publishable_key: str
    supabase_secret_key: str
    supabase_jwks_url: str
    admin_bootstrap_password: str
    cors_allowed_origins: tuple[str, ...]

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_secret_key)


def parse_origins(value: str) -> tuple[str, ...]:
    origins = []
    for item in value.split(","):
        origin = item.strip().strip('"').strip("'").strip("`").rstrip("/")
        if origin:
            origins.append(origin)
    return tuple(dict.fromkeys(origins))


load_env_files()


def get_config() -> AppConfig:
    cors_origins = os.getenv(
        "CORS_ALLOWED_ORIGINS",
        ",".join(
            [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "https://transaction-iq.vercel.app",
            ]
        ),
    )
    return AppConfig(
        supabase_url=os.getenv("SUPABASE_URL", "").strip().strip("`"),
        supabase_publishable_key=os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip(),
        supabase_secret_key=os.getenv("SUPABASE_SECRET_KEY", "").strip(),
        supabase_jwks_url=os.getenv("SUPABASE_JWKS_URL", "").strip().strip("`"),
        admin_bootstrap_password=os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "admin123").strip(),
        cors_allowed_origins=parse_origins(cors_origins),
    )

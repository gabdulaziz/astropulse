"""App settings, read from the .env file (or real environment variables)."""
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"
load_dotenv(ENV_FILE)

def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip() or "postgresql+psycopg://astropulse:astropulse_pw@localhost:5432/astropulse"
    # Hosting services (Neon, Render) give "postgres://" or "postgresql://" addresses.
    # SQLAlchemy needs to be told to use the psycopg driver.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


DATABASE_URL = _database_url()
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]
# Older versions saved uploads here. Files found here are moved into the database on start.
UPLOAD_DIR = BASE_DIR / "uploads"

# ---- Login settings
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "mission2026")

ASTRONAUT_SESSION_DAYS = 30      # astronauts stay logged in for 30 days (renewed on every visit)
ADMIN_SESSION_HOURS = 12         # Mission Control sees everyone, so its pass is short
EMERGENCY_MINUTES = 60           # how long an emergency access lasts
MAX_FAILED_LOGINS = 5            # wrong PIN/password attempts before a lock
LOCK_MINUTES = 5


def _load_or_create_secret() -> str:
    """The signing secret must survive restarts, otherwise everyone gets logged out.
    If .env has no JWT_SECRET, create a random one and save it there."""
    value = os.getenv("JWT_SECRET", "").strip()
    if value:
        return value
    value = secrets.token_urlsafe(48)
    try:
        lines = ENV_FILE.read_text().splitlines() if ENV_FILE.exists() else []
        lines = [l for l in lines if not l.startswith("JWT_SECRET=")] + [f"JWT_SECRET={value}"]
        ENV_FILE.write_text("\n".join(lines) + "\n")
    except OSError:
        pass  # read-only folder: works until restart
    os.environ["JWT_SECRET"] = value
    return value


JWT_SECRET = _load_or_create_secret()

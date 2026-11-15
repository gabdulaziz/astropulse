"""
AstroPulse API - entry point.

Run from the backend folder:
    uvicorn app.main:app --reload
Then open http://localhost:8000/docs for the interactive API explorer.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import CORS_ORIGINS
from .database import Base, SessionLocal, engine
from .routers import astronauts, auth, health, images, vitals
from .security import ensure_default_admin
from .storage import import_files_from_disk

# Columns added after the first version. "IF NOT EXISTS" makes this safe to run on every start,
# so an existing database is upgraded without losing any data.
UPGRADES = [
    "ALTER TABLE astronauts ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(100)",
    "ALTER TABLE astronauts ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE astronauts ADD COLUMN IF NOT EXISTS failed_logins INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE astronauts ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ",
    "ALTER TABLE astronauts ADD COLUMN IF NOT EXISTS photo_filename VARCHAR(200)",
    "ALTER TABLE admins ADD COLUMN IF NOT EXISTS photo_filename VARCHAR(200)",
]


def prepare_database():
    Base.metadata.create_all(bind=engine)          # new tables (admins, emergency_access)
    with engine.begin() as conn:
        for stmt in UPGRADES:
            conn.execute(text(stmt))
    with SessionLocal() as db:
        ensure_default_admin(db)                   # Mission Control account from .env
        import_files_from_disk(db)                 # photos saved on disk by older versions


@asynccontextmanager
async def lifespan(app: FastAPI):
    prepare_database()
    yield


app = FastAPI(
    title="AstroPulse API",
    description="Astronaut health monitoring - NASA Space Apps Challenge 2026. "
                "Most endpoints need a login: use POST /api/auth/astronaut or /api/auth/admin, "
                "then click 'Authorize' and paste the token.",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(astronauts.router)
app.include_router(vitals.router)
app.include_router(health.router)
app.include_router(images.router)


@app.get("/api/health", tags=["System"])
def health_check():
    """Is the API up and can it reach PostgreSQL?"""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}

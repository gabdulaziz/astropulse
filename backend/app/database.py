"""Database connection. SQLAlchemy talks to PostgreSQL through the psycopg driver."""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency: opens one DB session per request and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

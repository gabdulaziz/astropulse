"""Database tables (SQLAlchemy ORM models). See schema.sql for the same thing in plain SQL."""
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Astronaut(Base):
    __tablename__ = "astronauts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    call_sign: Mapped[str] = mapped_column(String(40), default="")
    role: Mapped[str] = mapped_column(String(80), default="Mission Specialist")
    agency: Mapped[str] = mapped_column(String(40), default="NASA")
    environment: Mapped[str] = mapped_column(String(30), default="station")
    mission_name: Mapped[str] = mapped_column(String(120), default="")
    mission_start: Mapped[date] = mapped_column(Date, default=date.today)
    baseline_mass_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    prior_career_dose_msv: Mapped[float] = mapped_column(Float, default=0.0)
    avatar_color: Mapped[str] = mapped_column(String(20), default="#7c5cff")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # ---- login (the PIN itself is never stored, only its bcrypt hash)
    pin_hash: Mapped[str | None] = mapped_column(String(100), nullable=True)
    token_version: Mapped[int] = mapped_column(Integer, default=0)   # +1 = log out every device
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    photo_filename: Mapped[str | None] = mapped_column(String(200), nullable=True)  # in uploads/avatars/

    readings: Mapped[list["VitalReading"]] = relationship(back_populates="astronaut", cascade="all, delete-orphan")
    completions: Mapped[list["TaskCompletion"]] = relationship(back_populates="astronaut", cascade="all, delete-orphan")
    images: Mapped[list["HealthImage"]] = relationship(back_populates="astronaut", cascade="all, delete-orphan")


class VitalReading(Base):
    """One measurement of one health indicator. Blood pressure uses value (systolic) + value2 (diastolic)."""

    __tablename__ = "vital_readings"
    __table_args__ = (Index("ix_readings_astro_ind_time", "astronaut_id", "indicator", "recorded_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey("astronauts.id", ondelete="CASCADE"))
    indicator: Mapped[str] = mapped_column(String(40))
    value: Mapped[float] = mapped_column(Float)
    value2: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="nominal")
    notes: Mapped[str] = mapped_column(Text, default="")
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    astronaut: Mapped[Astronaut] = relationship(back_populates="readings")


class TaskCompletion(Base):
    """A health task (quest) completed on a given day; earns XP."""

    __tablename__ = "task_completions"
    __table_args__ = (UniqueConstraint("astronaut_id", "task_key", "completed_on", name="uq_task_per_day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey("astronauts.id", ondelete="CASCADE"))
    task_key: Mapped[str] = mapped_column(String(40))
    xp: Mapped[int] = mapped_column(Integer, default=0)
    completed_on: Mapped[date] = mapped_column(Date, default=date.today)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    astronaut: Mapped[Astronaut] = relationship(back_populates="completions")


class HealthImage(Base):
    """A camera image (ultrasound, skin, eye, wound...) saved to /uploads, with metadata here."""

    __tablename__ = "health_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey("astronauts.id", ondelete="CASCADE"))
    category: Mapped[str] = mapped_column(String(30), default="other")
    filename: Mapped[str] = mapped_column(String(200))
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    astronaut: Mapped[Astronaut] = relationship(back_populates="images")


class Admin(Base):
    """A Mission Control account (flight surgeon / admin). Password stored as a bcrypt hash."""

    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(60), unique=True)
    display_name: Mapped[str] = mapped_column(String(120), default="Mission Control")
    password_hash: Mapped[str] = mapped_column(String(100))
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    photo_filename: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class EmergencyAccess(Base):
    """A crewmate opened another astronaut's record in an emergency. Every row is the audit log."""

    __tablename__ = "emergency_access"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("astronauts.id", ondelete="CASCADE"))
    astronaut_id: Mapped[int] = mapped_column(ForeignKey("astronauts.id", ondelete="CASCADE"))
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

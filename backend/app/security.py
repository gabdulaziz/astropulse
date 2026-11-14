"""
Login and permissions.

* PINs and passwords are hashed with bcrypt (slow on purpose, salted) - never stored as text.
* After login the browser gets a signed pass (a JWT). Every API request sends it back.
* Each request is checked here: an astronaut may only read their own record, unless they
  hold an active emergency access; Mission Control may read everyone.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import config
from .database import get_db
from .models import Admin, Astronaut, EmergencyAccess

ALGORITHM = "HS256"


# ------------------------------------------------------------------ hashing
def hash_secret(secret: str) -> str:
    return bcrypt.hashpw(secret.encode(), bcrypt.gensalt()).decode()


def verify_secret(secret: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(secret.encode(), hashed.encode())
    except ValueError:
        return False


# ------------------------------------------------------------------ passes (JWT)
def make_token(role: str, subject_id: int, version: int) -> tuple[str, datetime]:
    now = datetime.now(timezone.utc)
    life = timedelta(days=config.ASTRONAUT_SESSION_DAYS) if role == "astronaut" else timedelta(hours=config.ADMIN_SESSION_HOURS)
    exp = now + life
    token = jwt.encode({"role": role, "sub": str(subject_id), "ver": version, "iat": now, "exp": exp},
                       config.JWT_SECRET, algorithm=ALGORITHM)
    return token, exp


@dataclass
class Principal:
    role: str                 # "admin" | "astronaut"
    id: int                   # admin id or astronaut id
    name: str
    version: int
    issued_at: datetime

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


def current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> Principal:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Please log in")
    token = authorization.split(" ", 1)[1]
    try:
        data = jwt.decode(token, config.JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Your session expired, please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Please log in")
    model = Admin if data.get("role") == "admin" else Astronaut
    user = db.get(model, int(data["sub"]))
    if not user or user.token_version != data.get("ver"):
        raise HTTPException(401, "Please log in again")   # deleted, or PIN/password was reset
    name = user.display_name if model is Admin else user.name
    return Principal(data["role"], user.id, name, user.token_version,
                     datetime.fromtimestamp(data["iat"], timezone.utc))


def require_admin(user: Principal = Depends(current_user)) -> Principal:
    if not user.is_admin:
        raise HTTPException(403, "Only Mission Control can do this")
    return user


def active_emergency(db: Session, requester_id: int, astronaut_id: int) -> EmergencyAccess | None:
    now = datetime.now(timezone.utc)
    return db.scalar(select(EmergencyAccess).where(
        EmergencyAccess.requester_id == requester_id, EmergencyAccess.astronaut_id == astronaut_id,
        EmergencyAccess.expires_at > now, EmergencyAccess.ended_at.is_(None)))


def ensure_can_read(db: Session, user: Principal, astronaut_id: int) -> None:
    """Admin: everyone. Astronaut: themself, or someone they hold emergency access to."""
    if user.is_admin or user.id == astronaut_id:
        return
    if active_emergency(db, user.id, astronaut_id):
        return
    raise HTTPException(403, "This health record is private")


def ensure_can_write(user: Principal, astronaut_id: int) -> None:
    """Only the astronaut themself (or Mission Control) can add or change data. Emergency access is read-only."""
    if user.is_admin or user.id == astronaut_id:
        return
    raise HTTPException(403, "You can only change your own record")


# ------------------------------------------------------------------ lockout
def check_lock(account) -> None:
    if account.locked_until and account.locked_until > datetime.now(timezone.utc):
        mins = int((account.locked_until - datetime.now(timezone.utc)).total_seconds() // 60) + 1
        raise HTTPException(429, f"Too many wrong attempts. Try again in {mins} min.")


def register_failure(db: Session, account) -> None:
    account.failed_logins = (account.failed_logins or 0) + 1
    if account.failed_logins >= config.MAX_FAILED_LOGINS:
        account.locked_until = datetime.now(timezone.utc) + timedelta(minutes=config.LOCK_MINUTES)
        account.failed_logins = 0
    db.commit()


def register_success(db: Session, account) -> None:
    account.failed_logins = 0
    account.locked_until = None
    db.commit()


# ------------------------------------------------------------------ first start
def ensure_default_admin(db: Session) -> None:
    """Create the Mission Control account from .env if there is no admin yet."""
    if db.scalar(select(Admin.id).limit(1)) is None:
        db.add(Admin(username=config.ADMIN_USERNAME, display_name="Mission Control",
                     password_hash=hash_secret(config.ADMIN_PASSWORD)))
        db.commit()

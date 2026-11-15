"""Login, sessions, emergency access and the Mission Control overview."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import config
from ..database import get_db
from ..health_engine import assessment
from ..models import Admin, Astronaut, EmergencyAccess, VitalReading
from ..photos import admin_photo_url, astronaut_photo_url, photo_response, remove_photo, save_photo
from ..security import (Principal, check_lock, current_user, hash_secret, make_token, register_failure,
                        register_success, require_admin, verify_secret)

router = APIRouter(prefix="/api", tags=["Login & access"])

PIN_PATTERN = r"^\d{6}$"


class AstronautLogin(BaseModel):
    astronaut_id: int
    pin: str = Field(pattern=PIN_PATTERN)


class AdminLogin(BaseModel):
    username: str
    password: str


class ChangePin(BaseModel):
    current_pin: str = Field(pattern=PIN_PATTERN)
    new_pin: str = Field(pattern=PIN_PATTERN)


class EmergencyRequest(BaseModel):
    astronaut_id: int
    reason: str = Field(min_length=5, max_length=500)


def _session(role, account) -> dict:
    token, exp = make_token(role, account.id, account.token_version)
    return {"token": token, "expires_at": exp.isoformat()}


# ------------------------------------------------------------------ login
@router.get("/auth/roster")
def roster(db: Session = Depends(get_db)):
    """Names and colours only, for the login screen. No health data."""
    rows = db.scalars(select(Astronaut).order_by(Astronaut.id)).all()
    return [{"id": a.id, "name": a.name, "call_sign": a.call_sign, "avatar_color": a.avatar_color,
             "has_pin": bool(a.pin_hash), "photo_url": astronaut_photo_url(a)} for a in rows]


@router.post("/auth/astronaut")
def login_astronaut(body: AstronautLogin, db: Session = Depends(get_db)):
    astro = db.get(Astronaut, body.astronaut_id)
    if not astro:
        raise HTTPException(401, "Wrong astronaut or PIN")
    if not astro.pin_hash:
        raise HTTPException(403, "No PIN set yet. Ask Mission Control to set your PIN.")
    check_lock(astro)
    if not verify_secret(body.pin, astro.pin_hash):
        register_failure(db, astro)
        raise HTTPException(401, "Wrong PIN")
    register_success(db, astro)
    return _session("astronaut", astro)


@router.post("/auth/admin")
def login_admin(body: AdminLogin, db: Session = Depends(get_db)):
    admin = db.scalar(select(Admin).where(Admin.username == body.username))
    if not admin:
        raise HTTPException(401, "Wrong username or password")
    check_lock(admin)
    if not verify_secret(body.password, admin.password_hash):
        register_failure(db, admin)
        raise HTTPException(401, "Wrong username or password")
    register_success(db, admin)
    return _session("admin", admin)


@router.get("/auth/me")
def me(user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    """Who am I? Also hands back a fresh pass, so regular users never get logged out."""
    model = Admin if user.is_admin else Astronaut
    account = db.get(model, user.id)
    out = {"role": user.role, "id": user.id, "name": user.name, **_session(user.role, account),
           "photo_url": admin_photo_url(account) if user.is_admin else astronaut_photo_url(account)}
    if not user.is_admin:
        now = datetime.now(timezone.utc)
        # Emergency accesses I currently hold (I'm the crewmate helping)
        held = db.scalars(select(EmergencyAccess).where(
            EmergencyAccess.requester_id == user.id, EmergencyAccess.expires_at > now,
            EmergencyAccess.ended_at.is_(None))).all()
        out["emergency_held"] = [_grant_out(db, g) for g in held]
        # Times someone opened MY record in the last 7 days (transparency)
        seen = db.scalars(select(EmergencyAccess).where(
            EmergencyAccess.astronaut_id == user.id, EmergencyAccess.created_at > now - timedelta(days=7))
            .order_by(EmergencyAccess.created_at.desc())).all()
        out["emergency_on_me"] = [_grant_out(db, g) for g in seen]
    return out


@router.post("/auth/change-pin")
def change_pin(body: ChangePin, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    if user.is_admin:
        raise HTTPException(400, "Mission Control uses a password, not a PIN")
    astro = db.get(Astronaut, user.id)
    check_lock(astro)
    if not verify_secret(body.current_pin, astro.pin_hash):
        register_failure(db, astro)
        raise HTTPException(401, "Current PIN is wrong")
    astro.pin_hash = hash_secret(body.new_pin)
    astro.token_version += 1          # other devices must log in with the new PIN
    register_success(db, astro)
    return {"ok": True, **_session("astronaut", astro)}


@router.post("/auth/logout-everywhere")
def logout_everywhere(user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    account = db.get(Admin if user.is_admin else Astronaut, user.id)
    account.token_version += 1
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ emergency access
def _grant_out(db: Session, g: EmergencyAccess) -> dict:
    req = db.get(Astronaut, g.requester_id)
    pat = db.get(Astronaut, g.astronaut_id)
    now = datetime.now(timezone.utc)
    active = g.ended_at is None and g.expires_at > now
    return {"id": g.id, "requester_id": g.requester_id, "requester": req.name if req else "?",
            "astronaut_id": g.astronaut_id, "astronaut": pat.name if pat else "?", "reason": g.reason,
            "created_at": g.created_at.isoformat(), "expires_at": g.expires_at.isoformat(),
            "ended_at": g.ended_at.isoformat() if g.ended_at else None, "active": active}


@router.post("/emergency")
def start_emergency(body: EmergencyRequest, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    """A crewmate opens another astronaut's record, read-only, for 60 minutes. Always logged."""
    if user.is_admin:
        raise HTTPException(400, "Mission Control can already see every record")
    if body.astronaut_id == user.id:
        raise HTTPException(400, "You already have access to your own record")
    if not db.get(Astronaut, body.astronaut_id):
        raise HTTPException(404, "Astronaut not found")
    now = datetime.now(timezone.utc)
    grant = EmergencyAccess(requester_id=user.id, astronaut_id=body.astronaut_id, reason=body.reason.strip(),
                            created_at=now, expires_at=now + timedelta(minutes=config.EMERGENCY_MINUTES))
    db.add(grant)
    db.commit()
    return _grant_out(db, grant)


@router.post("/emergency/{grant_id}/end")
def end_emergency(grant_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    g = db.get(EmergencyAccess, grant_id)
    if not g or (not user.is_admin and g.requester_id != user.id):
        raise HTTPException(404, "Not found")
    if g.ended_at is None:
        g.ended_at = datetime.now(timezone.utc)
        db.commit()
    return _grant_out(db, g)


# ------------------------------------------------------------------ Mission Control
@router.get("/admin/overview")
def overview(_: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    """Every astronaut at a glance."""
    out = []
    for astro in db.scalars(select(Astronaut).order_by(Astronaut.id)).all():
        a = assessment(db, astro)
        last = db.scalar(select(func.max(VitalReading.recorded_at)).where(VitalReading.astronaut_id == astro.id))
        out.append({
            "id": astro.id, "name": astro.name, "call_sign": astro.call_sign, "role": astro.role,
            "photo_url": astronaut_photo_url(astro),
            "agency": astro.agency, "avatar_color": astro.avatar_color, "has_pin": bool(astro.pin_hash),
            "environment": a["environment"]["name"], "mission_day": a["mission_day"],
            "score": a["score"], "overall": a["overall"], "summary": a["summary"],
            "alerts": [{"title": x["title"], "level": x["level"]} for x in a["alerts"]],
            "last_checkin": last.isoformat() if last else None,
            "locked": bool(astro.locked_until and astro.locked_until > datetime.now(timezone.utc)),
        })
    return out


@router.get("/admin/access-log")
def access_log(_: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.scalars(select(EmergencyAccess).order_by(EmergencyAccess.created_at.desc()).limit(200)).all()
    return [_grant_out(db, g) for g in rows]


# ------------------------------------------------------------------ Mission Control photo
@router.get("/admin/{admin_id}/photo")
def admin_photo(admin_id: int, db: Session = Depends(get_db)):
    admin = db.get(Admin, admin_id)
    if not admin:
        raise HTTPException(404, "No photo")
    return photo_response(db, admin.photo_filename)


@router.post("/admin/me/photo")
async def upload_admin_photo(file: UploadFile = File(...), user: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    admin = db.get(Admin, user.id)
    admin.photo_filename = await save_photo(db, file, admin.photo_filename)
    db.commit()
    return {"photo_url": admin_photo_url(admin)}


@router.delete("/admin/me/photo")
def delete_admin_photo(user: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    admin = db.get(Admin, user.id)
    remove_photo(db, admin.photo_filename)
    admin.photo_filename = None
    db.commit()
    return {"photo_url": None}

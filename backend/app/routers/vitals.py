from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import knowledge as K
from ..database import get_db
from ..health_engine import evaluate, mass_baseline
from ..models import VitalReading
from ..schemas import ReadingBatch, ReadingCreate, ReadingOut
from ..security import Principal, current_user, ensure_can_read, ensure_can_write
from .astronauts import get_astronaut_or_404

router = APIRouter(prefix="/api/vitals", tags=["Vitals"])


def _save(db: Session, body: ReadingCreate, user: Principal) -> VitalReading:
    ensure_can_write(user, body.astronaut_id)
    astro = get_astronaut_or_404(db, body.astronaut_id)
    spec = K.INDICATORS[body.indicator]
    inp = spec["input"]
    if not (inp["min"] <= body.value <= inp["max"]):
        raise HTTPException(422, f"{spec['name']} must be between {inp['min']} and {inp['max']} {spec['unit']}")
    if body.indicator == "blood_pressure":
        if body.value2 is None:
            raise HTTPException(422, "Blood pressure needs value (systolic) and value2 (diastolic)")
        if body.value2 >= body.value:
            raise HTTPException(422, "Diastolic must be lower than systolic")
    baseline = mass_baseline(db, astro) if body.indicator == "body_mass" else None
    status = evaluate(body.indicator, body.value, body.value2, baseline)
    reading = VitalReading(
        astronaut_id=astro.id, indicator=body.indicator, value=body.value, value2=body.value2,
        notes=body.notes, status=status, recorded_at=body.recorded_at or datetime.now(timezone.utc),
    )
    db.add(reading)
    return reading


@router.post("", response_model=ReadingOut, status_code=201)
def add_reading(body: ReadingCreate, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    reading = _save(db, body, user)
    db.commit()
    db.refresh(reading)
    return reading


@router.post("/batch", response_model=list[ReadingOut], status_code=201)
def add_readings(body: ReadingBatch, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    """Save a whole check-in (several indicators) in one transaction."""
    saved = [_save(db, ReadingCreate(astronaut_id=body.astronaut_id, **r), user) for r in body.readings]
    db.commit()
    for r in saved:
        db.refresh(r)
    return saved


@router.get("", response_model=list[ReadingOut])
def list_readings(
    astronaut_id: int,
    indicator: str | None = None,
    days: int = Query(30, ge=1, le=3650),
    limit: int = Query(500, ge=1, le=5000),
    user: Principal = Depends(current_user),
    db: Session = Depends(get_db),
):
    ensure_can_read(db, user, astronaut_id)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    q = select(VitalReading).where(VitalReading.astronaut_id == astronaut_id, VitalReading.recorded_at >= since)
    if indicator:
        q = q.where(VitalReading.indicator == indicator)
    return db.scalars(q.order_by(VitalReading.recorded_at.desc()).limit(limit)).all()


@router.delete("/{reading_id}", status_code=204)
def delete_reading(reading_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    r = db.get(VitalReading, reading_id)
    if not r:
        raise HTTPException(404, "Reading not found")
    ensure_can_write(user, r.astronaut_id)
    db.delete(r)
    db.commit()

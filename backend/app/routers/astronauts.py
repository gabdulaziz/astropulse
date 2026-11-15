from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..storage import delete_file
from ..models import Astronaut, HealthImage
from ..photos import astronaut_photo_url, photo_response, remove_photo, save_photo
from ..schemas import AstronautCreate, AstronautOut, AstronautUpdate, PinSet
from ..security import Principal, current_user, ensure_can_read, ensure_can_write, hash_secret, require_admin

router = APIRouter(prefix="/api/astronauts", tags=["Crew"])

# Fields an astronaut may change on their own profile. Everything else is Mission Control's job.
SELF_EDITABLE = {"call_sign", "avatar_color"}


def get_astronaut_or_404(db: Session, astronaut_id: int) -> Astronaut:
    astro = db.get(Astronaut, astronaut_id)
    if not astro:
        raise HTTPException(404, f"Astronaut {astronaut_id} not found")
    return astro


def to_out(astro: Astronaut) -> AstronautOut:
    out = AstronautOut.model_validate(astro)
    out.has_pin = bool(astro.pin_hash)
    out.photo_url = astronaut_photo_url(astro)
    return out


@router.get("", response_model=list[AstronautOut])
def list_astronauts(user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    """Mission Control sees the whole crew; an astronaut only sees themself."""
    q = select(Astronaut).order_by(Astronaut.id)
    if not user.is_admin:
        q = q.where(Astronaut.id == user.id)
    return [to_out(a) for a in db.scalars(q).all()]


@router.post("", response_model=AstronautOut, status_code=201)
def create_astronaut(body: AstronautCreate, _: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    data = body.model_dump(exclude={"pin"})
    data["mission_start"] = data["mission_start"] or date.today()
    astro = Astronaut(**data, pin_hash=hash_secret(body.pin))
    db.add(astro)
    db.commit()
    db.refresh(astro)
    return to_out(astro)


@router.get("/{astronaut_id}", response_model=AstronautOut)
def get_astronaut(astronaut_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    ensure_can_read(db, user, astronaut_id)
    return to_out(get_astronaut_or_404(db, astronaut_id))


@router.patch("/{astronaut_id}", response_model=AstronautOut)
def update_astronaut(astronaut_id: int, body: AstronautUpdate, user: Principal = Depends(current_user),
                     db: Session = Depends(get_db)):
    astro = get_astronaut_or_404(db, astronaut_id)
    changes = body.model_dump(exclude_unset=True)
    if not user.is_admin:
        if user.id != astronaut_id or not set(changes) <= SELF_EDITABLE:
            raise HTTPException(403, "Only Mission Control can change these details")
    for field, value in changes.items():
        setattr(astro, field, value)
    db.commit()
    db.refresh(astro)
    return to_out(astro)


@router.post("/{astronaut_id}/pin")
def set_pin(astronaut_id: int, body: PinSet, _: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    """Mission Control sets or resets a PIN. Devices logged in with the old PIN are logged out."""
    astro = get_astronaut_or_404(db, astronaut_id)
    astro.pin_hash = hash_secret(body.pin)
    astro.token_version += 1
    astro.failed_logins = 0
    astro.locked_until = None
    db.commit()
    return {"ok": True}


@router.delete("/{astronaut_id}", status_code=204)
def delete_astronaut(astronaut_id: int, _: Principal = Depends(require_admin), db: Session = Depends(get_db)):
    astro = get_astronaut_or_404(db, astronaut_id)
    files = [img.filename for img in db.scalars(select(HealthImage).where(HealthImage.astronaut_id == astronaut_id)).all()]
    # remove their stored files too, not only the database rows
    remove_photo(db, astro.photo_filename)
    for name in files:
        delete_file(db, name)
    db.delete(astro)
    db.commit()


# ------------------------------------------------------------------ profile photo
@router.get("/{astronaut_id}/photo")
def get_photo(astronaut_id: int, db: Session = Depends(get_db)):
    """Public on purpose: crew photos are shown on the login screen. Never health data."""
    astro = get_astronaut_or_404(db, astronaut_id)
    return photo_response(db, astro.photo_filename)


@router.post("/{astronaut_id}/photo", response_model=AstronautOut)
async def upload_photo(astronaut_id: int, file: UploadFile = File(...), user: Principal = Depends(current_user),
                       db: Session = Depends(get_db)):
    ensure_can_write(user, astronaut_id)   # yourself, or Mission Control
    astro = get_astronaut_or_404(db, astronaut_id)
    astro.photo_filename = await save_photo(db, file, astro.photo_filename)
    db.commit()
    db.refresh(astro)
    return to_out(astro)


@router.delete("/{astronaut_id}/photo", response_model=AstronautOut)
def delete_photo(astronaut_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    ensure_can_write(user, astronaut_id)
    astro = get_astronaut_or_404(db, astronaut_id)
    remove_photo(db, astro.photo_filename)
    astro.photo_filename = None
    db.commit()
    db.refresh(astro)
    return to_out(astro)

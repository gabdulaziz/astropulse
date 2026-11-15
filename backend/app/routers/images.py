"""Camera / image uploads (ultrasound, skin, eye, wound photos).

Image files are private health data, so they are NOT served as public files.
They are only sent through /api/images/{id}/file after a permission check."""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..storage import delete_file, file_response, put_file
from ..database import get_db
from ..models import HealthImage
from ..schemas import ImageOut
from ..security import Principal, current_user, ensure_can_read, ensure_can_write
from .astronauts import get_astronaut_or_404

router = APIRouter(prefix="/api/images", tags=["Images"])

ALLOWED = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
CATEGORIES = {"ultrasound", "skin", "eye", "wound", "other"}
MAX_BYTES = 10 * 1024 * 1024


def _out(img: HealthImage) -> ImageOut:
    o = ImageOut.model_validate(img)
    o.url = f"/api/images/{img.id}/file"
    return o


@router.post("", response_model=ImageOut, status_code=201)
async def upload_image(
    astronaut_id: int = Form(...),
    category: str = Form("other"),
    notes: str = Form(""),
    file: UploadFile = File(...),
    user: Principal = Depends(current_user),
    db: Session = Depends(get_db),
):
    ensure_can_write(user, astronaut_id)
    get_astronaut_or_404(db, astronaut_id)
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(422, f"Only images allowed: {sorted(ALLOWED)}")
    if category not in CATEGORIES:
        category = "other"
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image larger than 10 MB")
    name = f"{uuid.uuid4().hex}{ext}"
    put_file(db, name, data)
    img = HealthImage(astronaut_id=astronaut_id, category=category, filename=name, notes=notes)
    db.add(img)
    db.commit()
    db.refresh(img)
    return _out(img)


@router.get("", response_model=list[ImageOut])
def list_images(astronaut_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    ensure_can_read(db, user, astronaut_id)
    rows = db.scalars(select(HealthImage).where(HealthImage.astronaut_id == astronaut_id)
                      .order_by(HealthImage.created_at.desc())).all()
    return [_out(r) for r in rows]


@router.get("/{image_id}/file")
def image_file(image_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    img = db.get(HealthImage, image_id)
    if not img:
        raise HTTPException(404, "Image not found")
    ensure_can_read(db, user, img.astronaut_id)
    return file_response(db, img.filename, "private, no-store", "Image file missing")


@router.delete("/{image_id}", status_code=204)
def delete_image(image_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    img = db.get(HealthImage, image_id)
    if not img:
        raise HTTPException(404, "Image not found")
    ensure_can_write(user, img.astronaut_id)
    delete_file(db, img.filename)
    db.delete(img)
    db.commit()

"""Uploaded files (profile photos and health images) are stored in the database.

Free hosting services wipe their disk on every restart, so a file saved to disk would vanish.
The rest of the app only knows a file by its name; these helpers read and write the bytes."""
from fastapi import HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from .config import UPLOAD_DIR
from .models import StoredFile

TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"}


def content_type_for(name: str) -> str:
    ext = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return TYPES.get(ext, "application/octet-stream")


def put_file(db: Session, name: str, data: bytes) -> None:
    db.merge(StoredFile(name=name, content_type=content_type_for(name), data=data))


def delete_file(db: Session, name: str | None) -> None:
    if name:
        row = db.get(StoredFile, name)
        if row:
            db.delete(row)


def file_response(db: Session, name: str | None, cache: str, missing: str = "File missing") -> Response:
    row = db.get(StoredFile, name) if name else None
    if not row:
        raise HTTPException(404, missing)
    return Response(content=row.data, media_type=row.content_type, headers={"Cache-Control": cache})


def import_files_from_disk(db: Session) -> int:
    """One-time move: files saved on disk by older versions are copied into the database."""
    moved = 0
    if not UPLOAD_DIR.exists():
        return 0
    for path in list(UPLOAD_DIR.glob("*")) + list((UPLOAD_DIR / "avatars").glob("*")):
        if path.is_file() and path.suffix.lower() in TYPES and not db.get(StoredFile, path.name):
            put_file(db, path.name, path.read_bytes())
            moved += 1
    if moved:
        db.commit()
    return moved

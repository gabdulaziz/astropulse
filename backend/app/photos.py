"""Profile photos for astronauts and Mission Control.

Photos are stored in backend/uploads/avatars/ and the database keeps only the file name.
The browser already crops and shrinks them to 256x256 before upload, but the server still
checks that the file really is an image and not too big."""
import uuid

from fastapi import HTTPException, UploadFile

from .config import UPLOAD_DIR

AVATAR_DIR = UPLOAD_DIR / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
MAX_BYTES = 5 * 1024 * 1024

# The first bytes of a file tell what it really is (the name can lie).
SIGNATURES = {
    b"\xff\xd8\xff": ".jpg",
    b"\x89PNG\r\n\x1a\n": ".png",
    b"GIF87a": ".gif",
    b"GIF89a": ".gif",
}


def _detect(data: bytes) -> str | None:
    for sig, ext in SIGNATURES.items():
        if data.startswith(sig):
            return ext
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


async def save_photo(file: UploadFile, old_filename: str | None) -> str:
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Photo larger than 5 MB")
    ext = _detect(data)
    if not ext:
        raise HTTPException(422, "Please choose a JPG, PNG, WebP or GIF image")
    name = f"{uuid.uuid4().hex}{ext}"
    (AVATAR_DIR / name).write_bytes(data)
    remove_photo(old_filename)
    return name


def remove_photo(filename: str | None) -> None:
    if filename:
        (AVATAR_DIR / filename).unlink(missing_ok=True)


def photo_path(filename: str | None):
    if not filename:
        return None
    path = AVATAR_DIR / filename
    return path if path.exists() else None


def astronaut_photo_url(astro) -> str | None:
    # the ?v= part changes with every new photo, so browsers never show an old cached one
    return f"/api/astronauts/{astro.id}/photo?v={astro.photo_filename[:8]}" if astro.photo_filename else None


def admin_photo_url(admin) -> str | None:
    return f"/api/admin/{admin.id}/photo?v={admin.photo_filename[:8]}" if admin.photo_filename else None

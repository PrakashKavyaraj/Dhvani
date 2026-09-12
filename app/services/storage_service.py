from __future__ import annotations

import re
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import settings
from app.models.domain import AnalysisError


def safe_filename(name: str | None) -> str:
    candidate = Path(name or "audio.wav").name
    return re.sub(r"[^A-Za-z0-9._-]", "_", candidate)[:120] or "audio.wav"


async def save_temporarily(upload: UploadFile, analysis_id: str) -> Path:
    settings.temp_audio_dir.mkdir(parents=True, exist_ok=True)
    path = settings.temp_audio_dir / f"{analysis_id}-{uuid4().hex}.wav"
    size = 0
    try:
        with path.open("wb") as destination:
            while chunk := await upload.read(1024 * 1024):
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    raise AnalysisError("FILE_TOO_LARGE", "The uploaded file exceeds the configured size limit.")
                destination.write(chunk)
        return path
    except Exception:
        delete_temporary(path)
        raise


def delete_temporary(path: Path) -> None:
    path.unlink(missing_ok=True)

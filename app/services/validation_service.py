from __future__ import annotations

from fastapi import UploadFile

from app.models.domain import AnalysisError


def validate_upload_hint(upload: UploadFile) -> None:
    filename = upload.filename or ""
    if not filename.lower().endswith(".wav"):
        raise AnalysisError("UNSUPPORTED_FORMAT", "Only WAV audio files are supported in V1.")
    if upload.content_type and upload.content_type.lower() not in {"audio/wav", "audio/x-wav", "audio/wave", "application/octet-stream"}:
        raise AnalysisError("UNSUPPORTED_FORMAT", "The file MIME type is not a supported WAV audio hint.")

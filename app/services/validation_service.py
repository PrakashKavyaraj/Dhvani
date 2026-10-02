from pathlib import Path
from fastapi import UploadFile
from app.core.errors import UnsupportedFormatError
from app.integrations.m2_audio import preprocess_audio
from app.models.domain import PreparedAudio

PERMITTED_MIME_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "application/octet-stream",
}


class ValidationService:
    @staticmethod
    def validate_file_metadata(file: UploadFile) -> None:
        filename = (file.filename or "").lower()
        if not filename.endswith(".wav"):
            raise UnsupportedFormatError(
                f"Unsupported file extension for '{file.filename}'. Only .wav files are allowed."
            )

        if file.content_type:
            normalized_mime = file.content_type.lower().split(";")[0].strip()
            if normalized_mime not in PERMITTED_MIME_TYPES:
                raise UnsupportedFormatError(
                    f"Unsupported MIME type hint '{file.content_type}'. Permitted types are WAV audio."
                )

    @staticmethod
    def validate_wav_content(path: Path) -> PreparedAudio:
        """
        Validates WAV header structure, PCM bit depth, duration, and speech activity.
        """
        return preprocess_audio(path)


validation_service = ValidationService()
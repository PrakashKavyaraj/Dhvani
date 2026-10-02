import uuid
from pathlib import Path
from fastapi import UploadFile
from app.core.config import get_settings
from app.core.errors import FileTooLargeError
from app.core.logging import logger


class StorageService:
    @staticmethod
    async def save_upload_chunked(file: UploadFile) -> Path:
        settings = get_settings()
        dest_dir = settings.temp_audio_path
        filename = f"{uuid.uuid4().hex}.wav"
        dest_path = dest_dir / filename

        total_bytes = 0
        chunk_size = 64 * 1024  # 64 KB

        try:
            with open(dest_path, "wb") as buffer:
                while chunk := await file.read(chunk_size):
                    total_bytes += len(chunk)
                    if total_bytes > settings.max_upload_size_bytes:
                        dest_path.unlink(missing_ok=True)
                        raise FileTooLargeError(
                            f"File size exceeds limit of {settings.MAX_UPLOAD_SIZE_MB} MB."
                        )
                    buffer.write(chunk)
        except Exception:
            dest_path.unlink(missing_ok=True)
            raise

        return dest_path

    @staticmethod
    def delete_file(path: Path | str | None) -> None:
        if path is None:
            return
        try:
            target = Path(path)
            if target.is_file():
                target.unlink(missing_ok=True)
                logger.debug("Deleted temporary audio file: %s", target.name)
        except Exception as exc:
            logger.warning("Failed to remove temporary file: %s", exc)


storage_service = StorageService()
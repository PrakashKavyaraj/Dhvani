from fastapi import HTTPException


class AppError(HTTPException):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message": message},
        )
        self.code = code
        self.message = message


class UnsupportedFormatError(AppError):
    def __init__(self, message: str = "Unsupported audio format. Only WAV files are permitted."):
        super().__init__(status_code=422, code="UNSUPPORTED_FORMAT", message=message)


class FileTooLargeError(AppError):
    def __init__(self, message: str = "The uploaded file exceeds the maximum allowed size."):
        super().__init__(status_code=413, code="FILE_TOO_LARGE", message=message)


class AudioTooShortError(AppError):
    def __init__(self, message: str = "Audio duration is shorter than the minimum required threshold."):
        super().__init__(status_code=422, code="AUDIO_TOO_SHORT", message=message)


class InvalidAudioError(AppError):
    def __init__(self, message: str = "Audio file is corrupt or has unsupported properties."):
        super().__init__(status_code=422, code="INVALID_AUDIO", message=message)


class InsufficientSpeechError(AppError):
    def __init__(self, message: str = "Audio contains insufficient detectable speech activity."):
        super().__init__(status_code=422, code="INSUFFICIENT_SPEECH", message=message)


class AnalysisNotFoundError(AppError):
    def __init__(self, message: str = "No analysis exists for this ID."):
        super().__init__(status_code=404, code="ANALYSIS_NOT_FOUND", message=message)
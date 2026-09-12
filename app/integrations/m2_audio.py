"""M2 integration boundary: replace this adapter when real DSP is available."""
from __future__ import annotations

import struct
import wave
from pathlib import Path

from app.core.config import settings
from app.models.domain import AnalysisError, PreparedAudio


def _speech_seconds(raw: bytes, sample_width: int, duration: float) -> float:
    """Simple energy placeholder, not voice activity detection."""
    if not raw:
        return 0.0
    if sample_width == 1:
        values = (abs(value - 128) for value in raw)
    elif sample_width == 2:
        values = (abs(value[0]) for value in struct.iter_unpack("<h", raw))
    else:
        return duration  # WAV is readable; advanced sample handling belongs in M2.
    mean_energy = sum(values) / max(1, len(raw) // sample_width)
    return duration if mean_energy >= 100 else 0.0


def preprocess_audio(audio_path: Path) -> PreparedAudio:
    try:
        with wave.open(str(audio_path), "rb") as source:
            channels = source.getnchannels()
            sample_rate = source.getframerate()
            frame_count = source.getnframes()
            sample_width = source.getsampwidth()
            if channels not in (1, 2) or sample_rate <= 0 or frame_count <= 0 or sample_width not in (1, 2):
                raise AnalysisError("INVALID_AUDIO", "The uploaded file has unsupported WAV audio properties.")
            duration = frame_count / sample_rate
            raw = source.readframes(frame_count)
    except AnalysisError:
        raise
    except (wave.Error, EOFError, OSError) as exc:
        raise AnalysisError("INVALID_AUDIO", "The uploaded file could not be read as a valid WAV recording.") from exc

    if duration < settings.min_duration_seconds:
        raise AnalysisError("AUDIO_TOO_SHORT", "The recording is shorter than the minimum useful duration.")
    if duration > settings.max_duration_seconds:
        raise AnalysisError("INVALID_AUDIO", "The recording exceeds the maximum allowed duration.")
    speech_seconds = _speech_seconds(raw, sample_width, duration)
    if speech_seconds < settings.min_speech_seconds:
        raise AnalysisError("INSUFFICIENT_SPEECH", "The recording does not contain enough detectable speech for this prototype.")
    return PreparedAudio(raw, sample_rate, duration, speech_seconds, "suitable", [], settings.preprocessing_version, channels, sample_width)

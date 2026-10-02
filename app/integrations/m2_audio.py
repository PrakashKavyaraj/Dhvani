import math
import struct
import wave
from pathlib import Path
from app.core.config import get_settings
from app.core.errors import (
    AudioTooShortError,
    InsufficientSpeechError,
    InvalidAudioError,
)
from app.models.domain import PreparedAudio


def _estimate_speech_duration(
    raw_data: bytes,
    channels: int,
    sample_width: int,
    sample_rate: int,
) -> float:
    """
    Estimates speech duration using VADEngine (Silero neural VAD)
    with seamless fallback to calibrated energy thresholding.
    """
    if len(raw_data) == 0 or sample_rate <= 0:
        return 0.0

    # Neural Silero VAD evaluation
    try:
        import numpy as np
        from app.core.vad_engine import vad_engine
        if sample_width == 2:
            samples = np.frombuffer(raw_data, dtype=np.int16).astype(np.float32) / 32768.0
        elif sample_width == 1:
            samples = (np.frombuffer(raw_data, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
        else:
            samples = None

        if samples is not None and len(samples) > 0:
            if channels > 1:
                samples = samples.reshape(-1, channels).mean(axis=1)
            vad_res = vad_engine.analyze(samples)
            if vad_res.speech_duration_sec > 0:
                return vad_res.speech_duration_sec
    except Exception:
        pass

    bytes_per_sample = sample_width
    bytes_per_frame = bytes_per_sample * channels
    total_frames = len(raw_data) // bytes_per_frame

    if total_frames == 0 or sample_rate <= 0:
        return 0.0

    # 30 ms window frame size
    window_size_frames = int(sample_rate * 0.030)
    if window_size_frames <= 0:
        return 0.0

    active_windows = 0
    total_windows = 0

    # Energy threshold calculation
    threshold = 0.015  # normalized RMS threshold for speech activity

    for offset in range(0, total_frames - window_size_frames + 1, window_size_frames):
        window_bytes = raw_data[offset * bytes_per_frame : (offset + window_size_frames) * bytes_per_frame]
        sum_sq = 0.0
        samples_in_window = window_size_frames

        if sample_width == 2:  # 16-bit signed PCM
            unpacked = struct.unpack(f"<{window_size_frames * channels}h", window_bytes)
            # Downmix stereo to mono if necessary
            for i in range(0, len(unpacked), channels):
                val = unpacked[i] if channels == 1 else (unpacked[i] + unpacked[i + 1]) / 2.0
                normalized = val / 32768.0
                sum_sq += normalized * normalized
        elif sample_width == 1:  # 8-bit unsigned PCM
            unpacked = struct.unpack(f"<{window_size_frames * channels}B", window_bytes)
            for i in range(0, len(unpacked), channels):
                val = unpacked[i] if channels == 1 else (unpacked[i] + unpacked[i + 1]) / 2.0
                normalized = (val - 128.0) / 128.0
                sum_sq += normalized * normalized
        else:
            return 0.0

        rms = math.sqrt(sum_sq / samples_in_window) if samples_in_window > 0 else 0.0
        if rms >= threshold:
            active_windows += 1
        total_windows += 1

    window_duration = window_size_frames / sample_rate
    return active_windows * window_duration


def preprocess_audio(path: Path) -> PreparedAudio:
    """
    Standard-library baseline WAV reader and audio preprocessor.
    Preserves signature: preprocess_audio(Path) -> PreparedAudio
    """
    settings = get_settings()

    try:
        with wave.open(str(path), "rb") as wf:
            channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            sample_rate = wf.getframerate()
            frame_count = wf.getnframes()
            raw_data = wf.readframes(frame_count)
    except wave.Error as exc:
        raise InvalidAudioError(f"Corrupt or invalid WAV structure: {exc}") from exc
    except Exception as exc:
        raise InvalidAudioError(f"Unable to read audio file: {exc}") from exc

    # Validate channel count
    if channels not in (1, 2):
        raise InvalidAudioError(
            f"Unsupported channel count ({channels}). Only mono and stereo are supported."
        )

    # Validate sample width (8-bit or 16-bit PCM)
    if sample_width not in (1, 2):
        raise InvalidAudioError(
            f"Unsupported bit depth ({sample_width * 8}-bit). Only 8-bit and 16-bit PCM are supported."
        )

    if sample_rate <= 0:
        raise InvalidAudioError(f"Invalid audio sample rate: {sample_rate} Hz.")

    duration_seconds = frame_count / float(sample_rate)

    # Duration boundary validation
    if duration_seconds < settings.MIN_DURATION_SECONDS:
        raise AudioTooShortError(
            f"Audio duration ({duration_seconds:.2f}s) is shorter than the minimum "
            f"required ({settings.MIN_DURATION_SECONDS:.1f}s)."
        )

    if duration_seconds > settings.MAX_DURATION_SECONDS:
        raise InvalidAudioError(
            f"Audio duration ({duration_seconds:.2f}s) exceeds the maximum "
            f"allowed ({settings.MAX_DURATION_SECONDS:.1f}s)."
        )

    # Speech duration estimation
    speech_seconds = _estimate_speech_duration(
        raw_data=raw_data,
        channels=channels,
        sample_width=sample_width,
        sample_rate=sample_rate,
    )

    if speech_seconds < settings.MIN_SPEECH_SECONDS:
        raise InsufficientSpeechError(
            f"Audio contains only {speech_seconds:.2f}s of detectable speech. "
            f"A minimum of {settings.MIN_SPEECH_SECONDS:.1f}s is required."
        )

    # Audio quality inspection
    quality_notes: list[str] = []
    quality_status = "suitable"

    speech_ratio = speech_seconds / duration_seconds if duration_seconds > 0 else 0.0
    if speech_ratio < 0.25:
        quality_notes.append("High proportion of silence or non-speech background.")
        quality_status = "degraded"

    return PreparedAudio(
        raw_data=raw_data,
        sample_rate=sample_rate,
        duration_seconds=round(duration_seconds, 3),
        speech_seconds=round(speech_seconds, 3),
        quality_status=quality_status,
        quality_notes=quality_notes,
        preprocessing_version=settings.PREPROCESSING_VERSION,
        channels=channels,
        sample_width=sample_width,
        frame_count=frame_count,
    )
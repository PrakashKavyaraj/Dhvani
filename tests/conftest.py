import io
import math
import struct
import wave
import pytest
from fastapi.testclient import TestClient
from app.core.config import get_settings
from app.main import app


def generate_test_wav(
    duration: float = 3.0,
    sample_rate: int = 16000,
    channels: int = 1,
    sample_width: int = 2,
    frequency: float = 440.0,
    silent: bool = False,
) -> bytes:
    """Programmatically generates valid in-memory PCM WAV bytes."""
    buf = io.BytesIO()
    total_frames = int(duration * sample_rate)

    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(sample_rate)

        frames = bytearray()
        for i in range(total_frames):
            if silent:
                sample_val = 0
            else:
                # Active sinusoidal audio
                t = float(i) / sample_rate
                sine_val = math.sin(2.0 * math.pi * frequency * t)
                sample_val = int(sine_val * 16000)

            if sample_width == 2:
                frame = struct.pack("<h", sample_val)
            else:
                frame = struct.pack("<B", min(255, max(0, int(sample_val / 256.0 + 128))))

            frames.extend(frame * channels)

        wf.writeframes(frames)

    return buf.getvalue()


@pytest.fixture
def client():
    # Force baseline dummy detector during automated testing
    settings = get_settings()
    settings.DETECTOR_BACKEND = "dummy"
    with TestClient(app) as test_client:
        yield test_client
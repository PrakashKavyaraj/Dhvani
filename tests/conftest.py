import io
import math
import struct
import wave

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.job_service import job_store


def wav_bytes(seconds: float = 2.5, rate: int = 8000, amplitude: int = 1000) -> bytes:
    raw = b"".join(struct.pack("<h", int(amplitude * math.sin(2 * math.pi * 440 * i / rate))) for i in range(int(seconds * rate)))
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(rate)
        output.writeframes(raw)
    return buffer.getvalue()


@pytest.fixture(autouse=True)
def clear_jobs():
    job_store._jobs.clear()
    yield
    job_store._jobs.clear()


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


@pytest.fixture
def valid_wav():
    return wav_bytes()

import time
import numpy as np
import pytest
from app.core.config import get_settings
from app.core.security_engine import SecurityEngine, security_engine


def test_dynamic_secrets_resolution(monkeypatch):
    """
    Verifies that VOICE_SALT and AUDIT_SECRET are dynamically retrieved
    from configuration and environment, not hardcoded immutable values.
    """
    settings = get_settings()
    original_salt = settings.VOICE_SALT
    original_secret = settings.AUDIT_SECRET

    try:
        # Default should match config
        assert security_engine.VOICE_SALT == original_salt
        assert security_engine.AUDIT_SECRET == original_secret

        # Dynamic override
        monkeypatch.setattr(settings, "VOICE_SALT", "CUSTOM_TEST_SALT_XYZ")
        monkeypatch.setattr(settings, "AUDIT_SECRET", "CUSTOM_TEST_SECRET_ABC")

        assert security_engine.VOICE_SALT == "CUSTOM_TEST_SALT_XYZ"
        assert security_engine.AUDIT_SECRET == "CUSTOM_TEST_SECRET_ABC"
        assert SecurityEngine.VOICE_SALT == "CUSTOM_TEST_SALT_XYZ"
        assert SecurityEngine.AUDIT_SECRET == "CUSTOM_TEST_SECRET_ABC"
    finally:
        monkeypatch.setattr(settings, "VOICE_SALT", original_salt)
        monkeypatch.setattr(settings, "AUDIT_SECRET", original_secret)


def test_session_ttl_pruning():
    """
    Verifies that old sessions in SecurityEngine._session_history are pruned
    after exceeding their time-to-live (TTL), preventing memory leaks.
    """
    engine = SecurityEngine()
    now = time.time()

    # Add active session (recent)
    engine._session_history["session-active"] = [
        {"turn_index": 0, "fake_prob": 0.1, "timestamp": now - 10.0}
    ]

    # Add expired session (older than 100 seconds)
    engine._session_history["session-stale"] = [
        {"turn_index": 0, "fake_prob": 0.2, "timestamp": now - 200.0}
    ]

    # Run prune with max_age_seconds = 60
    pruned_count = engine.prune_expired_sessions(max_age_seconds=60.0)

    assert pruned_count == 1
    assert "session-active" in engine._session_history
    assert "session-stale" not in engine._session_history


def test_secure_memory_zeroing():
    """
    Verifies that secure_zero_memory actively clears in-memory buffers
    and returns a positive microsecond execution duration.
    """
    # Test numpy array zeroing
    data_np = np.ones((16000,), dtype=np.float32)
    elapsed_us = SecurityEngine.secure_zero_memory(data_np)
    assert elapsed_us > 0
    assert np.all(data_np == 0.0)

    # Test bytearray zeroing
    data_bytes = bytearray(b"SENSITIVE_AUDIO_RAW_DATA_12345")
    elapsed_bytes = SecurityEngine.secure_zero_memory(data_bytes)
    assert elapsed_bytes > 0
    assert all(b == 0 for b in data_bytes)

import numpy as np
import pytest
from app.core.indic_scam_detector import indic_scam_detector
from app.core.vad_engine import vad_engine


def test_vad_engine_silence_detection():
    """
    Verifies that pure silence or near-zero noise is flagged as non-speech.
    """
    silence = np.zeros(16000, dtype=np.float32)
    result = vad_engine.analyze(silence)

    assert result.is_speech is False
    assert result.speech_ratio == 0.0
    assert result.speech_duration_sec == 0.0
    assert result.duration_sec == 1.0


def test_vad_engine_speech_detection():
    """
    Verifies that audio with genuine human speech is recognized by VAD.
    """
    from pathlib import Path
    import soundfile as sf
    import time

    sample_file = Path("/Users/prakashkavyaraj/frontend/public/samples/authentic_phone.wav")
    if sample_file.is_file():
        audio, sr = sf.read(str(sample_file))
        result = vad_engine.analyze(audio[: sr * 3])
        assert result.is_speech is True
        assert result.speech_ratio > 0.20
        assert result.speech_duration_sec > 0.5
        assert result.processing_time_ms < 50.0  # Ultra-fast sub-50ms execution
    else:
        t = np.linspace(0, 1.5, int(16000 * 1.5), endpoint=False)
        audio = (0.5 * np.sin(2 * np.pi * 200 * t)).astype(np.float32)
        dsp_res = vad_engine._analyze_dsp(audio, time.perf_counter())
        assert dsp_res.is_speech is True


def test_indic_digital_arrest_scam_detection():
    """
    Tests Digital Arrest scam detection in Hinglish with law enforcement intimidation.
    """
    transcript = (
        "Main police thana se daroga bol raha hoon! Aapke parcel me narcotics aur drugs mila hai! "
        "Supreme Court ka giraftari warrant issue hua hai, turant fine jama karo warna jail bhejenge!"
    )

    score, reasons, meta = indic_scam_detector.scan(transcript)

    assert score >= 90.0
    assert meta["archetype"] == "DIGITAL_ARREST_EXTORTION"
    assert "LAW_ENFORCEMENT_AUTHORITY" in meta["matched_categories"]
    assert any("giraftar" in str(meta["detected_keywords"]).lower() for _ in [1])
    assert any("digital arrest" in r.lower() or "law enforcement" in r.lower() for r in reasons)


def test_indic_virtual_kidnapping_family_extortion():
    """
    Tests Virtual Kidnapping / Family Emergency extortion in Hindi / Hinglish.
    """
    transcript = (
        "Aapka beta road accident me hospital me admit hai! Critical condition hai, "
        "bachane ke liye turant paise bhejiye, kisi ko mat batana!"
    )

    score, reasons, meta = indic_scam_detector.scan(transcript)

    assert score >= 90.0
    assert meta["archetype"] == "FAMILY_DISTRESS_EXTORTION"
    assert "FAMILY_EXTORTION" in meta["matched_categories"]
    assert any("accident" in str(meta["detected_keywords"]).lower() for _ in [1])


def test_indic_remote_access_malware_dropper():
    """
    Tests Remote Access tool scam (AnyDesk / TeamViewer / APK).
    """
    transcript = (
        "Sir aapka bank account block ho gaya hai. AnyDesk app install karo "
        "aur screen share karke code bataiye turant!"
    )

    score, reasons, meta = indic_scam_detector.scan(transcript)

    assert score >= 80.0
    assert meta["archetype"] == "REMOTE_DEVICE_HIJACK"
    assert "REMOTE_DEVICE_ACCESS" in meta["matched_categories"]


def test_benign_customer_inquiry():
    """
    Tests that a normal banking inquiry is recognized as completely benign (0 score).
    """
    transcript = "Good afternoon, I would like to check the fixed deposit interest rate for 1 year tenure."

    score, reasons, meta = indic_scam_detector.scan(transcript)

    assert score == 0.0
    assert meta["archetype"] == "BENIGN"
    assert len(reasons) == 0

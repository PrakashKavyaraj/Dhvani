import os
from pathlib import Path
import pytest

from app.integrations.aegis_adapter import AegisAdapter
from app.schemas.aegis_schema import AegisResult
from tests.conftest import generate_test_wav


@pytest.fixture(scope="module")
def checkpoint_path() -> Path:
    base_dir = Path(__file__).resolve().parent.parent
    return base_dir / "models" / "weights" / "AASIST-L.pth"


@pytest.fixture(scope="module")
def sample_wav_path(tmp_path_factory) -> Path:
    # Check for existing download WAV
    candidate = Path("/Users/prakashkavyaraj/Downloads/voice.wav")
    if candidate.is_file():
        return candidate
    # Fallback to programmatically generated test WAV
    temp_dir = tmp_path_factory.mktemp("audio")
    wav_path = temp_dir / "generated_test_audio.wav"
    wav_bytes = generate_test_wav(duration=6.0)
    wav_path.write_bytes(wav_bytes)
    return wav_path


def test_checkpoint_exists(checkpoint_path: Path):
    """Verifies that the official AASIST-L checkpoint exists on disk with expected size."""
    assert checkpoint_path.is_file(), f"Checkpoint not found at {checkpoint_path}"
    file_size = checkpoint_path.stat().st_size
    assert file_size > 400_000, f"Expected checkpoint size > 400KB, got {file_size} bytes"


def test_adapter_initializes_successfully(checkpoint_path: Path):
    """Verifies that AegisAdapter initializes and loads the PyTorch model strictly."""
    adapter = AegisAdapter(checkpoint_path=checkpoint_path)
    assert adapter.is_loaded is True
    assert adapter.checkpoint_path == checkpoint_path


def test_checkpoint_loading_failure_handled_correctly(tmp_path: Path):
    """Verifies that AegisAdapter fails loudly on a missing checkpoint and does not use random weights."""
    missing_path = tmp_path / "non_existent_weights.pth"
    with pytest.raises(FileNotFoundError) as exc_info:
        AegisAdapter(checkpoint_path=missing_path)

    assert "strictly requires official trained weights" in str(exc_info.value)


def test_corrupt_checkpoint_fails_loudly(tmp_path: Path):
    """Verifies that AegisAdapter fails loudly when a corrupt checkpoint is provided."""
    corrupt_path = tmp_path / "corrupt.pth"
    corrupt_path.write_bytes(b"NOT_A_VALID_PYTORCH_CHECKPOINT")

    with pytest.raises(RuntimeError) as exc_info:
        AegisAdapter(checkpoint_path=corrupt_path)

    assert "Failed to load AASIST-L checkpoint" in str(exc_info.value)


def test_analyze_wav_metrics_and_ranges(checkpoint_path: Path, sample_wav_path: Path):
    """
    Verifies that analyze() executes inference and all spoof/reliability metrics
    are within valid [0.0, 1.0] bounds.
    """
    adapter = AegisAdapter(checkpoint_path=checkpoint_path)
    result = adapter.analyze(audio_path=sample_wav_path, session_id="test-session-001")

    # 1. Conforms to AegisResult schema
    assert isinstance(result, AegisResult)
    assert result.session_id == "test-session-001"

    # 2. Audio duration & window count
    assert result.audio.duration > 0.0
    assert result.voice_authenticity.windows_analyzed > 0

    # 3. Spoof scores bounded in [0.0, 1.0]
    assert 0.0 <= result.voice_authenticity.current_spoof_score <= 1.0
    assert 0.0 <= result.voice_authenticity.persistent_spoof_evidence <= 1.0
    assert 0.0 <= result.voice_authenticity.reliability <= 1.0

    # 4. Latency measured
    assert result.processing_time_ms is not None
    assert result.processing_time_ms > 0.0


def test_deferred_modules_explicit_state(checkpoint_path: Path, sample_wav_path: Path):
    """
    Verifies that unimplemented components explicitly declare 'NOT_AVAILABLE'
    and decision engine declares 'PARTIAL'.
    """
    adapter = AegisAdapter(checkpoint_path=checkpoint_path)
    result = adapter.analyze(audio_path=sample_wav_path)

    # Deferred module checks
    assert result.speaker_identity.status == "NOT_AVAILABLE"
    assert result.speaker_identity.similarity is None

    assert result.conversation.status == "NOT_AVAILABLE"
    assert result.conversation.risk == 0.0
    assert result.conversation.signals == []

    assert result.replay.status == "NOT_AVAILABLE"
    assert result.replay.score == 0.0

    assert result.temporal.status == "NOT_AVAILABLE"
    assert result.temporal.trend is None

    assert result.decision.status == "PARTIAL"


def test_pydantic_schema_serialization(checkpoint_path: Path, sample_wav_path: Path):
    """Verifies that AegisResult cleanly serializes to dict and JSON."""
    adapter = AegisAdapter(checkpoint_path=checkpoint_path)
    result = adapter.analyze(audio_path=sample_wav_path)

    data_dict = result.model_dump()
    assert isinstance(data_dict, dict)
    assert "voice_authenticity" in data_dict
    assert "current_spoof_score" in data_dict["voice_authenticity"]
    assert "persistent_spoof_evidence" in data_dict["voice_authenticity"]
    assert "windows_analyzed" in data_dict["voice_authenticity"]

    json_str = result.model_dump_json()
    assert isinstance(json_str, str)
    assert "NOT_AVAILABLE" in json_str
    assert "PARTIAL" in json_str


def test_ecapa_similarity_normalization_contract():
    """
    Verifies similarity-scale normalization contract:
        raw = -1.0 -> normalized = 0.0
        raw =  0.0 -> normalized = 0.5
        raw = +1.0 -> normalized = 1.0
    """
    import sys
    from pathlib import Path
    aegis_dir = Path(__file__).resolve().parent.parent / "AEGIS_INTEGRATION"
    if str(aegis_dir) not in sys.path:
        sys.path.insert(0, str(aegis_dir))

    from inference.ecapa_verifier import ECAPAVerifier

    assert ECAPAVerifier.normalize_similarity(-1.0) == 0.0
    assert ECAPAVerifier.normalize_similarity(0.0) == 0.5
    assert ECAPAVerifier.normalize_similarity(1.0) == 1.0

    # Bounds & clamping checks
    assert ECAPAVerifier.normalize_similarity(-1.5) == 0.0
    assert ECAPAVerifier.normalize_similarity(1.5) == 1.0
    assert 0.0 <= ECAPAVerifier.normalize_similarity(-0.1003) <= 1.0
    assert round(ECAPAVerifier.normalize_similarity(0.074393), 4) == 0.5372


def test_channel_analyzer_high_fidelity():
    """Verifies that full-bandwidth high-fidelity audio is classified with 100% reliability."""
    import sys
    from pathlib import Path
    import numpy as np
    aegis_dir = Path(__file__).resolve().parent.parent / "AEGIS_INTEGRATION"
    if str(aegis_dir) not in sys.path:
        sys.path.insert(0, str(aegis_dir))

    from inference.channel_analyzer import ChannelAnalyzer

    sr = 16000
    t = np.linspace(0, 3.0, int(sr * 3.0), endpoint=False)
    # Harmonics extending up to 7200 Hz
    signal = (
        0.4 * np.sin(2 * np.pi * 300 * t)
        + 0.3 * np.sin(2 * np.pi * 1500 * t)
        + 0.2 * np.sin(2 * np.pi * 4000 * t)
        + 0.1 * np.sin(2 * np.pi * 7200 * t)
    ).astype(np.float32)

    analyzer = ChannelAnalyzer(target_sr=sr)
    res = analyzer.analyze(signal, sr=sr)

    assert res["channel_status"] == "HIGH_FIDELITY"
    assert res["channel_reliability"] == 1.0
    assert res["indicators"]["upper_band_power_ratio"] > 0.00025
    assert res["indicators"]["spectral_rolloff_95"] > 5000.0


def test_channel_analyzer_telephony_constrained():
    """Verifies that brickwall band-limited audio (< 3400 Hz) is detected as telephony with reduced reliability."""
    import sys
    from pathlib import Path
    import numpy as np
    from scipy.signal import butter, sosfilt
    aegis_dir = Path(__file__).resolve().parent.parent / "AEGIS_INTEGRATION"
    if str(aegis_dir) not in sys.path:
        sys.path.insert(0, str(aegis_dir))

    from inference.channel_analyzer import ChannelAnalyzer

    sr = 16000
    t = np.linspace(0, 3.0, int(sr * 3.0), endpoint=False)
    # Rich signal, filtered with a steep 3200 Hz lowpass filter simulating telephony codec
    raw_signal = (
        0.5 * np.sin(2 * np.pi * 250 * t)
        + 0.3 * np.sin(2 * np.pi * 800 * t)
        + 0.2 * np.sin(2 * np.pi * 1800 * t)
    ).astype(np.float32)
    sos = butter(8, 3200, btype="lowpass", fs=sr, output="sos")
    telephony_signal = sosfilt(sos, raw_signal).astype(np.float32)

    analyzer = ChannelAnalyzer(target_sr=sr)
    res = analyzer.analyze(telephony_signal, sr=sr)

    assert res["channel_status"] in {"TELEPHONY", "CHANNEL_CONSTRAINED"}
    assert res["channel_reliability"] <= 0.50
    assert res["indicators"]["upper_band_power_ratio"] <= 0.00005
    assert res["indicators"]["spectral_rolloff_95"] <= 3500.0
    assert len(res["active_indicators"]) >= 2


def test_robust_spoof_with_channel_reliability():
    """Verifies that robust spoof evidence correctly integrates channel reliability and audit fields."""
    import sys
    from pathlib import Path
    aegis_dir = Path(__file__).resolve().parent.parent / "AEGIS_INTEGRATION"
    if str(aegis_dir) not in sys.path:
        sys.path.insert(0, str(aegis_dir))

    from inference.robust_spoof import robust_spoof_evidence

    # 1. Full confidence case: high fidelity AI speech
    res_clean = robust_spoof_evidence(
        [0.99, 0.98, 0.99, 0.97],
        audio_quality=1.0,
        channel_reliability=1.0,
    )
    assert res_clean["reliability"] == 1.0
    assert res_clean["reliable_score"] >= 0.97
    assert res_clean["channel_reliability"] == 1.0
    assert res_clean["raw_persistent_spoof_evidence"] >= 0.97

    # 2. Telephony channel constraint: real speech with spurious high AASIST logits
    res_phone = robust_spoof_evidence(
        [0.99, 0.98, 0.99, 0.97],
        audio_quality=1.0,
        channel_reliability=0.40,
    )
    assert res_phone["reliability"] == 0.40
    # Scaled toward neutral midpoint: 0.40 * ~0.98 + 0.60 * 0.50 ≈ 0.69
    assert 0.65 <= res_phone["reliable_score"] <= 0.72
    assert res_phone["raw_persistent_spoof_evidence"] >= 0.97
    assert res_phone["channel_reliability"] == 0.40
    assert res_phone["reliability_adjusted_spoof_evidence"] == res_phone["reliable_score"]


def test_aegis_result_schema_with_channel_telemetry():
    """Verifies that AegisResult validates with the new channel block and auditability fields."""
    from app.schemas.aegis_schema import AegisResult

    payload = {
        "session_id": "audit-test-01",
        "audio": {"duration": 4.5, "quality": 0.95},
        "voice_authenticity": {
            "current_spoof_score": 0.65,
            "persistent_spoof_evidence": 0.68,
            "raw_current_spoof_score": 0.98,
            "raw_persistent_spoof_evidence": 0.99,
            "channel_reliability": 0.45,
            "reliability_adjusted_spoof_evidence": 0.68,
            "reliability": 0.4275,
            "windows_analyzed": 5,
        },
        "channel": {
            "status": "TELEPHONY",
            "channel_reliability": 0.45,
            "indicators": {
                "upper_band_power_ratio": 0.000001,
                "spectral_rolloff_95": 3300.0,
                "spectral_bandwidth": 1100.0,
                "native_sample_rate": 8000,
            },
            "active_indicators": ["upper_band_deficiency", "brickwall_rolloff"],
            "reason": "Acoustic channel matches telephony profile",
        },
        "evidence": ["Acoustic channel matches telephony profile"],
        "processing_time_ms": 120.5,
    }

    result = AegisResult.model_validate(payload)
    assert result.session_id == "audit-test-01"
    assert result.channel.status == "TELEPHONY"
    assert result.channel.channel_reliability == 0.45
    assert result.voice_authenticity.raw_persistent_spoof_evidence == 0.99
    assert result.voice_authenticity.channel_reliability == 0.45


def test_aegis_result_schema_with_primary_detector():
    """Verifies that AegisResult validates with primary_detector (Forensics 0.3B) and secondary AASIST-L telemetry."""
    from app.schemas.aegis_schema import AegisResult

    payload = {
        "session_id": "primary-test-01",
        "audio": {"duration": 5.0, "quality": 1.0},
        "primary_detector": {
            "model": "eliya/forensics_0.3B_base_deepfake_classifier",
            "version": "0.3B-base-v1",
            "fake_probability": 0.8603,
            "bonafide_probability": 0.1397,
            "center_fake_probability": 0.8603,
            "verdict": "FAKE",
            "windows_analyzed": 3,
            "window_scores": [0.863, 0.861, 0.859],
        },
        "voice_authenticity": {
            "current_spoof_score": 0.1583,
            "persistent_spoof_evidence": 0.1583,
            "raw_current_spoof_score": 0.1583,
            "raw_persistent_spoof_evidence": 0.1583,
            "channel_reliability": 1.0,
            "reliability_adjusted_spoof_evidence": 0.1583,
            "reliability": 1.0,
            "windows_analyzed": 3,
        },
        "channel": {
            "status": "HIGH_FIDELITY",
            "channel_reliability": 1.0,
        },
        "evidence": ["strong synthetic/spoofing evidence"],
        "processing_time_ms": 250.0,
    }

    result = AegisResult.model_validate(payload)
    assert result.session_id == "primary-test-01"
    assert result.primary_detector is not None
    assert result.primary_detector.model == "eliya/forensics_0.3B_base_deepfake_classifier"
    assert result.primary_detector.fake_probability == 0.8603
    assert result.primary_detector.verdict == "FAKE"
    assert result.voice_authenticity.persistent_spoof_evidence == 0.1583


def test_fusion_rule_a_telephony_real_suppresses_aasist():
    """Rule A: If Forensics indicates REAL and channel is TELEPHONY, AASIST high score does not force synthetic verdict."""
    from AEGIS_INTEGRATION.fusion_engine import AEGISFusionEngine
    fusion = AEGISFusionEngine()
    res = fusion.fuse(
        primary_spoof=0.14,
        secondary_spoof=0.99,
        channel_reliability=0.43,
        channel_status="TELEPHONY",
        spoof_available=True,
    )
    assert res["sensor_agreement"] == "DISAGREEMENT"
    assert res["sensor_agreement_detail"] == "DISAGREE_AASIST_ELEVATED"
    assert res["severity"] in {"LOW", "MINIMAL"}
    assert res["action"] == "VERIFY"
    assert any("discordant" in e.lower() for e in res["evidence"])


def test_fusion_rule_b_high_fidelity_ai_strengthens_confidence():
    """Rule B: If Forensics indicates FAKE and channel is HIGH_FIDELITY, AASIST agreement strengthens confidence."""
    from AEGIS_INTEGRATION.fusion_engine import AEGISFusionEngine
    fusion = AEGISFusionEngine()
    res = fusion.fuse(
        primary_spoof=0.85,
        secondary_spoof=0.92,
        channel_reliability=1.0,
        channel_status="HIGH_FIDELITY",
        spoof_available=True,
    )
    assert res["sensor_agreement"] == "AGREEMENT"
    assert res["sensor_agreement_detail"] == "CONCORDANT_FAKE"
    assert res["severity"] in {"CRITICAL", "HIGH"}
    assert res["action"] == "VERIFY"
    assert res["confidence"] >= 0.55


def test_fusion_rule_c_sensor_disagreement():
    """Rule C: Sensor disagreement is visible and incomplete evidence results in VERIFY."""
    from AEGIS_INTEGRATION.fusion_engine import AEGISFusionEngine
    fusion = AEGISFusionEngine()
    res = fusion.fuse(
        primary_spoof=0.86,
        secondary_spoof=0.15,
        channel_reliability=1.0,
        channel_status="HIGH_FIDELITY",
        spoof_available=True,
    )
    assert res["sensor_agreement"] == "DISAGREEMENT"
    assert res["sensor_agreement_detail"] == "DISAGREE_PRIMARY_ELEVATED"
    assert res["action"] == "VERIFY"
    assert any("disagreement" in e.lower() for e in res["evidence"])


def test_fusion_rule_d_telephony_ai_retains_fake_probability():
    """Rule D: Forensics FAKE on telephony channel is not suppressed to real, but confidence is adjusted."""
    from AEGIS_INTEGRATION.fusion_engine import AEGISFusionEngine
    fusion = AEGISFusionEngine()
    res = fusion.fuse(
        primary_spoof=0.80,
        secondary_spoof=0.75,
        channel_reliability=0.40,
        channel_status="TELEPHONY",
        spoof_available=True,
    )
    assert res["risk"] >= 0.75
    assert res["severity"] in {"HIGH", "CRITICAL"}
    assert res["action"] == "VERIFY"
    assert any("channel-constrained" in e.lower() for e in res["evidence"])




import base64
import json
import math
import re
import struct
import threading
import time
import wave
from pathlib import Path
import pytest
from starlette.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.services.analysis_service import run_analysis_pipeline
from app.services.database_service import DatabaseService, database_service
from app.services.job_service import job_service


def generate_test_wav(duration: float = 2.5, sample_rate: int = 16000) -> bytes:
    """Generates a valid mono 16-bit PCM WAV in memory."""
    num_samples = int(duration * sample_rate)
    sine_samples = [
        int(16000 * math.sin(2 * math.pi * 440.0 * i / sample_rate))
        for i in range(num_samples)
    ]
    raw_frames = struct.pack(f"<{len(sine_samples)}h", *sine_samples)

    import io
    bio = io.BytesIO()
    with wave.open(bio, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(raw_frames)
    return bio.getvalue()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_random_salted_sha256_format_and_entropy(tmp_path):
    """
    Requirement 1:
    - 64-char lowercase hexadecimal regex match.
    - 32-byte salt properly base64-encoded.
    - Never empty hash (e3b0c442...).
    - Identical audio analyzed twice produces two different hashes.
    """
    wav_bytes = generate_test_wav(duration=2.5)

    # First run
    file_path_1 = tmp_path / "test_1.wav"
    file_path_1.write_bytes(wav_bytes)
    analysis_id_1 = "test-analysis-entropy-1"
    job_service.create_job(analysis_id=analysis_id_1, file_path=file_path_1)
    run_analysis_pipeline(analysis_id=analysis_id_1, file_path=file_path_1)

    job_1 = job_service.get_job(analysis_id_1)
    assert job_1 is not None
    hash_1 = job_1.voiceprint_sha256
    salt_1 = job_1.salt_base64

    # Validate hash 1
    assert re.match(r"^[a-f0-9]{64}$", hash_1), f"Hash must be 64 lowercase hex chars: {hash_1}"
    assert hash_1 != "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    assert len(base64.b64decode(salt_1)) == 32, "Salt must be 32 bytes"

    # Second run with identical WAV bytes
    file_path_2 = tmp_path / "test_2.wav"
    file_path_2.write_bytes(wav_bytes)
    analysis_id_2 = "test-analysis-entropy-2"
    job_service.create_job(analysis_id=analysis_id_2, file_path=file_path_2)
    run_analysis_pipeline(analysis_id=analysis_id_2, file_path=file_path_2)

    job_2 = job_service.get_job(analysis_id_2)
    assert job_2 is not None
    hash_2 = job_2.voiceprint_sha256
    salt_2 = job_2.salt_base64

    # Validate hash 2
    assert re.match(r"^[a-f0-9]{64}$", hash_2), f"Hash must be 64 lowercase hex chars: {hash_2}"
    assert hash_2 != "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    assert len(base64.b64decode(salt_2)) == 32, "Salt must be 32 bytes"

    # Entropy assertion: Same audio analyzed twice produces different hashes
    assert hash_1 != hash_2, "Entropy failure: identical audio produced duplicate SHA-256 hashes"
    assert salt_1 != salt_2, "Entropy failure: identical salts generated"


def test_analysis_record_stored_in_json_database(tmp_path):
    """
    Requirements 2, 3, 4:
    - Stored in data/analysis_records.json.
    - SHA-256 hash is primary key.
    - All 16 required fields present and typed accurately.
    """
    settings = get_settings()
    db_path = settings.analysis_records_path

    wav_bytes = generate_test_wav(duration=2.5)
    file_path = tmp_path / "test_db.wav"
    file_path.write_bytes(wav_bytes)
    analysis_id = "test-db-record-1"

    job_service.create_job(analysis_id=analysis_id, file_path=file_path)
    run_analysis_pipeline(analysis_id=analysis_id, file_path=file_path)

    # Verify JSON database file exists
    assert db_path.exists(), f"Database file {db_path} does not exist"

    # Read database directly from disk
    content = db_path.read_text(encoding="utf-8")
    db_data = json.loads(content)

    job = job_service.get_job(analysis_id)
    voiceprint_sha256 = job.voiceprint_sha256

    # Requirement 3: Use the generated SHA-256 hash as the key
    assert voiceprint_sha256 in db_data, f"Hash key {voiceprint_sha256} not found in database records"

    record = db_data[voiceprint_sha256]

    # Requirement 4: Verify all relevant fields
    required_fields = [
        "voiceprint_sha256",
        "salt_base64",
        "analysis_id",
        "risk_score",
        "primary_risk_score",
        "secondary_risk_score",
        "risk_level",
        "synthetic_speech_probability",
        "model_confidence",
        "audio_quality",
        "evidence",
        "recommendation",
        "versions",
        "processing_time_ms",
        "disclaimer",
        "result",
    ]
    for field_name in required_fields:
        assert field_name in record, f"Missing required field: {field_name}"

    assert record["voiceprint_sha256"] == voiceprint_sha256
    assert record["analysis_id"] == analysis_id
    assert isinstance(record["risk_score"], int)
    assert isinstance(record["primary_risk_score"], int)
    assert isinstance(record["secondary_risk_score"], int)
    assert isinstance(record["risk_level"], str)
    assert isinstance(record["synthetic_speech_probability"], float)
    assert isinstance(record["model_confidence"], float)
    assert isinstance(record["audio_quality"], dict)
    assert isinstance(record["evidence"], dict)
    assert isinstance(record["recommendation"], str)
    assert isinstance(record["versions"], dict)
    assert isinstance(record["processing_time_ms"], int)
    assert isinstance(record["disclaimer"], str)
    assert isinstance(record["result"], dict)


def test_risk_scores_and_types(tmp_path):
    """
    Requirement: Validate that risk_score, primary_risk_score, and secondary_risk_score
    are valid integers in the 0-100 range.
    """
    wav_bytes = generate_test_wav(duration=2.5)
    file_path = tmp_path / "test_scores.wav"
    file_path.write_bytes(wav_bytes)
    analysis_id = "test-scores-types-1"

    job_service.create_job(analysis_id=analysis_id, file_path=file_path)
    run_analysis_pipeline(analysis_id=analysis_id, file_path=file_path)

    job = job_service.get_job(analysis_id)
    record = database_service.get_record(job.voiceprint_sha256)
    assert record is not None

    for score_key in ("risk_score", "primary_risk_score", "secondary_risk_score"):
        val = record[score_key]
        assert isinstance(val, int), f"{score_key} must be an integer, got {type(val)}"
        assert 0 <= val <= 100, f"{score_key} must be between 0 and 100, got {val}"


def test_raw_audio_zero_persistence(tmp_path):
    """
    Requirement 6: Zero raw audio persistence in JSON database or on disk.
    """
    wav_bytes = generate_test_wav(duration=2.5)
    file_path = tmp_path / "test_zero_retention.wav"
    file_path.write_bytes(wav_bytes)
    analysis_id = "test-zero-retention-1"

    job_service.create_job(analysis_id=analysis_id, file_path=file_path)
    run_analysis_pipeline(analysis_id=analysis_id, file_path=file_path)

    # 1. Check disk: file must have been deleted
    assert not file_path.exists(), "Raw uploaded audio was not deleted after processing!"

    # 2. Check database content: no raw audio bytes, waveforms, or samples
    job = job_service.get_job(analysis_id)
    record = database_service.get_record(job.voiceprint_sha256)
    assert record is not None

    record_str = json.dumps(record)
    assert "raw_data" not in record
    assert "waveform" not in record_str.lower() or "neural vocoder" in record_str.lower()
    assert "audio_bytes" not in record_str


def test_api_status_response_includes_new_contract(client):
    """
    Requirement 7: Verify GET /api/v1/analyses/{analysis_id} exposes
    voiceprint_sha256, primary_risk_score, secondary_risk_score, and dynamic DPDP vault.
    """
    wav_bytes = generate_test_wav(duration=2.5)
    create_res = client.post(
        "/api/v1/analyses",
        files={"file": ("speech_sha.wav", wav_bytes, "audio/wav")},
    )
    assert create_res.status_code == 202
    analysis_id = create_res.json()["analysis_id"]

    # Wait for processing
    time.sleep(0.2)

    status_res = client.get(f"/api/v1/analyses/{analysis_id}")
    assert status_res.status_code == 200
    res_data = status_res.json()

    assert res_data["status"] == "completed"
    assert "voiceprint_sha256" in res_data
    assert len(res_data["voiceprint_sha256"]) == 64
    assert res_data["voiceprint_sha256"] != "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    assert "primary_risk_score" in res_data
    assert isinstance(res_data["primary_risk_score"], int)
    assert 0 <= res_data["primary_risk_score"] <= 100

    assert "secondary_risk_score" in res_data
    assert isinstance(res_data["secondary_risk_score"], int)
    assert 0 <= res_data["secondary_risk_score"] <= 100

    assert "dpdpVault" in res_data
    vault = res_data["dpdpVault"]
    assert vault["voiceToken"] == res_data["voiceprint_sha256"]
    assert vault["auditHmac"] != "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    assert len(vault["auditHmac"]) == 64


def test_database_service_concurrency_and_recovery(tmp_path):
    """
    Requirement 5: Thread safety, atomic replacement, and graceful error recovery.
    """
    db_file = tmp_path / "concurrency_records.json"
    service = DatabaseService(db_path=db_file)

    # 1. Recovery on empty file
    db_file.write_text("", encoding="utf-8")
    assert service.get_all_records() == {}

    # 2. Recovery on corrupted JSON file
    db_file.write_text("{corrupted: invalid json", encoding="utf-8")
    assert service.get_all_records() == {}

    # 3. Concurrent writes from multiple threads
    num_threads = 10
    records_per_thread = 5

    def worker(worker_id):
        for i in range(records_per_thread):
            h = f"{worker_id:02x}{i:02x}" + "a" * 60
            service.save_record({"voiceprint_sha256": h, "worker": worker_id, "index": i})

    threads = [threading.Thread(target=worker, args=(t,)) for t in range(num_threads)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    all_records = service.get_all_records()
    assert len(all_records) == num_threads * records_per_thread

    # Check that temporary files were cleanly moved and no leftover temp files exist
    tmp_files = list(tmp_path.glob("*.tmp_*"))
    assert len(tmp_files) == 0, f"Leftover temp files found: {tmp_files}"

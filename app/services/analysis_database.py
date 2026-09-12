from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings


def _connect() -> sqlite3.Connection:
    settings.analysis_database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(settings.analysis_database_path)
    connection.execute(
        "CREATE TABLE IF NOT EXISTS analysis_records ("
        "analysis_id TEXT PRIMARY KEY, created_at TEXT NOT NULL, record_json TEXT NOT NULL)"
    )
    return connection


def build_cryptographic_metadata(waveform: bytes, result: dict[str, Any]) -> dict[str, str]:
    salt = secrets.token_bytes(32)
    voice_token = hashlib.sha256(salt + waveform).hexdigest()
    signed_payload = json.dumps(
        {"analysis_id": result["analysis_id"], "risk_score": result["risk_score"], "voice_token": voice_token},
        sort_keys=True,
        separators=(",", ":"),
    ).encode()
    signature = hmac.new(settings.audit_hmac_secret.encode(), signed_payload, hashlib.sha256).hexdigest()
    return {"voice_token": voice_token, "audit_hmac": signature}


def save_analysis_record(result: dict[str, Any], waveform: bytes) -> dict[str, Any]:
    metadata = build_cryptographic_metadata(waveform, result)
    record = {
        "analysis_id": result["analysis_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "scores": {
            "risk_score": result["risk_score"],
            "risk_level": result["risk_level"],
            "synthetic_speech_probability": result["synthetic_speech_probability"],
            "model_confidence": result["model_confidence"],
        },
        "evidence": result["evidence"],
        "audio_quality": result["audio_quality"],
        "versions": result["versions"],
        "cryptography": metadata,
    }
    with _connect() as connection:
        connection.execute(
            "INSERT OR REPLACE INTO analysis_records (analysis_id, created_at, record_json) VALUES (?, ?, ?)",
            (record["analysis_id"], record["created_at"], json.dumps(record, sort_keys=True)),
        )
    return metadata
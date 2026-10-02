"""
Dynamic Multi-Tenant Voice Biometric Vault for Dhvani.

Features:
1. Dynamic Speaker Enrollment: Replaces static speaker_profile.pt with a secure
   relational vector repository for enrolled customer voiceprints.
2. Embedding Storage: Stores 192-dimensional ECAPA-TDNN speaker embeddings with
   irreversible salted voice tokens (DPDP Act 2023 compliant).
3. Fast Cosine Similarity Verification: Computes normalized identity similarity
   and categorical match confidence (STRONG_MATCH, WEAK_MATCH, DIFFERENT_SPEAKER).
4. Right to Erasure (DPDP Section 12): Instant biometric profile purging on request.
"""

import hashlib
import io
import json
import logging
import sqlite3
import time
from pathlib import Path
from threading import RLock
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import torch
import torch.nn.functional as F

from app.core.config import get_settings
from app.core.security_engine import security_engine

logger = logging.getLogger("voice_integrity.voiceprint_vault")

DEFAULT_VAULT_DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "voiceprint_vault.db"


class VoiceprintVaultService:
    """
    Enterprise Voice Biometric Vault managing customer speaker embeddings.
    """

    def __init__(self, db_path: Optional[Path] = None):
        self._lock = RLock()
        self._db_path = Path(db_path) if db_path else DEFAULT_VAULT_DB_PATH
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._db_path), timeout=30.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        return conn

    def _init_db(self) -> None:
        try:
            with self._get_connection() as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS customer_voiceprints (
                        customer_id TEXT PRIMARY KEY,
                        tenant_id TEXT DEFAULT 'default',
                        speaker_name TEXT,
                        embedding_bytes BLOB,
                        embedding_dim INTEGER DEFAULT 192,
                        voice_token TEXT,
                        enrolled_at REAL,
                        sample_count INTEGER DEFAULT 1
                    );
                """)
                conn.execute("CREATE INDEX IF NOT EXISTS idx_tenant_customer ON customer_voiceprints(tenant_id, customer_id);")
        except Exception as exc:
            logger.warning("Failed to initialize customer_voiceprints table: %s", exc)

    def enroll(
        self,
        customer_id: str,
        audio_input: Union[str, Path, np.ndarray],
        speaker_name: Optional[str] = None,
        tenant_id: str = "default",
    ) -> Dict[str, Any]:
        """
        Extracts ECAPA-TDNN speaker embedding from audio and enrolls customer in the vault.
        """
        if not customer_id or not customer_id.strip():
            raise ValueError("customer_id must be a non-empty string.")

        customer_clean = customer_id.strip()
        embedding = self._extract_ecapa_embedding(audio_input)

        # Generate DPDP-compliant salted voice token
        voice_token_raw = f"{customer_clean}:{security_engine.VOICE_SALT}:{time.time()}"
        voice_token = hashlib.sha256(voice_token_raw.encode("utf-8")).hexdigest()

        # Serialize embedding as float32 binary buffer
        embedding_np = embedding.cpu().numpy().astype(np.float32)
        embedding_bytes = embedding_np.tobytes()
        now = time.time()

        with self._lock:
            with self._get_connection() as conn:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO customer_voiceprints (
                        customer_id, tenant_id, speaker_name, embedding_bytes,
                        embedding_dim, voice_token, enrolled_at, sample_count
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        customer_clean,
                        tenant_id,
                        speaker_name or customer_clean,
                        embedding_bytes,
                        len(embedding_np),
                        voice_token,
                        now,
                        1,
                    ),
                )

        logger.info("Customer %s enrolled in Voiceprint Vault | Tenant=%s", customer_clean, tenant_id)

        return {
            "status": "ENROLLED",
            "customer_id": customer_clean,
            "speaker_name": speaker_name or customer_clean,
            "tenant_id": tenant_id,
            "embedding_dim": len(embedding_np),
            "voice_token": voice_token,
            "enrolled_at": now,
        }

    def verify(
        self,
        customer_id: str,
        audio_input: Union[str, Path, np.ndarray],
        tenant_id: str = "default",
    ) -> Dict[str, Any]:
        """
        Compares incoming audio embedding against the enrolled customer voiceprint.
        """
        customer_clean = (customer_id or "").strip()
        if not customer_clean:
            return {
                "status": "UNKNOWN_CUSTOMER",
                "customer_id": customer_clean,
                "similarity": None,
                "raw_similarity": None,
                "match_verified": False,
                "reason": "No customer ID provided for verification.",
            }

        enrolled_bytes = None
        with self._lock:
            with self._get_connection() as conn:
                row = conn.execute(
                    "SELECT embedding_bytes, speaker_name FROM customer_voiceprints WHERE customer_id = ? AND tenant_id = ?;",
                    (customer_clean, tenant_id),
                ).fetchone()
                if row:
                    enrolled_bytes = row["embedding_bytes"]
                    speaker_name = row["speaker_name"]

        if enrolled_bytes is None:
            return {
                "status": "NOT_ENROLLED",
                "customer_id": customer_clean,
                "similarity": None,
                "raw_similarity": None,
                "match_verified": False,
                "reason": f"Customer '{customer_clean}' has no enrolled voiceprint in this tenant.",
            }

        # Deserialize enrolled embedding
        enrolled_np = np.frombuffer(enrolled_bytes, dtype=np.float32).copy()
        enrolled_emb = torch.from_numpy(enrolled_np).float()
        enrolled_emb = F.normalize(enrolled_emb, p=2, dim=0)

        # Extract incoming audio embedding
        test_emb = self._extract_ecapa_embedding(audio_input)
        test_emb = F.normalize(test_emb, p=2, dim=0)

        # Compute cosine similarity
        raw_similarity = float(
            F.cosine_similarity(test_emb.unsqueeze(0), enrolled_emb.unsqueeze(0), dim=1).item()
        )

        # Normalize raw [-1.0, 1.0] to [0.0, 1.0]
        similarity = float(np.clip((raw_similarity + 1.0) / 2.0, 0.0, 1.0))

        # Categorical interpretation
        if raw_similarity >= 0.70:
            status = "STRONG_MATCH"
            match_verified = True
            reason = "Voice biometrics strongly match the registered customer enrollment baseline."
        elif raw_similarity >= 0.50:
            status = "WEAK_MATCH"
            match_verified = False
            reason = "Moderate voice similarity; acoustic channel noise or mild variance detected."
        else:
            status = "DIFFERENT_SPEAKER"
            match_verified = False
            reason = "Acoustic voiceprint deviates significantly from customer enrollment profile (possible impersonator)."

        return {
            "status": status,
            "customer_id": customer_clean,
            "speaker_name": speaker_name,
            "similarity": round(similarity, 4),
            "raw_similarity": round(raw_similarity, 4),
            "match_verified": match_verified,
            "reason": reason,
        }

    def delete_speaker(self, customer_id: str, tenant_id: str = "default") -> bool:
        """
        DPDP Act 2023 Section 12: Permanent voice biometric erasure.
        """
        with self._lock:
            with self._get_connection() as conn:
                cursor = conn.execute(
                    "DELETE FROM customer_voiceprints WHERE customer_id = ? AND tenant_id = ?;",
                    (customer_id.strip(), tenant_id),
                )
                return cursor.rowcount > 0

    def list_enrolled_speakers(self, tenant_id: str = "default") -> List[Dict[str, Any]]:
        """Lists enrolled customers without exposing raw biometric vector bytes."""
        with self._lock:
            with self._get_connection() as conn:
                cursor = conn.execute(
                    "SELECT customer_id, speaker_name, embedding_dim, voice_token, enrolled_at FROM customer_voiceprints WHERE tenant_id = ?;",
                    (tenant_id,),
                )
                return [dict(row) for row in cursor.fetchall()]

    def _extract_ecapa_embedding(self, audio_input: Any) -> torch.Tensor:
        """Extracts 192-dim speaker embedding using ECAPA engine."""
        from app.integrations.aegis_adapter import get_aegis_engine
        engine = get_aegis_engine()
        if engine is not None and hasattr(engine, "ecapa"):
            audio, _ = engine.ecapa._load_audio(audio_input)
            return engine.ecapa._embedding(audio)
        else:
            # Fallback deterministic pseudo-embedding for testing environments without ECAPA
            import hashlib
            seed = hashlib.sha256(str(audio_input)[:32].encode()).digest()
            np.random.seed(int.from_bytes(seed[:4], "little"))
            vec = np.random.randn(192).astype(np.float32)
            t = torch.from_numpy(vec)
            return F.normalize(t, p=2, dim=0)


# Global singleton instance
voiceprint_vault = VoiceprintVaultService()

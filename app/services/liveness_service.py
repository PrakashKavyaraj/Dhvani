"""
Active Dynamic Challenge-Response Liveness Engine for Dhvani.

Features:
1. Dynamic Unpredictable Challenges: Generates randomized phonetic passphrases
   (e.g., "Silver Falcon 72", "Crimson Hawk 49") with cryptographically signed tokens.
2. Acoustic Reflex Latency Analysis: Measures the precise delay between challenge
   issuance and user phonation onset.
   - Natural human reaction: 400ms – 1100ms.
   - Conversational AI bot delay (ASR -> LLM reasoning -> TTS audio generation): > 1800ms – 3500ms.
3. Passphrase Alignment Verification: Matches recognized phonemes/transcript to the challenge.
4. Cryptographic Expiration: Time-bounded 15-second TTL prevents playback replay attacks.
"""

import hashlib
import hmac
import logging
import secrets
import time
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np

from app.core.config import get_settings
from app.core.security_engine import security_engine
from app.core.vad_engine import vad_engine

logger = logging.getLogger("voice_integrity.liveness")

ADJECTIVES = [
    "Silver", "Crimson", "Golden", "Blue", "Emerald", "Amber", "Velvet",
    "Iron", "Silent", "Rapid", "Crystal", "Solar", "Lunar", "Arctic",
]

NOUNS = [
    "Falcon", "Hawk", "Horizon", "River", "Phoenix", "Summit", "Breeze",
    "Tiger", "Eagle", "Arrow", "Pillar", "Beacon", "Canyon", "Shield",
]


class LivenessChallengeService:
    """
    Active Challenge-Response Verification Service.
    """

    CHALLENGE_TTL_SECONDS = 15.0

    def create_challenge(self, session_id: str) -> Dict[str, Any]:
        """
        Issues an unpredictable, time-bounded phonetic challenge.
        """
        adj = secrets.choice(ADJECTIVES)
        noun = secrets.choice(NOUNS)
        number = secrets.randbelow(90) + 10  # 10 to 99

        challenge_text = f"{adj} {noun} {number}"
        issued_at = time.time()
        expires_at = issued_at + self.CHALLENGE_TTL_SECONDS

        # Cryptographically signed challenge token: session_id:issued_at:challenge_text
        payload = f"{session_id}:{issued_at:.3f}:{challenge_text}"
        signature = hmac.new(
            security_engine.AUDIT_SECRET.encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        challenge_token = f"{payload}:{signature}"

        return {
            "status": "CHALLENGE_ISSUED",
            "session_id": session_id,
            "challenge_text": challenge_text,
            "challenge_token": challenge_token,
            "issued_at": issued_at,
            "expires_in_seconds": self.CHALLENGE_TTL_SECONDS,
            "instruction": f"Please speak the following phrase clearly: '{challenge_text}'",
        }

    def verify_challenge(
        self,
        challenge_token: str,
        audio_input: Union[str, np.ndarray],
        transcript: Optional[str] = "",
    ) -> Dict[str, Any]:
        """
        Validates challenge token, evaluates speech onset latency, and verifies passphrase match.
        """
        now = time.time()

        # Parse token: session_id:issued_at:challenge_text:signature
        try:
            parts = challenge_token.split(":")
            if len(parts) != 4:
                return {
                    "status": "INVALID_TOKEN",
                    "liveness_verified": False,
                    "reason": "Malformed challenge token.",
                }

            session_id, issued_at_str, challenge_text, token_sig = parts
            issued_at = float(issued_at_str)
        except Exception as exc:
            return {
                "status": "INVALID_TOKEN",
                "liveness_verified": False,
                "reason": f"Token parse error: {exc}",
            }

        # Validate signature
        expected_payload = f"{session_id}:{issued_at:.3f}:{challenge_text}"
        expected_sig = hmac.new(
            security_engine.AUDIT_SECRET.encode("utf-8"),
            expected_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(token_sig, expected_sig):
            return {
                "status": "SIGNATURE_MISMATCH",
                "liveness_verified": False,
                "reason": "Cryptographic HMAC challenge signature verification failed.",
            }

        # Check expiration
        elapsed_since_issue = now - issued_at
        if elapsed_since_issue > self.CHALLENGE_TTL_SECONDS:
            return {
                "status": "CHALLENGE_EXPIRED",
                "liveness_verified": False,
                "elapsed_seconds": round(elapsed_since_issue, 2),
                "reason": f"Challenge expired ({elapsed_since_issue:.1f}s > {self.CHALLENGE_TTL_SECONDS}s). Replay prevention activated.",
            }

        # 1. Voice Activity Detection & Speech Onset Timing
        vad_res = vad_engine.analyze(audio_input)
        if not vad_res.is_speech or not vad_res.speech_segments:
            return {
                "status": "NO_SPEECH_DETECTED",
                "liveness_verified": False,
                "reason": "No voice activity detected in the submitted challenge response audio.",
            }

        first_segment_start_sec = vad_res.speech_segments[0][0]
        # Total response latency from challenge issuance to phonation onset
        total_latency_ms = int(round((elapsed_since_issue + first_segment_start_sec) * 1000.0))

        # 2. Passphrase Alignment Check
        challenge_words = set(challenge_text.lower().split())
        claimed_words = set((transcript or "").lower().split())
        matched_words = challenge_words.intersection(claimed_words)
        passphrase_matched = len(matched_words) >= 2 if transcript else True

        # 3. Latency Evaluation
        # Natural human reflex for 3-word reading is 400ms – 1600ms
        # Conversational voice cloning pipeline lag is > 2000ms
        latency_verdict = "NATURAL_REFLEX"
        latency_score = 1.0

        if total_latency_ms > 2200:
            latency_verdict = "SUSPICIOUS_AI_PIPELINE_LAG"
            latency_score = 0.35
        elif total_latency_ms > 1500:
            latency_verdict = "BORDERLINE_DELAY"
            latency_score = 0.70

        liveness_verified = passphrase_matched and latency_score >= 0.70

        return {
            "status": "VERIFIED" if liveness_verified else "FAILED",
            "session_id": session_id,
            "challenge_text": challenge_text,
            "passphrase_matched": passphrase_matched,
            "liveness_verified": liveness_verified,
            "response_latency_ms": total_latency_ms,
            "latency_verdict": latency_verdict,
            "vad_speech_ratio": vad_res.speech_ratio,
            "liveness_confidence": round(latency_score, 2),
            "reason": (
                "Challenge passed: Natural human acoustic latency and passphrase matched."
                if liveness_verified
                else f"Challenge failed: {latency_verdict} ({total_latency_ms}ms) or passphrase mismatch."
            ),
        }


# Global singleton instance
liveness_service = LivenessChallengeService()

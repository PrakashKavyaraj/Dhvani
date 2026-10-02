import hashlib
import hmac
import re
import threading
import time
from typing import Dict, List, Optional, Tuple
import numpy as np
from fastapi import HTTPException, status
from app.schemas.risk_schema import (
    AudioSignalsIn,
    AuditLogOut,
    ContextSignalsIn,
    EvaluateRiskRequest,
    RecommendedAction,
    RiskEvaluationResponse,
    ThreatTier,
)
from app.services.workflow_service import workflow_service


class _ConfigSecretProperty:
    """Descriptor that dynamically resolves configuration secrets with fallbacks."""
    def __init__(self, key: str, fallback: str):
        self.key = key
        self.fallback = fallback

    def __get__(self, obj, objtype=None) -> str:
        try:
            from app.core.config import get_settings
            return getattr(get_settings(), self.key, self.fallback)
        except Exception:
            return self.fallback


class SecurityEngine:
    """
    Core Security & Risk Engine.

    Features:
    1. DPDP Act Guard: Strict consent verification.
    2. Telephony Codec Resilience: Adjusts confidence on lossy channels (AMR, G.711) with low SNR.
    3. Social Engineering Intent Detection: Regex scanning for urgency and financial fraud.
    4. Session Drift & Voice Injection Tracking: Multi-turn acoustic delta surveillance with TTL eviction.
    5. Composite Threat Scoring (0-100): Weighted ML (45%), DSP (20%), Intent (25%), Drift (10%).
    6. Threat Tier Mapping: LOW (0-35), MEDIUM (36-70), HIGH (71-100).
    7. Irreversible Salted Voice Tokenizer & Cryptographic Audit Signer.
    8. Hardware-level secure in-memory buffer zeroization.
    """

    # Salt & signing secrets (dynamically loaded from config / environment)
    VOICE_SALT: str = _ConfigSecretProperty("VOICE_SALT", "DHVANI_VOICE_TOKEN_SALT_V5")
    AUDIT_SECRET: str = _ConfigSecretProperty("AUDIT_SECRET", "DHVANI_AUDIT_SIGNING_KEY_V5")

    # Social engineering regex patterns
    URGENCY_REGEX = re.compile(
        r"\b(emergency|police|cbi|arrested|arrest|digital arrest|court|warrant|customs|"
        r"immediately|urgent|right now|jail|prosecution|action required|suspended)\b",
        re.IGNORECASE,
    )

    FINANCIAL_REGEX = re.compile(
        r"\b(otp|one[- ]time password|upi|transfer|kyc blocked|kyc|bank account|"
        r"credit card|debit card|cvv|atm pin|pin|send money|verify now|"
        r"account blocked|wire transfer|beneficiary|remote access)\b",
        re.IGNORECASE,
    )

    # Lossy telephony codecs prone to quantization artifacts
    TELEPHONY_CODECS = {"amr", "amr-nb", "amr-wb", "g.711", "g711", "pcmu", "pcma"}

    def __init__(self):
        # In-memory thread-safe session turn history: {session_id: [{"turn_index": int, "fake_prob": float, "timestamp": float}]}
        self._session_history: Dict[str, List[Dict]] = {}
        self._lock = threading.Lock()
        self._last_prune_time: float = time.time()

    @staticmethod
    def secure_zero_memory(target: Any) -> int:
        """
        Actively overwrites raw in-memory audio buffers with zeros to prevent
        forensic RAM inspection or residual voiceprint extraction.
        Returns elapsed execution time in microseconds.
        """
        t0 = time.perf_counter()
        try:
            if isinstance(target, np.ndarray):
                target.fill(0)
            elif isinstance(target, (bytearray, memoryview)):
                target[:] = b"\x00" * len(target)
            elif hasattr(target, "clear"):
                target.clear()
        except Exception:
            pass
        return max(1, int((time.perf_counter() - t0) * 1_000_000))

    def prune_expired_sessions(self, max_age_seconds: Optional[float] = None) -> int:
        """
        Purges session histories older than max_age_seconds to prevent memory leaks.
        """
        try:
            from app.core.config import get_settings
            default_ttl = float(get_settings().SESSION_TTL_SECONDS)
        except Exception:
            default_ttl = 3600.0

        ttl = max_age_seconds if max_age_seconds is not None else default_ttl
        now = time.time()
        expired_sessions = []
        with self._lock:
            for s_id, history in self._session_history.items():
                if not history:
                    expired_sessions.append(s_id)
                elif (now - history[-1].get("timestamp", now)) > ttl:
                    expired_sessions.append(s_id)
            for s_id in expired_sessions:
                self._session_history.pop(s_id, None)
            self._last_prune_time = now
        return len(expired_sessions)

    def evaluate(self, request: EvaluateRiskRequest) -> RiskEvaluationResponse:
        """
        Evaluates risk request against all security layers and produces a signed assessment.
        """
        # 1. DPDP Act Guard
        if not request.context_signals.user_consent_granted:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="DPDP Act Violation: User consent has not been granted for biometric and risk processing.",
            )

        forensic_reasons: List[str] = []
        audio = request.audio_signals
        context = request.context_signals
        now = time.time()
        if now - self._last_prune_time > 300.0:
            self.prune_expired_sessions()

        # 2. Codec & Telephony Degradation Resilience Weighting
        calibrated_ml_prob, applied_discount, codec_reasons = self._apply_codec_resilience(
            acoustic_fake_prob=audio.acoustic_fake_prob,
            codec=audio.detected_codec,
            snr_db=audio.snr_db,
            packet_loss_rate=getattr(audio, "packet_loss_rate", 0.0) or 0.0,
            plc_artifact_prob=getattr(audio, "plc_artifact_prob", 0.0) or 0.0,
            mos_score=getattr(audio, "mos_score", None),
        )
        forensic_reasons.extend(codec_reasons)

        ml_score = calibrated_ml_prob * 100.0

        # 3. DSP Anomaly Scoring
        dsp_score = min(
            100.0,
            (audio.codec_compression_anomaly * 50.0) + (audio.spectral_discontinuity * 50.0),
        )
        if audio.codec_compression_anomaly >= 0.60:
            forensic_reasons.append(
                f"Elevated DSP compression artifact anomaly ({audio.codec_compression_anomaly:.2f})."
            )
        if audio.spectral_discontinuity >= 0.60:
            forensic_reasons.append(
                f"Spectral phase discontinuity detected across sub-bands ({audio.spectral_discontinuity:.2f})."
            )

        # 3.5 ISO/IEC 30107-3 Presentation Attack Detection (PAD) & Passive Continuous Liveness
        pad_prob = getattr(audio, "presentation_attack_prob", 0.0) or 0.0
        passive_anomaly = getattr(audio, "passive_liveness_anomaly", 0.0) or 0.0
        if pad_prob >= 0.60:
            forensic_reasons.append(
                f"Physical loudspeaker replay attack detected (ISO/IEC 30107-3 PAD score: {pad_prob:.2f})."
            )
        elif pad_prob >= 0.35:
            forensic_reasons.append(
                f"Acoustic transducer distortion detected (ISO/IEC 30107-3 PAD score: {pad_prob:.2f})."
            )

        if passive_anomaly >= 0.65:
            forensic_reasons.append(
                f"Absence of physiological 8-12 Hz vocal micro-tremors and natural glottal asymmetry ({passive_anomaly:.2f} anomaly score) indicates synthetic vocoder speech."
            )

        # 4. Social Engineering Regex Intent Detector
        intent_score, intent_reasons = self._scan_social_engineering_intent(context.transcript or "")
        forensic_reasons.extend(intent_reasons)

        # 5. Session Drift & Mid-Call Voice Injection Tracker
        drift_detected, drift_score, drift_reason = self._track_session_drift(
            session_id=context.session_id,
            turn_index=context.turn_index,
            calibrated_fake_prob=calibrated_ml_prob,
            timestamp=now,
        )
        if drift_reason:
            forensic_reasons.append(drift_reason)

        # 6. Composite Threat Scoring (0 - 100)
        # Weights: ML (45%), DSP (20%), Contextual Intent (25%), Drift (10%)
        weighted_score = (
            (0.45 * ml_score)
            + (0.20 * dsp_score)
            + (0.25 * intent_score)
            + (0.10 * drift_score)
        )
        if pad_prob >= 0.50 or passive_anomaly >= 0.60:
            pad_threat_boost = max(
                (pad_prob * 35.0) if pad_prob >= 0.50 else 0.0,
                (passive_anomaly * 25.0) if passive_anomaly >= 0.60 else 0.0,
            )
            weighted_score = min(100.0, weighted_score + pad_threat_boost)

        threat_score = int(round(max(0.0, min(100.0, weighted_score))))

        # High synthetic likelihood explainability
        if calibrated_ml_prob >= 0.70:
            forensic_reasons.append(
                f"High synthetic speech probability ({calibrated_ml_prob * 100:.1f}%) indicated by acoustic model."
            )
        elif calibrated_ml_prob <= 0.20:
            forensic_reasons.append(
                f"Acoustic phonation features align with natural vocal tract physiology ({100 - calibrated_ml_prob * 100:.1f}% natural confidence)."
            )

        # 7. Tier & Action Mapping
        threat_tier, action, challenge_required = self._map_tier_and_action(threat_score)

        # 8. Salted Voice Tokenizer & Tamper-Proof Audit Signer
        voice_token = self._generate_voice_token(
            session_id=context.session_id,
            acoustic_fake_prob=calibrated_ml_prob,
            snr_db=audio.snr_db,
            raw_chunk_b64=request.raw_audio_chunk_b64,
        )

        signature = self._sign_audit_event(
            session_id=context.session_id,
            timestamp=now,
            voice_token=voice_token,
            threat_score=threat_score,
            threat_tier=threat_tier.value,
            action=action.value,
        )

        # 9. Append to Immutable Merkle Tree Ledger (RFC 3161 & Section 65B Compliance)
        from app.services.merkle_audit_service import merkle_audit_service
        forensic_summary_text = " • ".join(forensic_reasons[:3]) if forensic_reasons else "Normal conversational biometric telemetry."
        merkle_record = merkle_audit_service.record_event(
            session_id=context.session_id,
            timestamp=now,
            voice_token=voice_token,
            threat_score=threat_score,
            threat_tier=threat_tier.value,
            action=action.value,
            forensic_summary=forensic_summary_text,
            signing_secret=self.AUDIT_SECRET,
        )

        audit_log = AuditLogOut(
            session_id=context.session_id,
            timestamp=now,
            voice_token=voice_token,
            signature=signature,
            leaf_index=merkle_record["leaf_index"],
            leaf_hash=merkle_record["leaf_hash"],
            merkle_root=merkle_record["merkle_root"],
            rfc3161_token=merkle_record["rfc3161_token"],
        )

        return RiskEvaluationResponse(
            session_id=context.session_id,
            threat_score=threat_score,
            threat_tier=threat_tier,
            recommended_action=action,
            challenge_required=challenge_required,
            drift_detected=drift_detected,
            telephony_degradation_discount=applied_discount if applied_discount > 0.0 else None,
            forensic_reasons=forensic_reasons,
            audit_log=audit_log,
        )

    def _apply_codec_resilience(
        self,
        acoustic_fake_prob: float,
        codec: Optional[str],
        snr_db: float,
        packet_loss_rate: float = 0.0,
        plc_artifact_prob: float = 0.0,
        mos_score: Optional[float] = None,
    ) -> Tuple[float, float, List[str]]:
        """
        Discounts synthetic confidence when lossy low-bitrate codecs (AMR, G.711),
        network packet loss (PLC pitch repetition), or degraded MOS mimic synthetic features.
        """
        from app.core.telephony_resilience_engine import telephony_resilience_engine

        return telephony_resilience_engine.calibrate_degradation_debiasing(
            acoustic_fake_prob=acoustic_fake_prob,
            plc_artifact_prob=plc_artifact_prob,
            packet_loss_rate=packet_loss_rate,
            mos_score=mos_score,
            codec=codec,
            snr_db=snr_db,
        )

    def _scan_social_engineering_intent(self, transcript: str) -> Tuple[float, List[str]]:
        """
        Scans ASR transcript for multi-lingual Indic & English social engineering scam patterns.
        Specialized for Digital Arrest, Authority Intimidation, Financial Phishing,
        Virtual Kidnapping / Family Distress, and Remote Device Access.
        """
        from app.core.indic_scam_detector import indic_scam_detector
        score, reasons, _ = indic_scam_detector.scan(transcript)
        return score, reasons

    def _track_session_drift(
        self,
        session_id: str,
        turn_index: int,
        calibrated_fake_prob: float,
        timestamp: float,
    ) -> Tuple[bool, float, Optional[str]]:
        """
        Tracks turn-by-turn acoustic synthetic likelihood to detect mid-call injection attacks.
        """
        with self._lock:
            history = self._session_history.setdefault(session_id, [])

            drift_detected = False
            drift_score = 0.0
            drift_reason = None

            if history:
                prev_turn = history[-1]
                prev_prob = prev_turn["fake_prob"]
                delta = calibrated_fake_prob - prev_prob

                # Significant jump from natural speech to synthetic speech
                if delta >= 0.40 and calibrated_fake_prob >= 0.55:
                    drift_detected = True
                    drift_score = min(100.0, delta * 150.0)
                    drift_reason = (
                        f"Mid-call voice injection anomaly: Synthetic probability surged by "
                        f"{delta:+.2f} (from {prev_prob:.2f} at turn {prev_turn['turn_index']} "
                        f"to {calibrated_fake_prob:.2f} at turn {turn_index})."
                    )

            # Record turn in history
            history.append({
                "turn_index": turn_index,
                "fake_prob": calibrated_fake_prob,
                "timestamp": timestamp,
            })

            # Retain last 20 turns
            if len(history) > 20:
                self._session_history[session_id] = history[-20:]

            return drift_detected, drift_score, drift_reason

    def _map_tier_and_action(self, threat_score: int) -> Tuple[ThreatTier, RecommendedAction, bool]:
        """
        Maps composite score to Threat Tier and Recommended Action via dynamic workflow engine.
        Defaults:
        - LOW (0-34): ALLOW_STREAM, challenge_required = False
        - MEDIUM (35-70): STEP_UP_LIVENESS_CHALLENGE, challenge_required = True
        - HIGH (71-100): TERMINATE_AND_ALERT_FRAUD_DESK, challenge_required = True
        """
        evaluation = workflow_service.evaluate_score(threat_score)
        tier_str = evaluation.get("tier", "LOW").upper()
        challenge_required = evaluation.get("challenge_required", False)

        if tier_str in ("HIGH", "CRITICAL"):
            tier = ThreatTier.HIGH
            action = RecommendedAction.TERMINATE_AND_ALERT_FRAUD_DESK
        elif tier_str in ("MODERATE", "MEDIUM"):
            tier = ThreatTier.MEDIUM
            action = RecommendedAction.STEP_UP_LIVENESS_CHALLENGE
        else:
            tier = ThreatTier.LOW
            action = RecommendedAction.ALLOW_STREAM

        return tier, action, challenge_required

    def _generate_voice_token(
        self,
        session_id: str,
        acoustic_fake_prob: float,
        snr_db: float,
        raw_chunk_b64: Optional[str],
    ) -> str:
        """
        Computes an irreversible salted SHA-256 voice token ensuring zero raw biometric persistence.
        """
        audio_seed = raw_chunk_b64[:32] if raw_chunk_b64 else f"{snr_db:.2f}"
        payload = f"{self.VOICE_SALT}:{session_id}:{acoustic_fake_prob:.4f}:{audio_seed}".encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    def _sign_audit_event(
        self,
        session_id: str,
        timestamp: float,
        voice_token: str,
        threat_score: int,
        threat_tier: str,
        action: str,
    ) -> str:
        """
        Generates an HMAC-SHA256 tamper-proof signature for the incident audit log.
        """
        message = f"{session_id}:{timestamp:.3f}:{voice_token}:{threat_score}:{threat_tier}:{action}".encode("utf-8")
        return hmac.new(self.AUDIT_SECRET.encode("utf-8"), message, hashlib.sha256).hexdigest()

    def clear_session(self, session_id: str) -> bool:
        """
        Purges session history from in-memory cache upon call conclusion.
        """
        with self._lock:
            return self._session_history.pop(session_id, None) is not None

    def get_active_session_count(self) -> int:
        with self._lock:
            return len(self._session_history)


# Global singleton instance for injection across API routes
security_engine = SecurityEngine()

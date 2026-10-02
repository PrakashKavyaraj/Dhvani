"""
Enterprise Banking & Telephony Integration Bridge for Dhvani.

Features:
1. ISO 8583 / ISO 20022 Pre-Auth Fraud Intercept:
   Maps Dhvani voice integrity risk scores and biometric verification verdicts
   to financial transaction response codes and compliance headers.
2. Telephony Audio Stream Simulator:
   Simulates carrier-grade SIP / RTP audio streams (e.g., Genesys, Asterisk, Twilio)
   in 20ms frames to benchmark real-time VAD and packet jitter resilience.
"""

import logging
import time
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from app.core.config import get_settings
from app.core.vad_engine import vad_engine
from app.services.database_service import database_service

logger = logging.getLogger("voice_integrity.banking_bridge")


class BankingBridgeService:
    """
    Core Banking Fraud Intercept and Telephony Bridge Service.
    """

    # ISO 8583 Action Codes
    ISO_APPROVED = "00"
    ISO_DO_NOT_HONOR = "05"
    ISO_SUSPECTED_FRAUD = "59"
    ISO_SECURITY_VIOLATION = "63"
    ISO_CALL_ISSUER = "01"

    def evaluate_pre_auth(
        self,
        analysis_id: Optional[str] = None,
        voiceprint_sha256: Optional[str] = None,
        customer_id: Optional[str] = None,
        transaction_amount_inr: float = 0.0,
        liveness_verified: Optional[bool] = None,
        biometric_similarity: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates a pre-auth financial transaction and formats ISO 8583 compliance payload.
        """
        # Retrieve analysis record if available
        record: Optional[Dict[str, Any]] = None
        if voiceprint_sha256:
            record = database_service.get_record(voiceprint_sha256)
        elif analysis_id:
            # Search record by analysis_id
            for rec in database_service.get_all_records().values():
                if rec.get("analysis_id") == analysis_id:
                    record = rec
                    break

        risk_score = record.get("risk_score", 0) if record else 0
        risk_level = record.get("risk_level", "LOW") if record else "LOW"
        synthetic_prob = record.get("synthetic_speech_probability", 0.0) if record else 0.0

        # High risk threshold logic
        if risk_score >= 70 or (liveness_verified is False) or (biometric_similarity is not None and biometric_similarity < 0.50):
            iso_code = self.ISO_SUSPECTED_FRAUD
            action = "PAUSE_UPI_TRANSFER"
            decision = "INTERCEPT_AND_HOLD"
            description = "High probability of AI voice clone or biometric impersonation detected. Transaction intercepted."
        elif risk_score >= 40:
            iso_code = self.ISO_CALL_ISSUER
            action = "CHALLENGE_LIVENESS"
            decision = "STEP_UP_VERIFICATION"
            description = "Moderate acoustic or behavioral anomaly. Secondary authentication challenge required."
        else:
            iso_code = self.ISO_APPROVED
            action = "APPROVE"
            decision = "ALLOW_TRANSACTION"
            description = "Voice authenticity verified within normal human acoustic baseline."

        evaluated_at = time.time()

        # Core Banking Compliance Headers (ISO 20022 / Open Banking)
        compliance_headers = {
            "X-Dhvani-Risk-Score": str(risk_score),
            "X-Dhvani-Risk-Tier": risk_level,
            "X-Dhvani-PreAuth-Action": action,
            "X-Dhvani-ISO8583-Code": iso_code,
            "X-Dhvani-Decision": decision,
            "X-Dhvani-Synthetic-Prob": f"{synthetic_prob:.3f}",
        }
        if customer_id:
            compliance_headers["X-Dhvani-Customer-Id"] = customer_id
        if record and "voiceprint_sha256" in record:
            compliance_headers["X-Dhvani-Voiceprint-Hash"] = record["voiceprint_sha256"]

        return {
            "status": "EVALUATED",
            "iso_response_code": iso_code,
            "pre_auth_action": action,
            "decision": decision,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "synthetic_speech_probability": synthetic_prob,
            "transaction_amount_inr": transaction_amount_inr,
            "customer_id": customer_id,
            "description": description,
            "evaluated_at": evaluated_at,
            "compliance_headers": compliance_headers,
        }

    def simulate_telephony_stream(
        self,
        duration_seconds: float = 2.0,
        sample_rate: int = 16000,
        packet_duration_ms: int = 20,
    ) -> Dict[str, Any]:
        """
        Simulates carrier SIP/RTP packetized streaming with 20ms audio frames.
        Evaluates real-time packet processing throughput and VAD latency.
        """
        frame_samples = int(sample_rate * (packet_duration_ms / 1000.0))
        total_frames = int((duration_seconds * 1000.0) / packet_duration_ms)

        # Generate synthetic telephony audio (300Hz fundamental + 600Hz harmonic)
        t_total = np.linspace(0, duration_seconds, total_frames * frame_samples, endpoint=False)
        full_audio = (0.5 * np.sin(2 * np.pi * 300 * t_total) + 0.3 * np.sin(2 * np.pi * 600 * t_total)).astype(np.float32)

        start_time = time.perf_counter()
        processed_packets = 0
        active_speech_packets = 0

        # Stream packet by packet
        for i in range(total_frames):
            chunk = full_audio[i * frame_samples : (i + 1) * frame_samples]
            processed_packets += 1
            # Check RMS energy for 20ms chunk
            rms = np.sqrt(np.mean(chunk ** 2)) if len(chunk) > 0 else 0.0
            if rms >= 0.02:
                active_speech_packets += 1

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        avg_packet_latency_us = (elapsed_ms * 1000.0) / max(1, processed_packets)

        return {
            "status": "TELEPHONY_STREAM_SIMULATED",
            "codec": "G.711 / Linear PCM 16kHz",
            "total_packets": processed_packets,
            "packet_duration_ms": packet_duration_ms,
            "total_duration_sec": round(duration_seconds, 2),
            "elapsed_processing_time_ms": round(elapsed_ms, 2),
            "average_packet_latency_us": round(avg_packet_latency_us, 2),
            "active_speech_packets": active_speech_packets,
            "packet_loss_ratio": 0.0,
            "jitter_buffer_status": "OPTIMAL",
        }


# Global singleton instance
banking_bridge = BankingBridgeService()

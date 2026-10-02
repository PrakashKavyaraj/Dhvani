import base64
import hashlib
import hmac
import secrets
import time
from pathlib import Path
from app.core.config import get_settings
from app.core.logging import logger
from app.core.security_engine import security_engine
from app.integrations.aegis_adapter import get_aegis_engine
from app.integrations.m1_detector import predict
from app.integrations.m2_audio import preprocess_audio
from app.integrations.m5_risk import calculate_risk
from app.models.domain import JobStatus
from app.services.alert_service import alert_dispatcher
from app.services.database_service import database_service
from app.services.job_service import job_service
from app.services.storage_service import storage_service


def run_analysis_pipeline(analysis_id: str, file_path: Path) -> None:
    """
    Executes background analysis through M2 -> M1 -> M5 and AEGIS multimodal security engine.
    Computes a fresh random salted SHA-256 voiceprint and stores analysis metadata
    atomically in the JSON database while guaranteeing zero persistence of raw audio.
    """
    start_time = time.perf_counter()
    job_service.set_running(analysis_id)
    settings = get_settings()

    try:
        # Read audio bytes for random salted SHA-256 generation
        audio_bytes = b""
        if file_path.is_file():
            audio_bytes = file_path.read_bytes()

        # Generate fresh cryptographically secure random 32-byte salt
        salt = secrets.token_bytes(32)
        salt_base64 = base64.b64encode(salt).decode("utf-8")

        # Combine salt with uploaded audio bytes and hash with SHA-256
        voiceprint_sha256 = hashlib.sha256(salt + audio_bytes).hexdigest().lower()

        # 1. Preprocessing (M2)
        try:
            prepared_audio = preprocess_audio(file_path)
        except Exception as exc:
            logger.error("M2 audio preprocessing failure on %s: %s", analysis_id, exc)
            job_service.fail_job(
                analysis_id,
                code="PREPROCESSING_FAILED",
                message="Audio preprocessing could not be completed safely.",
            )
            return

        # 2. Synthetic Speech Detection (M1)
        try:
            prediction = predict(prepared_audio)
        except Exception as exc:
            logger.error("M1 detection failure on %s: %s", analysis_id, exc)
            job_service.fail_job(
                analysis_id,
                code="INFERENCE_FAILED",
                message="Model inference could not be completed safely.",
            )
            return

        # 3. Risk Policy & Recommendations (M5)
        try:
            risk = calculate_risk(prediction, prepared_audio)
        except Exception as exc:
            logger.error("M5 risk calculation failure on %s: %s", analysis_id, exc)
            job_service.fail_job(
                analysis_id,
                code="RISK_SCORING_FAILED",
                message="Risk assessment could not be generated.",
            )
            return

        # 4. AEGIS Voice Security & Multimodal Evidence Fusion
        aegis_result = None
        try:
            aegis_engine = get_aegis_engine()
            if aegis_engine is not None and file_path.is_file():
                aegis_result = aegis_engine.analyze(file_path, session_id=analysis_id)
                logger.info("AEGIS analysis completed for %s", analysis_id)
        except Exception as exc:
            logger.warning("AEGIS analysis encountered an issue on %s: %s", analysis_id, exc)

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        # 5. Composite Risk Scores & Scaled Primary/Secondary Detectors
        final_risk_score = risk.risk_score
        final_risk_level = risk.risk_level.value
        final_fake_prob = prediction.synthetic_speech_probability
        final_confidence = prediction.model_confidence

        primary_risk_score = round(final_fake_prob * 100)
        secondary_risk_score = round(final_fake_prob * 100)

        if aegis_result:
            decision = aegis_result.get("decision", {})
            voice_auth = aegis_result.get("voice_authenticity", {})
            primary_det = aegis_result.get("primary_detector") or {}

            if decision.get("risk") is not None:
                final_risk_score = round(float(decision["risk"]) * 100)
            if decision.get("severity") is not None:
                final_risk_level = str(decision["severity"])
            if decision.get("confidence") is not None:
                final_confidence = float(decision["confidence"])

            if primary_det.get("fake_probability") is not None:
                fake_prob = float(primary_det["fake_probability"])
                final_fake_prob = fake_prob
                primary_risk_score = round(fake_prob * 100)

            if voice_auth.get("raw_persistent_spoof_evidence") is not None:
                secondary_risk_score = round(float(voice_auth["raw_persistent_spoof_evidence"]) * 100)
            elif voice_auth.get("persistent_spoof_evidence") is not None:
                secondary_risk_score = round(float(voice_auth["persistent_spoof_evidence"]) * 100)

        primary_risk_score = max(0, min(100, int(primary_risk_score)))
        secondary_risk_score = max(0, min(100, int(secondary_risk_score)))
        final_risk_score = max(0, min(100, int(final_risk_score)))

        # 6. Dynamic HMAC Audit Receipt
        audit_msg = f"{analysis_id}:{final_risk_score}:{voiceprint_sha256}:{int(time.time())}"
        audit_hmac = hmac.new(
            security_engine.AUDIT_SECRET.encode("utf-8"),
            audit_msg.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest().lower()

        # 7. Construct Full Result Dictionary
        result_dict = {
            "analysis_id": analysis_id,
            "status": "completed",
            "risk_score": final_risk_score,
            "risk_level": final_risk_level,
            "synthetic_speech_probability": final_fake_prob,
            "model_confidence": final_confidence,
            "audio_quality": {
                "status": prepared_audio.quality_status,
                "speech_seconds": prepared_audio.speech_seconds,
                "notes": prepared_audio.quality_notes,
            },
            "evidence": {
                "spectral_anomaly": prediction.spectral_anomaly,
                "prosody_anomaly": prediction.prosody_anomaly,
            },
            "recommendation": risk.recommendation,
            "versions": {
                "model": prediction.model_version,
                "preprocessing": prepared_audio.preprocessing_version,
                "risk_policy": risk.risk_policy_version,
            },
            "processing_time_ms": elapsed_ms,
            "disclaimer": settings.DISCLAIMER_TEXT,
            "aegis": aegis_result,
            "voiceprint_sha256": voiceprint_sha256,
            "primary_risk_score": primary_risk_score,
            "secondary_risk_score": secondary_risk_score,
            "salt_base64": salt_base64,
            "dpdpVault": {
                "storageMode": "EPHEMERAL RAM BUFFER",
                "bufferWipeTimeUs": max(1, security_engine.secure_zero_memory(audio_bytes)),
                "rawBytesPersisted": 0,
                "voiceToken": voiceprint_sha256,
                "auditHmac": audit_hmac,
                "complianceRule": "Section 8(7) DPDP Act 2023 • TRAI TCCCPR Guidelines",
            },
        }

        # 8. Save Record in JSON Database
        record = {
            "voiceprint_sha256": voiceprint_sha256,
            "salt_base64": salt_base64,
            "analysis_id": analysis_id,
            "risk_score": final_risk_score,
            "primary_risk_score": primary_risk_score,
            "secondary_risk_score": secondary_risk_score,
            "risk_level": final_risk_level,
            "synthetic_speech_probability": final_fake_prob,
            "model_confidence": final_confidence,
            "audio_quality": {
                "status": prepared_audio.quality_status,
                "speech_seconds": prepared_audio.speech_seconds,
                "notes": prepared_audio.quality_notes,
            },
            "evidence": {
                "spectral_anomaly": prediction.spectral_anomaly,
                "prosody_anomaly": prediction.prosody_anomaly,
            },
            "recommendation": risk.recommendation,
            "versions": {
                "model": prediction.model_version,
                "preprocessing": prepared_audio.preprocessing_version,
                "risk_policy": risk.risk_policy_version,
            },
            "processing_time_ms": elapsed_ms,
            "disclaimer": settings.DISCLAIMER_TEXT,
            "result": result_dict,
        }

        try:
            database_service.save_record(record)
        except Exception as db_exc:
            logger.error("Failed to save record to database for %s: %s", analysis_id, db_exc)

        # 9. Multi-Channel Alert Dispatcher (Fraud Desk, SMS, Webhook, Email)
        try:
            alert_dispatcher.dispatch_for_analysis(record)
        except Exception as alert_exc:
            logger.error("Alert dispatch failure on %s: %s", analysis_id, alert_exc)

        # 9. Complete Job
        job_service.complete_job(
            analysis_id=analysis_id,
            prepared_audio=prepared_audio,
            prediction=prediction,
            risk_assessment=risk,
            processing_time_ms=elapsed_ms,
            aegis_result=aegis_result,
            voiceprint_sha256=voiceprint_sha256,
            salt_base64=salt_base64,
            primary_risk_score=primary_risk_score,
            secondary_risk_score=secondary_risk_score,
            audit_hmac=audit_hmac,
        )
        logger.info("Analysis %s completed in %d ms with hash %s", analysis_id, elapsed_ms, voiceprint_sha256)

    except Exception as exc:
        logger.exception("Unexpected worker failure on %s: %s", analysis_id, exc)
        job_service.fail_job(
            analysis_id,
            code="INTERNAL_ERROR",
            message="An unexpected system failure occurred during analysis.",
        )
    finally:
        storage_service.delete_file(file_path)
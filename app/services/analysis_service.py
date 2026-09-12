from __future__ import annotations

import logging
import time
from pathlib import Path

from app.integrations.m1_detector import predict
from app.integrations.m2_audio import preprocess_audio
from app.integrations.m5_risk import calculate_risk
from app.models.domain import AnalysisError, Status
from app.services.job_service import JobStore
from app.services.analysis_database import save_analysis_record
from app.services.storage_service import delete_temporary

logger = logging.getLogger(__name__)
DISCLAIMER = "This is a probabilistic risk estimate based on audio characteristics. It is not proof of fraud, identity, authorship, or authenticity. Elevated-risk results require independent secondary verification."


def run_analysis(analysis_id: str, path: Path, store: JobStore) -> None:
    started = time.perf_counter()
    store.set_status(analysis_id, Status.RUNNING)
    try:
        try:
            prepared = preprocess_audio(path)
        except AnalysisError:
            raise
        except Exception as exc:
            raise AnalysisError("PREPROCESSING_FAILED", "Audio preprocessing could not be completed safely.") from exc
        try:
            prediction = predict(prepared)
        except AnalysisError:
            raise
        except Exception as exc:
            raise AnalysisError("INFERENCE_FAILED", "Model inference could not be completed safely.") from exc
        try:
            assessment = calculate_risk(prediction, prepared)
        except AnalysisError:
            raise
        except Exception as exc:
            raise AnalysisError("RISK_SCORING_FAILED", "Risk scoring could not be completed safely.") from exc
        result = {
            "analysis_id": analysis_id, "status": "completed", "risk_score": assessment.risk_score,
            "risk_level": assessment.risk_level, "synthetic_speech_probability": prediction.synthetic_probability,
            "model_confidence": prediction.model_confidence,
            "audio_quality": {"status": prepared.quality_status, "speech_seconds": round(prepared.speech_seconds, 2), "notes": prepared.quality_notes + assessment.notes},
            "evidence": prediction.indicators, "recommendation": assessment.recommendation,
            "versions": {"model": prediction.model_version, "preprocessing": prepared.preprocessing_version, "risk_policy": assessment.risk_policy_version},
            "processing_time_ms": round((time.perf_counter() - started) * 1000), "disclaimer": DISCLAIMER,
        }
        cryptography = save_analysis_record(result, prepared.waveform)
        result["dpdpVault"] = {"voiceToken": cryptography["voice_token"], "auditHmac": cryptography["audit_hmac"]}
        store.complete(analysis_id, result)
        logger.info("analysis_completed analysis_id=%s", analysis_id)
    except AnalysisError as exc:
        store.fail(analysis_id, exc.code, exc.message)
        logger.info("analysis_failed analysis_id=%s code=%s", analysis_id, exc.code)
    except Exception:
        store.fail(analysis_id, "INFERENCE_FAILED", "Analysis could not be completed safely.")
        logger.exception("analysis_failed analysis_id=%s", analysis_id)
    finally:
        delete_temporary(path)

from __future__ import annotations

import asyncio
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.integrations.m1_detector import predict
from app.integrations.m5_risk import calculate_risk
from app.models.domain import AnalysisError, AnalysisJob, PreparedAudio, Status
from app.schemas.responses import AcceptedResponse, CompletedResponse, FailedResponse, HealthResponse, PendingResponse
from app.services.analysis_service import run_analysis
from app.services.job_service import job_store
from app.services.storage_service import delete_temporary, safe_filename, save_temporarily
from app.services.validation_service import validate_upload_hint
from app.integrations.m2_audio import preprocess_audio

router = APIRouter()
LIVE_SAMPLE_RATE = 16000
LIVE_SAMPLE_WIDTH = 2
LIVE_BUFFER_BYTES = LIVE_SAMPLE_RATE * LIVE_SAMPLE_WIDTH * 2


def _http_error(error: AnalysisError) -> HTTPException:
    status = 413 if error.code == "FILE_TOO_LARGE" else 422
    return HTTPException(status_code=status, detail={"code": error.code, "message": error.message})


@router.get("/health", response_model=HealthResponse)
def health() -> dict:
    return {"status": "ok", "versions": {"model": settings.model_version, "preprocessing": settings.preprocessing_version, "risk_policy": settings.risk_policy_version}}


@router.websocket("/ws/voice-detect")
async def voice_detect(websocket: WebSocket) -> None:
    await websocket.accept()
    buffer = bytearray()
    try:
        await websocket.send_json({"status": "CONNECTED", "sample_rate": LIVE_SAMPLE_RATE, "buffer_seconds": 2})
        while True:
            chunk = await websocket.receive_bytes()
            buffer.extend(chunk)
            if len(buffer) < LIVE_BUFFER_BYTES:
                await websocket.send_json({"status": "BUFFERING", "buffered_seconds": round(len(buffer) / (LIVE_SAMPLE_RATE * LIVE_SAMPLE_WIDTH), 2)})
                continue

            raw_audio = bytes(buffer[-LIVE_BUFFER_BYTES:])
            prepared = PreparedAudio(
                waveform=raw_audio,
                sample_rate=LIVE_SAMPLE_RATE,
                duration_seconds=2.0,
                speech_seconds=2.0,
                quality_status="suitable",
                quality_notes=[],
                preprocessing_version=settings.preprocessing_version,
                sample_width=LIVE_SAMPLE_WIDTH,
            )
            prediction = await asyncio.to_thread(predict, prepared)
            assessment = calculate_risk(prediction, prepared)
            await websocket.send_json({
                "status": "STREAMING",
                "risk_score": assessment.risk_score,
                "risk_level": assessment.risk_level,
                "synthetic_speech_probability": prediction.synthetic_probability,
                "model_confidence": prediction.model_confidence,
                "audio_quality": {"status": prepared.quality_status, "speech_seconds": prepared.speech_seconds, "notes": assessment.notes},
                "evidence": prediction.indicators,
                "recommendation": assessment.recommendation,
            })
    except WebSocketDisconnect:
        return
    except AnalysisError as exc:
        await websocket.send_json({"status": "ERROR", "code": exc.code, "message": exc.message})
        await websocket.close(code=1011)


@router.post("/api/v1/analyses", response_model=AcceptedResponse, status_code=202)
async def create_analysis(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    experiment_id: str | None = Form(default=None, max_length=100),
    language: str | None = Form(default=None, max_length=32),
) -> dict:
    analysis_id = str(uuid4())
    try:
        validate_upload_hint(file)
        path = await save_temporarily(file, analysis_id)
        # Reject unreadable, too-long, too-short, and silent uploads before accepting a job.
        preprocess_audio(path)
    except AnalysisError as exc:
        if "path" in locals():
            delete_temporary(path)
        raise _http_error(exc)
    finally:
        await file.close()
    job_store.add(AnalysisJob(analysis_id, Status.QUEUED, safe_filename(file.filename), experiment_id, language))
    background_tasks.add_task(run_analysis, analysis_id, path, job_store)
    return {"analysis_id": analysis_id, "status": "queued", "message": "Audio accepted for analysis."}


@router.get("/api/v1/analyses/{analysis_id}", response_model=PendingResponse | CompletedResponse | FailedResponse)
def get_analysis(analysis_id: str) -> dict:
    job = job_store.get(analysis_id)
    if job is None:
        raise HTTPException(status_code=404, detail={"code": "ANALYSIS_NOT_FOUND", "message": "No analysis exists for this ID."})
    if job.status in (Status.QUEUED, Status.RUNNING):
        return {"analysis_id": job.analysis_id, "status": job.status.value}
    if job.status == Status.FAILED:
        return {"analysis_id": job.analysis_id, "status": "failed", "error": job.error}
    return job.result or {"analysis_id": job.analysis_id, "status": "failed", "error": {"code": "INFERENCE_FAILED", "message": "Analysis result was unavailable."}}

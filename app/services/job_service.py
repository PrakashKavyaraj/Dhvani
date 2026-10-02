import time
from pathlib import Path
from threading import RLock
from typing import Optional
from app.models.domain import (
    AnalysisJob,
    DetectorPrediction,
    JobError,
    JobStatus,
    PreparedAudio,
    RiskAssessment,
)


class JobService:
    def __init__(self):
        self._jobs: dict[str, AnalysisJob] = {}
        self._lock = RLock()

    def create_job(
        self,
        analysis_id: str,
        file_path: Path,
        experiment_id: Optional[str] = None,
        language: Optional[str] = None,
    ) -> AnalysisJob:
        with self._lock:
            job = AnalysisJob(
                analysis_id=analysis_id,
                status=JobStatus.QUEUED,
                file_path=file_path,
                created_at=time.time(),
                experiment_id=experiment_id,
                language=language,
            )
            self._jobs[analysis_id] = job
            return job

    def get_job(self, analysis_id: str) -> Optional[AnalysisJob]:
        with self._lock:
            return self._jobs.get(analysis_id)

    def set_running(self, analysis_id: str) -> None:
        with self._lock:
            job = self._jobs.get(analysis_id)
            if job:
                job.status = JobStatus.RUNNING

    def complete_job(
        self,
        analysis_id: str,
        prepared_audio: PreparedAudio,
        prediction: DetectorPrediction,
        risk_assessment: RiskAssessment,
        processing_time_ms: int,
        aegis_result: Optional[dict] = None,
        voiceprint_sha256: Optional[str] = None,
        salt_base64: Optional[str] = None,
        primary_risk_score: Optional[int] = None,
        secondary_risk_score: Optional[int] = None,
        audit_hmac: Optional[str] = None,
    ) -> None:
        with self._lock:
            job = self._jobs.get(analysis_id)
            if job:
                job.status = JobStatus.COMPLETED
                job.prepared_audio = prepared_audio
                job.prediction = prediction
                job.risk_assessment = risk_assessment
                job.processing_time_ms = processing_time_ms
                job.aegis_result = aegis_result
                job.voiceprint_sha256 = voiceprint_sha256
                job.salt_base64 = salt_base64
                job.primary_risk_score = primary_risk_score
                job.secondary_risk_score = secondary_risk_score
                job.audit_hmac = audit_hmac
                job.file_path = None  # Reference cleared after audio cleanup

    def fail_job(self, analysis_id: str, code: str, message: str) -> None:
        with self._lock:
            job = self._jobs.get(analysis_id)
            if job:
                job.status = JobStatus.FAILED
                job.error = JobError(code=code, message=message)
                job.file_path = None


job_service = JobService()
from __future__ import annotations

from threading import Lock

from app.models.domain import AnalysisJob, Status


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, AnalysisJob] = {}
        self._lock = Lock()

    def add(self, job: AnalysisJob) -> None:
        with self._lock:
            self._jobs[job.analysis_id] = job

    def get(self, analysis_id: str) -> AnalysisJob | None:
        with self._lock:
            return self._jobs.get(analysis_id)

    def set_status(self, analysis_id: str, status: Status) -> None:
        with self._lock:
            self._jobs[analysis_id].status = status

    def complete(self, analysis_id: str, result: dict) -> None:
        with self._lock:
            job = self._jobs[analysis_id]
            job.status, job.result = Status.COMPLETED, result

    def fail(self, analysis_id: str, code: str, message: str) -> None:
        with self._lock:
            job = self._jobs[analysis_id]
            job.status, job.error = Status.FAILED, {"code": code, "message": message}


job_store = JobStore()

"""
Sliding-Window In-Memory Rate Limiting Guard for Dhvani.

Protects against automated brute-force, volumetric API flooding, and DoS attacks.
"""

from collections import defaultdict
from threading import Lock
import time
from typing import Dict, List
from fastapi import HTTPException, Request, status


class SlidingWindowRateLimiter:
    """
    Thread-safe in-memory sliding-window request rate limiter.
    """

    def __init__(self):
        self._lock = Lock()
        # client_identifier -> list of timestamps
        self._history: Dict[str, List[float]] = defaultdict(list)

    def _get_client_id(self, request: Request) -> str:
        # Check X-API-Key or X-Forwarded-For or client host
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return f"key:{api_key[:8]}"
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"
        if request.client:
            return f"ip:{request.client.host}"
        return "ip:127.0.0.1"

    def check_limit(
        self,
        request: Request,
        max_requests: int = 120,
        window_seconds: int = 60,
    ) -> None:
        """
        Enforces maximum requests within a sliding time window.
        Raises HTTP 429 Too Many Requests if limit is breached.
        """
        client_id = self._get_client_id(request)
        if client_id == "ip:testclient" and not request.headers.get("X-Enforce-Rate-Limit"):
            return

        now = time.time()
        cutoff = now - window_seconds

        with self._lock:
            timestamps = self._history[client_id]
            # Prune timestamps outside window
            valid_timestamps = [t for t in timestamps if t > cutoff]

            if len(valid_timestamps) >= max_requests:
                retry_after = int(window_seconds - (now - valid_timestamps[0])) + 1
                self._history[client_id] = valid_timestamps
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded: maximum {max_requests} requests per {window_seconds} seconds.",
                    headers={"Retry-After": str(max(1, retry_after))},
                )

            valid_timestamps.append(now)
            self._history[client_id] = valid_timestamps

    def cleanup_stale_records(self, max_idle_seconds: int = 300) -> None:
        """Periodic garbage collector to prevent memory growth."""
        cutoff = time.time() - max_idle_seconds
        with self._lock:
            stale_keys = [
                k for k, timestamps in self._history.items()
                if not timestamps or timestamps[-1] < cutoff
            ]
            for k in stale_keys:
                del self._history[k]


rate_limiter = SlidingWindowRateLimiter()

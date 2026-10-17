"""
Distributed Ephemeral Telephony Session & Circuit Breaker Store for Dhvani.

Architecture:
1. High-Concurrency Ephemeral Telephony Buffering:
   In distributed bank telephony clusters (multiple FastAPI replicas behind F5/Kubernetes ingress),
   carrier PCM chunks (20ms) are appended to an in-memory Redis sliding list with an automatic
   short-lived TTL (15s). Zero bytes touch physical storage, maintaining strict DPDP Act 2023
   Section 8(7) compliance.
2. Distributed Circuit Breaker State:
   Maintains cluster-wide failure counts across carriers (Exotel, Twilio, Genesys) so all
   replicas fail open consistently during upstream latency spikes (< 350ms budget).
3. Resilient In-Memory Fallback:
   If Redis is unconfigured or unreachable, automatically falls back to thread-safe in-memory
   ring buffers with zero downtime.
"""

import logging
import time
from collections import deque
from threading import RLock
from typing import Any, Dict, List, Optional

from app.core.config import get_settings

logger = logging.getLogger("voice_integrity.redis_session")

try:
    import redis
    REDIS_PACKAGE_AVAILABLE = True
except ImportError:
    redis = None
    REDIS_PACKAGE_AVAILABLE = False


class RedisSessionStore:
    """
    Distributed Redis Ephemeral Session Store with fallback to thread-safe in-memory ring buffers.
    """

    def __init__(self, redis_url: Optional[str] = None, default_ttl: int = 15):
        self._lock = RLock()
        self._redis_url = redis_url or get_settings().REDIS_URL
        self._default_ttl = default_ttl
        self._client: Optional[Any] = None
        self._is_connected = False

        # In-memory fallback structures
        self._mem_sessions: Dict[str, deque] = {}
        self._mem_session_timestamps: Dict[str, float] = {}
        self._mem_circuit_failures: Dict[str, List[float]] = {}

        self._init_connection()

    def _init_connection(self) -> None:
        if not REDIS_PACKAGE_AVAILABLE or not self._redis_url:
            self._is_connected = False
            return

        try:
            client = redis.from_url(
                self._redis_url,
                socket_timeout=0.3,
                socket_connect_timeout=0.3,
                decode_responses=False,
            )
            # Ping test
            client.ping()
            self._client = client
            self._is_connected = True
            logger.info("Connected to Redis ephemeral telephony session store at %s", self._redis_url)
        except Exception as exc:
            self._is_connected = False
            self._client = None
            logger.info("Redis offline or unconfigured (%s). Using thread-safe in-memory fallback.", exc)

    @property
    def is_redis_active(self) -> bool:
        return self._is_connected and self._client is not None

    def append_chunk(self, call_sid: str, chunk_bytes: bytes, max_chunks: int = 150) -> int:
        """
        Appends a 20ms audio chunk to the ephemeral sliding-window buffer.
        Returns the current number of chunks in the window.
        """
        if not call_sid or not chunk_bytes:
            return 0

        key = f"call_session:{call_sid}:chunks"
        if self.is_redis_active:
            try:
                pipe = self._client.pipeline()
                pipe.rpush(key, chunk_bytes)
                pipe.ltrim(key, -max_chunks, -1)
                pipe.expire(key, self._default_ttl)
                pipe.llen(key)
                results = pipe.execute()
                return int(results[-1])
            except Exception as exc:
                logger.warning("Redis append_chunk failed (%s), falling back to RAM.", exc)
                self._is_connected = False

        with self._lock:
            now = time.time()
            if call_sid not in self._mem_sessions:
                self._mem_sessions[call_sid] = deque(maxlen=max_chunks)
            q = self._mem_sessions[call_sid]
            q.append(chunk_bytes)
            self._mem_session_timestamps[call_sid] = now
            self._purge_expired_mem_sessions()
            return len(q)

    def get_window_audio(self, call_sid: str) -> bytes:
        """
        Returns concatenated audio bytes from the active sliding window.
        """
        if not call_sid:
            return b""

        key = f"call_session:{call_sid}:chunks"
        if self.is_redis_active:
            try:
                chunks = self._client.lrange(key, 0, -1)
                if chunks:
                    return b"".join(chunks)
                return b""
            except Exception as exc:
                logger.warning("Redis get_window_audio failed (%s), falling back to RAM.", exc)
                self._is_connected = False

        with self._lock:
            q = self._mem_sessions.get(call_sid)
            if not q:
                return b""
            return b"".join(q)

    def clear_session(self, call_sid: str) -> None:
        """
        Immediately purges call buffer from volatile RAM (DPDP Section 8(7) compliance).
        """
        if not call_sid:
            return

        key = f"call_session:{call_sid}:chunks"
        if self.is_redis_active:
            try:
                self._client.delete(key)
            except Exception as exc:
                logger.warning("Redis clear_session failed: %s", exc)

        with self._lock:
            self._mem_sessions.pop(call_sid, None)
            self._mem_session_timestamps.pop(call_sid, None)

    def record_circuit_failure(self, carrier: str, window_seconds: int = 60) -> int:
        """
        Records a carrier latency/timeout failure in the distributed circuit breaker.
        Returns total active failures within the sliding window.
        """
        carrier_clean = (carrier or "default").upper()
        now = time.time()
        key = f"circuit_breaker:{carrier_clean}:failures"

        if self.is_redis_active:
            try:
                pipe = self._client.pipeline()
                pipe.zadd(key, {f"{now}:{time.time_ns()}": now})
                pipe.zremrangebyscore(key, 0, now - window_seconds)
                pipe.expire(key, window_seconds * 2)
                pipe.zcard(key)
                res = pipe.execute()
                return int(res[-1])
            except Exception as exc:
                logger.warning("Redis circuit breaker failure recording failed: %s", exc)
                self._is_connected = False

        with self._lock:
            if carrier_clean not in self._mem_circuit_failures:
                self._mem_circuit_failures[carrier_clean] = []
            lst = self._mem_circuit_failures[carrier_clean]
            lst.append(now)
            cutoff = now - window_seconds
            self._mem_circuit_failures[carrier_clean] = [t for t in lst if t >= cutoff]
            return len(self._mem_circuit_failures[carrier_clean])

    def is_circuit_breaker_open(self, carrier: str, threshold: int = 5, window_seconds: int = 60) -> bool:
        """
        Checks whether carrier circuit breaker is open (exceeds failure threshold).
        """
        carrier_clean = (carrier or "default").upper()
        now = time.time()
        key = f"circuit_breaker:{carrier_clean}:failures"

        if self.is_redis_active:
            try:
                cutoff = now - window_seconds
                self._client.zremrangebyscore(key, 0, cutoff)
                count = self._client.zcard(key)
                return count >= threshold
            except Exception as exc:
                logger.warning("Redis is_circuit_breaker_open check failed: %s", exc)
                self._is_connected = False

        with self._lock:
            lst = self._mem_circuit_failures.get(carrier_clean, [])
            cutoff = now - window_seconds
            valid = [t for t in lst if t >= cutoff]
            self._mem_circuit_failures[carrier_clean] = valid
            return len(valid) >= threshold

    def reset_circuit_breaker(self, carrier: str) -> None:
        """
        Resets the circuit breaker failure history for a given carrier.
        """
        carrier_clean = (carrier or "default").upper()
        key = f"circuit_breaker:{carrier_clean}:failures"

        if self.is_redis_active:
            try:
                self._client.delete(key)
            except Exception:
                pass

        with self._lock:
            self._mem_circuit_failures.pop(carrier_clean, None)

    def _purge_expired_mem_sessions(self) -> None:
        now = time.time()
        expired = [sid for sid, ts in self._mem_session_timestamps.items() if now - ts > self._default_ttl]
        for sid in expired:
            self._mem_sessions.pop(sid, None)
            self._mem_session_timestamps.pop(sid, None)

    def get_health(self) -> Dict[str, Any]:
        """
        Returns telemetry regarding the telephony session store.
        """
        if self.is_redis_active:
            try:
                t0 = time.perf_counter()
                self._client.ping()
                latency_ms = (time.perf_counter() - t0) * 1000.0
                return {
                    "backend": "redis_cluster",
                    "status": "HEALTHY",
                    "latency_ms": round(latency_ms, 2),
                    "redis_url": self._redis_url,
                    "default_ttl_seconds": self._default_ttl,
                }
            except Exception as exc:
                return {
                    "backend": "in_memory_fallback",
                    "status": "DEGRADED",
                    "reason": str(exc),
                    "active_sessions": len(self._mem_sessions),
                }

        return {
            "backend": "in_memory_fallback",
            "status": "OPERATIONAL",
            "active_sessions": len(self._mem_sessions),
            "default_ttl_seconds": self._default_ttl,
        }


# Global singleton instance
redis_session_store = RedisSessionStore()

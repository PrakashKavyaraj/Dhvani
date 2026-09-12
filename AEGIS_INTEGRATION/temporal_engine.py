
from typing import Dict, Any, List, Optional
from collections import deque
import numpy as np


class TemporalEvidenceEngine:
    """
    Availability-aware temporal evidence aggregator.

    IMPORTANT SECURITY SEMANTICS:

        AVAILABLE + low evidence  -> evidence of safety
        AVAILABLE + high evidence -> evidence of threat
        NOT_AVAILABLE             -> UNKNOWN

    Missing detectors are NEVER interpreted as benign evidence.

    The engine aggregates evidence over successive observations
    during a voice session.

    Evidence channels:
        - voice authenticity / spoof
        - speaker identity
        - conversation behavior
        - replay detection
    """

    def __init__(
        self,
        window_size: int = 8,
        decay: float = 0.85,
        critical_threshold: float = 0.80,
        high_threshold: float = 0.60,
        medium_threshold: float = 0.35,
    ):

        self.window_size = int(window_size)
        self.decay = float(decay)

        self.critical_threshold = float(
            critical_threshold
        )
        self.high_threshold = float(
            high_threshold
        )
        self.medium_threshold = float(
            medium_threshold
        )

        self.history = deque(
            maxlen=self.window_size
        )

    # --------------------------------------------------------
    # Session management
    # --------------------------------------------------------

    def reset(self):
        self.history.clear()

    def get_history(self) -> List[Dict[str, Any]]:
        return list(self.history)

    # --------------------------------------------------------
    # Helpers
    # --------------------------------------------------------

    @staticmethod
    def _clip(value: float) -> float:
        return float(
            np.clip(value, 0.0, 1.0)
        )

    @staticmethod
    def _available(value, status=None) -> bool:
        """
        Determine whether a signal is actually available.

        Explicit status values take precedence.
        """

        if status is not None:
            return str(status).upper() == "AVAILABLE"

        return value is not None

    # --------------------------------------------------------
    # Instantaneous evidence
    # --------------------------------------------------------

    def _instant_evidence(
        self,
        spoof_score: Optional[float],
        speaker_similarity: Optional[float],
        conversation_risk: Optional[float],
        replay_score: Optional[float],
        spoof_available: bool,
        identity_available: bool,
        conversation_available: bool,
        replay_available: bool,
    ):

        components = []
        evidence_details = []

        # -----------------------------------------------
        # Spoof evidence
        # -----------------------------------------------

        if spoof_available and spoof_score is not None:

            spoof = self._clip(
                spoof_score
            )

            components.append(
                ("spoof", 0.35, spoof)
            )

            if spoof >= 0.80:
                evidence_details.append(
                    "strong synthetic/spoofing evidence"
                )

        # -----------------------------------------------
        # Identity evidence
        # -----------------------------------------------

        if (
            identity_available
            and speaker_similarity is not None
        ):

            similarity = self._clip(
                speaker_similarity
            )

            identity_risk = (
                1.0 - similarity
            )

            components.append(
                ("identity", 0.25, identity_risk)
            )

            if identity_risk >= 0.60:
                evidence_details.append(
                    "weak speaker identity match"
                )

        # -----------------------------------------------
        # Conversation evidence
        # -----------------------------------------------

        if (
            conversation_available
            and conversation_risk is not None
        ):

            conversation = self._clip(
                conversation_risk
            )

            components.append(
                ("conversation", 0.25, conversation)
            )

            if conversation >= 0.60:
                evidence_details.append(
                    "high-risk conversational behavior"
                )

        # -----------------------------------------------
        # Replay evidence
        # -----------------------------------------------

        if (
            replay_available
            and replay_score is not None
        ):

            replay = self._clip(
                replay_score
            )

            components.append(
                ("replay", 0.15, replay)
            )

            if replay >= 0.60:
                evidence_details.append(
                    "replay evidence"
                )

        # -----------------------------------------------
        # No evidence available
        # -----------------------------------------------

        if not components:
            return {
                "evidence_score": 0.0,
                "coverage": 0.0,
                "strong_signal_count": 0,
                "evidence": [],
                "available_signals": [],
                "unknown_signals": [
                    "spoof",
                    "identity",
                    "conversation",
                    "replay",
                ],
            }

        # -----------------------------------------------
        # Renormalize ONLY over available evidence.
        #
        # Missing channels do not become zero.
        # -----------------------------------------------

        total_weight = sum(
            weight
            for _, weight, _ in components
        )

        evidence_score = sum(
            weight * value
            for _, weight, value in components
        ) / total_weight

        # -----------------------------------------------
        # Corroboration
        # -----------------------------------------------

        strong_signal_count = 0

        for _, _, value in components:
            if value >= 0.60:
                strong_signal_count += 1

        if strong_signal_count >= 3:
            evidence_score += 0.20

        elif strong_signal_count >= 2:
            evidence_score += 0.08

        evidence_score = self._clip(
            evidence_score
        )

        available_signals = [
            name
            for name, _, _ in components
        ]

        all_signals = {
            "spoof",
            "identity",
            "conversation",
            "replay",
        }

        unknown_signals = sorted(
            all_signals
            -
            set(available_signals)
        )

        coverage = float(
            total_weight / 1.0
        )

        return {
            "evidence_score": evidence_score,
            "coverage": self._clip(coverage),
            "strong_signal_count": strong_signal_count,
            "evidence": evidence_details,
            "available_signals": available_signals,
            "unknown_signals": unknown_signals,
        }

    # --------------------------------------------------------
    # Temporal aggregation
    # --------------------------------------------------------

    def _temporal_risk(self):

        if not self.history:
            return 0.0

        values = np.asarray(
            [
                item["evidence_score"]
                for item in self.history
            ],
            dtype=np.float32,
        )

        weights = np.asarray(
            [
                self.decay ** (
                    len(values) - 1 - i
                )
                for i in range(len(values))
            ],
            dtype=np.float32,
        )

        risk = float(
            np.sum(values * weights)
            /
            np.sum(weights)
        )

        return self._clip(risk)

    # --------------------------------------------------------
    # Evidence coverage
    # --------------------------------------------------------

    def _coverage(self):

        if not self.history:
            return 0.0

        values = [
            item["coverage"]
            for item in self.history
        ]

        return float(
            np.mean(values)
        )

    # --------------------------------------------------------
    # Confidence
    # --------------------------------------------------------

    def _confidence(self):

        if not self.history:
            return 0.0

        n = len(self.history)

        observation_confidence = min(
            1.0,
            n / float(self.window_size)
        )

        values = np.asarray(
            [
                item["evidence_score"]
                for item in self.history
            ],
            dtype=np.float32,
        )

        if len(values) <= 1:
            stability = 0.5
        else:
            stability = float(
                np.clip(
                    1.0 - values.std() / 0.30,
                    0.0,
                    1.0,
                )
            )

        coverage = self._coverage()

        confidence = (
            0.45 * observation_confidence
            +
            0.30 * stability
            +
            0.25 * coverage
        )

        return self._clip(
            confidence
        )

    # --------------------------------------------------------
    # Trend
    # --------------------------------------------------------

    def _trend(self):

        if len(self.history) < 2:
            return "STABLE"

        previous = self.history[-2][
            "evidence_score"
        ]

        current = self.history[-1][
            "evidence_score"
        ]

        delta = current - previous

        if delta > 0.03:
            return "RISING"

        if delta < -0.03:
            return "FALLING"

        return "STABLE"

    # --------------------------------------------------------
    # Severity
    # --------------------------------------------------------

    def _severity(self, risk):

        if risk >= self.critical_threshold:
            return "CRITICAL"

        if risk >= self.high_threshold:
            return "HIGH"

        if risk >= self.medium_threshold:
            return "MEDIUM"

        if risk >= 0.15:
            return "LOW"

        return "MINIMAL"

    # --------------------------------------------------------
    # Security policy
    # --------------------------------------------------------

    def _action(
        self,
        severity: str,
        spoof_available: bool,
        spoof_score: Optional[float],
    ):

        # Strong persistent spoof evidence must never
        # silently become ALLOW merely because other
        # detectors are unavailable.

        if (
            spoof_available
            and spoof_score is not None
            and spoof_score >= 0.90
        ):
            return "VERIFY"

        if severity == "CRITICAL":
            return "BLOCK"

        if severity in {
            "HIGH",
            "MEDIUM",
        }:
            return "VERIFY"

        return "ALLOW"

    # --------------------------------------------------------
    # Public API
    # --------------------------------------------------------

    def update(
        self,
        timestamp: float,

        spoof_score: Optional[float] = None,
        speaker_similarity: Optional[float] = None,
        conversation_risk: Optional[float] = None,
        replay_score: Optional[float] = None,

        spoof_available: bool = False,
        identity_available: bool = False,
        conversation_available: bool = False,
        replay_available: bool = False,
    ):

        instant = self._instant_evidence(
            spoof_score=spoof_score,
            speaker_similarity=speaker_similarity,
            conversation_risk=conversation_risk,
            replay_score=replay_score,

            spoof_available=spoof_available,
            identity_available=identity_available,
            conversation_available=conversation_available,
            replay_available=replay_available,
        )

        self.history.append(
            {
                "timestamp": float(timestamp),

                "spoof_score": spoof_score,
                "speaker_similarity": speaker_similarity,
                "conversation_risk": conversation_risk,
                "replay_score": replay_score,

                "evidence_score": instant[
                    "evidence_score"
                ],

                "coverage": instant[
                    "coverage"
                ],

                "available_signals": instant[
                    "available_signals"
                ],

                "unknown_signals": instant[
                    "unknown_signals"
                ],
            }
        )

        risk = self._temporal_risk()
        confidence = self._confidence()
        trend = self._trend()
        severity = self._severity(risk)

        action = self._action(
            severity=severity,
            spoof_available=spoof_available,
            spoof_score=spoof_score,
        )

        return {
            "timestamp": float(timestamp),

            "overall_risk": risk,

            "confidence": confidence,

            "severity": severity,

            "risk_trend": trend,

            "recommended_action": action,

            "current_evidence": {
                "spoof_score": spoof_score,
                "speaker_similarity": speaker_similarity,
                "conversation_risk": conversation_risk,
                "replay_score": replay_score,
            },

            "evidence": instant[
                "evidence"
            ],

            "available_signals": instant[
                "available_signals"
            ],

            "unknown_signals": instant[
                "unknown_signals"
            ],

            "evidence_coverage": instant[
                "coverage"
            ],

            "windows_observed": len(
                self.history
            ),
        }

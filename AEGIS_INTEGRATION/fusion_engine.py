
from typing import Dict, Any, Optional
import numpy as np


class AEGISFusionEngine:
    """
    Multimodal evidence fusion layer.

    This is intentionally NOT a trained ML classifier.

    It combines independent security evidence while preserving
    the distinction between:

        AVAILABLE
        NOT_AVAILABLE
        UNKNOWN

    Inputs:
        - synthetic/spoof evidence
        - speaker identity evidence
        - conversation risk
        - replay evidence
        - temporal risk
        - confidence / reliability

    Output:
        standardized AEGIS security decision.

    The final action is policy-controlled and should not be
    confused with the probability emitted by any individual
    detector.
    """

    WEIGHTS = {
        "spoof": 0.30,
        "identity": 0.25,
        "conversation": 0.25,
        "replay": 0.20,
    }

    def __init__(
        self,
        critical_threshold: float = 0.80,
        high_threshold: float = 0.60,
        medium_threshold: float = 0.35,
    ):

        self.critical_threshold = float(
            critical_threshold
        )

        self.high_threshold = float(
            high_threshold
        )

        self.medium_threshold = float(
            medium_threshold
        )

    # --------------------------------------------------------
    # Helpers
    # --------------------------------------------------------

    @staticmethod
    def _clip(
        value: float
    ) -> float:

        return float(
            np.clip(
                value,
                0.0,
                1.0,
            )
        )

    @staticmethod
    def _identity_risk(
        similarity: float
    ) -> float:

        return float(
            np.clip(
                1.0 - similarity,
                0.0,
                1.0,
            )
        )

    # --------------------------------------------------------
    # Fusion
    # --------------------------------------------------------

    def _available_components(
        self,
        spoof_score,
        speaker_similarity,
        conversation_risk,
        replay_score,

        spoof_available,
        identity_available,
        conversation_available,
        replay_available,
    ):

        components = []

        if (
            spoof_available
            and spoof_score is not None
        ):

            components.append(
                (
                    "spoof",
                    self.WEIGHTS["spoof"],
                    self._clip(
                        spoof_score
                    ),
                )
            )

        if (
            identity_available
            and speaker_similarity is not None
        ):

            components.append(
                (
                    "identity",
                    self.WEIGHTS["identity"],
                    self._identity_risk(
                        speaker_similarity
                    ),
                )
            )

        if (
            conversation_available
            and conversation_risk is not None
        ):

            components.append(
                (
                    "conversation",
                    self.WEIGHTS["conversation"],
                    self._clip(
                        conversation_risk
                    ),
                )
            )

        if (
            replay_available
            and replay_score is not None
        ):

            components.append(
                (
                    "replay",
                    self.WEIGHTS["replay"],
                    self._clip(
                        replay_score
                    ),
                )
            )

        return components

    def _base_risk(
        self,
        components,
    ):

        if not components:
            return 0.0

        total_weight = sum(
            weight
            for _, weight, _ in components
        )

        risk = sum(
            weight * value
            for _, weight, value in components
        ) / total_weight

        # Corroboration bonus.
        strong = sum(
            1
            for _, _, value in components
            if value >= 0.60
        )

        if strong >= 3:
            risk += 0.20

        elif strong >= 2:
            risk += 0.10

        return self._clip(
            risk
        )

    # --------------------------------------------------------
    # Severity
    # --------------------------------------------------------

    def _severity(
        self,
        risk,
    ):

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
        risk,
        severity,
        spoof_score,
        spoof_available,
        identity_risk,
        identity_available,
        evidence_count,
        sensor_agreement="NOT_APPLICABLE",
        identity_status: Optional[str] = None,
    ):

        # ----------------------------------------------------
        # Strong multimodal corroboration.
        # ----------------------------------------------------

        if (
            severity == "CRITICAL"
            and evidence_count >= 2
        ):
            return "BLOCK"

        # ----------------------------------------------------
        # Strong persistent synthetic evidence.
        #
        # If identity is also strongly inconsistent, this is
        # enough to justify blocking once policy allows it.
        # ----------------------------------------------------

        if (
            spoof_available
            and spoof_score is not None
            and spoof_score >= 0.95
            and identity_available
            and identity_risk >= 0.60
        ):
            return "BLOCK"

        # ----------------------------------------------------
        # Strong spoof evidence alone.
        #
        # Do not silently allow.
        # ----------------------------------------------------

        if (
            spoof_available
            and spoof_score is not None
            and spoof_score >= 0.90
        ):
            return "VERIFY"

        if severity in {
            "CRITICAL",
            "HIGH",
            "MEDIUM",
        }:
            return "VERIFY"

        # ----------------------------------------------------
        # Rule C: Sensor disagreement requires verification
        # unless complete authenticated identity evidence is present
        # ----------------------------------------------------
        if sensor_agreement == "DISAGREEMENT" and not (
            identity_available
            and identity_risk is not None
            and identity_risk < 0.20
        ):
            return "VERIFY"

        if not identity_available:
            return "VERIFY"

        # ----------------------------------------------------
        # Positive identity authentication:
        # A caller must NOT be treated as authenticated merely because
        # audio appears genuine, spoof is low, or moderate ECAPA similarity exists.
        # If similarity does not meet positive authentication (e.g. BELOW_ENROLLMENT_BASELINE,
        # WEAK_MATCH, or similarity < 0.75 / identity_risk >= 0.25), action must remain VERIFY.
        # ----------------------------------------------------
        if identity_status in {
            "BELOW_ENROLLMENT_BASELINE",
            "WEAK_MATCH",
            "UNKNOWN",
            "NOT_AVAILABLE",
            "DIFFERENT_SPEAKER",
        }:
            return "VERIFY"

        if identity_risk is not None and identity_risk >= 0.25:
            return "VERIFY"

        return "ALLOW"

    # --------------------------------------------------------
    # Public API
    # --------------------------------------------------------

    def fuse(
        self,

        spoof_score: Optional[float] = None,
        speaker_similarity: Optional[float] = None,
        conversation_risk: Optional[float] = None,
        replay_score: Optional[float] = None,

        audio_quality: float = 1.0,

        temporal_risk: Optional[float] = None,
        temporal_confidence: Optional[float] = None,

        identity_status: Optional[str] = None,

        spoof_available: bool = False,
        identity_available: bool = False,
        conversation_available: bool = False,
        replay_available: bool = False,

        primary_spoof: Optional[float] = None,
        secondary_spoof: Optional[float] = None,
        channel_reliability: float = 1.0,
        channel_status: str = "HIGH_FIDELITY",
    ):

        # Resolve primary spoof evidence (Forensics 0.3B)
        if primary_spoof is not None:
            effective_spoof = primary_spoof
        elif spoof_score is not None:
            effective_spoof = spoof_score
            primary_spoof = spoof_score
        else:
            effective_spoof = None

        # Determine sensor agreement between Primary (Forensics 0.3B) and Secondary (AASIST-L)
        sensor_agreement = "NOT_APPLICABLE"
        sensor_agreement_detail = "NO_SECONDARY_DATA"

        if primary_spoof is not None and secondary_spoof is not None:
            p_fake = primary_spoof >= 0.50
            s_fake = secondary_spoof >= 0.50

            if p_fake == s_fake:
                sensor_agreement = "AGREEMENT"
                sensor_agreement_detail = "CONCORDANT_FAKE" if p_fake else "CONCORDANT_REAL"
            else:
                sensor_agreement = "DISAGREEMENT"
                if not p_fake and s_fake:
                    sensor_agreement_detail = "DISAGREE_AASIST_ELEVATED"
                else:
                    sensor_agreement_detail = "DISAGREE_PRIMARY_ELEVATED"

        is_telephony = (channel_status in {"TELEPHONY", "CHANNEL_CONSTRAINED"}) or (channel_reliability < 0.80)

        components = self._available_components(
            effective_spoof,
            speaker_similarity,
            conversation_risk,
            replay_score,

            spoof_available,
            identity_available,
            conversation_available,
            replay_available,
        )

        base_risk = self._base_risk(
            components
        )

        # ----------------------------------------------------
        # Temporal fusion.
        #
        # Temporal risk is evidence about persistence.
        # It is not another independent sensor.
        # ----------------------------------------------------

        if temporal_risk is not None:

            temporal_risk = self._clip(
                temporal_risk
            )

            if components:

                risk = (
                    0.55 * base_risk
                    +
                    0.45 * temporal_risk
                )

            else:
                risk = temporal_risk

        else:
            risk = base_risk

        risk = self._clip(
            risk
        )

        # ----------------------------------------------------
        # Confidence
        # ----------------------------------------------------

        quality = self._clip(
            audio_quality
        )

        # Base audio quality modulated by channel reliability
        effective_quality = self._clip(quality * channel_reliability)

        evidence_coverage = (
            sum(
                weight
                for _, weight, _ in components
            )
            /
            sum(
                self.WEIGHTS.values()
            )
        )

        component_confidence = min(
            1.0,
            len(components) / 2.0
        )

        if temporal_confidence is not None:

            temporal_confidence = self._clip(
                temporal_confidence
            )

            confidence = (
                0.35 * effective_quality
                +
                0.25 * evidence_coverage
                +
                0.20 * component_confidence
                +
                0.20 * temporal_confidence
            )

        else:

            confidence = (
                0.50 * effective_quality
                +
                0.30 * evidence_coverage
                +
                0.20 * component_confidence
            )

        # Rule B: If Forensics 0.3B indicates FAKE and channel is HIGH_FIDELITY,
        # AASIST agreement strengthens confidence
        if (
            primary_spoof is not None
            and primary_spoof >= 0.50
            and not is_telephony
            and secondary_spoof is not None
            and secondary_spoof >= 0.50
        ):
            confidence += 0.08

        confidence = self._clip(
            confidence
        )

        severity = self._severity(
            risk
        )

        identity_risk = None

        if (
            identity_available
            and speaker_similarity is not None
        ):
            identity_risk = (
                self._identity_risk(
                    speaker_similarity
                )
            )

        action = self._action(
            risk=risk,
            severity=severity,

            spoof_score=effective_spoof,
            spoof_available=spoof_available,

            identity_risk=identity_risk,
            identity_available=identity_available,

            evidence_count=len(
                components
            ),
            sensor_agreement=sensor_agreement,
            identity_status=identity_status,
        )

        # ----------------------------------------------------
        # Evidence explanation
        # ----------------------------------------------------

        evidence = []

        # Rule A: If Forensics 0.3B indicates REAL and channel is TELEPHONY, but AASIST is high:
        if (
            primary_spoof is not None
            and primary_spoof < 0.50
            and secondary_spoof is not None
            and secondary_spoof >= 0.50
            and is_telephony
        ):
            evidence.append(
                "Secondary AASIST-L spoof score is discordant with primary detector due to telephony channel acoustic artifacts; downweighted as uncorroborated telemetry."
            )
        elif (
            primary_spoof is not None
            and primary_spoof >= 0.50
            and not is_telephony
            and secondary_spoof is not None
            and secondary_spoof >= 0.50
        ):
            evidence.append(
                "Primary deepfake detector and secondary acoustic model concordantly indicate synthetic speech."
            )
        elif (
            primary_spoof is not None
            and primary_spoof >= 0.50
            and is_telephony
        ):
            # Rule D: FAKE on telephony channel
            evidence.append(
                "Primary detector indicates synthetic speech under channel-constrained audio; acoustic confidence adjusted."
            )
        elif primary_spoof is not None and primary_spoof >= 0.80:
            evidence.append(
                "strong synthetic/spoofing evidence from primary detector"
            )

        # Rule C: Expose sensor disagreement
        if sensor_agreement == "DISAGREEMENT":
            evidence.append(
                f"Acoustic sensor disagreement: primary detector ({primary_spoof:.4f}) vs secondary telemetry ({secondary_spoof:.4f})."
            )

        if (
            identity_available
            and speaker_similarity is not None
        ):

            if speaker_similarity < 0.60:

                evidence.append(
                    "speaker similarity below "
                    "enrollment baseline"
                )

            elif speaker_similarity < 0.75:

                evidence.append(
                    "speaker identity match is weak"
                )

        if (
            conversation_available
            and conversation_risk is not None
            and conversation_risk >= 0.60
        ):
            evidence.append(
                "high-risk conversational behavior"
            )

        if (
            replay_available
            and replay_score is not None
            and replay_score >= 0.60
        ):
            evidence.append(
                "replay evidence"
            )

        availability = {
            "voice_authenticity": (
                "AVAILABLE"
                if spoof_available
                else "NOT_AVAILABLE"
            ),

            "speaker_identity": (
                "AVAILABLE"
                if identity_available
                else "NOT_AVAILABLE"
            ),

            "conversation": (
                "AVAILABLE"
                if conversation_available
                else "NOT_AVAILABLE"
            ),

            "replay": (
                "AVAILABLE"
                if replay_available
                else "NOT_AVAILABLE"
            ),
        }

        return {

            "action": action,

            "recommended_action": action,

            "risk": risk,

            "risk_percent": risk * 100.0,

            "confidence": confidence,

            "confidence_percent":
                confidence * 100.0,

            "severity": severity,

            "sensor_agreement": sensor_agreement,

            "sensor_agreement_detail": sensor_agreement_detail,

            "fusion_mode": (
                "multimodal_temporal"
                if temporal_risk is not None
                else "multimodal"
            ),

            "signals": {
                "spoof_score":
                    effective_spoof,

                "primary_spoof":
                    primary_spoof,

                "secondary_spoof":
                    secondary_spoof,

                "speaker_similarity":
                    speaker_similarity,

                "identity_risk":
                    identity_risk,

                "conversation_risk":
                    conversation_risk,

                "replay_score":
                    replay_score,

                "audio_quality":
                    quality,

                "channel_reliability":
                    channel_reliability,
            },

            "availability": availability,

            "evidence_coverage":
                evidence_coverage,

            "active_components":
                [
                    name
                    for name, _, _
                    in components
                ],

            "evidence": evidence,

            "temporal": {
                "risk": temporal_risk,
                "confidence":
                    temporal_confidence,
            },

            "identity_status":
                identity_status,

            "evidence_count":
                len(components),
        }

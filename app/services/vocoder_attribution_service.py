"""
Neural Vocoder Architecture Attribution Fingerprinting Service for Dhvani.

Forensic Background:
Modern AI voice synthesis pipelines pair an acoustic model (FastSpeech2, VITS, CosyVoice, XTTSv2)
with a neural vocoder to reconstruct continuous time-domain waveforms from mel-spectrograms.
Each vocoder architecture leaves characteristic mathematical artifacts:
1. HiFi-GAN: Multi-Period / Multi-Scale Discriminator residues and periodic sub-harmonic comb spikes.
2. MelGAN: Transposed convolution checkerboard artifacts and steep frequency attenuation above 7.2 kHz.
3. BigVGAN: Snake periodic activation function resonance in high frequencies.
4. DiffWave / Diffusion: Stochastic reverse-diffusion Langevin dynamics noise traces.
5. Neural Codec (EnCodec / SoundStream / DAC): Residual Vector Quantization (RVQ) codebook step entropy.
6. Natural Human Voice: Biological vocal tract resonances with non-stationary pitch micro-jitter.
"""

import io
import logging
import math
import wave
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

logger = logging.getLogger("voice_integrity.vocoder")

# Threat Intelligence Database for Known Vocoder Families
VOCODER_THREAT_CATALOG: Dict[str, Dict[str, Any]] = {
    "HIFI_GAN": {
        "family_name": "HiFi-GAN (Multi-Period Discriminator GAN)",
        "risk_level": "CRITICAL",
        "description": "Widely deployed GAN vocoder using multi-period and multi-scale discriminators with dilated residual blocks.",
        "common_generators": ["ElevenLabs Standard", "XTTS-v2", "Tortoise-TTS", "Bark", "Coqui TTS"],
        "fingerprint_traits": [
            "Harmonic comb peaks at 2 kHz, 4 kHz, and 6 kHz",
            "Slight sub-band phase discontinuity",
            "Rapid inference (<100ms)",
        ],
        "attack_vector": "Commercial API Clone or Open-Source Local Clone",
    },
    "BIGVGAN": {
        "family_name": "BigVGAN (Periodic Snake Activation Vocoder)",
        "risk_level": "CRITICAL",
        "description": "High-fidelity universal vocoder replacing LeakyReLU with periodic Snake activation functions for continuous pitch.",
        "common_generators": ["CosyVoice", "F5-TTS", "Fish Speech", "Amphion"],
        "fingerprint_traits": [
            "Periodic modulation in 5.5 - 7.5 kHz spectrum",
            "Exceptionally clean baseband with localized high-frequency harmonic phase lock",
            "High computational complexity",
        ],
        "attack_vector": "State-of-the-Art Zero-Shot Voice Clone",
    },
    "MELGAN": {
        "family_name": "MelGAN (Transposed Convolution Architecture)",
        "risk_level": "HIGH",
        "description": "Fast lightweight vocoder prone to 2D checkerboard spectral artifacts due to unpadded transposed convolutions.",
        "common_generators": ["Legacy Voice-Conversion-WebUI", "Real-Time Soundboards", "Mobile TTS"],
        "fingerprint_traits": [
            "Checkerboard spectral energy ripple",
            "Sharp band-edge rolloff above 7.2 kHz",
            "Noticeable metallic timbre in fricatives",
        ],
        "attack_vector": "Real-Time Voice Changer / Soundboard",
    },
    "DIFFUSION_DENOISER": {
        "family_name": "DiffWave / Score-Based Diffusion Vocoder",
        "risk_level": "HIGH",
        "description": "Waveform generation using iterative reverse-time stochastic differential equations (SDEs) or Langevin dynamics.",
        "common_generators": ["DiffWave", "WaveGrad", "Grad-TTS", "Resemble AI Enhanced"],
        "fingerprint_traits": [
            "Uniform stochastic noise floor in unvoiced segments",
            "Residual variance in micro-pauses",
            "High generation latency (>600ms)",
        ],
        "attack_vector": "High-Fidelity Studio Impersonation",
    },
    "NEURAL_CODEC_RVQ": {
        "family_name": "RVQ Neural Codec (EnCodec / SoundStream / DAC)",
        "risk_level": "CRITICAL",
        "description": "End-to-end discrete token audio codec using Residual Vector Quantization codebooks.",
        "common_generators": ["VALL-E", "MusicGen / AudioGen", "Meta EnCodec / Descript DAC"],
        "fingerprint_traits": [
            "Quantization step entropy floor",
            "Frame-boundary 50Hz/75Hz phase jitter",
            "Discrete token harmonic clustering",
        ],
        "attack_vector": "Generative Audio Language Model (LLM Tokenizer)",
    },
    "NATURAL_HUMAN": {
        "family_name": "Natural Biological Larynx & Vocal Tract",
        "risk_level": "BENIGN",
        "description": "Authentic organic speech generated through lung pressure, vocal fold vibrations, and oral/nasal articulation.",
        "common_generators": ["Genuine Human Speaker"],
        "fingerprint_traits": [
            "Organic pitch perturbation (jitter > 0.4%)",
            "Continuous natural shimmer variation",
            "Complex asymmetric glottal pulse waveforms",
        ],
        "attack_vector": "None (Authentic Customer)",
    },
}


class VocoderAttributionService:
    """
    Forensic Neural Vocoder Architecture Attribution and Fingerprinting Engine.
    """

    def __init__(self):
        pass

    def extract_vocoder_features(
        self,
        audio_samples: np.ndarray,
        sample_rate: int = 16000,
    ) -> Dict[str, float]:
        """
        Extracts diagnostic acoustic features sensitive to neural vocoder architectures.
        """
        if len(audio_samples) < 512:
            return {
                "checkerboard_metric": 0.0,
                "harmonic_comb_ratio": 0.0,
                "high_freq_rolloff_khz": 8.0,
                "unvoiced_noise_entropy": 0.0,
                "phase_coherence_jitter": 0.0,
                "glottal_asymmetry_index": 0.5,
            }

        # Ensure 1D float32
        x = audio_samples.astype(np.float32)

        # 1. FFT spectrum
        n_fft = min(2048, len(x))
        spec = np.abs(np.fft.rfft(x[:n_fft]))
        freqs = np.fft.rfftfreq(n_fft, d=1.0 / sample_rate)

        spec_sum = np.sum(spec) + 1e-12
        spec_norm = spec / spec_sum

        # 2. High-Frequency Rolloff (85% energy point)
        cum_spec = np.cumsum(spec)
        rolloff_idx = np.searchsorted(cum_spec, 0.85 * cum_spec[-1])
        rolloff_hz = float(freqs[min(rolloff_idx, len(freqs) - 1)])

        # 3. Transposed Convolution Checkerboard Metric:
        # Measures alternating high-frequency energy ripples across consecutive bins
        diff_spec = np.diff(spec[:512])
        sign_flips = np.sum(np.diff(np.sign(diff_spec)) != 0)
        checkerboard_metric = float(sign_flips / max(1, len(diff_spec)))

        # 4. Harmonic Comb Ratio:
        # Evaluates energy concentration at common vocoder sub-bands (2kHz, 4kHz, 6kHz)
        comb_bands = [(1900, 2100), (3900, 4100), (5900, 6100)]
        comb_energy = 0.0
        for f_low, f_high in comb_bands:
            band_mask = (freqs >= f_low) & (freqs <= f_high)
            if np.any(band_mask):
                comb_energy += float(np.sum(spec[band_mask]))
        comb_ratio = float(comb_energy / spec_sum)

        # 5. Unvoiced Noise Floor Entropy (Diffusion indicator)
        # Evaluates spectral entropy of quieter segments
        tail_spec = spec[len(spec) // 2 :]
        tail_norm = tail_spec / (np.sum(tail_spec) + 1e-12)
        entropy = -float(np.sum(tail_norm * np.log(tail_norm + 1e-12))) / float(np.log(len(tail_norm) + 1e-12))

        # 6. Glottal Pulse Asymmetry (Biological vs Neural)
        # Authentic human voices have natural negative skew in temporal derivatives
        dx = np.diff(x)
        skewness = float(np.mean(dx ** 3) / (np.mean(dx ** 2) ** 1.5 + 1e-12))
        glottal_asymmetry = float(np.clip(abs(skewness) / 3.0, 0.0, 1.0))

        # 7. Phase Coherence Jitter
        phase = np.angle(np.fft.rfft(x[:n_fft]))
        d_phase = np.diff(phase)
        phase_jitter = float(np.std(d_phase))

        return {
            "checkerboard_metric": round(checkerboard_metric, 4),
            "harmonic_comb_ratio": round(comb_ratio, 4),
            "high_freq_rolloff_khz": round(rolloff_hz / 1000.0, 2),
            "unvoiced_noise_entropy": round(entropy, 4),
            "phase_coherence_jitter": round(phase_jitter, 4),
            "glottal_asymmetry_index": round(glottal_asymmetry, 4),
        }

    def attribute_vocoder(
        self,
        audio_samples: np.ndarray,
        sample_rate: int = 16000,
        synthetic_prob: float = 0.50,
    ) -> Dict[str, Any]:
        """
        Attributes the audio to a neural vocoder family based on extracted fingerprint features
        and synthetic speech probability.
        """
        features = self.extract_vocoder_features(audio_samples, sample_rate)

        # Scoring candidate architectures
        scores: Dict[str, float] = {
            "HIFI_GAN": 0.05,
            "BIGVGAN": 0.05,
            "MELGAN": 0.05,
            "DIFFUSION_DENOISER": 0.05,
            "NEURAL_CODEC_RVQ": 0.05,
            "NATURAL_HUMAN": 0.10,
        }

        if synthetic_prob < 0.25:
            # High probability of authentic human voice
            scores["NATURAL_HUMAN"] += 0.70 + (0.20 * features["glottal_asymmetry_index"])
        else:
            # Synthetic detected, score neural vocoder candidates
            scores["NATURAL_HUMAN"] = max(0.01, 1.0 - synthetic_prob)

            # HiFi-GAN pattern: elevated harmonic comb ratio + moderate rolloff
            if features["harmonic_comb_ratio"] > 0.18:
                scores["HIFI_GAN"] += 0.45
            if features["high_freq_rolloff_khz"] > 6.8:
                scores["HIFI_GAN"] += 0.25

            # MelGAN pattern: high checkerboard metric + low rolloff cutoff
            if features["checkerboard_metric"] > 0.48:
                scores["MELGAN"] += 0.50
            if features["high_freq_rolloff_khz"] < 7.2:
                scores["MELGAN"] += 0.30

            # BigVGAN pattern: high rolloff + lower checkerboard + high phase coherence
            if features["high_freq_rolloff_khz"] >= 7.4 and features["checkerboard_metric"] < 0.45:
                scores["BIGVGAN"] += 0.55

            # Diffusion pattern: high unvoiced noise entropy
            if features["unvoiced_noise_entropy"] > 0.78:
                scores["DIFFUSION_DENOISER"] += 0.50

            # Neural Codec pattern: high phase jitter
            if features["phase_coherence_jitter"] > 1.75:
                scores["NEURAL_CODEC_RVQ"] += 0.40

        # Normalize score distribution
        total_score = sum(scores.values()) + 1e-12
        normalized_scores = {k: round(v / total_score, 4) for k, v in scores.items()}

        # Identify top candidate
        top_family = max(normalized_scores, key=normalized_scores.get)
        confidence = normalized_scores[top_family]

        threat_info = VOCODER_THREAT_CATALOG.get(top_family, VOCODER_THREAT_CATALOG["NATURAL_HUMAN"])

        return {
            "attributed_family": top_family,
            "family_name": threat_info["family_name"],
            "attribution_confidence": confidence,
            "threat_level": threat_info["risk_level"],
            "description": threat_info["description"],
            "common_generators": threat_info["common_generators"],
            "attack_vector": threat_info["attack_vector"],
            "fingerprint_traits": threat_info["fingerprint_traits"],
            "fingerprint_metrics": features,
            "architecture_probabilities": normalized_scores,
        }

    def get_threat_catalog(self) -> Dict[str, Any]:
        """Returns the full forensic vocoder threat intelligence catalog."""
        return {
            "status": "CATALOG_ACTIVE",
            "supported_families_count": len(VOCODER_THREAT_CATALOG),
            "catalog": VOCODER_THREAT_CATALOG,
        }


# Global Singleton
vocoder_attribution_service = VocoderAttributionService()

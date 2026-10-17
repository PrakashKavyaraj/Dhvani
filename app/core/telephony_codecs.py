"""
Telephony Audio Codec Simulation Suite for Dhvani Voice Integrity.

Provides accurate signal processing implementations of telephony audio codecs
and degradation channels:
1. G.711 mu-law (PCMU) companding and 8-bit quantization.
2. G.711 A-law (PCMA) companding and 8-bit quantization.
3. AMR-NB narrow-band telephony frequency rolloff (300 Hz to 3400 Hz bandpass).
4. 8 kHz narrow-band downsampling and anti-aliasing reconstruction.
5. PSTN / GSM channel noise injection.
"""

import math
from typing import Any, Dict, Optional, Tuple, Union
import numpy as np
from scipy import signal


def resample_audio(
    audio_pcm: np.ndarray,
    orig_sr: int = 16000,
    target_sr: int = 8000,
) -> np.ndarray:
    """
    Resamples 1D float32 audio using polyphase filtering to prevent aliasing.
    """
    if orig_sr == target_sr:
        return audio_pcm.astype(np.float32)

    num_target_samples = int(round(len(audio_pcm) * (target_sr / orig_sr)))
    if num_target_samples <= 0:
        return np.zeros(0, dtype=np.float32)

    resampled = signal.resample(audio_pcm, num_target_samples)
    return resampled.astype(np.float32)


def apply_g711_mulaw(
    audio_pcm: np.ndarray,
    mu: float = 255.0,
) -> np.ndarray:
    """
    Simulates ITU-T G.711 mu-law non-linear companding with 8-bit quantization.
    Compression: F(x) = sgn(x) * ln(1 + mu*|x|) / ln(1 + mu)
    Expansion:   F_inv(y) = sgn(y) * (1/mu) * ((1 + mu)^|y| - 1)
    """
    x = np.clip(audio_pcm, -1.0, 1.0)
    sign = np.sign(x)
    abs_x = np.abs(x)

    # 1. Non-linear compression
    compressed = sign * np.log1p(mu * abs_x) / math.log1p(mu)

    # 2. 8-bit uniform quantization (-128 to 127)
    quantized_8bit = np.round(compressed * 127.0) / 127.0
    quantized_8bit = np.clip(quantized_8bit, -1.0, 1.0)

    # 3. Expansion (D/A reconstruction)
    sign_q = np.sign(quantized_8bit)
    abs_q = np.abs(quantized_8bit)
    decompressed = sign_q * (1.0 / mu) * (np.power(1.0 + mu, abs_q) - 1.0)

    return decompressed.astype(np.float32)


def apply_g711_alaw(
    audio_pcm: np.ndarray,
    a_param: float = 87.6,
) -> np.ndarray:
    """
    Simulates ITU-T G.711 A-law non-linear companding with 8-bit quantization.
    Compression piecewise formula per ITU-T recommendation.
    """
    x = np.clip(audio_pcm, -1.0, 1.0)
    sign = np.sign(x)
    abs_x = np.abs(x)

    inv_a = 1.0 / a_param
    denom = 1.0 + math.log(a_param)

    # Piecewise A-law compression
    compressed = np.zeros_like(x)
    mask_linear = abs_x < inv_a
    mask_log = ~mask_linear

    compressed[mask_linear] = sign[mask_linear] * (a_param * abs_x[mask_linear]) / denom
    compressed[mask_log] = sign[mask_log] * (1.0 + np.log(a_param * abs_x[mask_log])) / denom

    # 8-bit uniform quantization
    quantized_8bit = np.round(compressed * 127.0) / 127.0
    quantized_8bit = np.clip(quantized_8bit, -1.0, 1.0)

    # Expansion (D/A reconstruction)
    sign_q = np.sign(quantized_8bit)
    abs_q = np.abs(quantized_8bit)
    decompressed = np.zeros_like(quantized_8bit)

    thr = 1.0 / denom
    mask_lin_q = abs_q < thr
    mask_log_q = ~mask_lin_q

    decompressed[mask_lin_q] = sign_q[mask_lin_q] * (abs_q[mask_lin_q] * denom) / a_param
    decompressed[mask_log_q] = sign_q[mask_log_q] * (1.0 / a_param) * np.exp(abs_q[mask_log_q] * denom - 1.0)

    return decompressed.astype(np.float32)


def apply_amr_nb_bandpass(
    audio_pcm: np.ndarray,
    sample_rate: int = 16000,
    low_cutoff_hz: float = 300.0,
    high_cutoff_hz: float = 3400.0,
) -> np.ndarray:
    """
    Simulates narrow-band telephony frequency rolloff using a 4th-order Butterworth
    bandpass filter (300 Hz - 3400 Hz), characteristic of AMR-NB and 2G/3G mobile networks.
    """
    nyquist = 0.5 * sample_rate
    low = max(0.01, min(0.95, low_cutoff_hz / nyquist))
    high = max(0.02, min(0.98, high_cutoff_hz / nyquist))

    if low >= high:
        low = 0.05
        high = 0.40

    b, a = signal.butter(4, [low, high], btype="bandpass")
    filtered = signal.lfilter(b, a, audio_pcm)
    return filtered.astype(np.float32)


def apply_telephony_channel(
    audio_pcm: np.ndarray,
    sample_rate: int = 16000,
    codec: str = "none",
    snr_db: Optional[float] = None,
) -> np.ndarray:
    """
    Applies the full specified telephony degradation pipeline:
    - Codec options: "none", "g711_ulaw", "g711_alaw", "amr_nb", "telephony_8k".
    - Downsamples to 8 kHz, compands, applies bandpass, and restores to 16 kHz.
    - Optional Gaussian thermal/channel noise addition.
    """
    codec_key = (codec or "none").strip().lower()

    if codec_key in ("none", "raw", "clean"):
        out_pcm = audio_pcm.copy()
    elif codec_key in ("g711_ulaw", "pcmu", "mulaw"):
        pcm_8k = resample_audio(audio_pcm, orig_sr=sample_rate, target_sr=8000)
        pcm_g711 = apply_g711_mulaw(pcm_8k)
        out_pcm = resample_audio(pcm_g711, orig_sr=8000, target_sr=sample_rate)
    elif codec_key in ("g711_alaw", "pcma", "alaw"):
        pcm_8k = resample_audio(audio_pcm, orig_sr=sample_rate, target_sr=8000)
        pcm_alaw = apply_g711_alaw(pcm_8k)
        out_pcm = resample_audio(pcm_alaw, orig_sr=8000, target_sr=sample_rate)
    elif codec_key in ("amr_nb", "amr", "narrowband"):
        pcm_8k = resample_audio(audio_pcm, orig_sr=sample_rate, target_sr=8000)
        pcm_band = apply_amr_nb_bandpass(pcm_8k, sample_rate=8000)
        pcm_quant = apply_g711_alaw(pcm_band)
        out_pcm = resample_audio(pcm_quant, orig_sr=8000, target_sr=sample_rate)
    elif codec_key in ("telephony_8k", "8k"):
        pcm_8k = resample_audio(audio_pcm, orig_sr=sample_rate, target_sr=8000)
        out_pcm = resample_audio(pcm_8k, orig_sr=8000, target_sr=sample_rate)
    else:
        out_pcm = audio_pcm.copy()

    # Optional SNR-controlled background noise injection
    if snr_db is not None and len(out_pcm) > 0:
        sig_power = float(np.mean(out_pcm ** 2))
        if sig_power > 1e-9:
            noise_power = sig_power / (10.0 ** (snr_db / 10.0))
            noise = np.random.normal(0, math.sqrt(noise_power), len(out_pcm))
            out_pcm = np.clip(out_pcm + noise, -1.0, 1.0).astype(np.float32)

    return out_pcm

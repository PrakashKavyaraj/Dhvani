import hashlib
import os
import threading
from typing import Any, Optional
from app.core.config import get_settings
from app.core.logging import logger
from app.integrations.m3_prosody import evaluate_prepared_audio_prosody
from app.models.domain import DetectorPrediction, PreparedAudio

_cached_model: Optional[Any] = None
_cached_feature_extractor: Optional[Any] = None
_model_lock = threading.Lock()


def _predict_dummy(prepared_audio: PreparedAudio) -> DetectorPrediction:
    """
    Deterministic demo-only synthetic speech detector backend.

    DISCLAIMER & LIMITATIONS:
    This dummy implementation does NOT perform real synthetic speech or deepfake
    detection. It computes a deterministic pseudo-score from the waveform hash
    solely to allow testing and running the complete backend pipeline without
    heavy ML dependencies.
    """
    settings = get_settings()
    chunk = prepared_audio.raw_data[:4096] if prepared_audio.raw_data else b""
    hash_digest = hashlib.sha256(chunk).hexdigest()
    int_seed = int(hash_digest[:8], 16)

    # Deterministic probability bounded in [0.08, 0.42]
    synthetic_prob = round(0.08 + (int_seed % 340) / 1000.0, 4)
    confidence = round(0.85 + (int_seed % 100) / 1000.0, 2)

    spectral_level = "low"
    if synthetic_prob >= 0.70:
        spectral_level = "high"
    elif synthetic_prob >= 0.40:
        spectral_level = "medium"

    return DetectorPrediction(
        synthetic_speech_probability=synthetic_prob,
        model_confidence=confidence,
        model_version=f"{settings.MODEL_VERSION}-dummy",
        spectral_anomaly=spectral_level,
        prosody_anomaly="not_available",
    )


def _load_transformers_pipeline():
    """
    Lazily loads and caches the local Hugging Face Wav2Vec2 model and feature extractor.

    DISCLAIMER & LIMITATIONS:
    1. The model (Vansh180/deepfake-audio-wav2vec2) is a research-oriented acoustic
       classifier trained on a subset of the ASVspoof 2021 PA dataset.
    2. Its published performance metrics are self-reported and not universally verified.
    3. It is NOT validated for unseen languages, compressed telephony codecs,
       low-quality mobile microphones, or contemporary generative voice models.
    4. It must be benchmarked on a representative labeled evaluation set before any
       operational or decision-support deployment.
    5. This detector produces a probabilistic acoustic indicator only; it CANNOT prove
       authenticity, identity, authorship, or fraud.
    """
    global _cached_model, _cached_feature_extractor
    if _cached_model is not None and _cached_feature_extractor is not None:
        return _cached_model, _cached_feature_extractor

    with _model_lock:
        if _cached_model is not None and _cached_feature_extractor is not None:
            return _cached_model, _cached_feature_extractor

        try:
            import torch
            from transformers import AutoFeatureExtractor, AutoModelForAudioClassification
        except ImportError as exc:
            raise RuntimeError(
                "The 'transformers' detector backend requires optional ML dependencies. "
                "Install them via: pip install -r requirements-ml.txt"
            ) from exc

        settings = get_settings()
        cache_dir = Path(settings.MODEL_CACHE_DIR)
        cache_dir.mkdir(parents=True, exist_ok=True)
        os.environ["HF_HOME"] = str(cache_dir.resolve())

        logger.info("Loading local classification model: %s", settings.DETECTOR_MODEL_ID)
        extractor = AutoFeatureExtractor.from_pretrained(
            settings.DETECTOR_MODEL_ID,
            cache_dir=cache_dir,
            local_files_only=False,
        )
        model = AutoModelForAudioClassification.from_pretrained(
            settings.DETECTOR_MODEL_ID,
            cache_dir=cache_dir,
            local_files_only=False,
        )
        model.eval()

        _cached_feature_extractor = extractor
        _cached_model = model
        return _cached_model, _cached_feature_extractor


def _predict_transformers(prepared_audio: PreparedAudio) -> DetectorPrediction:
    import numpy as np
    import torch

    settings = get_settings()
    model, feature_extractor = _load_transformers_pipeline()

    # Convert raw PCM bytes to normalized float32
    if prepared_audio.sample_width == 2:
        samples = np.frombuffer(prepared_audio.raw_data, dtype=np.int16).astype(np.float32) / 32768.0
    elif prepared_audio.sample_width == 1:
        samples = (np.frombuffer(prepared_audio.raw_data, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    else:
        raise ValueError("Unsupported sample width for inference.")

    # Downmix stereo to mono
    if prepared_audio.channels == 2:
        samples = samples.reshape(-1, 2).mean(axis=1)

    # In-memory linear resampling to 16 kHz if necessary
    target_sr = settings.DETECTOR_TARGET_SAMPLE_RATE
    if prepared_audio.sample_rate != target_sr:
        duration = len(samples) / float(prepared_audio.sample_rate)
        target_len = int(round(duration * target_sr))
        orig_indices = np.linspace(0.0, duration, num=len(samples), endpoint=False)
        target_indices = np.linspace(0.0, duration, num=target_len, endpoint=False)
        samples = np.interp(target_indices, orig_indices, samples).astype(np.float32)

    # Run feature extraction
    inputs = feature_extractor(
        samples,
        sampling_rate=target_sr,
        return_tensors="pt",
    )

    with torch.no_grad():
        logits = model(**inputs).logits
        probabilities = torch.softmax(logits, dim=-1)[0]

    # Resolve spoof probability
    spoof_idx = settings.DETECTOR_SPOOF_LABEL_INDEX
    target_label = settings.DETECTOR_SPOOF_LABEL.lower()
    if hasattr(model.config, "id2label") and model.config.id2label:
        for idx, label in model.config.id2label.items():
            if target_label in label.lower() or "fake" in label.lower():
                spoof_idx = int(idx)
                break

    spoof_prob = float(probabilities[spoof_idx].item())
    confidence = float(probabilities.max().item())

    spectral_level = "low"
    if spoof_prob >= 0.70:
        spectral_level = "high"
    elif spoof_prob >= 0.40:
        spectral_level = "medium"

    return DetectorPrediction(
        synthetic_speech_probability=round(spoof_prob, 4),
        model_confidence=round(confidence, 4),
        model_version=f"{settings.DETECTOR_MODEL_ID}",
        spectral_anomaly=spectral_level,
        prosody_anomaly="not_available",
    )


def predict(prepared_audio: PreparedAudio) -> DetectorPrediction:
    """
    Synthetic-speech detection entrypoint.
    Preserves signature: predict(PreparedAudio) -> DetectorPrediction
    """
    settings = get_settings()
    backend = settings.DETECTOR_BACKEND.lower()
    if backend == "transformers":
        prediction = _predict_transformers(prepared_audio)
    else:
        prediction = _predict_dummy(prepared_audio)

    # Production-grade YIN acoustic prosody & pitch contour evaluation
    try:
        prosody_level, telemetry = evaluate_prepared_audio_prosody(prepared_audio)
        prediction.prosody_anomaly = prosody_level
        logger.info(
            "Prosody analysis complete: level=%s, f0_std=%s, jumps=%s, jitter=%s, npvi=%s",
            prosody_level,
            telemetry.get("f0_std_semitones"),
            telemetry.get("pitch_jump_ratio"),
            telemetry.get("jitter_rap"),
            telemetry.get("cadence_npvi"),
        )
    except Exception as exc:
        logger.warning("Prosody analysis fallback to low due to error: %s", exc)
        prediction.prosody_anomaly = "low"

    return prediction
"""M1 detector integration boundary.

The default is a deterministic demo. Set `DETECTOR_BACKEND=transformers` after
installing requirements-ml.txt to use a local pretrained anti-spoofing model.
Weights are cached locally; uploaded audio is never sent to an inference API.
"""
from __future__ import annotations

from functools import lru_cache
import os

from app.core.config import settings
from app.models.domain import AnalysisError, DetectorPrediction, PreparedAudio


def _bucket(probability: float) -> str:
    return "high" if probability >= 0.7 else "medium" if probability >= 0.4 else "low"


def _dummy_prediction(prepared_audio: PreparedAudio) -> DetectorPrediction:
    signal = sum(prepared_audio.waveform[:4096]) + prepared_audio.sample_rate + len(prepared_audio.waveform)
    probability = round((signal % 101) / 100, 2)
    confidence = round(0.65 + min(prepared_audio.speech_seconds, 20) / 100, 2)
    return DetectorPrediction(probability, min(confidence, 0.95), settings.model_version, {"spectral_anomaly": _bucket(probability), "prosody_anomaly": "medium" if probability >= 0.4 else "low"})


@lru_cache(maxsize=1)
def _load_transformers_model():
    # Keep every Hugging Face cache inside the project-controlled cache directory.
    # Disabling Xet avoids writing its separate default cache under the home directory.
    os.environ.setdefault("HF_HOME", str(settings.model_cache_dir))
    os.environ.setdefault("HF_HUB_CACHE", str(settings.model_cache_dir / "hub"))
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    try:
        from transformers import AutoFeatureExtractor, AutoModelForAudioClassification
        import torch
    except ImportError as exc:
        raise AnalysisError("INFERENCE_FAILED", "Real detector dependencies are missing. Install requirements-ml.txt.") from exc
    try:
        settings.model_cache_dir.mkdir(parents=True, exist_ok=True)
        extractor = AutoFeatureExtractor.from_pretrained(settings.detector_model_id, cache_dir=settings.model_cache_dir)
        model = AutoModelForAudioClassification.from_pretrained(settings.detector_model_id, cache_dir=settings.model_cache_dir)
        model.eval()
        return extractor, model, torch
    except Exception as exc:
        raise AnalysisError("INFERENCE_FAILED", "The configured real detector could not be loaded locally.") from exc


def _waveform_for_model(prepared_audio: PreparedAudio):
    try:
        import numpy as np
    except ImportError as exc:
        raise AnalysisError("INFERENCE_FAILED", "Real detector dependencies are missing. Install requirements-ml.txt.") from exc
    dtype = np.uint8 if prepared_audio.sample_width == 1 else "<i2"
    samples = np.frombuffer(prepared_audio.waveform, dtype=dtype).astype(np.float32)
    samples = (samples - 128.0) / 128.0 if prepared_audio.sample_width == 1 else samples / 32768.0
    if prepared_audio.channels == 2:
        samples = samples.reshape(-1, 2).mean(axis=1)
    if prepared_audio.sample_rate != settings.detector_target_sample_rate:
        target_length = round(len(samples) * settings.detector_target_sample_rate / prepared_audio.sample_rate)
        samples = np.interp(np.linspace(0, len(samples) - 1, target_length), np.arange(len(samples)), samples).astype(np.float32)
    return samples


def _spoof_probability(probabilities, id2label: dict) -> float:
    for index, label in id2label.items():
        if settings.detector_spoof_label in str(label).lower() or "fake" in str(label).lower():
            return float(probabilities[int(index)])
    index = settings.detector_spoof_label_index
    if not 0 <= index < len(probabilities):
        raise AnalysisError("INFERENCE_FAILED", "Configured spoof label index is outside the model output range.")
    return float(probabilities[index])


def _transformers_prediction(prepared_audio: PreparedAudio) -> DetectorPrediction:
    extractor, model, torch = _load_transformers_model()
    waveform = _waveform_for_model(prepared_audio)
    try:
        inputs = extractor(waveform, sampling_rate=settings.detector_target_sample_rate, return_tensors="pt")
        with torch.no_grad():
            probabilities = torch.softmax(model(**inputs).logits, dim=1)[0].cpu().tolist()
        probability = _spoof_probability(probabilities, model.config.id2label)
    except AnalysisError:
        raise
    except Exception as exc:
        raise AnalysisError("INFERENCE_FAILED", "The real detector could not score this recording.") from exc
    confidence = max(probabilities)
    return DetectorPrediction(round(probability, 4), round(float(confidence), 4), settings.detector_model_id, {"spectral_anomaly": _bucket(probability), "prosody_anomaly": "not_available"})


def predict(prepared_audio: PreparedAudio) -> DetectorPrediction:
    if settings.detector_backend == "dummy":
        return _dummy_prediction(prepared_audio)
    if settings.detector_backend == "transformers":
        return _transformers_prediction(prepared_audio)
    raise AnalysisError("INFERENCE_FAILED", "DETECTOR_BACKEND must be 'dummy' or 'transformers'.")

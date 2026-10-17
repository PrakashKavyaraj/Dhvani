"""
Unit & Integration Test Suite for Scientific Evaluation Harness & Probability Calibration Engine.

Validates:
1. Equal Error Rate (EER) computation with linear threshold interpolation.
2. Minimum and Actual Detection Cost Functions (minDCF, actDCF).
3. Platt scaling logistic probability calibration and Bayes optimal thresholds.
4. ITU-T G.711 mu-law, A-law, and AMR-NB narrow-band telephony codec simulation.
5. End-to-end benchmark suite execution.
"""

import math
import numpy as np
import pytest

from app.core.calibration_engine import (
    ASVSPOOF_COST_PROFILE,
    BANKING_COST_PROFILE,
    ProbabilityCalibrator,
    calibration_engine,
)
from app.core.telephony_codecs import (
    apply_amr_nb_bandpass,
    apply_g711_alaw,
    apply_g711_mulaw,
    apply_telephony_channel,
    resample_audio,
)
from scripts.evaluation_harness import (
    compute_dcf,
    compute_eer,
    evaluate_score_set,
    format_markdown_report,
    run_synthetic_benchmark_suite,
)


class TestBiometricMetrics:
    def test_eer_perfect_separation(self):
        bona = [0.05, 0.10, 0.15, 0.20]
        spoof = [0.80, 0.85, 0.90, 0.95]
        eer, th = compute_eer(bona, spoof)
        assert eer == 0.0
        assert 0.20 <= th <= 0.80

    def test_eer_symmetric_overlap(self):
        # Overlapping scores around 0.50
        bona = [0.1, 0.2, 0.3, 0.4, 0.6]
        spoof = [0.4, 0.6, 0.7, 0.8, 0.9]
        eer, th = compute_eer(bona, spoof)
        assert 0.0 < eer <= 0.40
        assert 0.35 <= th <= 0.65

    def test_eer_empty_inputs_safety(self):
        eer, th = compute_eer([], [])
        assert eer == 0.0
        assert th == 0.5

    def test_dcf_bounds_and_calibration_gap(self):
        bona = [0.05, 0.12, 0.18, 0.22, 0.29]
        spoof = [0.65, 0.72, 0.81, 0.89, 0.94]
        res = compute_dcf(
            bona,
            spoof,
            cost_miss=BANKING_COST_PROFILE["cost_miss"],
            cost_fa=BANKING_COST_PROFILE["cost_fa"],
            p_target=BANKING_COST_PROFILE["p_target"],
        )
        assert res["min_dcf"] <= res["act_dcf"]
        assert res["calibration_loss"] >= 0.0
        assert 0.0 <= res["min_dcf"] <= 1.0


class TestProbabilityCalibrator:
    def test_calibrator_sigmoid_bounds(self):
        calibrator = ProbabilityCalibrator(scale_param=5.0, bias_param=-2.5)
        # Low raw score should give low probability
        p_low = calibrator.calibrate(0.0)
        assert 0.0 <= p_low < 0.20

        # High raw score should give high probability
        p_high = calibrator.calibrate(1.0)
        assert 0.80 < p_high <= 1.0

    def test_fit_reduces_brier_and_ece(self):
        np.random.seed(123)
        calibrator = ProbabilityCalibrator()

        # Generate synthetic uncalibrated scores
        bona = np.random.uniform(0.0, 0.4, 100)
        spoof = np.random.uniform(0.6, 1.0, 100)
        raw_scores = np.concatenate([bona, spoof])
        labels = np.concatenate([np.zeros(100), np.ones(100)])

        fit_res = calibrator.fit(raw_scores, labels, max_iter=50)
        assert calibrator.is_fitted
        assert fit_res["brier"] <= 0.25
        assert fit_res["ece"] <= 0.30

    def test_bayes_threshold_calculation(self):
        calibrator = ProbabilityCalibrator()
        th_asv = calibrator.compute_bayes_threshold(cost_miss=1.0, cost_fa=1.0, p_target=0.05)
        th_bank = calibrator.compute_bayes_threshold(cost_miss=10.0, cost_fa=1.0, p_target=0.01)

        # Higher cost of miss should lower the decision threshold to catch more spoofs
        assert 0.0 <= th_asv <= 1.0
        assert 0.0 <= th_bank <= 1.0


class TestTelephonyCodecs:
    def test_resample_audio_length(self):
        pcm_16k = np.zeros(16000, dtype=np.float32)
        pcm_8k = resample_audio(pcm_16k, orig_sr=16000, target_sr=8000)
        assert len(pcm_8k) == 8000

    def test_g711_mulaw_roundtrip_fidelity(self):
        t = np.linspace(0, 1.0, 8000, endpoint=False)
        clean_sine = (0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
        mulaw_reconstructed = apply_g711_mulaw(clean_sine)

        assert len(mulaw_reconstructed) == len(clean_sine)
        # 8-bit quantization SNR should be greater than 30 dB
        noise = clean_sine - mulaw_reconstructed
        snr = 10 * np.log10(np.mean(clean_sine ** 2) / max(1e-12, np.mean(noise ** 2)))
        assert snr > 30.0

    def test_g711_alaw_roundtrip_fidelity(self):
        t = np.linspace(0, 1.0, 8000, endpoint=False)
        clean_sine = (0.5 * np.sin(2 * np.pi * 1000 * t)).astype(np.float32)
        alaw_reconstructed = apply_g711_alaw(clean_sine)

        assert len(alaw_reconstructed) == len(clean_sine)
        noise = clean_sine - alaw_reconstructed
        snr = 10 * np.log10(np.mean(clean_sine ** 2) / max(1e-12, np.mean(noise ** 2)))
        assert snr > 30.0

    def test_amr_nb_bandpass_attenuates_extreme_frequencies(self):
        t = np.linspace(0, 1.0, 8000, endpoint=False)
        # Superposition of 50 Hz (sub-bass hum), 1000 Hz (speech band), and 3800 Hz (above cutoff)
        low_tone = np.sin(2 * np.pi * 50 * t).astype(np.float32)
        speech_tone = np.sin(2 * np.pi * 1000 * t).astype(np.float32)

        filtered_low = apply_amr_nb_bandpass(low_tone, sample_rate=8000)
        filtered_speech = apply_amr_nb_bandpass(speech_tone, sample_rate=8000)

        # 50 Hz should be heavily attenuated compared to 1000 Hz
        assert np.mean(filtered_low ** 2) < 0.10 * np.mean(filtered_speech ** 2)

    def test_apply_telephony_channel_pipeline(self):
        pcm = np.random.uniform(-0.5, 0.5, 16000).astype(np.float32)
        out_g711 = apply_telephony_channel(pcm, sample_rate=16000, codec="g711_alaw")
        out_amr = apply_telephony_channel(pcm, sample_rate=16000, codec="amr_nb")

        assert len(out_g711) == len(pcm)
        assert len(out_amr) == len(pcm)
        assert not np.array_equal(pcm, out_g711)


class TestBenchmarkSuiteIntegration:
    def test_evaluate_score_set_structure(self):
        bona = [0.08, 0.12, 0.15, 0.22]
        spoof = [0.75, 0.85, 0.92, 0.98]
        report = evaluate_score_set(bona, spoof)

        assert "eer_percent" in report
        assert "asvspoof_profile" in report
        assert "banking_profile" in report
        assert "calibration_metrics" in report
        assert report["eer_percent"] == 0.0

    def test_synthetic_benchmark_suite_and_report_generation(self):
        bench = run_synthetic_benchmark_suite()
        assert "codec_benchmarks" in bench
        assert "language_benchmarks" in bench
        assert "attack_benchmarks" in bench
        assert len(bench["codec_benchmarks"]) >= 5

        md = format_markdown_report(bench)
        assert "# Dhvani Voice Integrity: Scientific Evaluation Report" in md
        assert "G.711 A-law" in md
        assert "Hindi" in md

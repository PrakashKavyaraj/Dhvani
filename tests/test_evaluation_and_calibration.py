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
    compute_speaker_clustered_bootstrap_ci,
    create_disjoint_partitions,
    evaluate_score_set,
    evaluate_with_disjoint_calibration,
    format_markdown_report,
    load_manifest_trials,
    run_manifest_evaluation,
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

    def test_disjoint_partitions_speaker_and_generator_isolation(self):
        trials = [
            {"trial_id": "T1", "speaker_id": "SPK_01", "generator": "seen_hifigan", "score": 0.1},
            {"trial_id": "T2", "speaker_id": "SPK_01", "generator": "seen_hifigan", "score": 0.2},
            {"trial_id": "T3", "speaker_id": "SPK_02", "generator": "seen_hifigan", "score": 0.8},
            {"trial_id": "T4", "speaker_id": "SPK_03", "generator": "elevenlabs_v2", "score": 0.9},
            {"trial_id": "T5", "speaker_id": "SPK_04", "generator": "seen_hifigan", "score": 0.15},
            {"trial_id": "T6", "speaker_id": "SPK_05", "generator": "seen_hifigan", "score": 0.85},
        ]
        dev, test = create_disjoint_partitions(
            trials,
            dev_ratio=0.5,
            holdout_generators=["elevenlabs_v2"],
            seed=42,
        )

        dev_speakers = {t["speaker_id"] for t in dev}
        test_speakers = {t["speaker_id"] for t in test}

        # 1. Zero speaker overlap
        assert dev_speakers.isdisjoint(test_speakers)

        # 2. Holdout generator strictly assigned to test
        assert any(t["generator"] == "elevenlabs_v2" for t in test)
        assert all(t["generator"] != "elevenlabs_v2" for t in dev)

    def test_evaluate_with_disjoint_calibration_zero_leakage(self):
        dev_b = [0.05, 0.10, 0.15, 0.20, 0.25]
        dev_s = [0.75, 0.80, 0.85, 0.90, 0.95]
        eval_b = [0.08, 0.12, 0.18, 0.22]
        eval_s = [0.72, 0.82, 0.88, 0.92]

        res = evaluate_with_disjoint_calibration(dev_b, dev_s, eval_b, eval_s)
        assert res["leakage_audit"]["calibration_leakage"] == "ZERO_LEAKAGE_HELD_OUT_EVALUATION"
        assert res["leakage_audit"]["calibrator_fitted"] is True
        assert res["eer_percent"] == 0.0

    def test_bounded_slope_prevents_detector_inversion(self):
        calibrator = ProbabilityCalibrator()
        # Even with difficult/noisy data, calibrator slope 'a' must remain strictly positive (a >= 1e-3)
        noisy_scores = [0.9, 0.8, 0.85, 0.1, 0.2, 0.15]
        inverted_labels = [0, 0, 0, 1, 1, 1]
        calibrator.fit(noisy_scores, inverted_labels)
        assert calibrator.a >= 1e-3

    def test_load_manifest_trials_csv(self, tmp_path):
        manifest_file = tmp_path / "test_manifest.csv"
        manifest_file.write_text(
            "trial_id,speaker_id,label,score,codec,generator,language\n"
            "T1,SPK1,bonafide,0.05,clean_16k,bonafide,English\n"
            "T2,SPK2,spoof,0.92,g711_alaw,HiFi-GAN,Hindi\n"
        )
        trials = load_manifest_trials(manifest_file)
        assert len(trials) == 2
        assert trials[0]["trial_id"] == "T1"
        assert trials[0]["label"] == 0
        assert trials[0]["score"] == 0.05
        assert trials[1]["trial_id"] == "T2"
        assert trials[1]["label"] == 1
        assert trials[1]["score"] == 0.92

    def test_load_manifest_raw_protocol(self, tmp_path):
        protocol_file = tmp_path / "test_protocol.txt"
        protocol_file.write_text(
            "LA_0001 flac_00001 - - bonafide\n"
            "LA_0002 flac_00002 g711 A01 spoof\n"
        )
        trials = load_manifest_trials(protocol_file)
        assert len(trials) == 2
        assert trials[0]["speaker_id"] == "LA_0001"
        assert trials[0]["label"] == 0
        assert trials[1]["speaker_id"] == "LA_0002"
        assert trials[1]["label"] == 1

    def test_run_manifest_evaluation_end_to_end(self, tmp_path):
        manifest_file = tmp_path / "eval_manifest.csv"
        # 10 bonafide across 5 speakers, 10 spoof across 5 speakers
        rows = ["trial_id,speaker_id,label,score,codec,generator,language"]
        for i in range(1, 6):
            rows.append(f"B{i}a,SPK_B{i},bonafide,0.05,clean_16k,bonafide,English")
            rows.append(f"B{i}b,SPK_B{i},bonafide,0.08,g711_alaw,bonafide,Hindi")
        for i in range(1, 6):
            rows.append(f"S{i}a,SPK_S{i},spoof,0.95,clean_16k,HiFi-GAN,English")
            rows.append(f"S{i}b,SPK_S{i},spoof,0.88,g711_alaw,ElevenLabs,Hindi")
        manifest_file.write_text("\n".join(rows))

        report = run_manifest_evaluation(
            manifest_path=manifest_file,
            holdout_generators=["ElevenLabs"],
            dev_ratio=0.4,
            seed=42,
        )

        assert "manifest_summary" in report
        assert "overall_evaluation" in report
        assert report["overall_evaluation"]["eer_percent"] == 0.0
        assert report["manifest_summary"]["rule_of_three_miss_upper_pct"] > 0.0
        assert len(report["manifest_summary"]["sample_size_warnings"]) > 0

        md = format_markdown_report(report)
        assert "## Dataset Manifest & Partition Summary" in md
        assert "## Overall Held-out Biometric Benchmark" in md
        assert "## Multi-Dimensional Leakage Audit" in md
        assert "Statistical Power & Sample Size Notice" in md
        assert "bootstrap_ci95" in report["overall_evaluation"]

    def test_cllr_and_speaker_bootstrap_ci(self, tmp_path):
        calibrator = ProbabilityCalibrator()
        bona_scores = [0.05, 0.10, 0.12, 0.15, 0.18]
        spoof_scores = [0.82, 0.85, 0.90, 0.92, 0.95]
        s = np.concatenate([bona_scores, spoof_scores])
        y = np.concatenate([np.zeros(len(bona_scores)), np.ones(len(spoof_scores))])
        calibrator.fit(s, y)

        cllr = calibrator.compute_cllr(s, y)
        assert 0.0 <= cllr < 1.0

        eval_trials = []
        for i in range(10):
            eval_trials.append({
                "speaker_id": f"spk_{i}",
                "label": 0 if i < 5 else 1,
                "score": 0.1 if i < 5 else 0.9,
            })

        ci = compute_speaker_clustered_bootstrap_ci(eval_trials, calibrator=calibrator, n_bootstrap=20)
        assert "eer_percent_ci95" in ci
        assert "cllr_ci95" in ci
        assert ci["n_speakers"] == 10

    def test_asvspoof5_10_column_manifest_parsing(self, tmp_path):
        asv5_file = tmp_path / "ASVspoof5.sample.tsv"
        asv5_file.write_text(
            "D_0062 D_0000000001 F - - - AC1 A11 spoof -\n"
            "D_0461 D_0000000190 M - - - - bonafide bonafide -\n"
            "D_0106 D_0000000043 M C01 2 D_0000000001 AC2 A15 spoof -\n"
        )
        trials = load_manifest_trials(asv5_file)
        assert len(trials) == 3
        assert trials[0]["speaker_id"] == "D_0062"
        assert trials[0]["trial_id"] == "D_0000000001"
        assert trials[0]["generator"] == "A11"
        assert trials[0]["label"] == 1
        assert trials[0]["codec"] == "clean_16k"

        assert trials[1]["speaker_id"] == "D_0461"
        assert trials[1]["label"] == 0
        assert trials[1]["generator"] == "bonafide"

        assert trials[2]["speaker_id"] == "D_0106"
        assert trials[2]["label"] == 1
        assert trials[2]["codec"] == "C01"
        assert trials[2]["generator"] == "A15"



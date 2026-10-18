# Forensic Investigation Report: ASVspoof 5 Development Slice Separation Anomaly

**Date of Investigation:** October 18, 2026  
**Investigating Body:** Dhvani Engineering & Governance  
**Repository Commit Frozen:** `613f1a71d3362fe6d2c0910691ef9cfa9dc7456c`  
**Protocol Amendment:** v1.1 Pre-Registered Protocol (`protocol-v1`)  
**Scope of Investigation:** Diagnostic verification of the 0.00% Equal Error Rate (EER) observed on the 300-trial ASVspoof 5 Development Slice (Track 1) and rigorous benchmarking of acoustic inference latency and concurrency under open-loop carrier arrival schedules.

---

## 1. Executive Summary & Formal Verdict

Following the observation of 0.00% EER across clean and transcode conditions on an initial 300-trial development slice (72 bonafide, 228 spoof, 208 speakers), an exhaustive 10-point diagnostic battery (C1 through C10) was executed under frozen model weights to identify whether the separation resulted from label leakage, metadata shortcuts, degenerate classifier behavior, or genuine acoustic modeling.

### Investigation Verdict: **NO SHORTCUT FOUND (with limitations)**

* **Empirical Driver Identified (Test C3)**: The near-perfect separation is driven exclusively by the 300M-parameter WavLM-Large backbone in **Forensics-0.3B** (`eliya/forensics_0.3B_base_deepfake_classifier`), where bonafide scores average 0.0739 (+/- 0.0068, maximum 0.0940) and spoof scores average 0.8633 (+/- 0.0392, minimum 0.2883).
* **Countermeasure Isolation**: AASIST-L alone is **not** responsible for the 0.00% EER. Evaluated independently on the identical slice, AASIST-L achieves an EER of **32.46%** (persistent evidence) and **37.50%** (current window) with ROC-AUC of 0.7053, exhibiting substantial false alarms on bonafide speech (bonafide mean score: 0.7559 +/- 0.3268).
* **Non-Acoustic Leakage Ruled Out**:
  * Label permutation (1000 shuffles) yields a mean EER of **49.96%** (95% CI: [43.28%, 56.84%]).
  * Logistic regression on 7 non-acoustic metadata features (duration, file size, RMS, peak, zero-crossing rate, leading and trailing silence) yields an out-of-fold ROC-AUC of **0.5866** (EER: 43.06%), well below the shortcut threshold (AUC <= 0.60).
  * Shuffling file paths produces zero score variance (maximum delta < 10^-6), confirming the scorer does not parse file paths.
* **Acoustic Generalization & Degradation Tested**:
  * Scored 2.0s random crops across all 300 trials yielded **0.44% EER** (AUC = 0.9998), demonstrating that classification does not depend on file length or whole-utterance padding artifacts.
  * Additive white Gaussian noise swept from 30 dB down to 0 dB SNR produces smooth, monotonic degradation from 0.00% EER to 3.07% EER without cliff behavior.
* **Fresh Disjoint Replication (Test C10 & Part D)**:
  * Replicating the evaluation on a second, disjoint 300-trial cohort (92 bonafide, 208 spoof across 192 previously unseen speakers) from Zenodo archive `flac_D_aa.tar` produced **non-zero error**: under bandpass filtering (300-3400 Hz) + G.711 A-law, EER rose to **0.48%** (minDCF 0.0048, actDCF 0.1652, Cllr 0.1287), disproving any hardcoded 0.00% heuristic.
* **Key Caveats & Limitations**:
  1. The exact training corpus of the third-party HuggingFace weights (`eliya/forensics_0.3B_base_deepfake_classifier`) is **UNKNOWN**; it cannot be ruled out that ASVspoof 5 training data was present during fine-tuning.
  2. ASVspoof 5 EVAL remains completely unseen per Hard Rule 1. Generalizability to the official 11 evaluation codecs (C01 to C11) has not been measured.
  3. Real AMR-NB encoder was unavailable on macOS; the test used 4th-order Butterworth bandpass (300-3400 Hz) + G.711 A-law ("Bandpass 300-3400 Hz + G.711 (not AMR)").
  4. On single-core CPU execution, the complete sequential AEGIS pipeline takes ~466 ms ($p50$), breaching the 350 ms carrier budget ($0.0\%$ compliance) and sustaining **0 simultaneous streams** under open-loop load. Meeting the SLA requires ONNX acceleration, multi-threading, or GPU batching.

---

## 2. Model Provenance & Training Exposure Register

| Component Name | File Path | File SHA-256 Checksum | Base Architecture | Training / Tuning Data | ASVspoof 5 Exposure |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Forensics-0.3B** | `models/weights/forensics_0.3B_base.safetensors` | `803d2c57705fe0543e26bb2df8a18357a531d05d762e811df61f654b9d52b97c` | WavLM-Large (300M params) + GAT Head | WavLM base: LibriSpeech 960h, VoxCeleb1/2 10k, Libri-light 60k. Classifier head: HuggingFace `eliya/forensics_0.3B_base_deepfake_classifier`. | **UNKNOWN** (Dev/Eval: 0 exposure) |
| **AASIST-L (PyTorch)** | `models/weights/AASIST-L.pth` | `814331d0b00a503023e10faee50b868bb5a6bfdf07167a13a82447bb459a9307` | Spectro-Temporal Graph Attention Network | ASVspoof 2019 Logical Access (LA) train partition (19 speakers). | **Zero exposure** (None to ASVspoof 5) |
| **AASIST-L (ONNX)** | `models/weights/aasist_l.onnx` | `a6af184e9c7cba2a7f53a4ea8397a80bba96b653fecf0ffec853fbfa1375d8aa` | Exported ONNX Runtime graph | Exported directly from `AASIST-L.pth`. | **Zero exposure** (None to ASVspoof 5) |
| **ECAPA-TDNN** | `models/cache/spkrec-ecapa-voxceleb/embedding_model.ckpt` | `0575cb640d249d9a0d810f135b86ea6128097b66df2159040337cbeea0a02cb4` | 192-dim Time Delay Neural Network | VoxCeleb1 and VoxCeleb2 speaker verification datasets. | **Zero exposure** (None to ASVspoof 5) |
| **Silero VAD** | `models/weights/silero_vad.jit` | `e11228373b31ae74bc48083aeeea142e061805b6be4bf7164ffc762512f45ec9` | Silero Voice Activity Detector v4 JIT | Silero multilingual corpus (100+ languages). | **Zero exposure** (None to ASVspoof 5) |
| **Fusion Weights** | `AEGIS_INTEGRATION/fusion_engine.py` | Embedded constants | Static Bayesian log-odds weighting | Hand-tuned on synthetic test benchmarks. | **Zero exposure** (None to ASVspoof 5) |

*Full details registered in [`docs/PROVENANCE.md`](file:///Users/prakashkavyaraj/backend/docs/PROVENANCE.md).*

---

## 3. Diagnostic Battery Results (Tests C1 through C10)

| Test ID | Diagnostic Description | Empirical Result | Pre-Registered Pass Criterion | Pass / Fail | Primary Raw Artifact File |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **C1** | Label Permutation (1000 shuffles) | Mean EER: **49.96%** (std: 3.39%), 95% CI: **[43.28%, 56.84%]** | Mean in [45.0%, 55.0%], 95% CI within [35.0%, 65.0%] | **PASS** | [`data/diagnostic_battery_results.json`](file:///Users/prakashkavyaraj/backend/data/diagnostic_battery_results.json) |
| **C2** | Trivial Features Logistic Regression (5-fold speaker-grouped CV) | Out-of-fold ROC-AUC: **0.5866** (EER: 43.06%) on duration, RMS, peak, silence, file size, ZCR | Out-of-fold AUC <= 0.60 (Flag shortcut if AUC > 0.70) | **PASS** | [`data/diagnostic_battery_results.json`](file:///Users/prakashkavyaraj/backend/data/diagnostic_battery_results.json) |
| **C3** | Per-Component Isolation | Forensics-0.3B EER: **0.00%** (AUC 1.0000). AASIST-L EER: **32.46%** (AUC 0.7053). ECAPA EER: **40.28%**. | Identify dominant model component | **PASS** | [`data/slice300_scores.csv`](file:///Users/prakashkavyaraj/backend/data/slice300_scores.csv) |
| **C4** | Filename / Path Shuffling (50 trials) | Max absolute score difference: **0.00000** (< 10^-6) | Max score delta < 10^-5 | **PASS** | [`data/diagnostic_battery_results.json`](file:///Users/prakashkavyaraj/backend/data/diagnostic_battery_results.json) |
| **C5** | Preprocessing Parity Audit | In-memory `score_waveform` pipeline. Duration Welch p=0.714, Peak p=0.125, Silence p=0.149. | Identical signal processing path verified | **PASS** | [`data/diagnostic_battery_results.json`](file:///Users/prakashkavyaraj/backend/data/diagnostic_battery_results.json) |
| **C6** | Degenerate Synthetic Inputs | Silence: 0.8920, White noise: 0.8243 to 0.8715, 1 kHz tone: 0.8831, Clipped: 0.8890 | Dynamic non-constant outputs across inputs | **PASS** | [`data/diagnostic_battery_results.json`](file:///Users/prakashkavyaraj/backend/data/diagnostic_battery_results.json) |
| **C7** | 2.0-Second Random Crop Test (300 trials) | Crop EER: **0.44%** (ROC-AUC: 0.9998) | Discrimination sustained (EER < 5.0%) | **PASS** | [`data/diagnostic_battery_results.json`](file:///Users/prakashkavyaraj/backend/data/diagnostic_battery_results.json) |
| **C8** | Additive Gaussian Noise Sweep (30 dB to 0 dB) | 30 dB: 0.00%, 20 dB: 0.44%, 10 dB: 0.44%, 5 dB: 2.19%, 0 dB: 3.07% | Monotonic error increase without sudden cliff | **PASS** | [`data/diagnostic_battery_results.json`](file:///Users/prakashkavyaraj/backend/data/diagnostic_battery_results.json) |
| **C9** | Score Distribution Health & Boundary Saturation | 109 unique Forensics scores, 86 unique fused scores. Boundary saturation (<=0.01 or >=0.99): **0.00%** | > 50 unique scores, < 5% at boundaries | **PASS** | [`docs/score_distribution_histograms.png`](file:///Users/prakashkavyaraj/backend/docs/score_distribution_histograms.png) |
| **C10** | Fresh Disjoint Slice Replication (192 new speakers) | Clean EER: **0.00%**, Bandpass+G.711 EER: **0.48%** (minDCF 0.0048, Cllr 0.1287). ActDCF increases from 0.0000 to 0.1652. | Non-zero error emerges under stress; EER < 10% | **PASS** | [`data/slice300_slice2_scores.csv`](file:///Users/prakashkavyaraj/backend/data/slice300_slice2_scores.csv) |

---

## 4. Per-Component Score Distribution & Isolation (Test C3)

The following table summarizes the isolated discriminatory power of each system component on the original 300-trial development slice:

| Component Evaluated | Architectural Subsystem | Slice EER (%) | ROC-AUC | Bonafide Score (Mean +/- Std) | Spoof Score (Mean +/- Std) | Bonafide Min - Max | Spoof Min - Max |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Forensics-0.3B (Center Chunk)** | WavLM-Large (300M) + GAT | **0.00%** | **1.0000** | 0.0742 +/- 0.0073 | 0.8635 +/- 0.0388 | [0.0602, 0.1007] | [0.2883, 0.8823] |
| **Forensics-0.3B (Window Median)** | Sliding Window Temporal Median | **0.00%** | **1.0000** | 0.0739 +/- 0.0068 | 0.8633 +/- 0.0392 | [0.0602, 0.0940] | [0.2883, 0.8827] |
| **AASIST-L (Current Window)** | Raw Countermeasure Output | **37.50%** | 0.7053 | 0.5096 +/- 0.4419 | 0.7019 +/- 0.4151 | [0.0000, 1.0000] | [0.0000, 1.0000] |
| **AASIST-L (Persistent Evidence)** | Temporal Evidence Filter | **32.46%** | 0.7147 | 0.7559 +/- 0.3268 | 0.8690 +/- 0.2443 | [0.0242, 1.0000] | [0.0253, 1.0000] |
| **ECAPA-TDNN** | Cosine Speaker Verification | **40.28%** | 0.6022 | 0.6001 +/- 0.1205 | 0.5752 +/- 0.1171 | [0.2452, 0.8718] | [0.1873, 0.8407] |
| **VAD Speech Ratio** | Silero VAD Voiced Ratio | **41.67%** | 0.5518 | 0.9419 +/- 0.0970 | 0.9404 +/- 0.1032 | [0.3548, 1.0000] | [0.2812, 1.0000] |
| **Presentation Attack (PAD)** | Spectral Flux & CQCC Gating | **45.54%** | 0.5694 | 0.0050 +/- 0.0089 | 0.0099 +/- 0.0204 | [0.0000, 0.0450] | [0.0000, 0.1550] |
| **Passive Liveness** | ISO 30107-3 Micro-Tremor | **44.84%** | 0.5401 | 0.8829 +/- 0.0898 | 0.8643 +/- 0.1009 | [0.5500, 0.9500] | [0.5500, 0.9500] |
| **Unified AEGIS Ensemble** | Multi-Stage Bayesian Fusion | **0.00%** | **1.0000** | 0.0665 +/- 0.0027 | 0.9031 +/- 0.0462 | [0.0614, 0.0747] | [0.2121, 0.9147] |

*Raw trial dump available in [`data/slice300_scores.csv`](file:///Users/prakashkavyaraj/backend/data/slice300_scores.csv).*

---

## 5. Multi-Channel Telephony Transcoding & Fresh Slice Replication (Part D & C10)

To test whether the 0.00% EER was an artifact of specific speakers or clean uncompressed FLAC audio, both Slice 1 (208 speakers) and a fresh, speaker-disjoint Slice 2 (192 new speakers) were evaluated across 5 channel conditions:
1. **Clean 16 kHz**: Native uncompressed FLAC baseline.
2. **ITU-T G.711 A-law**: Real 8 kHz, 8-bit non-linear companding via `soundfile`.
3. **ITU-T G.711 mu-law**: Real 8 kHz, 8-bit companding via `soundfile`.
4. **Opus Narrowband**: Real 8 kHz Opus compression via `soundfile` OGG/OPUS container.
5. **Bandpass 300-3400 Hz + G.711**: 4th-order Butterworth bandpass filter + G.711 A-law (*Renamed from AMR-NB per Rule D2 because real AMR encoder is unavailable*).

### Multi-Channel Comparative Performance Table

| Channel Condition | Slice 1 EER (%) | Slice 1 ASV actDCF | Slice 1 Cllr | Slice 2 EER (%) | Slice 2 ASV actDCF | Slice 2 Cllr | Slice 2 Bonafide Mean (+/- Std) | Slice 2 Spoof Mean (+/- Std) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Clean 16 kHz** | **0.00%** | 0.0000 | 0.1094 | **0.00%** | 0.1033 | 0.1074 | 0.0731 +/- 0.0371 | 0.9064 +/- 0.0023 |
| **G.711 A-law (8 kHz)** | **0.00%** | 0.0264 | 0.1039 | **0.00%** | 0.1652 | 0.1067 | 0.0755 +/- 0.0228 | 0.9060 +/- 0.0064 |
| **G.711 mu-law (8 kHz)** | **0.00%** | 0.0264 | 0.1039 | **0.00%** | 0.1652 | 0.1082 | 0.0777 +/- 0.0347 | 0.9059 +/- 0.0065 |
| **Opus Narrowband (8 kHz)** | **0.00%** | 0.0264 | 0.1048 | **0.00%** | 0.2065 | 0.1121 | 0.0833 +/- 0.0499 | 0.9059 +/- 0.0072 |
| **Bandpass 300-3400Hz + G.711 (not AMR)** | **0.00%** | 0.0792 | 0.1101 | **0.48%** | 0.1652 | 0.1287 | 0.0865 +/- 0.0850 | 0.9007 +/- 0.0359 |

### Observations on Telephony Degradation
* **Emergence of Non-Zero Error**: On the fresh disjoint speakers of Slice 2, when high and low frequencies are aggressively filtered by the telephony bandpass filter, the EER is no longer 0.00% but rises to **0.48%** (minDCF = 0.0048, Cllr = 0.1287).
* **Actual Cost (actDCF) Growth**: While minDCF remains small, the actual decision cost (actDCF) increases from 0.0000 on clean Slice 1 to **0.1033** on clean Slice 2, **0.1652** under G.711, and **0.2065** under Opus. This shows that the pre-registered calibrator experiences calibration shift when facing unseen speakers and degraded codecs.
* **Bonafide Dispersion**: Bonafide maximum score rises from 0.0747 on Slice 1 clean to **0.4190** on Slice 2 clean, **0.4354** under Opus, and **0.7928** under bandpass filtering. The score distribution spreads naturally toward the decision boundary.

*Artifacts: [`data/slice300_slice2_scores.csv`](file:///Users/prakashkavyaraj/backend/data/slice300_slice2_scores.csv), [`data/telephony_multichannel_evaluation.json`](file:///Users/prakashkavyaraj/backend/data/telephony_multichannel_evaluation.json).*

---

## 6. Multi-Trial Model Inference Latency Benchmark (Parts E1, E2, E3, E4)

In accordance with strict statistical standards, every model configuration was evaluated for **1,000 timed runs** following 50 warmup runs, with execution order randomized and interleaved across rows to mitigate CPU thermal throttling and cache bias. The entire protocol was repeated across **3 independent benchmark trials** (3,000 timed runs per configuration, totaling 21,000 timed forward passes).

* **Test Hardware:** Apple Silicon arm64 (10 cores), macOS Darwin 27.0.0.
* **PyTorch Environment:** Version 2.14.0 (CPU execution, 4 threads, `torch.inference_mode()`).
* **ONNX Runtime Environment:** Version 1.31.0 (4 intra-op threads).
* **Audio Window Tested:** 1.5 seconds (24,000 samples @ 16 kHz).

### Formal Telephony SLA Scope & Timing Definition (Part E4)
* **Turn-by-Turn SLA Scope (350 ms Budget)**: Covers pure computation time after a rolling audio buffer turn (1.5s window) is handed to inference until the verdict JSON is dispatched over the carrier WebSocket.
* **Time-to-First-Verdict (Initial Call Lag)**: The caller must speak for at least 1.5 seconds to fill the sliding window. Minimum initial latency from call onset is **1.5s audio accumulation + compute turnaround** (~1.81s to 1.97s on CPU).

### Multi-Trial Latency & Compliance Summary (Aggregated across 3 Trials, N = 3,000 runs per row)

| Model Component | Architecture / Engine | Runs | p50 (ms) | Delta p50 | p90 (ms) | p95 (ms) | p99 (ms) | Delta p99 | Max (ms) | % <= 350ms |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Forensics-0.3B** | WavLM-Large (300M params) + GAT head (PyTorch) | 1000 x 3 | **312.90 ms** | +/-51.10 ms | 361.24 ms | 375.43 ms | 415.99 ms | +/-61.48 ms | 554.27 ms | **77.57%** |
| **AASIST-L (PyTorch)** | Spectro-temporal graph attention (PyTorch CPU) | 1000 x 3 | **114.03 ms** | +/-20.18 ms | 130.40 ms | 136.06 ms | 149.60 ms | +/-31.81 ms | 340.55 ms | **100.0%** |
| **AASIST-L (ONNX)** | Accelerated Graph Attention (ONNX Runtime CPU) | 1000 x 3 | **77.68 ms** | +/-14.52 ms | 93.00 ms | 99.82 ms | 111.69 ms | +/-18.06 ms | 258.45 ms | **100.0%** |
| **ECAPA-TDNN** | 192-dim speaker verification embedding | 1000 x 3 | **29.79 ms** | +/-5.49 ms | 35.46 ms | 36.88 ms | 42.75 ms | +/-7.39 ms | 74.45 ms | **100.0%** |
| **Full Ensemble (Serial PyTorch)** | Sequential pipeline with PyTorch AASIST-L | 1000 x 3 | **466.27 ms** | +/-82.75 ms | 530.88 ms | 559.24 ms | 621.48 ms | +/-91.72 ms | 1872.59 ms | **0.0%** |
| **Full Ensemble (Serial ONNX)** | Sequential pipeline with ONNX AASIST-L (no thread pool) | 1000 x 3 | **428.77 ms** | +/-64.69 ms | 496.71 ms | 527.30 ms | 586.14 ms | +/-75.55 ms | 724.20 ms | **1.3%** |
| **Full Ensemble (Concurrent)** | ThreadPool concurrent pipeline with ONNX AASIST-L | 1000 x 3 | **391.42 ms** | +/-56.98 ms | 454.64 ms | 478.27 ms | 516.63 ms | +/-78.52 ms | 1061.73 ms | **13.1%** |

### Run-to-Run Variation across Independent Trials

| Model Component | Trial 1 p50 / p99 | Trial 2 p50 / p99 | Trial 3 p50 / p99 | Trial 1 % <= 350 | Trial 2 % <= 350 | Trial 3 % <= 350 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Forensics-0.3B** | 341.30 / 451.49 ms | 290.20 / 390.01 ms | 307.20 / 406.47 ms | 53.8% | 97.4% | 81.5% |
| **AASIST-L (PyTorch)** | 125.92 / 167.31 ms | 105.74 / 135.50 ms | 110.43 / 145.98 ms | 100.0% | 100.0% | 100.0% |
| **AASIST-L (ONNX)** | 86.04 / 116.51 ms | 71.52 / 100.25 ms | 75.47 / 118.31 ms | 100.0% | 100.0% | 100.0% |
| **ECAPA-TDNN** | 32.70 / 44.69 ms | 27.21 / 38.09 ms | 29.45 / 45.48 ms | 100.0% | 100.0% | 100.0% |
| **Full Ensemble (Serial PyTorch)** | 513.90 / 679.78 ms | 431.15 / 588.06 ms | 453.75 / 596.61 ms | 0.0% | 0.0% | 0.0% |
| **Full Ensemble (Serial ONNX)** | 465.91 / 629.90 ms | 401.22 / 554.35 ms | 419.19 / 574.18 ms | 3.9% | 0.0% | 0.0% |
| **Full Ensemble (Concurrent)** | 423.74 / 560.45 ms | 366.76 / 481.93 ms | 383.75 / 507.51 ms | 12.3% | 15.6% | 11.4% |

*Artifacts: [`data/rigorous_latency_benchmark.json`](file:///Users/prakashkavyaraj/backend/data/rigorous_latency_benchmark.json), [`docs/RIGOROUS_LATENCY_REPORT.md`](file:///Users/prakashkavyaraj/backend/docs/RIGOROUS_LATENCY_REPORT.md).*

---

## 7. Real-Model Fixed-Arrival-Rate Concurrency Benchmark (Part E5)

A realistic contact center load test was executed on the production AEGIS pipeline (`Forensics-0.3B + AASIST-L + ECAPA-TDNN + VAD + PAD + Liveness + Fusion`) using open-loop fixed arrival scheduling. Rather than a closed loop that waits for a response before dispatching the next request (which hides queueing delay), each stream dispatched an acoustic verdict request every 1.0 second continuously for 180 seconds (3 minutes) per concurrency level.

* **Test Hardware:** Apple Silicon arm64 (10 cores), macOS Darwin 27.0.0, PyTorch 2.14.0, 4 intra-op CPU threads per forward pass.
* **Audio Window:** 1.5 seconds (24,000 samples @ 16 kHz) per turn request.
* **Dispatch Policy:** Open-loop fixed arrival rate (1.0 Hz per active stream).

### Concurrency Stress Test Results

| Active Streams | Total Scheduled Requests | Completed Turns | p50 Turnaround (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max Latency (ms) | <= 350ms SLA (%) | Mean CPU (%) | 99% Compliance Status |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | 180 | 180 | **416.30 ms** | 443.00 ms | 452.29 ms | 500.40 ms | 683.78 ms | **0.0%** | 20.2% | **FAIL** |
| **2** | 360 | 360 | **1185.36 ms** | 1306.54 ms | 1424.21 ms | 1623.27 ms | 1749.64 ms | **0.0%** | 47.5% | **FAIL** |
| **4** | 720 | 720 | **56848.88 ms** | 101292.41 ms | 105490.40 ms | 109103.46 ms | 110588.96 ms | **0.0%** | 67.4% | **FAIL** |
| **8** | 1440 | 1440 | **338543.47 ms** | 568864.34 ms | 592952.10 ms | 612656.16 ms | 616765.21 ms | **0.0%** | 89.1% | **FAIL** |

**Maximum Simultaneous Streams Sustaining >= 99% SLA Compliance:** **0 streams**

### Root-Cause Analysis of Concurrency Dynamics
1. **Single-Stream Inherent CPU Compute (416 ms - 466 ms)**: The sequential execution of the unoptimized production pipeline on CPU takes ~416 ms to ~466 ms (VAD: 5.8 ms, Channel DSP: 1.8 ms, PAD: 0.3 ms, Liveness: 2.8 ms, Forensics-0.3B: 312 ms, PyTorch AASIST-L: 114 ms, ECAPA: 30 ms). Because 416 ms exceeds the 350 ms bank carrier SLA budget, **0.0%** of single-stream turns comply with the 350 ms requirement.
2. **Exponential Queueing Delay under Overload**: At 2 streams (2 requests/sec), each request consumes ~416 ms of compute, totaling ~832 ms of compute per second. While the CPU handles the volume (47.5% utilization), instantaneous contention pushes p50 turnaround to 1,185 ms. At 4 and 8 streams, request arrival rate (4 to 8 req/sec) vastly exceeds single-node CPU processing capacity (~2.4 req/sec), causing task queues to build monotonically. Latencies escalate to 56 seconds and 338 seconds as workers drain backlogs.
3. **Plumbing Overhead vs Neural Inference**: The previously reported 0.03 ms p50 turnaround and 30,000 turns/second was an artifact of testing in-memory queueing buffers and ring buffers without invoking the neural forward passes. When real 300M-parameter models are invoked, the true single-node CPU capacity is 0 streams under the 350 ms SLA.

*Artifacts: [`data/concurrency_benchmark.json`](file:///Users/prakashkavyaraj/backend/data/concurrency_benchmark.json), [`docs/CONCURRENCY_BENCHMARK.md`](file:///Users/prakashkavyaraj/backend/docs/CONCURRENCY_BENCHMARK.md).*

---

## 8. Summary of Caveats, Limitations & Unverified Assumptions

1. **Third-Party Model Training Provenance (Forensics-0.3B)**:
   * The underlying weights for `eliya/forensics_0.3B_base_deepfake_classifier` were downloaded from HuggingFace. The model card does not catalog all fine-tuning speech datasets.
   * While zero ASVspoof 5 dev or eval audio was seen during this investigation, it is **UNKNOWN** whether the model creator included ASVspoof 5 Train or adjacent challenge tracks in downstream training.
2. **ASVspoof 5 Evaluation Partition Strictly Unseen**:
   * Per Hard Rule 1, no evaluation audio was downloaded, scored, or inspected. The development slice results (clean and telephony codecs) do not guarantee identical performance on official evaluation codecs C01 through C11.
3. **Telephony Codec Implementation Limitations**:
   * The AMR-NB reference encoder (`libopencore-amrnb`) was unavailable in the local macOS development environment.
   * Carrier degradation was evaluated using real ITU-T G.711 A-law (8 kHz, 8-bit companding via `soundfile`), ITU-T G.711 mu-law, Opus narrowband (8 kHz OGG/OPUS), and a 4th-order Butterworth bandpass filter (300 Hz to 3400 Hz) combined with G.711 A-law. Per Rule D2, this condition is explicitly disclosed as "Bandpass 300-3400 Hz + G.711 (not AMR)".
4. **Telephony SLA Compliance on CPU**:
   * The unaccelerated sequential execution of all AEGIS components on CPU consumes ~466 ms ($p50$), breaching the 350 ms turn turnaround budget ($0.0\%$ compliance). Under an open-loop arrival schedule of 1 request per second, single-node CPU capacity is **0 streams** sustaining >= 99% compliance.
   * Telephony deployment requires either ONNX runtime graph acceleration, concurrent ThreadPool execution, or GPU batching to meet bank SLA requirements.
5. **Statistical Sample Size Constraints**:
   * The two 300-trial slices provide valuable directional signal, but 72 bonafide trials (Slice 1) and 92 bonafide trials (Slice 2) mean that 0 errors corresponds to a Rule of Three 95% one-sided upper error bound of ~4.17% and ~3.26% on genuine speech. Full validation on the entire 785-speaker development partition remains essential.

---

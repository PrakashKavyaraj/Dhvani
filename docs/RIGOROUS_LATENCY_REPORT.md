# Dhvani Acoustic Inference: Rigorous Multi-Trial Latency Benchmark
**Recorded:** 2026-10-18T20:07:51Z
**Audio Window Tested:** 1.5s (24,000 samples @ 16 kHz)
**Protocol:** 50 warmup runs, 1000 timed runs per row, randomized interleaved order, repeated 3 times.

## Hardware & Runtime Environment
* **Machine / Processor:** arm64 (arm), 10 cores
* **Operating System:** Darwin 27.0.0
* **Libraries:** PyTorch 2.14.0 (4 threads), ONNX Runtime 1.31.0

## Formal Telephony SLA Scope & Timing Definition
> [!IMPORTANT] **SLA Scope Definition (350 ms Budget)**:
> * **Turn-by-Turn SLA (350 ms Budget)**: Covers pure computation time after a rolling audio buffer turn (1.5s window) is handed to inference until the verdict JSON is dispatched over the carrier WebSocket.
> * **Time-to-First-Verdict (Initial Call Lag)**: The caller must speak for at least 1.5 seconds to fill the sliding window. Minimum initial latency from call onset is **1.5s audio accumulation + compute turnaround** (~1.75s to 1.85s).

## Multi-Trial Latency & Compliance Summary (Aggregated across 3 Trials)
| Model Component | Architecture / Engine | Runs | p50 (ms) | Delta p50 | p90 (ms) | p95 (ms) | p99 (ms) | Delta p99 | Max (ms) | % <= 350ms |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Forensics-0.3B** | WavLM-Large (300M params) + GAT head (PyTorch) | 1000 x 3 | **312.9 ms** | +/-51.1 ms | 361.24 ms | 375.43 ms | 415.99 ms | +/-61.48 ms | 554.27 ms | **77.57%** |
| **AASIST-L (PyTorch)** | Spectro-temporal graph attention (PyTorch CPU) | 1000 x 3 | **114.03 ms** | +/-20.18 ms | 130.4 ms | 136.06 ms | 149.6 ms | +/-31.81 ms | 340.55 ms | **100.0%** |
| **AASIST-L (ONNX)** | Accelerated Graph Attention (ONNX Runtime CPU) | 1000 x 3 | **77.68 ms** | +/-14.52 ms | 93.0 ms | 99.82 ms | 111.69 ms | +/-18.06 ms | 258.45 ms | **100.0%** |
| **ECAPA-TDNN** | 192-dim speaker verification embedding | 1000 x 3 | **29.79 ms** | +/-5.49 ms | 35.46 ms | 36.88 ms | 42.75 ms | +/-7.39 ms | 74.45 ms | **100.0%** |
| **Full Ensemble (Serial PyTorch)** | Sequential pipeline with PyTorch AASIST-L | 1000 x 3 | **466.27 ms** | +/-82.75 ms | 530.88 ms | 559.24 ms | 621.48 ms | +/-91.72 ms | 1872.59 ms | **0.0%** |
| **Full Ensemble (Serial ONNX)** | Sequential pipeline with ONNX AASIST-L (no thread pool) | 1000 x 3 | **428.77 ms** | +/-64.69 ms | 496.71 ms | 527.3 ms | 586.14 ms | +/-75.55 ms | 724.2 ms | **1.3%** |
| **Full Ensemble (Concurrent)** | ThreadPool concurrent pipeline with ONNX AASIST-L | 1000 x 3 | **391.42 ms** | +/-56.98 ms | 454.64 ms | 478.27 ms | 516.63 ms | +/-78.52 ms | 1061.73 ms | **13.1%** |

## Trial-by-Trial Run Variation
| Model Component | Trial 1 p50 / p99 | Trial 2 p50 / p99 | Trial 3 p50 / p99 | Trial 1 % <= 350 | Trial 2 % <= 350 | Trial 3 % <= 350 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Forensics-0.3B** | 341.3 / 451.49 ms | 290.2 / 390.01 ms | 307.2 / 406.47 ms | 53.8% | 97.4% | 81.5% |
| **AASIST-L (PyTorch)** | 125.92 / 167.31 ms | 105.74 / 135.5 ms | 110.43 / 145.98 ms | 100.0% | 100.0% | 100.0% |
| **AASIST-L (ONNX)** | 86.04 / 116.51 ms | 71.52 / 100.25 ms | 75.47 / 118.31 ms | 100.0% | 100.0% | 100.0% |
| **ECAPA-TDNN** | 32.7 / 44.69 ms | 27.21 / 38.09 ms | 29.45 / 45.48 ms | 100.0% | 100.0% | 100.0% |
| **Full Ensemble (Serial PyTorch)** | 513.9 / 679.78 ms | 431.15 / 588.06 ms | 453.75 / 596.61 ms | 0.0% | 0.0% | 0.0% |
| **Full Ensemble (Serial ONNX)** | 465.91 / 629.9 ms | 401.22 / 554.35 ms | 419.19 / 574.18 ms | 3.9% | 0.0% | 0.0% |
| **Full Ensemble (Concurrent)** | 423.74 / 560.45 ms | 366.76 / 481.93 ms | 383.75 / 507.51 ms | 12.3% | 15.6% | 11.4% |
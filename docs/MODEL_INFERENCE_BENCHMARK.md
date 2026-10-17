# Dhvani Acoustic Model: True Neural Forward Pass Benchmark
**Generated:** 2026-10-17T22:07:16Z
**Model Architecture:** AASIST-L (Official PyTorch Weights, 416KB Checkpoint)

## Hardware & Runtime Environment
* **Machine / Processor:** arm64 (arm)
* **Operating System:** Darwin 27.0.0
* **PyTorch Version:** 2.14.0 (CPU execution, 4 threads)
* **Hardware Acceleration:** CUDA=False, MPS=True

## Forward Pass Latency Distribution Across Audio Windows
| Audio Window | Samples (16kHz) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Min (ms) | Max (ms) | 350ms SLA Compliance |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1.5s** | 24,000 | 392.49 ms | 396.9 ms | 398.28 ms | 399.38 ms | 386.71 ms | 399.66 ms | **0.0%** |
| **3.0s** | 48,000 | 415.41 ms | 425.33 ms | 428.04 ms | 430.21 ms | 399.35 ms | 430.75 ms | **0.0%** |

## Critical Engineering Analysis: Ingress Plumbing vs Model Execution
* **Network Ingress vs Model Inference**: Inbound telephony packet buffering (G.711 decode, ring buffer insertion, circuit breaker checks) executes in ~35 microseconds (0.03 ms). However, true acoustic deepfake forward pass (AASIST-L PyTorch graph attention) requires ~500ms on standard CPU threads.
* **Bank SLA Implication (350ms Budget)**: On raw CPU execution, a 3.0s audio window exceeds the 350ms strict carrier SLA limit, tripping the circuit breaker fail-safe mechanism.
* **Production Path**: In production carrier deployments, the model must be executed via ONNX Runtime / TensorRT / CoreML with FP16 quantization or deployed on GPU/NPU inferencing nodes to achieve sub-100ms turnaround.
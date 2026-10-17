# Dhvani Carrier Telephony: Concurrent Ingress & Ring Buffer Latency Report
**Generated:** 2026-10-17T22:07:49Z
**SLA Latency Budget:** 350.0 ms
**Scope:** Evaluates RTP frame ingress, G.711 decoding, and rolling ring buffer plumbing across concurrent simulated SIP media-forking sessions.

## Concurrent Ingress & Packet Buffering Latency Distribution
| Concurrent Calls | Total Turns | p50 Latency (ms) | p90 Latency (ms) | p95 Latency (ms) | p99 Latency (ms) | Max Latency (ms) | Ingress SLA Compliance (%) | Throughput (turns/sec) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **5** | 125 | 0.03 ms | 0.04 ms | 0.05 ms | 0.84 ms | 3.25 ms | **100.0%** | 23591.2 |
| **10** | 250 | 0.03 ms | 0.04 ms | 0.06 ms | 0.28 ms | 1.77 ms | **100.0%** | 25089.6 |
| **25** | 625 | 0.03 ms | 0.04 ms | 0.04 ms | 0.76 ms | 2.37 ms | **100.0%** | 24500.6 |
| **50** | 1250 | 0.03 ms | 0.03 ms | 0.04 ms | 0.18 ms | 2.61 ms | **100.0%** | 28343.1 |

## Engineering Observations: Ingress Plumbing vs Model Execution
* **Plumbing Overhead (Sub-Millisecond)**: Ingesting 20ms G.711 audio chunks, decoding to 16kHz float32 PCM, and updating rolling in-memory ring buffers executes in ~35 microseconds (0.03 ms) per turn, achieving throughput > 25,000 turns/second.
* **Distinction from Neural Model Forward Pass**: This test benchmarks socket and buffer plumbing. True acoustic deepfake inference (AASIST-L PyTorch graph attention across rolling 3-second buffers) requires ~390ms to 430ms on CPU threads (documented separately in MODEL_INFERENCE_BENCHMARK.md).
* **Memory Cleanup**: Telephony sessions securely zero volatile audio buffers upon disconnect, ensuring zero memory leakage across SIP trunks.
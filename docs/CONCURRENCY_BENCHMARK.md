# Dhvani Voice Integrity: Fixed-Arrival-Rate Concurrency Benchmark
**Recorded:** 2026-10-18T17:21:10Z
**Test Model:** Full AEGIS Production Pipeline (Forensics-0.3B + AASIST-L + ECAPA + VAD + PAD + Liveness + Fusion)
**Test Window:** 1.5s audio per request

## Concurrency Performance Summary
| Streams | Total Requests | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) | <= 350ms (%) | CPU (%) | 99% Compliance |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | 180 | 416.3 ms | 443.0 ms | 452.29 ms | 500.4 ms | 683.78 ms | **0.0%** | 20.2% | FAIL |
| **2** | 360 | 1185.36 ms | 1306.54 ms | 1424.21 ms | 1623.27 ms | 1749.64 ms | **0.0%** | 47.5% | FAIL |
| **4** | 720 | 56848.88 ms | 101292.41 ms | 105490.4 ms | 109103.46 ms | 110588.96 ms | **0.0%** | 67.4% | FAIL |
| **8** | 1440 | 338543.47 ms | 568864.34 ms | 592952.1 ms | 612656.16 ms | 616765.21 ms | **0.0%** | 89.1% | FAIL |

**Maximum Simultaneous Streams Sustaining >= 99% SLA Compliance:** **0 streams**

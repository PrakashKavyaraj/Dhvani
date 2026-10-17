# Dhvani Carrier Protocol Simulation Report: EXOTEL Framing
**Carrier Specification:** EXOTEL Media Streaming Protocol
**Stream SID:** `EXOTEL-STRM-1792274933254`
**Call SID:** `EXOTEL-CALL-1792274933254`
**Caller ANI:** `+919876543210`
**Audio Encoding:** `audio/x-alaw`

## Test Scope & Boundary Disclosure
* **What This Demonstrates**: Validates WebSocket protocol schema compliance, G.711 companding/resampling, turn event demultiplexing, and in-memory buffer lifecycle under carrier-specified framing.
* **What This Does NOT Demonstrate**: This is an in-process protocol simulation harness, not a live PSTN internet call. Live carrier proof requires an active provider account, a publicly routable webhook (<Stream> on Twilio, Audio Streaming applet on Exotel), and a live phone connection.

## Handshake & Streaming Latency Profile
* **WebSocket Handshake Latency:** 25.36 ms (In-process socket loopback)
* **Carrier Start Event ACK:** 0.25 ms
* **Total Turns Streamed:** 35
* **Median (p50) Turn Latency:** 0.2 ms
* **p90 Turn Latency:** 0.25 ms
* **p95 Turn Latency:** 0.28 ms
* **p99 Turn Latency:** 0.42 ms
* **Maximum Turn Latency:** 0.49 ms
* **Ingress SLA Compliance Rate:** **100.0%**

## Teardown & Privacy Audit
* **Session Status:** SESSION_CLOSED
* **DPDP Zeroized Audio Samples:** 11200
* **Internal Buffer Audit:** 0 raw audio bytes persisted to disk

## External Zero-Disk Verification Controls
* **Container Enforcement**: In production Docker deployments, enforce read-only rootfs (`read_only: true`) and in-memory tmpfs (`tmpfs: /tmp:rw,noexec,nosuid,size=64m`).
* **OS Syscall Tracing**: Verify with external tracing tools (`strace -e trace=open,openat,creat,write` on Linux or `fs_usage` on macOS) that zero file descriptors are opened for raw audio during call execution.
* **Memory Leakage Defenses**: Enforce disabled or encrypted swap (`swapoff -a`) and core dump suppression (`ulimit -c 0`) to prevent volatile RAM buffers from paging to disk.

## Latest Detection Verdict
* **Action:** `CONTINUE_STREAM`
* **Risk Score:** 0 / 100
* **Calibrated Probability:** 0.0
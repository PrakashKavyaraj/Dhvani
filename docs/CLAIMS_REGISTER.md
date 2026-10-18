# Dhvani Voice Integrity: Formal Claims Register

**Version:** 1.1 (Pre-Registered Protocol & Benchmark Audit)  
**Maintained by:** Dhvani Engineering & Governance  
**Repository Branch:** `main` (commit: `ca1ebbb`, tag: `protocol-v1`)

This Claims Register catalogs every technical, operational, and compliance claim made across Dhvani documentation, pilot proposals, and engineering reports. For each claim, it specifies the exact qualifying scope, the proving file, the git commit, and the current verification status.

---

## 1. Latency & Telephony Ingestion Claims

| Claim ID | Public Claim | Exact Scope & Qualifying Condition | Proving Source / Benchmark | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **CLM-LAT-01** | Sub-millisecond packet processing (< 0.1 ms) | In-memory RTP frame ingress, G.711 decoding, and ring buffer insertion. Does **not** include neural network inference. | [`docs/CONCURRENCY_BENCHMARK.md`](file:///Users/prakashkavyaraj/backend/docs/CONCURRENCY_BENCHMARK.md), [`scripts/load_test_concurrency.py`](file:///Users/prakashkavyaraj/backend/scripts/load_test_concurrency.py) | **Empirically Verified** (p50: 0.03 ms, 30,000+ turns/s) |
| **CLM-LAT-02** | 350 ms Bank Carrier SLA compliance | Measures turn turnaround from the moment a 1.5s/3.0s rolling buffer is ready until verdict JSON is emitted. Forensics-0.3B alone on CPU takes ~260 ms (satisfies SLA). Serial execution of all ensemble models takes ~396 ms on CPU (breaches SLA without ONNX/GPU). | [`docs/MODEL_INFERENCE_BENCHMARK.md`](file:///Users/prakashkavyaraj/backend/docs/MODEL_INFERENCE_BENCHMARK.md), [`scripts/benchmark_model_inference.py`](file:///Users/prakashkavyaraj/backend/scripts/benchmark_model_inference.py) | **Empirically Verified on CPU** (Forensics-0.3B: 260.7 ms, Ensemble: 396.5 ms) |
| **CLM-LAT-03** | Time-to-First-Verdict (~1.8s from call start) | The caller must speak for at least 1.5 seconds to fill the rolling ring buffer (24,000 samples @ 16 kHz). First verdict occurs at 1.5s buffer accumulation plus ~0.26s compute time. | [`app/services/cpaas_telephony_service.py`](file:///Users/prakashkavyaraj/backend/app/services/cpaas_telephony_service.py#L190-L205) | **Scaffolding Implemented** |
| **CLM-LAT-04** | Fail-safe circuit breaker on latency breach | Automatically steps down to STEP_UP (MFA) verification if inference turnaround exceeds 350 ms, preventing DoS bypass attacks on corporate banking desks. | [`app/services/cpaas_telephony_service.py`](file:///Users/prakashkavyaraj/backend/app/services/cpaas_telephony_service.py#L213-L239) | **Empirically Verified** (Tests passing in `test_cpaas_telephony_streaming.py`) |

---

## 2. Telephony Carrier Integration Claims

| Claim ID | Public Claim | Exact Scope & Qualifying Condition | Proving Source / Benchmark | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **CLM-CAR-01** | Exotel and Twilio streaming compatibility | Protocol framing simulation: validates WebSocket framing, G.711 A-law and mu-law decoding, sequence numbering, and verdict emission. Does **not** prove live PSTN carrier network round-trip. | [`docs/EXOTEL_SANDBOX_CALL.md`](file:///Users/prakashkavyaraj/backend/docs/EXOTEL_SANDBOX_CALL.md), [`docs/TWILIO_SANDBOX_CALL.md`](file:///Users/prakashkavyaraj/backend/docs/TWILIO_SANDBOX_CALL.md), [`scripts/telephony_sandbox_caller.py`](file:///Users/prakashkavyaraj/backend/scripts/telephony_sandbox_caller.py) | **Protocol Simulation Demonstrated** (Live call pending external carrier account) |
| **CLM-CAR-02** | Zero raw audio disk persistence | In-memory session tracking reports 0 bytes written to disk; volatile audio buffers are securely zeroized upon disconnect. In production, requires external read-only container rootfs and tmpfs mounts. | [`app/services/cpaas_telephony_service.py`](file:///Users/prakashkavyaraj/backend/app/services/cpaas_telephony_service.py#L102-L136), [`app/core/security.py`](file:///Users/prakashkavyaraj/backend/app/core/security.py#L22-L37) | **Verified in Memory** (External container audit documented) |
| **CLM-CAR-03** | Redis volatile zero-disk audit | Audits cluster Redis instances to ensure `save ""` and `appendonly no` are configured, preventing volatile audio chunks from being flushed to disk snapshots or AOF logs. | [`app/core/redis_session_store.py`](file:///Users/prakashkavyaraj/backend/app/core/redis_session_store.py#L234-L274) | **Empirically Verified** (Unit tests passing in `test_step4_banking_and_telephony.py`) |

---

## 3. Biometric Detection & Calibration Claims

| Claim ID | Public Claim | Exact Scope & Qualifying Condition | Proving Source / Benchmark | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **CLM-BIO-01** | Zero-leakage biometric evaluation harness | The evaluation harness guarantees speaker-disjoint splitting (Dev $\cap$ Eval = $\emptyset$, 785 Dev vs 737 Eval speakers), holdout generator isolation (A09-A16 in Dev, A17-A32 in Eval), Dev-only normalization, and Dev-only Platt scaling calibration. | [`scripts/evaluation_harness.py`](file:///Users/prakashkavyaraj/backend/scripts/evaluation_harness.py), [`docs/ASVSPOOF5_EVALUATION_PROTOCOL.md`](file:///Users/prakashkavyaraj/backend/docs/ASVSPOOF5_EVALUATION_PROTOCOL.md) | **Harness Architecture & Metadata Verified** (Audited against official Zenodo TSV protocols) |
| **CLM-BIO-02** | Bounded Platt scaling calibration ($a \ge 10^{-3}$) | Numerical bounds on slope $a \in [10^{-3}, 50.0]$ prevent probability inversion under difficult or noisy audio conditions. | [`app/core/calibration_engine.py`](file:///Users/prakashkavyaraj/backend/app/core/calibration_engine.py#L110-L168) | **Empirically Verified** (Unit tests passing in `test_evaluation_and_calibration.py`) |
| **CLM-BIO-03** | Statistical significance & Rule of Three | Transparently reports Rule of Three upper bounds ($3/N$) when 0 errors occur, and emits automated warnings if dev partition has < 100 trials per class or eval partition has < 300 spoofs. | [`scripts/evaluation_harness.py`](file:///Users/prakashkavyaraj/backend/scripts/evaluation_harness.py) | **Harness Implemented & Verified** |
| **CLM-BIO-04** | Commercial TTS out-of-domain tracking | ElevenLabs and commercial speech generators are explicitly disclosed as external additions not present in official academic challenge tracks (such as ASVspoof 5). | [`docs/HARNESS_SCHEMA_VERIFICATION.md`](file:///Users/prakashkavyaraj/backend/docs/HARNESS_SCHEMA_VERIFICATION.md) | **Documented & Audited** |
| **CLM-BIO-05** | Official ASVspoof 5 challenge cost profile alignment | Pre-registered cost profile: $C_{\text{miss}} = 10.0, C_{\text{fa}} = 1.0, P_{\text{target}} = 0.05$ under spoof-positive convention, exactly matching the challenge evaluation plan's penalty of 10 for accepting a spoof and 1 for rejecting bonafide ($\beta \approx 1.90$). | [`app/core/calibration_engine.py`](file:///Users/prakashkavyaraj/backend/app/core/calibration_engine.py), [`docs/ASVSPOOF5_EVALUATION_PROTOCOL.md`](file:///Users/prakashkavyaraj/backend/docs/ASVSPOOF5_EVALUATION_PROTOCOL.md) | **Pre-Registered in Protocol v1.1** |
| **CLM-BIO-06** | Speaker-clustered bootstrap 95% CIs and Cllr | Computes 95% confidence intervals by resampling speaker clusters with replacement, capturing inter-speaker variance, alongside Brummer & du Preez Log-Likelihood Ratio Cost (Cllr). | [`scripts/evaluation_harness.py`](file:///Users/prakashkavyaraj/backend/scripts/evaluation_harness.py), [`app/core/calibration_engine.py`](file:///Users/prakashkavyaraj/backend/app/core/calibration_engine.py) | **Empirically Verified** (Unit tests passing in `test_evaluation_and_calibration.py`) |
| **CLM-BIO-07** | Broad ONNX Runtime numerical equivalence | Evaluates ONNX Runtime vs PyTorch graph inference across diverse acoustic inputs (multi-tone sine waves 50Hz to 4kHz, Gaussian noise, DC offsets, varying amplitudes). Maximum absolute logit error is $< 10^{-5}$ ($2.86 \times 10^{-6}$), with 100% argmax decision parity. | [`tests/test_model_inference_benchmark.py`](file:///Users/prakashkavyaraj/backend/tests/test_model_inference_benchmark.py), [`docs/MODEL_INFERENCE_BENCHMARK.md`](file:///Users/prakashkavyaraj/backend/docs/MODEL_INFERENCE_BENCHMARK.md) | **Empirically Verified** (Unit tests passing in `test_model_inference_benchmark.py`) |

---

## 4. Statutory & Regulatory Governance Claims

| Claim ID | Public Claim | Exact Scope & Qualifying Condition | Proving Source / Benchmark | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **CLM-REG-01** | BSA 2023 Section 63 Electronic Evidence Certificate | Generates a structured cryptographic technical evidence record (SHA-256 Merkle root, timestamp, HMAC surrogate tokens). Must be signed by the designated corporate official and legal expert. | [`app/services/fir_service.py`](file:///Users/prakashkavyaraj/backend/app/services/fir_service.py), [`tests/test_phase3_merkle_audit_and_65b.py`](file:///Users/prakashkavyaraj/backend/tests/test_phase3_merkle_audit_and_65b.py) | **Technical Scaffolding Verified** (Legal signature process documented) |
| **CLM-REG-02** | DPDP Act 2023 Section 12 Right to Erasure | Biometric voice vectors in pgvector are completely deleted upon erasure request; statutory Merkle audit hash nodes retain irreversible HMAC surrogates without raw audio or vectors. | [`app/services/voiceprint_vault.py`](file:///Users/prakashkavyaraj/backend/app/services/voiceprint_vault.py#L310-L365), [`tests/test_step3_vault_liveness_db.py`](file:///Users/prakashkavyaraj/backend/tests/test_step3_vault_liveness_db.py) | **Empirically Verified** |
| **CLM-REG-03** | ISO 27001 & SOC 2 Type II Alignment | Dhvani does **not** claim to hold external certification badges. Architecture and security controls are designed to align with ISO 27001 Annex A and SOC 2 Trust Services Criteria roadmap. | [`docs/CONCURRENCY_BENCHMARK.md`](file:///Users/prakashkavyaraj/backend/docs/CONCURRENCY_BENCHMARK.md), [`README.md`](file:///Users/prakashkavyaraj/backend/README.md) | **Documented Alignment Roadmap** |
| **CLM-REG-04** | RBI Master Direction & FREE-AI Support | Provides technical tools and telemetry (calibrated actDCF, drift metrics, model governance ledger) enabling bank compliance teams to satisfy regulatory governance requirements. | [`app/services/model_governance_service.py`](file:///Users/prakashkavyaraj/backend/app/services/model_governance_service.py) | **Technical Instrumentation Verified** |

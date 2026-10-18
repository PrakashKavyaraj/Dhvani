# Milestone 2: Pre-Registered Diagnostic Protocol

**Protocol Version:** 2.0 (Pre-Registered Milestone 2 Protocol)  
**Effective Date:** October 19, 2026  
**Repository Branch:** `main`  
**Frozen Baseline Commit:** `613f1a71d3362fe6d2c0910691ef9cfa9dc7456c`  
**Frozen Threshold:** Canonical ASVspoof 5 Bayes LLR $\theta_{\text{LLR}} = +0.6419$ ($\ln 1.90$), corresponding to raw score $\theta_{\text{raw}} \approx 0.6035$ under default Platt calibrator ($a=6.2, b=-3.1, P_{\text{prior}}=0.5$). Operational Banking LLR $\theta_{\text{LLR}} = +2.2925$ ($\ln 9.90$), corresponding to raw score $\theta_{\text{raw}} \approx 0.8698$.  
**Decision Rule:** An utterance is classified as SPOOF if $\text{LLR} \ge +0.6419$ (raw score $\ge 0.6035$), and BONAFIDE otherwise.

---

## 1. Governance & Strict Isolation Rules

1. **Strictly Zero ASVspoof 5 Evaluation Partition Exposure:** No ASVspoof 5 EVAL audio files shall be downloaded, extracted, scored, opened, or parsed.
2. **Frozen Model Weights & Calibration Parameters:** Model weights (`forensics_0.3B_base.safetensors`, `AASIST-L.pth`, `aasist_l.onnx`, `embedding_model.ckpt`, `silero_vad.jit`), fusion weights, temporal window aggregation rules, calibration parameters ($a=6.2, b=-3.1$), and operating thresholds remain strictly frozen at the values defined in commit `613f1a7`.
3. **Pre-Registration Invariant:** All pass/fail criteria and verdict decision boundaries in this document are committed to git prior to the execution of any test in Milestone 2. No criteria shall be modified or re-fitted after observing results.
4. **Style and Communication Invariants:** No marketing terms ("robust", "compliant", "verified") shall be used without the adjacent raw empirical figure. Long dashes ("—" or "--") are strictly excluded from prose in all documentation.

---

## 2. Experimental Batteries & Pre-Registered Criteria

### Part A: Model Provenance, Lineage & Commercial Licensing
* **Objective:** Audit the Hugging Face model repository `eliya/forensics_0.3B_base_deepfake_classifier` (model card, repository commits, files, tags, and license) to identify documented training corpora and commercial usability.
* **Outputs:** Update `docs/PROVENANCE.md` with exact quotations and draft an author inquiry regarding fine-tuning exposure.

### Part B: Out-of-Domain Bona Fide False-Alarm Test (The Key Discriminative Test)
* **Objective:** Test whether the Forensics-0.3B classifier overfits to ASVspoof 5 channel/recording conditions by evaluating out-of-domain genuine human speech.
* **Corpus Requirements:** At least 300 genuine (bona fide) speech utterances NOT from ASVspoof 5, collected across at least 4 independent sources:
  1. **LibriSpeech test-clean:** Standard read English speech recorded in quiet studio conditions.
  2. **Common Voice (Multi-Lingual):** Crowdsourced real speech spanning English, Hindi, and Bengali.
  3. **VoxCeleb1 / VCTK:** Conversational speech recorded in diverse acoustic environments.
  4. **Live Telephony PSTN / Mobile Recordings:** At least 20 recordings of real human speech transmitted over a real carrier telephone call (recorded with speaker consent via carrier SIP/PSTN trunk).
* **Conditions Evaluated:** Each source scored in (1) clean native audio, (2) ITU-T G.711 A-law (8 kHz, 8-bit companding), and (3) Opus narrowband (8 kHz).
* **Pre-Registered Decision Criteria (False Alarm Rate = Fraction of Genuine Flagged as Spoof):**
  * **False Alarm Rate (FAR) > 20.0% on ANY source:** -> **DOMAIN SHORTCUT LIKELY** (Classifier relies on ASVspoof 5 specific recording/channel artifacts rather than universal genuine speech characteristics).
  * **False Alarm Rate (FAR) < 5.0% on ALL sources:** -> **No domain problem seen** (Evidence of genuine out-of-domain generalization).
  * **Otherwise (5.0% <= FAR <= 20.0%):** -> **INCONCLUSIVE** (Borderline domain sensitivity requiring further data).

### Part C: Fresh Spoof Generalization Test
* **Objective:** Test detection capabilities against modern speech synthesis and voice cloning engines not present in the ASVspoof 5 attack list (A01 through A32).
* **Corpus Requirements:** At least 100 synthetic speech samples generated from at least 3 distinct open-source TTS/voice-cloning architectures released recently. At least 20 utterances must be in Hindi or Bengali.
* **Systems Selected:**
  1. **Meta MMS-TTS (VITS Architecture):** Recent multilingual neural end-to-end synthesizer (`facebook/mms-tts-eng`, `facebook/mms-tts-hin`, `facebook/mms-tts-ben`).
  2. **Microsoft SpeechT5 / Bark Neural TTS:** Encoder-decoder transformer architecture.
  3. **Open-Source Multi-Speaker Neural Synthesizer (e.g. Coqui TTS / Piper / eSpeak-NG).**
* **Conditions Evaluated:** Clean native audio, G.711 A-law, and Opus narrowband.
* **Pre-Registered Decision Criteria:**
  * **Detection Rate >= 80.0% across all systems:** -> Broad generalization to unseen modern TTS architectures supported.
  * **Detection Rate < 50.0% on any system:** -> Model overfitted to challenge-specific generators.

### Part D: Cross-Dataset Benchmark (In-the-Wild)
* **Objective:** Evaluate zero-shot cross-dataset performance on the public In-the-Wild deepfake speech benchmark.
* **Corpus Requirements:** At least 300 trials from In-the-Wild (balanced genuine vs spoof).
* **Metrics:** EER (%), minDCF, Cllr, and score distributions without any score recalibration or threshold shifting.
* **Pre-Registered Decision Criteria:**
  * **EER <= 15.0%:** -> Cross-dataset deepfake discrimination supported.
  * **EER > 30.0%:** -> Cross-dataset failure / severe domain brittleness.

### Part E: Diagnostic & Calibration Fixes
* **E1 (Full-Precision Dumps):** All per-trial score dumps in CSV must record 64-bit IEEE floating-point logits and probabilities without string rounding.
* **E2 (Degenerate Input Guardrail):** Re-evaluate degenerate inputs (silence, white noise, pure 1 kHz tone, clipped tone) and real speech-free background noise using raw model logits.
  * **Pass/Fail Criterion:** If speech-free or degenerate inputs produce scores in the spoof range ($\text{score} \ge 0.6035$ / $\text{LLR} \ge +0.6419$), the test is marked **FAIL**; production pipelines must reject non-speech via upstream VAD gating rather than emitting spoof fraud alerts.
* **E3 (Noise Sweep & Achieved SNR):** Additive noise sweeps must record exact achieved SNR calculated from signal and noise power. Include babble or street noise.
* **E4 (Calibration Gap):** Report the exact training partition used to fit Platt scaling parameters and report the calibration gap ($\Delta_{\text{cal}} = \text{actDCF} - \min\text{DCF}$) across all conditions.

### Part F: Serving Design & Concurrency Fixes
* **F1 (VAD Per-Stream Isolation):** Refactor `VADEngine` so that each active call stream maintains an isolated instance or dedicated state buffer. Add automated unit test asserting that concurrent interleaved turns from two streams yield bitwise identical VAD decisions compared to sequential execution.
* **F2 (Bounded Queues & Turn Drop Telemetry):** Replace unbounded thread pool queues with per-stream bounded single-item ring buffers (capacity = 1). When inference latency exceeds the turn arrival cadence, the older unanalyzed window is dropped, incrementing `skipped_windows_count`, and the turn is immediately routed to the configured bank fallback policy (e.g., STEP_UP MFA).
* **F3 (Root-Cause Latency Investigation):** Investigate why CPU utilization registered 47.5% at 2 streams while turnaround latency exploded to 1,185 ms (profiling Python GIL, PyTorch thread oversubscription, and lock contention).
* **F4 (Concurreny Re-Benchmark):** Re-run open-loop concurrency test with 1, 2, and 4 streams at:
  * Low cadence: 1 verdict every 5.0 seconds (180s per level).
  * High cadence: 1 verdict every 1.0 second (180s per level).
  * Report turnaround percentiles (p50, p95, p99), % <= 350ms, skipped-window percentage, CPU utilization, and hardware thermal state.

### Part G: Claims Register Amendments
* Retract or correct:
  * ONNX 4.5x acceleration claim (corrected to empirical ~1.5x on 64,600 samples).
  * CPU carrier 350 ms compliance claims for sequential and concurrent ensembles.
  * Telephony resilience claims pending out-of-domain evidence.
  * Disclose Forensics-0.3B third-party origin and non-commercial licensing.

---

## 3. Final Milestone 2 Verdict Criteria

The overall investigation verdict for Milestone 2 must be chosen strictly from the following mutually exclusive categories:

1. **`CONTAMINATION OR DOMAIN SHORTCUT LIKELY`**:
   * Triggered if Out-of-Domain Bona Fide False Alarm Rate (FAR) exceeds 20.0% on ANY non-ASVspoof source, or if training provenance audit confirms that the model was trained on the ASVspoof 5 development cohort.
2. **`NOT SUPPORTED BY EVIDENCE`**:
   * Triggered if the model fails to detect fresh unseen open-source TTS systems (detection rate < 50.0%) or exhibits severe cross-dataset collapse on In-the-Wild (EER > 30.0%), even if false-alarm rates on genuine speech remain acceptable.
3. **`INCONCLUSIVE`**:
   * Triggered if out-of-domain false alarm rates fall into the ambiguous range (5.0% to 20.0%), or if critical external benchmark datasets cannot be accessed.

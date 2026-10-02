# Dhvani: Voice Integrity & Real-Time Deepfake Defense Platform

Dhvani is an enterprise-grade voice authenticity, synthetic speech detection, and telephony fraud defense platform. Designed for banking institutions, customer support contact centers, and fraud investigation teams, Dhvani inspects audio streams and telephony sessions in real time to prevent AI-generated voice cloning, presentation attacks, and social engineering fraud.

In strict compliance with the **Digital Personal Data Protection (DPDP) Act 2023 Section 8(7)**, Dhvani operates with **zero raw human audio retention** on disk, processing streams strictly in volatile memory buffers with immediate zeroing post-analysis.

---

## Key Capabilities

### 1. Forensic Spectrogram & Splicing Heatmap ("Audio CSI")
* Generates high-resolution normalized Mel-spectrogram matrices with plasma colormap visualization.
* Computes temporal frame discontinuity metrics to pinpoint splice artifacts, phase discontinuities, and cloned voice insertions.

### 2. Dual-Channel Call Center Agent Co-Pilot (Human-in-the-Loop)
* Ingests dual-stream telephony calls ($CH_1$ Agent vs $CH_2$ Inbound Caller).
* Tracks speech pipeline latency anomalies (500 to 1400 ms) characteristic of LLM speech-to-speech pipelines.
* Evaluates rolling composite risk scores and serves dynamic Tier 1 to 3 challenge prompts.
* Includes supervisor emergency lockdown and call transfer escalation.

### 3. Neural Vocoder Architecture Attribution Fingerprinting
* Extracts 6 acoustic diagnostic metrics: transposed convolution checkerboard artifacts, harmonic comb ratios at 2/4/6 kHz, high-frequency rolloff, noise floor entropy, phase coherence jitter, and glottal pulse asymmetry.
* Attributes synthetic speech to known vocoder architectures (HiFi-GAN, BigVGAN, MelGAN, DiffWave, RVQ Neural Codecs, or Natural Human).

### 4. Edge-Defense Virtual Mic & Audio Driver Micro-Detector
* Scans browser media devices via Web Audio API to detect virtual audio drivers (VB-Audio, BlackHole, Loopback, OBS Virtual Audio, Voicemeeter).
* Inspects Johnson-Nyquist room thermal noise floor distributions (-65 to -45 dB) versus mathematical digital silence.

### 5. Cyber Crime FIR & Regulatory Evidence Docket Generator
* Generates court-admissible formal complaints citing Section 66D of the IT Act 2000, Sections 318 and 319 of Bharatiya Nyaya Sanhita (BNS) 2023, and Section 63 of Bharatiya Sakshya Adhiniyam (BSA) 2023 electronic evidence certificates.
* Exports structured RBI Central Fraud Registry (CFR) schedules with loss averted figures and cryptographic audit signatures.

### 6. Inter-Bank Fraud Syndicate Federation (FTX)
* Connects banking nodes (SBI, HDFC, ICICI, Axis, PNB, RBI-CFR) into a Federated Threat Exchange.
* Broadcasts anonymized salted SHA-256 voiceprint hashes without transmitting biometric recordings.
* Tracks cross-institutional syndicate attacks and collective fraud losses averted.

### 7. Interactive Developer Sandbox & Multi-Language SDK Playground
* Provides ready-to-use code snippets in Python, TypeScript, cURL, Java, and Go across 9 core endpoints.
* Includes a live testing console with real turnaround latency telemetry.

---

## Architecture Overview

```
                          ┌───────────────────────────┐
                          │   Inbound Audio Stream    │
                          └─────────────┬─────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
              ┌─────────────────────┐       ┌──────────────────────┐
              │ WebRTC / Telephony  │       │ Batch Audio Upload   │
              │  (Dual-Stream PCM)  │       │  (WAV / Telephony)   │
              └──────────┬──────────┘       └──────────┬───────────┘
                         │                             │
                         └──────────────┬──────────────┘
                                        ▼
                         ┌─────────────────────────────┐
                         │    In-Memory Processing     │
                         │ (Zero Disk Audio Retention) │
                         └──────────────┬──────────────┘
                                        │
         ┌───────────────────┬──────────┴──────────┬───────────────────┐
         ▼                   ▼                     ▼                   ▼
┌─────────────────┐ ┌─────────────────┐  ┌──────────────────┐ ┌─────────────────┐
│ Voice Activity  │ │ Passive Liveness│  │ Presentation     │ │ Acoustic &      │
│ Detection (VAD) │ │ & Telephony PLC │  │ Attack Detection │ │ Splicing Mel-   │
│ (Silero / DSP)  │ │ (Gilbert-Elliott│  │ (AASIST / WavLM) │ │ Spectrogram     │
└────────┬────────┘ └────────┬────────┘  └─────────┬────────┘ └────────┬────────┘
         │                   │                     │                   │
         └───────────────────┼─────────────────────┴───────────────────┘
                             ▼
              ┌─────────────────────────────┐
              │ AEGIS Multi-Modal Fusion    │
              │ & Dynamic Risk Policy (M5)  │
              └──────────────┬──────────────┘
                             │
         ┌───────────────────┼─────────────────────┐
         ▼                   ▼                     ▼
┌─────────────────┐ ┌─────────────────┐  ┌──────────────────┐
│ Agent Co-Pilot  │ │ FIR Evidence    │  │ Federated Threat │
│ Live Challenges │ │ Docket (BSA 63) │  │ Exchange (FTX)   │
└─────────────────┘ └─────────────────┘  └──────────────────┘
```

---

## Repository Structure

* **`app/`**: Core FastAPI backend application.
  * **`api/v1/endpoints/`**: Endpoints for copilot, spectrogram, vocoder, edge defense, docket, federation, sandbox, liveness, and risk.
  * **`core/`**: Security engine, models loader, passive liveness engine, presentation attack detector, and telephony resilience.
  * **`services/`**: Specialized business logic and forensic services.
  * **`integrations/`**: Adapters for AASIST, audio preprocessing, and risk policy.
* **`frontend/`**: Modern React 19 + Vite dashboard application.
  * **`src/components/dashboard/`**: Spectrogram viewer, vocoder attribution card, edge defense card, and agent co-pilot modal.
  * **`src/institution/`**: Institutional portal with pre-transaction authorization workflows.
  * **`src/services/`**: API client and WebSocket streaming client.
* **`tests/`**: Comprehensive automated test suite with 159 unit and integration tests.
* **`scripts/`**: Model verification, evaluation runners, and benchmark utilities.
* **`AEGIS_INTEGRATION/`**: Multi-modal fusion model definitions and feature extractors.

---

## Quickstart Guide

### Prerequisites
* Python 3.11 or later
* Node.js 18 or later
* npm or pnpm

### 1. Backend Setup
```bash
# Navigate to repository root
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Launch FastAPI development server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Swagger UI is available at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup
```bash
cd frontend
npm install

# Run core dashboard (port 3000)
npm run dev

# Or run institution portal (port 3001)
npm run dev:institution
```

### 3. Docker Deployment
```bash
docker-compose up --build
```

---

## Testing & Quality Assurance

Dhvani features a test suite covering all modules, forensic algorithms, statutory templates, and network degradation simulators:

```bash
pytest tests -q
```
**Status: 159 passed of 159 tests (100% pass rate).**

---

## Statutory & Regulatory Compliance

* **DPDP Act 2023 Section 8(7)**: Mandatory data minimization and purpose limitation. Zero audio persistance to persistent disk storage.
* **Bharatiya Sakshya Adhiniyam (BSA) 2023 Section 63**: Cryptographic hash chains and electronic certificates for digital court admissibility.
* **Information Technology Act 2000 Section 66D**: Structured reporting for impersonation and cheating by personation using computer resource.
* **RBI Master Direction on Fraud Risk Management**: Central Fraud Registry (CFR) compatible schedules and inter-bank syndicate alerting.

---

## License & Responsible Disclosure

This platform is developed for defensive voice integrity and authorized security verification.
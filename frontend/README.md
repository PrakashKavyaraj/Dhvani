# Voice Integrity Analyzer - V1 (Frontend)

Modern, high-performance web interface for **AI-Powered Voice Integrity & Synthetic Speech Detection**, engineered with React, Tailwind CSS, and Lucide Icons.

---

## Architecture & Features

1. **Upload & Drag-and-Drop Zone**:
   - Accepts `.wav` files with client-side format & size (< 20MB) validation.
   - Built-in in-browser HTML5 audio preview player with waveform/playback controls.
   - Dispatches `multipart/form-data` with key `file` to `POST /api/v1/analyses`.

2. **Asynchronous Polling Engine**:
   - Receives `202 Accepted` with `analysis_id`.
   - Executes non-blocking recursive polling against `GET /api/v1/analyses/{analysis_id}` every **1.5 seconds**.
   - Handles connection interruptions gracefully with transient retry logic.
   - Real-time elapsed execution stopwatch and animated pulse/sonar telemetry.
   - AbortController cancellation on unmount or user abort.

3. **Analytical Results Dashboard**:
   - **Risk Score Card**: Color-coded score (0-100) based on `risk_level` (`LOW` in Emerald, `MEDIUM` in Amber, `HIGH` in Rose).
   - **Synthetic Speech Probability Meter**: Visual gradient bar showing exact confidence (e.g. 14.25%).
   - **Acoustic Evidence & Quality Telemetry**: Displays `audio_quality.status`, `speech_seconds`, `spectral_anomaly`, and `prosody_anomaly`.
   - **Operational Recommendation Banner**: Prominently styled callout with context-sensitive shield badges.
   - **Disclaimer**: Mandatory subdued legal/operational disclaimer.

4. **Fault Tolerance & Error Handling**:
   - Parses HTTP 413, 422, or server errors (`detail.code`, `detail.message`).
   - Dismissible alert cards with a dedicated "Try Again" recovery action.

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. FastAPI CORS Configuration
Ensure your FastAPI backend has CORS enabled so the frontend can interact with it seamlessly:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Or ["http://localhost:3000", "http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

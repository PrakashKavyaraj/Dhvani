# Voice Integrity & Synthetic Speech Detection — V1 Backend

This is a local, offline/near-offline prototype backend for estimating whether an uploaded WAV recording has characteristics associated with synthetic, cloned, or manipulated speech. It is deliberately small: FastAPI, an in-memory job store, standard-library WAV handling, and replaceable M2 (audio), M1 (detector), and M5 (risk) adapters.

It does **not** implement live calls, WebSockets, telephony, authentication, distributed workers, automatic fraud decisions, caller identification, or forensic conclusions.

## Setup and run

Use Python 3.11 or later.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs` for Swagger UI. Check health with:

```bash
curl http://127.0.0.1:8000/health
```

Upload a WAV file:

```bash
curl -F "file=@/absolute/path/to/recording.wav;type=audio/wav" \
  -F "experiment_id=demo-1" -F "language=en" \
  http://127.0.0.1:8000/api/v1/analyses
```

The response is `202` and contains an `analysis_id`. Fetch the result with:

```bash
curl http://127.0.0.1:8000/api/v1/analyses/ANALYSIS_ID
```

A completed response contains a score (0–100), `LOW` / `MEDIUM` / `HIGH` risk level, probability, confidence, audio-quality summary, non-forensic indicators, recommendation, component versions, timing, and this disclaimer: the result is probabilistic and requires independent verification for elevated risk.

## Configuration

Copy `.env.example` into your shell environment (or export values before starting). Defaults include a 20 MB upload limit, 2–120 second recording duration, and `data/temp` for transient files. Risk boundaries are configurable: 0–39 LOW, 40–69 MEDIUM, and 70–100 HIGH.

## Enable the local pretrained detector

The default `dummy` backend proves the pipeline but is **not** a real assessment. To enable the bundled M1 integration for the local Wav2Vec2 anti-spoofing model, install the optional ML dependencies:

```bash
cd backend
source .venv/bin/activate
pip install -r requirements-ml.txt
export DETECTOR_BACKEND=transformers
export MODEL_VERSION=Vansh180/deepfake-audio-wav2vec2
uvicorn app.main:app --reload
```

On the first analysis, the Hugging Face library downloads the model (about 400 MB) to `data/model-cache/`. Later analyses use that local cached copy. Uploaded audio is processed locally and is not sent to a hosted inference service. The model expects 16 kHz mono audio; the adapter converts WAV PCM samples to mono and resamples them in memory.

This is a research-oriented model trained on a balanced ASVspoof 2021 PA subset. Its published evaluation is self-reported and does not establish accuracy for your recordings, language, microphone, codec, or current voice generators. Validate it on a representative labelled test set before using it for any meaningful decision. It estimates spoof likelihood only; it cannot prove authenticity, identity, authorship, or fraud.

## Adapter replacement points

- `app/integrations/m2_audio.py`: replace the simple WAV reader and energy placeholder with resampling, VAD, segmentation, MFCC/spectral/pitch/energy/prosody features as needed. Keep `preprocess_audio(Path) -> PreparedAudio`.
- `app/integrations/m1_detector.py`: the `transformers` option is a local pretrained model integration; retain `predict(PreparedAudio) -> DetectorPrediction` if replacing it with another model.
- `app/integrations/m5_risk.py`: adjust the documented policy while keeping `calculate_risk(DetectorPrediction, PreparedAudio) -> RiskAssessment`.

The dummy detector is only to make the demo runnable; it is not a valid synthetic-speech model.

## Privacy and limits

Uploads are treated as untrusted, receive server-generated UUIDs, are never executed, and are deleted after success or failure. The application logs only non-sensitive operational identifiers and never returns storage paths. Results and metadata are in memory only, so restarting the server removes them.

V1 supports WAV only and is not live telephony, forensic proof, or universally multilingual. The simple speech-energy placeholder is not robust voice activity detection.

## Tests

```bash
cd backend
pytest -q
```

Tests generate WAVs programmatically and cover health, valid and invalid uploads, size/duration/speech checks, jobs, failure safety, and temporary-file cleanup.

## Reproducible prediction export

Prepare CSV or JSONL rows with `audio_path,label,speaker_id,split,source,language`, then run:

```bash
cd backend
python scripts/run_evaluation.py manifest.csv predictions.csv
```

The CSV export contains each pipeline prediction and status. It does not compute or claim scientific metrics; proper metrics require team-provided labels and an evaluation split.

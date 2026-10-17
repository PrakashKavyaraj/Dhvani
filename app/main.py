from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware  
from app.api.routes import router as legacy_router
from app.api.v1.endpoints.inference import router as inference_router
from app.api.v1.endpoints.risk import router as risk_router
from app.api.v1.endpoints.websocket import router as websocket_router
from app.api.v1.endpoints.alerts import router as alerts_router
from app.api.v1.endpoints.workflow import router as workflow_router
from app.api.v1.endpoints.voiceprint import router as voiceprint_router
from app.api.v1.endpoints.liveness import router as liveness_router
from app.api.v1.endpoints.banking import router as banking_router
from app.api.v1.endpoints.blacklist import router as blacklist_router
from app.api.v1.endpoints.audit import router as audit_router
from app.api.v1.endpoints.telephony import router as telephony_router
from app.api.v1.endpoints.spectrogram import router as spectrogram_router
from app.api.v1.endpoints.copilot import router as copilot_router
from app.api.v1.endpoints.vocoder import router as vocoder_router
from app.api.v1.endpoints.edge import router as edge_router
from app.api.v1.endpoints.docket import router as docket_router
from app.api.v1.endpoints.federation import router as federation_router
from app.api.v1.endpoints.sandbox import router as sandbox_router
from app.api.v1.endpoints.telephony_stream import router as cpaas_telephony_router
from app.core.config import get_settings
from app.core.logging import logger
from app.core.models_loader import load_all_models
from app.core.security_engine import security_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info(
        "Initializing Voice Integrity Backend | Backend=%s | Model=%s | Security Engine Ready",
        settings.DETECTOR_BACKEND,
        settings.MODEL_VERSION,
    )
    settings.temp_audio_path
    # Pre-warm all trained ML models once at server startup for zero-latency live mic streaming
    try:
        load_all_models()
    except Exception as exc:
        logger.warning("Startup model pre-warm notice: %s", exc)

    yield
    logger.info("Shutting down Voice Integrity Backend.")


app = FastAPI(
    title="AI-Powered Voice Integrity & Security Risk Engine — V1",
    description=(
        "Production-ready voice authenticity & security evaluation service integrating "
        "Member 1 (ML Deepfake Classifier), Member 2 (DSP Acoustic Preprocessing), and "
        "Member 5 (Core Security & Risk Engine with DPDP Act compliance, codec resilience, "
        "and social engineering intent detection)."
    ),
    version="1.1.0",
    lifespan=lifespan,
)

# Cross-Origin Resource Sharing (CORS) Middleware for Local, LAN, and Third-Party Portals
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$",
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://localhost:8005",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Member 5 Security & Risk Engine routes
app.include_router(risk_router, prefix="/api/v1")

# Mount Integrated Inference Pipeline routes
app.include_router(inference_router, prefix="/api/v1")

# Mount Multi-Channel Alert Mechanisms routes
app.include_router(alerts_router, prefix="/api/v1")

# Mount Configurable Workflow & Automated Policy routes
app.include_router(workflow_router, prefix="/api/v1")

# Mount Dynamic Multi-Tenant Voice Biometric Vault routes
app.include_router(voiceprint_router, prefix="/api/v1")

# Mount Active Dynamic Challenge-Response Liveness routes
app.include_router(liveness_router, prefix="/api/v1")

# Mount Core Banking & Telephony Bridge routes
app.include_router(banking_router, prefix="/api/v1")

# Mount High-Concurrence 1:N Fraudster Blacklist Search routes
app.include_router(blacklist_router, prefix="/api/v1")

# Mount Cryptographic Merkle Audit Trail & Section 65B Certification routes
app.include_router(audit_router, prefix="/api/v1")

# Mount Telephony Packet Loss Concealment (PLC) & Network Degradation Resilience routes
app.include_router(telephony_router, prefix="/api/v1")

# Mount Forensic Spectrogram & Splicing Heatmap routes
app.include_router(spectrogram_router, prefix="/api/v1")

# Mount Dual-Channel Call Center Agent Co-Pilot routes
app.include_router(copilot_router, prefix="/api/v1")

# Mount Neural Vocoder Architecture Attribution routes
app.include_router(vocoder_router, prefix="/api/v1")

# Mount Edge-Defense & Virtual Mic Micro-Detector routes
app.include_router(edge_router, prefix="/api/v1")

# Mount Cyber Crime FIR & Regulatory Evidence Docket routes
app.include_router(docket_router, prefix="/api/v1")

# Mount Inter-Bank Fraud Syndicate Federation routes
app.include_router(federation_router, prefix="/api/v1")

# Mount Developer Sandbox & Multi-Language SDK Playground routes
app.include_router(sandbox_router, prefix="/api/v1")

# Mount Carrier CPaaS & SIPREC Real-Time Media Stream Ingestion routes
app.include_router(cpaas_telephony_router, prefix="/api/v1")

# Mount Real-Time WebSocket Streaming Endpoint (/ws/voice-detect)
app.include_router(websocket_router)
app.include_router(websocket_router, prefix="/api/v1")

# Mount Legacy / Existing Analysis & Health routes (for full backward compatibility)
app.include_router(legacy_router)
"""
Active Dynamic Challenge-Response Liveness REST Endpoints.

Provides:
- POST /api/v1/liveness/challenge: Issues unpredictable signed phonetic challenge.
- POST /api/v1/liveness/verify: Verifies spoken phrase and speech latency to catch voice cloning lag.
"""

from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.services.liveness_service import liveness_service
from app.services.storage_service import storage_service
from app.services.validation_service import validation_service

router = APIRouter(prefix="/liveness", tags=["Active Liveness Challenge"])


@router.post(
    "/challenge",
    status_code=status.HTTP_200_OK,
    summary="Generate an unpredictable, cryptographically signed phonetic challenge",
)
def generate_challenge(session_id: str = Form("live-session")):
    return liveness_service.create_challenge(session_id=session_id)


@router.post(
    "/verify",
    status_code=status.HTTP_200_OK,
    summary="Verify user speech against issued challenge and measure acoustic reflex latency",
)
async def verify_liveness_challenge(
    file: UploadFile = File(...),
    challenge_token: str = Form(...),
    transcript: Optional[str] = Form(""),
):
    if not challenge_token.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="challenge_token is required.",
        )

    validation_service.validate_file_metadata(file)
    temp_path = await storage_service.save_upload_chunked(file)

    try:
        validation_service.validate_wav_content(temp_path)
        result = liveness_service.verify_challenge(
            challenge_token=challenge_token,
            audio_input=temp_path,
            transcript=transcript or "",
        )
        return result
    finally:
        storage_service.delete_file(temp_path)

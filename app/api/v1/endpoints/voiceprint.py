"""
Voiceprint Vault REST Endpoints for Dynamic Customer Speaker Biometrics.

Provides:
- POST /api/v1/voiceprint/enroll: Enrolls a customer voiceprint embedding in the vault.
- POST /api/v1/voiceprint/verify: Verifies live audio against enrolled customer profile.
- GET /api/v1/voiceprint/enrolled: Lists enrolled customers in the vault.
- DELETE /api/v1/voiceprint/{customer_id}: DPDP Act Right to Erasure.
"""

from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.services.storage_service import storage_service
from app.services.validation_service import validation_service
from app.services.voiceprint_vault import voiceprint_vault

router = APIRouter(prefix="/voiceprint", tags=["Voice Biometric Vault"])


@router.post(
    "/enroll",
    status_code=status.HTTP_201_CREATED,
    summary="Enroll customer voiceprint in the multi-tenant biometric vault",
)
async def enroll_voiceprint(
    file: UploadFile = File(...),
    customer_id: str = Form(...),
    speaker_name: Optional[str] = Form(None),
    tenant_id: str = Form("default"),
):
    if not customer_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="customer_id is required.",
        )

    validation_service.validate_file_metadata(file)
    temp_path = await storage_service.save_upload_chunked(file)

    try:
        validation_service.validate_wav_content(temp_path)
        result = voiceprint_vault.enroll(
            customer_id=customer_id,
            audio_input=temp_path,
            speaker_name=speaker_name,
            tenant_id=tenant_id,
        )
        return result
    finally:
        storage_service.delete_file(temp_path)


@router.post(
    "/verify",
    status_code=status.HTTP_200_OK,
    summary="Verify live voice against enrolled customer baseline in the vault",
)
async def verify_voiceprint(
    file: UploadFile = File(...),
    customer_id: str = Form(...),
    tenant_id: str = Form("default"),
):
    if not customer_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="customer_id is required for verification.",
        )

    validation_service.validate_file_metadata(file)
    temp_path = await storage_service.save_upload_chunked(file)

    try:
        validation_service.validate_wav_content(temp_path)
        result = voiceprint_vault.verify(
            customer_id=customer_id,
            audio_input=temp_path,
            tenant_id=tenant_id,
        )
        return result
    finally:
        storage_service.delete_file(temp_path)


@router.get(
    "/enrolled",
    status_code=status.HTTP_200_OK,
    summary="List enrolled customer profiles in the current tenant",
)
def list_enrolled_voiceprints(tenant_id: str = "default"):
    return {
        "tenant_id": tenant_id,
        "profiles": voiceprint_vault.list_enrolled_speakers(tenant_id=tenant_id),
    }


@router.delete(
    "/{customer_id}",
    status_code=status.HTTP_200_OK,
    summary="DPDP Act 2023: Permanently erase a customer's voice biometric profile",
)
def delete_voiceprint(customer_id: str, tenant_id: str = "default"):
    deleted = voiceprint_vault.delete_speaker(customer_id=customer_id, tenant_id=tenant_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer '{customer_id}' not found in vault for deletion.",
        )
    return {
        "status": "DELETED",
        "customer_id": customer_id,
        "compliance": "DPDP Act 2023 Section 12 Right to Erasure Fulfilled",
    }

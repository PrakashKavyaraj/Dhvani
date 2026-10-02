"""
Fraudster Blacklist REST Endpoints for 1:N High-Concurrence Vector Search.

Provides:
- POST /api/v1/blacklist/match: Searches 1:N HNSW vector index for matching fraudster voiceprints.
- POST /api/v1/blacklist/enroll: Enrolls a flagged voiceprint into the repeat offender database.
- GET /api/v1/blacklist/list: Lists registered fraudster voiceprints and syndicates.
- GET /api/v1/blacklist/stats: Provides aggregated syndicate and search statistics.
- DELETE /api/v1/blacklist/{entry_id}: Deactivates an entry from the active blacklist.
"""

from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.services.fraud_blacklist_service import fraud_blacklist_vault
from app.services.storage_service import storage_service
from app.services.validation_service import validation_service

router = APIRouter(prefix="/blacklist", tags=["1:N Fraudster Blacklist Search"])


@router.post(
    "/match",
    status_code=status.HTTP_200_OK,
    summary="Sub-millisecond 1:N HNSW search against known fraudster voiceprints",
)
async def match_blacklist_voiceprint(
    file: UploadFile = File(...),
    match_threshold: float = Form(0.72),
    top_k: int = Form(3),
    user_consent_granted: bool = Form(True),
):
    """
    Scans live audio against hundreds of thousands of known fraudster syndicate voiceprints
    using Hierarchical Navigable Small World (HNSW) cosine vector search in < 2ms.
    """
    if not user_consent_granted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="DPDP Act Violation: User consent has not been granted for biometric processing.",
        )

    validation_service.validate_file_metadata(file)
    temp_path = await storage_service.save_upload_chunked(file)

    try:
        validation_service.validate_wav_content(temp_path)
        result = fraud_blacklist_vault.match_voiceprint(
            audio_input=temp_path,
            top_k=top_k,
            match_threshold=match_threshold,
        )
        return result
    finally:
        storage_service.delete_file(temp_path)


@router.post(
    "/enroll",
    status_code=status.HTTP_201_CREATED,
    summary="Enroll flagged voiceprint into the repeat offender blacklist database",
)
async def enroll_fraudster_voiceprint(
    file: UploadFile = File(...),
    syndicate_id: str = Form(...),
    syndicate_name: str = Form(...),
    fraud_category: str = Form("DIGITAL_ARREST"),
    threat_level: str = Form("CRITICAL"),
    notes: Optional[str] = Form(None),
    incident_count: int = Form(1),
):
    """
    Enrolls a verified criminal voiceprint into the persistent 1:N vector database.
    """
    if not syndicate_id.strip() or not syndicate_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="syndicate_id and syndicate_name are required non-empty fields.",
        )

    validation_service.validate_file_metadata(file)
    temp_path = await storage_service.save_upload_chunked(file)

    try:
        validation_service.validate_wav_content(temp_path)
        result = fraud_blacklist_vault.enroll_fraudster(
            audio_input=temp_path,
            syndicate_id=syndicate_id,
            syndicate_name=syndicate_name,
            fraud_category=fraud_category,
            threat_level=threat_level,
            notes=notes,
            incident_count=incident_count,
        )
        return result
    finally:
        storage_service.delete_file(temp_path)


@router.get(
    "/list",
    status_code=status.HTTP_200_OK,
    summary="List active blacklisted fraudster entries",
)
async def list_blacklist_entries(limit: int = 50, offset: int = 0):
    return {
        "count": limit,
        "offset": offset,
        "entries": fraud_blacklist_vault.list_blacklist(limit=limit, offset=offset),
    }


@router.get(
    "/stats",
    status_code=status.HTTP_200_OK,
    summary="Aggregate statistics on fraudster syndicates and vector search latency",
)
async def get_blacklist_statistics():
    return fraud_blacklist_vault.get_stats()


@router.delete(
    "/{entry_id}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate entry from the active blacklist",
)
async def delete_blacklist_entry(entry_id: str):
    success = fraud_blacklist_vault.delete_entry(entry_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Blacklist entry '{entry_id}' not found.",
        )
    return {"status": "DEACTIVATED", "entry_id": entry_id}

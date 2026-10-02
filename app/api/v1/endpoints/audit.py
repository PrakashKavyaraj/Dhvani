"""
Cryptographic Merkle Audit Trail & Section 65B Forensic Evidence REST Endpoints.

Provides:
- GET /api/v1/audit/ledger: Lists sequential blocks in the immutable Merkle audit ledger.
- GET /api/v1/audit/proof/{session_id}: Generates cryptographic proof of inclusion for a session.
- POST /api/v1/audit/verify-proof: Validates mathematical proof against expected Merkle root.
- GET /api/v1/audit/section-65b/{session_id}: Generates court-admissible legal certificate (Indian Evidence Act / BSA 2023).
- GET /api/v1/audit/stats: Provides Merkle tree statistics and integrity status.
"""

from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.merkle_audit_service import merkle_audit_service

router = APIRouter(prefix="/audit", tags=["Merkle Audit Trail & Section 65B Certification"])


class VerifyProofRequest(BaseModel):
    leaf_hash: str = Field(..., description="Target leaf SHA-256 hash")
    proof_path: List[Dict[str, str]] = Field(..., description="Array of sibling directions and hashes")
    expected_root: str = Field(..., description="Expected Merkle root hash")


@router.get(
    "/ledger",
    status_code=status.HTTP_200_OK,
    summary="List blocks from the append-only cryptographic Merkle audit ledger",
)
async def list_merkle_ledger_blocks(limit: int = 50, offset: int = 0):
    return {
        "limit": limit,
        "offset": offset,
        "blocks": merkle_audit_service.list_ledger_entries(limit=limit, offset=offset),
    }


@router.get(
    "/proof/{session_id}",
    status_code=status.HTTP_200_OK,
    summary="Generate mathematical Merkle inclusion proof for a session",
)
async def get_merkle_inclusion_proof(session_id: str):
    try:
        cert = merkle_audit_service.generate_section_65b_certificate(session_id)
        return {
            "session_id": session_id,
            "leaf_index": cert["leaf_index"],
            "leaf_hash": cert["leaf_hash"],
            "merkle_root": cert["merkle_root"],
            "proof_path": cert["proof_path"],
            "rfc3161_token": cert["rfc3161_token"],
            "verified": cert["merkle_proof_verified"],
        }
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post(
    "/verify-proof",
    status_code=status.HTTP_200_OK,
    summary="Mathematically verify a cryptographic Merkle proof against a root hash",
)
async def verify_proof(request: VerifyProofRequest):
    is_valid = merkle_audit_service.verify_merkle_proof(
        leaf_hash=request.leaf_hash,
        proof_path=request.proof_path,
        expected_root=request.expected_root,
    )
    return {
        "valid": is_valid,
        "leaf_hash": request.leaf_hash,
        "expected_root": request.expected_root,
        "message": (
            "Mathematical proof verified: Leaf belongs to the authentic Merkle tree root."
            if is_valid
            else "Verification failed: Leaf hash or proof path has been tampered with."
        ),
    }


@router.get(
    "/section-65b/{session_id}",
    status_code=status.HTTP_200_OK,
    summary="Generate Section 65B Indian Evidence Act / Section 63 BSA 2023 Forensic Certificate",
)
async def get_section_65b_certificate(session_id: str):
    try:
        return merkle_audit_service.generate_section_65b_certificate(session_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.get(
    "/stats",
    status_code=status.HTTP_200_OK,
    summary="Aggregate statistics on cryptographic Merkle ledger and compliance status",
)
async def get_audit_ledger_stats():
    return merkle_audit_service.get_stats()

# Dhvani Enterprise Air-Gapped On-Premises Deployment Guide

This runbook guides Bank Infrastructure, DevSecOps, and CISO Security teams through deploying Dhvani in an **air-gapped, zero-internet-egress on-premises or private cloud environment** (such as OpenShift, VMware Tanzu, or Bare-Metal Kubernetes).

---

## 1. Statutory Alignment and Architecture

* **RBI FREE-AI Pillar 1 (Infrastructure)**: Complete model deployment and data processing isolated within the scheduled commercial bank's private boundary.
* **DPDP Act 2023 Section 8(7) & Rules 2025**: Strict zero-disk retention for raw telephony audio (ephemeral RAM ring buffers with 15-second automatic TTL).
* **Section 63 Bharatiya Sakshya Adhiniyam (BSA), 2023**: Self-contained cryptographic Merkle audit ledger with automated digital evidence certification.

```
[ Carrier Telephony / Contact Center ]
       │ (SIPREC / Audio Forking via DMZ)
       ▼
[ Dhvani Telephony Gateway (Pod: dhvani-telephony) ]
       │ 20ms Ephemeral Audio Chunks (Volatile RAM)
       ▼
[ Local Redis 7 Cluster (RAM Sliding Buffer, TTL 15s) ]
       │ Normalized Float32 Tensors (No Raw Audio on Disk)
       ▼
[ Dhvani Neural Inference Core (Pod: dhvani-core) ]
  ├── Forensics-0.3B (WavLM Backbone)
  ├── AASIST-L (Graph Attention)
  ├── ECAPA-TDNN (Voiceprint Biometrics)
  └── Silero-VAD (Voice Activity Detection)
       │ 192-dim Cosine Embeddings & Joint SASV Verdict
       ▼
[ PostgreSQL 16 + pgvector HNSW Database (Isolated VPC) ]
```

---

## 2. Air-Gapped Package Preparation (Pre-Ingestion Workstation)

On an internet-connected build machine before entering the air-gap facility:

### Step 2.1: Pull and Save Container Images
```bash
docker pull ghcr.io/prakashkavyaraj/dhvani-backend:latest
docker pull ghcr.io/prakashkavyaraj/dhvani-frontend:latest
docker pull pgvector/pgvector:pg16
docker pull redis:7-alpine

docker save -o dhvani-backend-v1.tar ghcr.io/prakashkavyaraj/dhvani-backend:latest
docker save -o dhvani-frontend-v1.tar ghcr.io/prakashkavyaraj/dhvani-frontend:latest
docker save -o pgvector-pg16.tar pgvector/pgvector:pg16
docker save -o redis-7.tar redis:7-alpine
```

### Step 2.2: Compute Cryptographic Hashes for Bank Ingestion Security Review
```bash
sha256sum dhvani-backend-v1.tar > checksums.sha256
sha256sum dhvani-frontend-v1.tar >> checksums.sha256
sha256sum pgvector-pg16.tar >> checksums.sha256
sha256sum redis-7.tar >> checksums.sha256
```

---

## 3. Bastion Import and Local Registry Push

Within the bank's secure network:

```bash
# Verify checksums
sha256sum -c checksums.sha256

# Load images to local docker daemon
docker load -i dhvani-backend-v1.tar
docker load -i dhvani-frontend-v1.tar
docker load -i pgvector-pg16.tar
docker load -i redis-7.tar

# Tag and push to internal bank container registry (e.g., Harbor or Nexus)
docker tag ghcr.io/prakashkavyaraj/dhvani-backend:latest harbor.bank.internal/dhvani/backend:latest
docker push harbor.bank.internal/dhvani/backend:latest
```

---

## 4. Kubernetes Helm Deployment (Air-Gapped Mode)

Deploy using the provided Helm chart with air-gap configuration overrides:

```yaml
# values-airgap.yaml
global:
  offlineMode: true
  airgap: true

backend:
  image:
    repository: harbor.bank.internal/dhvani/backend
    tag: latest
    pullPolicy: IfNotPresent
  env:
    DETECTOR_BACKEND: "torch"
    OFFLINE_WEIGHTS_ONLY: "true"
    HF_HUB_OFFLINE: "1"
    TRANSFORMERS_OFFLINE: "1"
    REDIS_HOST: "dhvani-redis"
    DATABASE_URL: "postgresql://dhvani_app:VaultSecret@dhvani-postgres:5432/dhvani_db"
  securityContext:
    readOnlyRootFilesystem: true
    runAsNonRoot: true
    runAsUser: 10001
    capabilities:
      drop:
        - ALL

database:
  image:
    repository: harbor.bank.internal/dhvani/pgvector
    tag: pg16
  persistence:
    enabled: true
    storageClass: "enterprise-san-encrypted"
    size: 250Gi
```

Install the Helm chart:
```bash
helm install dhvani-prod ./helm/dhvani -f values-airgap.yaml -n voice-security --create-namespace
```

---

## 5. Automated Pre-Flight Environment Verification

Execute the automated pre-flight audit script inside the air-gapped pod or bastion:

```bash
python3 scripts/airgap_preflight_check.py
```

Expected output:
```
======================================================================
DHVANI AIR-GAPPED ON-PREMISES ENTERPRISE PRE-FLIGHT VERIFICATION
======================================================================

Overall Readiness Status: READY_FOR_AIRGAP_DEPLOYMENT
Checks Passed:           4 / 4

  [PASS] PYTHON_RUNTIME_AND_HARDWARE    : Python 3.10+ runtime verified with SIMD support.
  [PASS] OUTBOUND_AIRGAP_ISOLATION      : Environment is strictly air-gapped with zero external internet leakage.
  [PASS] OFFLINE_MODEL_WEIGHTS          : All 4 neural acoustic backbones configured for local offline execution with zero remote downloads.
  [PASS] DPDP_EPHEMERAL_RAM_BUFFER      : Memory capacity exceeds requirements for 20ms sliding-window telephony buffers with 15s auto-TTL.
======================================================================
```

---

## 6. SRE & Observability Scrape Validation

Verify the Prometheus metrics endpoint inside the cluster:
```bash
curl -s http://dhvani-backend:8000/metrics | grep dhvani_system_up
# Output: dhvani_system_up 1.0

curl -s http://dhvani-backend:8000/metrics | grep dhvani_telephony_sla_budget_seconds
# Output: dhvani_telephony_sla_budget_seconds 0.35
```

---

## 7. CISO and Compliance Certification Checklist

| Requirement | Statutory Ground | Air-Gapped Verification Method |
| :--- | :--- | :--- |
| Zero External Network Calls | RBI FREE-AI Pillar 1 | Verified via `airgap_preflight_check.py` socket probe |
| Zero Raw Audio on Disk | DPDP Act Section 8(7) | In-memory Redis sliding-buffer with 15s auto-TTL verified |
| Right to Erasure Enforcement | DPDP Act Section 12 | Tested via `DELETE /api/v1/tenants/{id}/voiceprints/{account}` |
| Sub-350ms Telephony SLA | Banking Pilot Gate 2 | Monitored via `dhvani_inference_latency_seconds_bucket` |
| Court-Admissible Electronic Record | Section 63 BSA 2023 | Tested via `POST /api/v1/vendor/section-63-certificate` |

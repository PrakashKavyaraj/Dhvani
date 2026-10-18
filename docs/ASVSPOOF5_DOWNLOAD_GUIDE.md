# ASVspoof 5 Full Dataset Cloud Download & Infrastructure Guide
**Document Version:** 1.0  
**Pre-Registered Benchmark Protocol:** [Protocol v1.1](file:///Users/prakashkavyaraj/backend/docs/ASVSPOOF5_EVALUATION_PROTOCOL.md)  
**CERN Zenodo Record:** [Zenodo 14498691](https://zenodo.org/records/14498691)  
**License:** Open Data Commons Attribution License (ODC-By) / Creative Commons Attribution 4.0 International (CC BY 4.0)

---

## 1. Executive Summary & Infrastructure Sizing
The complete ASVspoof 5 corpus consists of 21 files totaling **~132.5 GB compressed** (and **~250 GB uncompressed** FLAC audio). Due to network bandwidth and local disk constraints, large-scale benchmark runs should be staged on high-bandwidth cloud virtual machines (e.g., AWS EC2, GCP Compute Engine, or Azure VM) attached to high-throughput NVMe or SSD storage volumes.

### Recommended Cloud VM Specifications
* **Cloud Instance Type**: AWS `c6i.4xlarge` (16 vCPU, 32 GB RAM) or `g5.2xlarge` (1 NVIDIA A10G GPU, 8 vCPU, 32 GB RAM)
* **Ephemeral / Attached Storage**: Minimum 350 GB GP3 EBS volume or local NVMe with $\ge 300\text{ MB/s}$ sustained sequential read throughput
* **Network Bandwidth**: $\ge 10\text{ Gbps}$ egress/ingress to ensure full archive downloads complete in under 2 hours
* **Operating System**: Ubuntu 22.04 LTS / Debian 12 / RHEL 9

---

## 2. Partition Breakdown & Checksum Registry
All files are served directly from CERN Zenodo with verified MD5 checksums:

| Partition Group | Archive Filename | Compressed Size | Uncompressed Path | Utterance Count | Official MD5 Checksum |
| :--- | :--- | :---: | :--- | :---: | :--- |
| **Documentation** | `README.txt` | 12.1 KB | `README.txt` | N/A | `784002b8449ba1eeecc042bfad285de7` |
| **Documentation** | `LICENSE.txt` | 19.9 KB | `LICENSE.txt` | N/A | `9cbefc63251e8cbc8eb22e62cd6fe584` |
| **Protocols & Keys**| `ASVspoof5_protocols.tar.gz` | 20.6 MB | TSV protocol manifests | 8 protocol files | `865d0e894ea9f686f0f37e5ae3ae3616` |
| **Development 1/3** | `flac_D_aa.tar` | 6.19 GB | `./flac_D/` | 47,400 | `df0be44957623991028cce59792beb17` |
| **Development 2/3** | `flac_D_ab.tar` | 6.19 GB | `./flac_D/` | 47,400 | `1e8cd685d89b64502692f1bcf1a13db3` |
| **Development 3/3** | `flac_D_ac.tar` | 6.31 GB | `./flac_D/` | 47,334 | `5e0031f08c30e4bdbf0c59f91b2d662b` |
| **Evaluation (10 parts)** | `flac_E_aa.tar` to `flac_E_aj.tar` | 78.8 GB total | `./flac_E_eval/` | 681,872 | See table in script |
| **Training (5 parts)** | `flac_T_aa.tar` to `flac_T_ae.tar` | 35.0 GB total | `./flac_T/` | 182,357 | See table in script |

> [!NOTE]
> **Independent Archive Extraction**: Each `.tar` file in a partition group is a standalone tar archive containing a distinct set of FLAC files. They do NOT require file concatenation (such as `cat`) prior to extraction. Extracting each archive into the same destination directory automatically populates `./flac_D/`, `./flac_E_eval/`, or `./flac_T/`.

---

## 3. Staged Download Procedures

### Option A: Shell Downloader (POSIX / Bash with `wget -c`)
The shell downloader in [`scripts/download_asvspoof5_full.sh`](file:///Users/prakashkavyaraj/backend/scripts/download_asvspoof5_full.sh) automatically resumes interrupted downloads, retries transient network errors, and verifies MD5 checksums.

```bash
# 1. Download official protocol metadata manifests and extract
./scripts/download_asvspoof5_full.sh --protocols --extract

# 2. Download and verify the complete Development partition (18.7 GB, 142k utterances)
./scripts/download_asvspoof5_full.sh --dev --extract

# 3. Download the full Evaluation partition on a cloud VM (78.8 GB, 681k utterances)
./scripts/download_asvspoof5_full.sh --eval --extract
```

### Option B: Python Resumable Downloader CLI
For fine-grained progress logging, automated verification, and cloud pipeline integration, use [`scripts/download_asvspoof5.py`](file:///Users/prakashkavyaraj/backend/scripts/download_asvspoof5.py):

```bash
# Download and verify development set to custom directory
python scripts/download_asvspoof5.py --target dev --dest /mnt/data/asvspoof5 --extract

# Verify integrity of existing downloads without re-downloading
python scripts/download_asvspoof5.py --target dev --dest /mnt/data/asvspoof5 --verify-only
```

---

## 4. Manifest Protocol Organization & Verification
Once `ASVspoof5_protocols.tar.gz` is unpacked, the following protocol files are placed into `data/asvspoof5_official/`:
* `ASVspoof5.dev.track_1.tsv`: 140,950 development trials (clean uncompressed 16 kHz audio, attacks A09 through A16).
* `ASVspoof5.eval.track_1.tsv`: 680,774 evaluation trials (telephony codecs C01 through C11, attacks A17 through A32).
* `ASVspoof5.codec.config.csv`: Configuration parameters and bitrates for codecs C01 to C11.

### 10-Column TSV Schema Alignment
All Track 1 protocol files strictly conform to the 10-column whitespace-separated format:
1. `SPEAKER_ID`: Speaker identifier (`D_****` for Dev, `E_****` for Eval).
2. `FLAC_FILE_NAME`: Audio file basename (e.g., `D_0000000001`).
3. `SPEAKER_GENDER`: Speaker gender (`M` or `F`).
4. `CODEC`: Codec condition (`C01` to `C11` for Eval, `-` for clean Dev).
5. `CODEC_Q`: Quality configuration number (`1` to `9` or `-`).
6. `CODEC_SEED`: Seed utterance filename or `-`.
7. `ATTACK_TAG`: Attacker adaptation condition (`AC*` or `-`).
8. `ATTACK_LABEL`: Attack algorithm (`A09` to `A32` or `bonafide`).
9. `KEY`: Truth label (`bonafide` or `spoof`).
10. `TMP`: Reserved column (`-`).

---

## 5. Next Steps for Full-Corpus Cloud Scoring
1. **Provision High-IOPS Cloud Instance**: Launch a compute node with at least 350 GB free disk space.
2. **Execute Full Development Scoring**:
   ```bash
   python scripts/evaluate_asvspoof5_slice.py \
       --protocol data/asvspoof5_official/ASVspoof5.dev.track_1.tsv \
       --audio-dir data/asvspoof5_official/flac_D \
       --max-trials 140950 \
       --output-json data/asvspoof5_full_dev_scores.json
   ```
3. **Calibrator Parameter Freezing**: Freeze logistic parameters $(a_{\text{dev}}, b_{\text{dev}})$ derived from the full development set prior to touching any evaluation trials.
4. **Zero-Day Holdout Evaluation**: Run inference on `ASVspoof5.eval.track_1.tsv` with frozen calibrator parameters and publish the complete cross-condition evaluation report.

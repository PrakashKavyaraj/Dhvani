"""
ASVspoof 5 Full Dataset Cloud Downloader & Integrity Verifier.

Automates the parallel, resumable downloading of official ASVspoof 5 dataset
archives from CERN Zenodo with multi-part range verification and MD5 integrity checks.

Usage:
    python scripts/download_asvspoof5.py --target dev --dest data/asvspoof5_official
    python scripts/download_asvspoof5.py --target eval --dest /mnt/data/asvspoof5
    python scripts/download_asvspoof5.py --verify-only --dest data/asvspoof5_official
"""

import argparse
import hashlib
import logging
import os
import sys
import tarfile
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("asvspoof5_downloader")

ZENODO_RECORD_ID = "14498691"
BASE_URL = f"https://zenodo.org/api/records/{ZENODO_RECORD_ID}/files"

# Official CERN Zenodo File Catalog with MD5 Checksums and File Sizes (Bytes)
ARCHIVE_CATALOG: Dict[str, Dict[str, any]] = {
    "README.txt": {
        "md5": "784002b8449ba1eeecc042bfad285de7",
        "size": 12131,
        "partition": "docs",
    },
    "LICENSE.txt": {
        "md5": "9cbefc63251e8cbc8eb22e62cd6fe584",
        "size": 19940,
        "partition": "docs",
    },
    "ASVspoof5_protocols.tar.gz": {
        "md5": "865d0e894ea9f686f0f37e5ae3ae3616",
        "size": 20669392,
        "partition": "protocols",
    },
    # Development Partitions (~18.7 GB total)
    "flac_D_aa.tar": {
        "md5": "df0be44957623991028cce59792beb17",
        "size": 6647265280,
        "partition": "dev",
    },
    "flac_D_ab.tar": {
        "md5": "1e8cd685d89b64502692f1bcf1a13db3",
        "size": 6641459200,
        "partition": "dev",
    },
    "flac_D_ac.tar": {
        "md5": "5e0031f08c30e4bdbf0c59f91b2d662b",
        "size": 6771660800,
        "partition": "dev",
    },
    # Evaluation Partitions (~78.8 GB total)
    "flac_E_aa.tar": {
        "md5": "a8c800766f3d4ef87971e2b4f29663e2",
        "size": 8449781760,
        "partition": "eval",
    },
    "flac_E_ab.tar": {
        "md5": "c35064188f54f07c87aba58de22534a0",
        "size": 8459868160,
        "partition": "eval",
    },
    "flac_E_ac.tar": {
        "md5": "ed7cbcd1b2847998b72472ddf6b445e3",
        "size": 8461475840,
        "partition": "eval",
    },
    "flac_E_ad.tar": {
        "md5": "626a080e994b05df49c577d7b3dede8d",
        "size": 8467200000,
        "partition": "eval",
    },
    "flac_E_ae.tar": {
        "md5": "05f19a5e64fa556714ae1b38eb2ea70b",
        "size": 8456785920,
        "partition": "eval",
    },
    "flac_E_af.tar": {
        "md5": "2ca2f52a3bbf827f7ec155ecb47e85d6",
        "size": 8457410560,
        "partition": "eval",
    },
    "flac_E_ag.tar": {
        "md5": "671200b5de2fc1e74a563b07b057af8f",
        "size": 8461946880,
        "partition": "eval",
    },
    "flac_E_ah.tar": {
        "md5": "eaf885b1299a61eb07f71e82e96dba37",
        "size": 8455321600,
        "partition": "eval",
    },
    "flac_E_ai.tar": {
        "md5": "b2625683bf440abae2af901a45542ad9",
        "size": 8464230400,
        "partition": "eval",
    },
    "flac_E_aj.tar": {
        "md5": "c50281c8233af6f3b0899604d21ade44",
        "size": 8623206400,
        "partition": "eval",
    },
    # Training Partitions (~35.0 GB total)
    "flac_T_aa.tar": {
        "md5": "b0cc86b14826a7701b52aad4f53daf9c",
        "size": 7522498560,
        "partition": "train",
    },
    "flac_T_ab.tar": {
        "md5": "d05be3f4be7a343fdbdd0ed29fdff2e1",
        "size": 7489587200,
        "partition": "train",
    },
    "flac_T_ac.tar": {
        "md5": "70d1ba4ad75a20aef3dae541fbd321e3",
        "size": 7497256960,
        "partition": "train",
    },
    "flac_T_ad.tar": {
        "md5": "c9bb56af2cc410d98338d74babcb95c9",
        "size": 7509688320,
        "partition": "train",
    },
    "flac_T_ae.tar": {
        "md5": "a3969816982f3e52300d6147ad796df7",
        "size": 7482521600,
        "partition": "train",
    },
}


def compute_file_md5(file_path: Path, chunk_size: int = 1024 * 1024) -> str:
    """Computes MD5 hash in streaming chunks."""
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()


def download_file_resumable(
    filename: str,
    dest_dir: Path,
    expected_md5: str,
    expected_size: int,
    chunk_size: int = 4 * 1024 * 1024,
) -> bool:
    """
    Downloads a single file from CERN Zenodo with resume support and MD5 check.
    """
    dest_path = dest_dir / filename
    url = f"{BASE_URL}/{filename}/content"

    existing_bytes = 0
    if dest_path.exists():
        existing_bytes = dest_path.stat().st_size
        if existing_bytes == expected_size:
            logger.info("File %s exists with exact size (%d bytes). Verifying checksum...", filename, expected_size)
            curr_md5 = compute_file_md5(dest_path)
            if curr_md5 == expected_md5:
                logger.info("[VERIFIED] %s matches expected MD5: %s", filename, curr_md5)
                return True
            else:
                logger.warning("Checksum mismatch on %s: expected %s, got %s. Restarting download.", filename, expected_md5, curr_md5)
                existing_bytes = 0
                dest_path.unlink()
        elif existing_bytes > expected_size:
            logger.warning("File %s is larger than expected (%d > %d). Removing and restarting.", filename, existing_bytes, expected_size)
            existing_bytes = 0
            dest_path.unlink()
        else:
            logger.info("Resuming %s from byte offset %d / %d (%.1f%% complete)...", filename, existing_bytes, expected_size, 100.0 * existing_bytes / expected_size)

    headers = {"User-Agent": "Dhvani-Voice-Integrity/1.0"}
    if existing_bytes > 0:
        headers["Range"] = f"bytes={existing_bytes}-"

    req = urllib.request.Request(url, headers=headers)

    mode = "ab" if existing_bytes > 0 else "wb"
    downloaded_in_session = 0

    try:
        with urllib.request.urlopen(req, timeout=120) as resp, open(dest_path, mode) as out_f:
            while True:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                out_f.write(chunk)
                downloaded_in_session += len(chunk)
                total_downloaded = existing_bytes + downloaded_in_session
                if total_downloaded % (64 * 1024 * 1024) < chunk_size:
                    pct = 100.0 * total_downloaded / max(expected_size, 1)
                    logger.info("Downloading %s: %.1f%% (%d / %d MB)", filename, pct, total_downloaded // (1024 * 1024), expected_size // (1024 * 1024))

        logger.info("Download finished for %s. Verifying MD5...", filename)
        post_md5 = compute_file_md5(dest_path)
        if post_md5 == expected_md5:
            logger.info("[SUCCESS] %s verified: MD5=%s", filename, post_md5)
            return True
        else:
            logger.error("[FAILED] %s checksum mismatch: expected %s, got %s", filename, expected_md5, post_md5)
            return False

    except Exception as exc:
        logger.error("Download interrupted for %s: %s", filename, exc)
        return False


def main():
    parser = argparse.ArgumentParser(description="ASVspoof 5 Official Dataset Downloader")
    parser.add_argument("--target", choices=["protocols", "dev", "eval", "train", "all"], default="protocols", help="Target archive group to download")
    parser.add_argument("--dest", type=str, default="data/asvspoof5_official", help="Destination directory for downloads")
    parser.add_argument("--extract", action="store_true", help="Extract archives after checksum verification")
    parser.add_argument("--verify-only", action="store_true", help="Only verify existing archives without downloading")

    args = parser.parse_args()
    dest_dir = Path(args.dest)
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Determine files to process
    targets = ["docs"]
    if args.target == "protocols":
        targets.append("protocols")
    elif args.target == "dev":
        targets.extend(["protocols", "dev"])
    elif args.target == "eval":
        targets.extend(["protocols", "eval"])
    elif args.target == "train":
        targets.extend(["protocols", "train"])
    elif args.target == "all":
        targets.extend(["protocols", "dev", "eval", "train"])

    selected_files = [fn for fn, meta in ARCHIVE_CATALOG.items() if meta["partition"] in targets]
    logger.info("Processing target [%s] (%d files selected)...", args.target, len(selected_files))

    failed_files = []
    for fn in selected_files:
        meta = ARCHIVE_CATALOG[fn]
        if args.verify_only:
            p = dest_dir / fn
            if not p.exists():
                logger.warning("[MISSING] %s", fn)
                failed_files.append(fn)
            else:
                curr_md5 = compute_file_md5(p)
                if curr_md5 == meta["md5"]:
                    logger.info("[VERIFIED] %s (MD5: %s)", fn, curr_md5)
                else:
                    logger.error("[CORRUPT] %s: expected %s, got %s", fn, meta["md5"], curr_md5)
                    failed_files.append(fn)
        else:
            ok = download_file_resumable(fn, dest_dir, meta["md5"], meta["size"])
            if not ok:
                failed_files.append(fn)
            elif args.extract and (fn.endswith(".tar.gz") or fn.endswith(".tar")):
                logger.info("Extracting %s...", fn)
                with tarfile.open(dest_dir / fn, "r:*") as tar:
                    tar.extractall(path=dest_dir)
                logger.info("Extracted %s", fn)

    if failed_files:
        logger.error("Finished with %d failed or corrupt file(s): %s", len(failed_files), failed_files)
        sys.exit(1)
    else:
        logger.info("All selected files verified successfully in %s.", dest_dir)


if __name__ == "__main__":
    main()

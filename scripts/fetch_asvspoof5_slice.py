"""
ASVspoof 5 Streaming Slice Fetcher.

Streams a verifiable slice of the official uncompressed ASVspoof 5 Development
audio archive (flac_D_aa.tar) from CERN Zenodo using HTTP Range requests.
Extracts complete FLAC files sequentially directly into data/asvspoof5_dev_slice/
for empirical countermeasure scoring without requiring the full 6.3GB archive.
"""

import argparse
import logging
import sys
import tarfile
import urllib.request
from pathlib import Path
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("asvspoof5_slice_fetcher")

ZENODO_FLAC_D_AA_URL = "https://zenodo.org/api/records/14498691/files/flac_D_aa.tar/content"


def fetch_audio_slice(
    target_bytes: int = 25 * 1024 * 1024,
    output_dir: Path = Path("data/asvspoof5_dev_slice"),
    max_files: Optional[int] = 150,
) -> int:
    """
    Streams a slice of flac_D_aa.tar from CERN Zenodo and extracts complete FLAC files.

    Args:
        target_bytes: Number of bytes to request in the Range header.
        output_dir: Directory where flac_D/ will be extracted.
        max_files: Maximum number of FLAC files to extract.

    Returns:
        Number of successfully extracted FLAC files.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    range_header = f"bytes=0-{target_bytes - 1}"
    logger.info("Connecting to CERN Zenodo with header: %s", range_header)

    req = urllib.request.Request(
        ZENODO_FLAC_D_AA_URL,
        headers={
            "Range": range_header,
            "User-Agent": "Dhvani-Voice-Integrity-Evaluation/1.0",
        },
    )

    extracted_count = 0
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            logger.info("Stream opened: HTTP %s, reading sequential tar blocks...", resp.status)
            with tarfile.open(fileobj=resp, mode="r|") as tar:
                for member in tar:
                    if member.isfile() and member.name.endswith(".flac"):
                        tar.extract(member, path=output_dir)
                        extracted_count += 1
                        if extracted_count % 20 == 0:
                            logger.info("Extracted %d audio files (%s)", extracted_count, member.name)
                        if max_files and extracted_count >= max_files:
                            logger.info("Reached target limit of %d files.", max_files)
                            break
    except tarfile.ReadError:
        logger.info("Reached end of HTTP byte range slice.")
    except Exception as exc:
        logger.warning("Stream truncated or completed: %s", exc)

    logger.info("Extraction complete: %d valid FLAC files in %s", extracted_count, output_dir)
    return extracted_count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch verifiable slice of ASVspoof 5 dev set audio.")
    parser.add_argument("--megabytes", type=int, default=25, help="Megabytes to stream (default: 25 MB).")
    parser.add_argument("--max-files", type=int, default=150, help="Max audio files to extract (default: 150).")
    parser.add_argument("--out-dir", type=str, default="data/asvspoof5_dev_slice", help="Output directory.")
    args = parser.parse_args()

    bytes_to_fetch = args.megabytes * 1024 * 1024
    count = fetch_audio_slice(
        target_bytes=bytes_to_fetch,
        output_dir=Path(args.out_dir),
        max_files=args.max_files,
    )
    if count == 0:
        logger.error("No files were extracted.")
        sys.exit(1)
    logger.info("Successfully fetched %d real ASVspoof 5 audio trials.", count)

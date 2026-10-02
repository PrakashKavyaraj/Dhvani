#!/usr/bin/env python3
"""
Evaluation Runner Script (Reproducible Prediction Export)

Executes the M2 -> M1 -> M5 pipeline on each record from an input CSV or JSONL
manifest and exports per-record predictions, risk scores, and component versions.

NOTE: This script deliberately does NOT calculate or claim scientific performance
metrics (such as EER, AUC-ROC, or Accuracy). Proper evaluation requires team-provided
ground-truth labels, a representative out-of-domain evaluation split, and statistical
significance testing.
"""

import argparse
import csv
import json
import sys
import time
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.integrations.m1_detector import predict
from app.integrations.m2_audio import preprocess_audio
from app.integrations.m5_risk import calculate_risk


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run evaluation export across audio files without live server requirements."
    )
    parser.add_argument("--input", required=True, help="Path to input CSV or JSONL manifest.")
    parser.add_argument("--output", required=True, help="Path to output CSV destination.")
    parser.add_argument("--limit", type=int, default=None, help="Optional max records to process.")
    return parser.parse_args()


def load_input_manifest(manifest_path: Path) -> list[dict]:
    records = []
    if manifest_path.suffix.lower() == ".jsonl":
        with open(manifest_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
    else:
        with open(manifest_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                records.append(row)
    return records


def main():
    args = parse_arguments()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.is_file():
        sys.exit(f"Error: Input manifest '{input_path}' not found.")

    records = load_input_manifest(input_path)
    if args.limit:
        records = records[: args.limit]

    output_fields = [
        "audio_path",
        "label",
        "predicted_probability",
        "risk_score",
        "risk_level",
        "model_version",
        "preprocessing_version",
        "risk_policy_version",
        "processing_time_ms",
        "status",
        "error_code",
    ]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    processed_count = 0

    with open(output_path, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=output_fields)
        writer.writeheader()

        for rec in records:
            audio_path_str = rec.get("audio_path", "")
            label = rec.get("label", "unknown")
            audio_path = Path(audio_path_str)

            start = time.perf_counter()
            if not audio_path.is_file():
                writer.writerow(
                    {
                        "audio_path": audio_path_str,
                        "label": label,
                        "predicted_probability": "",
                        "risk_score": "",
                        "risk_level": "",
                        "model_version": "",
                        "preprocessing_version": "",
                        "risk_policy_version": "",
                        "processing_time_ms": 0,
                        "status": "failed",
                        "error_code": "FILE_NOT_FOUND",
                    }
                )
                continue

            try:
                prepared = preprocess_audio(audio_path)
                prediction = predict(prepared)
                risk = calculate_risk(prediction, prepared)
                duration_ms = int((time.perf_counter() - start) * 1000)

                writer.writerow(
                    {
                        "audio_path": audio_path_str,
                        "label": label,
                        "predicted_probability": prediction.synthetic_speech_probability,
                        "risk_score": risk.risk_score,
                        "risk_level": risk.risk_level.value,
                        "model_version": prediction.model_version,
                        "preprocessing_version": prepared.preprocessing_version,
                        "risk_policy_version": risk.risk_policy_version,
                        "processing_time_ms": duration_ms,
                        "status": "completed",
                        "error_code": "",
                    }
                )
            except Exception as exc:
                duration_ms = int((time.perf_counter() - start) * 1000)
                writer.writerow(
                    {
                        "audio_path": audio_path_str,
                        "label": label,
                        "predicted_probability": "",
                        "risk_score": "",
                        "risk_level": "",
                        "model_version": "",
                        "preprocessing_version": "",
                        "risk_policy_version": "",
                        "processing_time_ms": duration_ms,
                        "status": "failed",
                        "error_code": getattr(exc, "code", type(exc).__name__),
                    }
                )

            processed_count += 1

    print(f"Processed {processed_count} records. Results exported to {output_path}")


if __name__ == "__main__":
    main()
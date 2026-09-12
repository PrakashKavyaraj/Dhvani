#!/usr/bin/env python3
"""Export reproducible pipeline predictions; this script does not calculate metrics."""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.integrations.m1_detector import predict
from app.integrations.m2_audio import preprocess_audio
from app.integrations.m5_risk import calculate_risk
from app.models.domain import AnalysisError

FIELDS = ["audio_path", "label", "predicted_probability", "risk_score", "risk_level", "model_version", "preprocessing_version", "risk_policy_version", "processing_time_ms", "status", "error_code"]


def read_manifest(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        if path.suffix.lower() == ".jsonl":
            return [json.loads(line) for line in handle if line.strip()]
        return list(csv.DictReader(handle))


def evaluate(row: dict[str, str]) -> dict[str, object]:
    output: dict[str, object] = {key: row.get(key, "") for key in FIELDS}
    output.update({"audio_path": row.get("audio_path", ""), "status": "failed", "error_code": ""})
    started = time.perf_counter()
    try:
        prepared = preprocess_audio(Path(str(output["audio_path"])))
        prediction = predict(prepared)
        assessment = calculate_risk(prediction, prepared)
        output.update({"predicted_probability": prediction.synthetic_probability, "risk_score": assessment.risk_score, "risk_level": assessment.risk_level, "model_version": prediction.model_version, "preprocessing_version": prepared.preprocessing_version, "risk_policy_version": assessment.risk_policy_version, "status": "completed"})
    except AnalysisError as exc:
        output["error_code"] = exc.code
    except Exception:
        output["error_code"] = "INFERENCE_FAILED"
    output["processing_time_ms"] = round((time.perf_counter() - started) * 1000)
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Export backend predictions for a CSV or JSONL manifest.")
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    rows = [evaluate(row) for row in read_manifest(args.manifest)]
    with args.output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} prediction rows to {args.output}")


if __name__ == "__main__":
    main()

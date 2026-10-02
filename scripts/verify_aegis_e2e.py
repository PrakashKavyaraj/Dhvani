#!/usr/bin/env python3
"""
End-to-end verification script for AEGIS integration into FastAPI backend.
Tests:
1. POST /api/v1/analyses with real audio (voice.wav)
2. GET /api/v1/analyses/{analysis_id} polling until completed
3. Schema and mapping verification:
   - risk_score == round(aegis["decision"]["risk"] * 100)
   - risk_level == aegis["decision"]["severity"]
   - synthetic_speech_probability == aegis["voice_authenticity"]["persistent_spoof_evidence"]
   - model_confidence == aegis["decision"]["confidence"]
   - All frontend fields preserved
   - No internal filesystem paths exposed
"""

import json
import os
import sys
import time
from pathlib import Path

from fastapi.testclient import TestClient

backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from app.main import app


def main():
    wav_path = Path("/Users/prakashkavyaraj/Downloads/voice.wav")
    if not wav_path.is_file():
        from tests.conftest import generate_test_wav
        wav_bytes = generate_test_wav(duration=4.0)
        filename = "test_synthetic.wav"
    else:
        wav_bytes = wav_path.read_bytes()
        filename = wav_path.name

    print("================================================================")
    print("  AEGIS INTEGRATION REAL END-TO-END VERIFICATION")
    print("================================================================")
    print(f"Testing audio payload: {filename} ({len(wav_bytes)} bytes)")

    with TestClient(app) as client:
        # Step 1: POST /api/v1/analyses
        t0 = time.perf_counter()
        post_res = client.post(
            "/api/v1/analyses",
            files={"file": (filename, wav_bytes, "audio/wav")},
            data={"experiment_id": "e2e-aegis-test", "language": "en"},
        )
        print(f"POST /api/v1/analyses status: {post_res.status_code}")
        assert post_res.status_code == 202, f"Expected 202, got {post_res.status_code}: {post_res.text}"
        post_data = post_res.json()
        analysis_id = post_data["analysis_id"]
        print(f"Received analysis_id: {analysis_id}, status: {post_data['status']}")

        # Step 2: Poll GET /api/v1/analyses/{analysis_id}
        max_wait = 30.0
        poll_interval = 0.2
        elapsed = 0.0
        completed_data = None

        while elapsed < max_wait:
            get_res = client.get(f"/api/v1/analyses/{analysis_id}")
            assert get_res.status_code == 200, f"Expected 200, got {get_res.status_code}"
            data = get_res.json()
            status = data.get("status")

            if status == "completed":
                completed_data = data
                break
            elif status == "failed":
                print(f"[!] Analysis failed: {data.get('error')}")
                sys.exit(1)

            time.sleep(poll_interval)
            elapsed += poll_interval

        total_time_ms = (time.perf_counter() - t0) * 1000.0
        assert completed_data is not None, f"Analysis timed out after {max_wait}s"

        print(f"\nAnalysis completed successfully in {total_time_ms:.2f} ms!")
        print("\n--- COMPLETED RESPONSE JSON ---")
        print(json.dumps(completed_data, indent=2))

        # Step 3: Verification of Required Fields
        print("\n--- VERIFICATION CHECKS ---")
        required_frontend_fields = [
            "analysis_id",
            "status",
            "risk_score",
            "risk_level",
            "synthetic_speech_probability",
            "model_confidence",
            "audio_quality",
            "evidence",
            "recommendation",
            "versions",
            "processing_time_ms",
            "disclaimer",
        ]

        for field in required_frontend_fields:
            assert field in completed_data, f"Missing frontend field: {field}"
            print(f"[PASS] Frontend field '{field}' is present: {completed_data[field] is not None}")

        assert "aegis" in completed_data, "Missing 'aegis' field in response"
        print(f"[PASS] 'aegis' evidence payload is present")

        aegis = completed_data["aegis"]

        for key in ["session_id", "audio", "voice_authenticity", "speaker_identity", "temporal", "decision", "evidence"]:
            assert key in aegis, f"Missing AEGIS key '{key}'"
            print(f"[PASS] AEGIS sub-key '{key}' is present")

        # Verification of Mappings
        expected_risk_score = round(aegis["decision"]["risk"] * 100)
        assert completed_data["risk_score"] == expected_risk_score, (
            f"risk_score mismatch: {completed_data['risk_score']} != {expected_risk_score}"
        )
        print(f"[PASS] risk_score mapped correctly: {completed_data['risk_score']}")

        expected_risk_level = aegis["decision"]["severity"]
        assert completed_data["risk_level"] == expected_risk_level, (
            f"risk_level mismatch: {completed_data['risk_level']} != {expected_risk_level}"
        )
        print(f"[PASS] risk_level mapped correctly: {completed_data['risk_level']}")

        expected_synth_prob = aegis["voice_authenticity"]["persistent_spoof_evidence"]
        assert completed_data["synthetic_speech_probability"] == expected_synth_prob, (
            f"synthetic_speech_probability mismatch: {completed_data['synthetic_speech_probability']} != {expected_synth_prob}"
        )
        print(f"[PASS] synthetic_speech_probability mapped correctly: {completed_data['synthetic_speech_probability']}")

        expected_conf = aegis["decision"]["confidence"]
        assert completed_data["model_confidence"] == expected_conf, (
            f"model_confidence mismatch: {completed_data['model_confidence']} != {expected_conf}"
        )
        print(f"[PASS] model_confidence mapped correctly: {completed_data['model_confidence']}")

        # Verification of Speaker Identity Semantics
        spk = aegis["speaker_identity"]
        assert "raw_similarity" in spk, "Missing 'raw_similarity' in speaker_identity"
        assert -1.0 <= spk["raw_similarity"] <= 1.0, f"raw_similarity out of bounds: {spk['raw_similarity']}"
        assert 0.0 <= spk["similarity"] <= 1.0, f"normalized similarity out of bounds: {spk['similarity']}"
        expected_norm_sim = (spk["raw_similarity"] + 1.0) / 2.0
        assert abs(spk["similarity"] - expected_norm_sim) < 1e-6, (
            f"Normalization mismatch: {spk['similarity']} != {expected_norm_sim}"
        )
        print(f"[PASS] speaker_identity raw_similarity ({spk['raw_similarity']:.4f}) and normalized similarity ({spk['similarity']:.4f}) verified")

        # Check for leaked filesystem paths
        json_str = json.dumps(completed_data)
        for leak in ["/Users/", "prakashkavyaraj", ".pth", ".pt", "AEGIS_INTEGRATION"]:
            assert leak not in json_str, f"Found leaked filesystem path '{leak}' in JSON response!"
        print(f"[PASS] No internal filesystem paths exposed in API response")

        print("\nALL END-TO-END VERIFICATION CHECKS PASSED!")


if __name__ == "__main__":
    main()

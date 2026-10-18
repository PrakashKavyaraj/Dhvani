# Model Weights & Fusion Logic Provenance Register
**Evaluation Milestone:** Milestone 1 Slice Investigation  
**Evaluation Git Commit Hash:** `613f1a71d3362fe6d2c0910691ef9cfa9dc7456c`  
**Recorded Timestamp:** 2026-10-18T14:48:00Z  

---

## 1. Model Weights Cryptographic Hash Inventory

| Model Identifier | File Path | File Format / Architecture | SHA-256 Cryptographic Checksum | Parameter Count | Source Repository |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Forensics-0.3B** | [`models/weights/forensics_0.3B_base.safetensors`](file:///Users/prakashkavyaraj/backend/models/weights/forensics_0.3B_base.safetensors) | SafeTensors (WavLM-Large + AASIST GAT + MLP) | `803d2c57e705395d007b9deaf5b1a110965950f207df223e6dff5b6d298490fb` | ~315M | `eliya/forensics_0.3B_base_deepfake_classifier` |
| **AASIST-L (PyTorch)** | [`models/weights/AASIST-L.pth`](file:///Users/prakashkavyaraj/backend/models/weights/AASIST-L.pth) | PyTorch Checkpoint (RawNet2 frontend + GAT) | `814331d088032bb4c3fa61cc014789eadeed464209dd094ab3a2dd6ffbdce27a` | ~297K | Official AASIST repository |
| **AASIST-L (ONNX)** | [`models/weights/aasist_l.onnx`](file:///Users/prakashkavyaraj/backend/models/weights/aasist_l.onnx) | ONNX Graph (64,600-sample window) | `a6af184ed5a59036f02668f05cd092e03aeadd5ac523085d15bdbc6711040002` | ~297K | Exported from `AASIST-L.pth` |
| **Silero VAD** | [`models/weights/silero_vad.jit`](file:///Users/prakashkavyaraj/backend/models/weights/silero_vad.jit) | TorchScript JIT (Voice Activity Detection) | `e1122837f4154c511485fe0b9c64455f7b929c96fbb8d79fbdb336383ebd3720` | ~1.8M | Silero VAD v4 |
| **ECAPA-TDNN Embedding** | [`models/cache/spkrec-ecapa-voxceleb/embedding_model.ckpt`](file:///Users/prakashkavyaraj/backend/models/cache/spkrec-ecapa-voxceleb/embedding_model.ckpt) | PyTorch Checkpoint (Speaker Embedding) | `0575cb64845e6b9a10db9bcb74d5ac32b326b8dc90352671d345e2ee3d0126a2` | ~20.8M | SpeechBrain `spkrec-ecapa-voxceleb` |
| **ECAPA-TDNN Classifier** | [`models/cache/spkrec-ecapa-voxceleb/classifier.ckpt`](file:///Users/prakashkavyaraj/backend/models/cache/spkrec-ecapa-voxceleb/classifier.ckpt) | PyTorch Checkpoint (Speaker Classification Head) | `fd9e3634fe68bd0a427c95e354c0c677374f62b3f434e45b78599950d860d535` | ~1.4M | SpeechBrain `spkrec-ecapa-voxceleb` |

---

## 2. Dataset Exposure & Training Provenance Audit

| Subsystem / Weight | Training & Fine-Tuning Corpus | ASVspoof 5 Train Included? | ASVspoof 5 Dev Included? | ASVspoof 5 Eval Included? | 300-Trial Dev Slice Included? |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Forensics-0.3B** | 5M+ speech samples spanning public and proprietary sets: MLAAD v7, CodecFake, DFADD, MD-CommonVoice, In-the-Wild, ASVspoof 2019 LA, ASVspoof 2021 LA, LibriSeVoc, SONAR. | **UNKNOWN** (Model card reports ASVspoof2024 external evaluation at 11.91% EER, but exact training manifest composition is undisclosed) | **UNKNOWN** | **NO** (Eval set remained sealed by challenge organizers) | **NO** (Audio files were extracted directly from CERN Zenodo archive `flac_D_aa.tar` on 2026-10-18) |
| **AASIST-L** | Trained strictly on ASVspoof 2019 Logical Access (LA) training split (attacks A01 to A06, 25,380 utterances). | **NO** (Model checkpoint created and published in 2021 prior to ASVspoof 5) | **NO** | **NO** | **NO** |
| **ECAPA-TDNN** | Trained on VoxCeleb 1 and VoxCeleb 2 developmental sets for automatic speaker verification. | **NO** | **NO** | **NO** | **NO** |
| **Silero VAD** | Trained by Silero on multilingual speech datasets (LibriSpeech, Common Voice) for voice activity discrimination. | **NO** | **NO** | **NO** | **NO** |
| **AEGIS Fusion Weights** | Heuristic evidence combination formulas balancing primary deepfake detector, channel reliability, passive liveness, and speaker similarity. | **NO** (Heuristic configuration, not trained or fitted on any dataset) | **NO** | **NO** | **NO** |
| **Probability Calibrator** | Fixed Platt scaling transformation: $a = 6.2$, $b = -3.1$, prior $= 0.05$. | **NO** (Default initialization parameters, explicitly frozen without fitting on the 300-trial slice) | **NO** | **NO** | **NO** |

---

## 3. Provenance Verdict
None of the components were fitted, trained, or calibrated on the 300-trial ASVspoof 5 development slice. AASIST-L, ECAPA-TDNN, and Silero VAD have zero historical exposure to any ASVspoof 5 data. Forensics-0.3B was trained externally on an expansive multi-source dataset (5M+ utterances) with undisclosed manifests, meaning its training overlap with the ASVspoof 5 training partition is classified as **UNKNOWN**.

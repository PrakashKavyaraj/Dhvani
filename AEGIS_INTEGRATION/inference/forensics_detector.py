"""
Forensics 0.3B Deepfake Detector for AEGIS.

Wrapper around eliya/forensics_0.3B_base_deepfake_classifier:
WavLM-Large backbone + AASIST Graph Attention Pooling + MLP Classifier.
Fine-tuned for speech deepfake detection across diverse TTS models,
voice conversion, and codec/channel augmentations.

Contract:
- Input: audio file path or numpy array (16 kHz mono)
- Output: calibrated fake_probability in [0.0, 1.0], bonafide_probability,
  verdict ('REAL' | 'FAKE'), per-window temporal scores.
"""

import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import librosa
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from safetensors.torch import load_file
from transformers import WavLMConfig, WavLMModel


# -------------------------------------------------------------------------
# Neural Architecture: WavLM-Large + AASIST Graph Attention Pooling
# -------------------------------------------------------------------------

class _GraphAttentionLayer(nn.Module):
    def __init__(self, in_dim, out_dim, temperature):
        super().__init__()
        self.att_proj = nn.Linear(in_dim, out_dim)
        self.att_weight = nn.Parameter(torch.empty(out_dim, 1))
        self.proj_with_att = nn.Linear(in_dim, out_dim)
        self.proj_without_att = nn.Linear(in_dim, out_dim)
        self.bn = nn.BatchNorm1d(out_dim)
        self.temp = temperature

    def forward(self, x):
        N = x.size(1)
        x_i = x.unsqueeze(2).expand(-1, -1, N, -1)
        att = torch.matmul(torch.tanh(self.att_proj(x_i * x_i.transpose(1, 2))), self.att_weight) / self.temp
        att = F.softmax(att, dim=-2)
        out = self.proj_with_att(torch.matmul(att.squeeze(-1), x)) + self.proj_without_att(x)
        s = out.shape
        return F.selu(self.bn(out.reshape(-1, s[-1])).reshape(s))


class _HtrgGraphAttentionLayer(nn.Module):
    def __init__(self, in_dim, out_dim, temperature):
        super().__init__()
        self.proj_type1 = nn.Linear(in_dim, in_dim)
        self.proj_type2 = nn.Linear(in_dim, in_dim)
        self.att_proj = nn.Linear(in_dim, out_dim)
        self.att_projM = nn.Linear(in_dim, out_dim)
        self.att_weight11 = nn.Parameter(torch.empty(out_dim, 1))
        self.att_weight22 = nn.Parameter(torch.empty(out_dim, 1))
        self.att_weight12 = nn.Parameter(torch.empty(out_dim, 1))
        self.att_weightM = nn.Parameter(torch.empty(out_dim, 1))
        self.proj_with_att = nn.Linear(in_dim, out_dim)
        self.proj_without_att = nn.Linear(in_dim, out_dim)
        self.proj_with_attM = nn.Linear(in_dim, out_dim)
        self.proj_without_attM = nn.Linear(in_dim, out_dim)
        self.bn = nn.BatchNorm1d(out_dim)
        self.temp = temperature

    def forward(self, x1, x2, master):
        n1 = x1.size(1)
        x = torch.cat([self.proj_type1(x1), self.proj_type2(x2)], dim=1)
        N = x.size(1)
        x_i = x.unsqueeze(2).expand(-1, -1, N, -1)
        att_map = torch.tanh(self.att_proj(x_i * x_i.transpose(1, 2)))
        board = torch.zeros_like(att_map[:, :, :, 0]).unsqueeze(-1)
        board[:, :n1, :n1] = torch.matmul(att_map[:, :n1, :n1], self.att_weight11)
        board[:, n1:, n1:] = torch.matmul(att_map[:, n1:, n1:], self.att_weight22)
        board[:, :n1, n1:] = torch.matmul(att_map[:, :n1, n1:], self.att_weight12)
        board[:, n1:, :n1] = torch.matmul(att_map[:, n1:, :n1], self.att_weight12)
        board = F.softmax(board / self.temp, dim=-2)
        out = self.proj_with_att(torch.matmul(board.squeeze(-1), x)) + self.proj_without_att(x)
        s = out.shape
        out = F.selu(self.bn(out.reshape(-1, s[-1])).reshape(s))
        att_m = F.softmax(torch.matmul(torch.tanh(self.att_projM(x * master)), self.att_weightM) / self.temp, dim=-2)
        master = self.proj_with_attM(torch.matmul(att_m.squeeze(-1).unsqueeze(1), x)) + self.proj_without_attM(master)
        return out.narrow(1, 0, n1), out.narrow(1, n1, N - n1), master


class _GraphPool(nn.Module):
    def __init__(self, k, in_dim):
        super().__init__()
        self.k = k
        self.proj = nn.Linear(in_dim, 1)

    def forward(self, h):
        scores = torch.sigmoid(self.proj(h))
        n_keep = max(int(h.size(1) * self.k), 1)
        idx = torch.topk(scores, n_keep, dim=1)[1].expand(-1, -1, h.size(-1))
        return torch.gather(h * scores, 1, idx)


class AASISTPool(nn.Module):
    def __init__(self, feat_dim, num_layers, gat_dims=(128, 64),
                 pool_ratios=(0.5, 0.7, 0.5, 0.5), temps=(2.0, 2.0, 100.0, 100.0)):
        super().__init__()
        g = list(gat_dims)
        self.proj = nn.Linear(feat_dim, g[0])
        self.pos_S = nn.Parameter(torch.randn(1, num_layers, g[0]))
        self.master1 = nn.Parameter(torch.randn(1, 1, g[0]))
        self.master2 = nn.Parameter(torch.randn(1, 1, g[0]))
        self.GAT_S = _GraphAttentionLayer(g[0], g[0], temps[0])
        self.GAT_T = _GraphAttentionLayer(g[0], g[0], temps[1])
        self.HtrgGAT_11 = _HtrgGraphAttentionLayer(g[0], g[1], temps[2])
        self.HtrgGAT_12 = _HtrgGraphAttentionLayer(g[1], g[1], temps[3])
        self.HtrgGAT_21 = _HtrgGraphAttentionLayer(g[0], g[1], temps[2])
        self.HtrgGAT_22 = _HtrgGraphAttentionLayer(g[1], g[1], temps[3])
        self.pool_S = _GraphPool(pool_ratios[0], g[0])
        self.pool_T = _GraphPool(pool_ratios[1], g[0])
        self.pool_hS1 = _GraphPool(pool_ratios[2], g[1])
        self.pool_hT1 = _GraphPool(pool_ratios[2], g[1])
        self.pool_hS2 = _GraphPool(pool_ratios[2], g[1])
        self.pool_hT2 = _GraphPool(pool_ratios[2], g[1])
        self.output_dim = 5 * g[1]

    def forward(self, hidden_states):
        projected = self.proj(torch.stack(hidden_states, dim=1))
        e_S = torch.max(torch.abs(projected), dim=2)[0] + self.pos_S
        e_T = torch.max(torch.abs(projected), dim=1)[0]
        out_S = self.pool_S(self.GAT_S(e_S))
        out_T = self.pool_T(self.GAT_T(e_T))
        out_T1, out_S1, m1 = self.HtrgGAT_11(out_T, out_S, self.master1)
        out_S1, out_T1 = self.pool_hS1(out_S1), self.pool_hT1(out_T1)
        a_T, a_S, a_m = self.HtrgGAT_12(out_T1, out_S1, m1)
        out_T1, out_S1, m1 = out_T1 + a_T, out_S1 + a_S, m1 + a_m
        out_T2, out_S2, m2 = self.HtrgGAT_21(out_T, out_S, self.master2)
        out_S2, out_T2 = self.pool_hS2(out_S2), self.pool_hT2(out_T2)
        a_T, a_S, a_m = self.HtrgGAT_22(out_T2, out_S2, m2)
        out_T2, out_S2, m2 = out_T2 + a_T, out_S2 + a_S, m2 + a_m
        out_T, out_S, master = torch.max(out_T1, out_T2), torch.max(out_S1, out_S2), torch.max(m1, m2)
        return torch.cat([torch.max(torch.abs(out_T), 1)[0], out_T.mean(1),
                          torch.max(torch.abs(out_S), 1)[0], out_S.mean(1), master.squeeze(1)], dim=1)


class MLPBlock(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(dim, dim * 2),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(dim * 2, dim),
            nn.GELU(),
            nn.Dropout(0.1),
        )

    def forward(self, x):
        return self.net(x)


class Classifier(nn.Module):
    def __init__(self, input_dim, hidden_dim, num_layers, num_labels=1):
        super().__init__()
        self.input_proj = nn.Linear(input_dim, hidden_dim) if input_dim != hidden_dim else nn.Identity()
        self.mlp_blocks = nn.ModuleList([MLPBlock(hidden_dim) for _ in range(num_layers)])
        self.layer_norms = nn.ModuleList([nn.LayerNorm(hidden_dim) for _ in range(num_layers)])
        self.output_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim, num_labels),
        )

    def forward(self, x):
        x = self.input_proj(x)
        for mlp, ln in zip(self.mlp_blocks, self.layer_norms):
            x = x + mlp(ln(x))
        return self.output_head(x)


class DeepfakeDetector(nn.Module):
    def __init__(self, hidden_dim=320, classifier_layers=3, aasist_gat_dims=(128, 64)):
        super().__init__()
        cfg = WavLMConfig.from_pretrained("microsoft/wavlm-large")
        self.wavlm = WavLMModel(cfg)
        self.pool = AASISTPool(self.wavlm.config.hidden_size, self.wavlm.config.num_hidden_layers, aasist_gat_dims)
        self.classifier = Classifier(self.pool.output_dim, hidden_dim, classifier_layers)

    @torch.no_grad()
    def forward(self, waveform):
        hs = list(self.wavlm(waveform, output_hidden_states=True).hidden_states[1:])
        return self.classifier(self.pool(hs)).squeeze(-1)


# -------------------------------------------------------------------------
# Production Inference Wrapper
# -------------------------------------------------------------------------

class ForensicsDetector:
    """
    AEGIS Primary Acoustic Deepfake Detector.
    Wraps forensics_0.3B_base_deepfake_classifier for production inference.
    """

    MODEL_ID = "eliya/forensics_0.3B_base_deepfake_classifier"
    VERSION = "0.3B-base-v1"
    SAMPLE_RATE = 16000
    WINDOW_SECONDS = 5.0
    WINDOW_SAMPLES = int(5.0 * 16000)   # 80,000 samples
    HOP_SECONDS = 2.5
    HOP_SAMPLES = int(2.5 * 16000)       # 40,000 samples

    def __init__(
        self,
        checkpoint_path: Union[str, Path],
        device: str = "cpu",
    ):
        self.checkpoint_path = Path(checkpoint_path)
        self.device = torch.device(device)
        self.model: Optional[DeepfakeDetector] = None
        self._load_model()

    def _load_model(self) -> None:
        if not self.checkpoint_path.is_file():
            raise FileNotFoundError(
                f"Forensics 0.3B checkpoint not found at: {self.checkpoint_path}. "
                f"Ensure 'forensics_0.3B_base.safetensors' is in backend/models/weights/."
            )

        self.model = DeepfakeDetector().to(self.device).eval()
        state_dict = load_file(str(self.checkpoint_path))
        # strict=False safely ignores auxiliary training projection head keys
        self.model.load_state_dict(state_dict, strict=False)

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def _load_audio(
        self,
        audio_input: Union[str, Path, np.ndarray],
        sr: Optional[int] = None,
    ) -> Tuple[torch.Tensor, float]:
        """Loads and normalizes audio into 16 kHz mono float tensor."""
        if isinstance(audio_input, (str, Path)):
            path = Path(audio_input)
            if not path.is_file():
                raise FileNotFoundError(f"Audio file not found: {path}")
            y, _ = librosa.load(str(path), sr=self.SAMPLE_RATE, mono=True)
        elif isinstance(audio_input, np.ndarray):
            y = audio_input.astype(np.float32)
            if y.ndim > 1:
                y = np.mean(y, axis=0)
            if sr is not None and sr != self.SAMPLE_RATE:
                y = librosa.resample(y, orig_sr=sr, target_sr=self.SAMPLE_RATE)
        else:
            raise ValueError(f"Unsupported audio input type: {type(audio_input)}")

        duration = float(len(y) / self.SAMPLE_RATE)
        wav = torch.from_numpy(y).float()
        # Peak normalization as required by model card
        max_val = float(wav.abs().max().item())
        wav = wav / (max_val + 1e-8)
        return wav, duration

    def predict(
        self,
        audio_input: Union[str, Path, np.ndarray],
        sr: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Executes primary deepfake detection across center and temporal sliding windows.

        Returns:
            Dictionary containing calibrated fake_probability, bonafide_probability,
            verdict, window_scores, and model metadata.
        """
        if self.model is None:
            raise RuntimeError("ForensicsDetector model is not loaded.")

        t_start = time.perf_counter()
        wav, duration = self._load_audio(audio_input, sr=sr)

        n = self.WINDOW_SAMPLES
        cur = wav.shape[0]

        # 1. Official Center 5s chunk
        if cur < n:
            center_chunk = wav.repeat((n + cur - 1) // cur)[:n]
        elif cur > n:
            s = (cur - n) // 2
            center_chunk = wav[s : s + n]
        else:
            center_chunk = wav

        with torch.inference_mode():
            center_logit = self.model(center_chunk.unsqueeze(0).to(self.device)).float()
            center_bonafide = float(torch.sigmoid(center_logit).item())
            center_fake = 1.0 - center_bonafide

        # 2. Sliding windows for temporal consistency tracking
        window_scores: List[float] = []
        if cur <= n:
            window_scores = [round(center_fake, 4)]
        else:
            window_tensors = []
            for start_idx in range(0, cur - n + 1, self.HOP_SAMPLES):
                window_tensors.append(wav[start_idx : start_idx + n])
            
            if window_tensors:
                batch = torch.stack(window_tensors).to(self.device)
                with torch.inference_mode():
                    logits = self.model(batch).float()
                    bonafides = torch.sigmoid(logits).cpu().numpy()
                    window_scores = [round(float(1.0 - b), 4) for b in bonafides]

        if not window_scores:
            window_scores = [round(center_fake, 4)]

        # Robust pooled primary fake probability (median across temporal windows)
        pooled_fake = float(np.median(window_scores))
        if len(window_scores) == 1:
            pooled_fake = center_fake

        pooled_fake = float(np.clip(pooled_fake, 0.0, 1.0))
        pooled_bonafide = float(np.clip(1.0 - pooled_fake, 0.0, 1.0))
        inference_ms = (time.perf_counter() - t_start) * 1000.0

        return {
            "model": self.MODEL_ID,
            "version": self.VERSION,
            "fake_probability": round(pooled_fake, 4),
            "bonafide_probability": round(pooled_bonafide, 4),
            "center_fake_probability": round(center_fake, 4),
            "verdict": "FAKE" if pooled_fake >= 0.50 else "REAL",
            "windows_analyzed": len(window_scores),
            "window_scores": window_scores,
            "duration_sec": round(duration, 2),
            "inference_time_ms": round(inference_ms, 2),
        }

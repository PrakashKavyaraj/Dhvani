
from typing import Dict, Any, List
import os

import numpy as np
import torch
import torch.nn.functional as F

from speechbrain.inference.speaker import SpeakerRecognition


class ECAPAVerifier:
    """
    ECAPA-TDNN speaker identity evidence provider.

    This component does NOT decide whether someone is an
    impersonator. It provides speaker similarity evidence
    for the AEGIS fusion layer.

    Similarity is interpreted relative to the enrollment
    profile and its observed calibration statistics.
    """

    def __init__(
        self,
        model_dir: str,
        profile_path: str,
        device: str = "cpu",
        chunk_seconds: float = 4.0,
        hop_seconds: float = 2.0,
    ):

        self.model_dir = model_dir
        self.profile_path = profile_path
        self.device = device

        self.sample_rate = 16000

        self.chunk_samples = int(
            chunk_seconds * self.sample_rate
        )

        self.hop_samples = int(
            hop_seconds * self.sample_rate
        )

        self.model = self._load_model()
        self.profile = self._load_profile()

    # --------------------------------------------------------
    # Model
    # --------------------------------------------------------

    def _load_model(self):

        if not os.path.exists(self.model_dir):
            raise FileNotFoundError(
                f"ECAPA model directory not found: "
                f"{self.model_dir}"
            )

        model = SpeakerRecognition.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            savedir=self.model_dir,
            run_opts={
                "device": self.device
            },
        )

        return model

    # --------------------------------------------------------
    # Profile
    # --------------------------------------------------------

    def _load_profile(self):

        if not os.path.exists(
            self.profile_path
        ):
            raise FileNotFoundError(
                f"Speaker profile not found: "
                f"{self.profile_path}"
            )

        profile = torch.load(
            self.profile_path,
            map_location="cpu",
            weights_only=False,
        )

        if not isinstance(
            profile,
            dict
        ):
            raise ValueError(
                "Speaker profile must be a dictionary."
            )

        if "embedding" not in profile:
            raise ValueError(
                "Speaker profile does not contain "
                "'embedding'."
            )

        embedding = profile[
            "embedding"
        ].float()

        if embedding.ndim != 1:
            embedding = embedding.reshape(-1)

        embedding = F.normalize(
            embedding,
            p=2,
            dim=0,
        )

        profile["embedding"] = embedding

        return profile

    # --------------------------------------------------------
    # Audio
    # --------------------------------------------------------

    def _load_audio(
        self,
        audio_input: Any,
    ):
        if isinstance(audio_input, np.ndarray):
            audio = audio_input.astype(np.float32)
            if audio.ndim > 1:
                audio = np.mean(audio, axis=0)
            audio = audio - np.mean(audio)
            return audio, self.sample_rate

        audio_path = str(audio_input)
        if not os.path.exists(
            audio_path
        ):
            raise FileNotFoundError(
                f"Audio not found: {audio_path}"
            )

        import librosa

        audio, sr = librosa.load(
            audio_path,
            sr=self.sample_rate,
            mono=True,
        )

        audio = np.asarray(
            audio,
            dtype=np.float32,
        )

        audio = audio - np.mean(
            audio
        )

        return audio, sr

    # --------------------------------------------------------
    # Chunking
    # --------------------------------------------------------

    def _make_chunks(
        self,
        audio: np.ndarray,
    ):

        chunks = []

        if len(audio) <= self.chunk_samples:

            padded = np.pad(
                audio,
                (
                    0,
                    max(
                        0,
                        self.chunk_samples
                        -
                        len(audio),
                    ),
                ),
            )

            chunks.append(
                {
                    "start_sample": 0,
                    "end_sample": len(audio),
                    "audio": padded,
                }
            )

            return chunks

        for start in range(
            0,
            len(audio),
            self.hop_samples,
        ):

            chunk = audio[
                start:
                start + self.chunk_samples
            ]

            if len(chunk) < (
                self.chunk_samples // 2
            ):
                continue

            original_length = len(
                chunk
            )

            if len(chunk) < self.chunk_samples:
                chunk = np.pad(
                    chunk,
                    (
                        0,
                        self.chunk_samples
                        -
                        len(chunk),
                    ),
                )

            chunks.append(
                {
                    "start_sample": start,
                    "end_sample": (
                        start
                        +
                        original_length
                    ),
                    "audio": chunk,
                }
            )

        return chunks

    # --------------------------------------------------------
    # Embedding
    # --------------------------------------------------------

    def _embedding(
        self,
        audio: np.ndarray,
    ):

        waveform = torch.from_numpy(
            audio
        ).float()

        waveform = waveform.unsqueeze(
            0
        )

        with torch.inference_mode():

            embedding = (
                self.model.encode_batch(
                    waveform
                )
            )

        embedding = embedding.squeeze()

        embedding = F.normalize(
            embedding,
            p=2,
            dim=0,
        )

        return embedding.cpu()

    # --------------------------------------------------------
    # Similarity
    # --------------------------------------------------------

    def _similarity(
        self,
        embedding: torch.Tensor,
    ) -> float:

        profile_embedding = (
            self.profile[
                "embedding"
            ]
        )

        similarity = F.cosine_similarity(
            embedding.unsqueeze(0),
            profile_embedding.unsqueeze(0),
            dim=1,
        )

        return float(
            similarity.item()
        )

    # --------------------------------------------------------
    # Identity interpretation
    # --------------------------------------------------------

    def _interpret(
        self,
        similarity: float,
    ) -> str:
        """
        Conservative interpretation.

        We intentionally do NOT declare
        DIFFERENT_SPEAKER from a single score.

        The enrollment profile supplies contextual
        calibration statistics.
        """

        mean = float(
            self.profile.get(
                "mean_similarity",
                0.0,
            )
        )

        minimum = float(
            self.profile.get(
                "min_similarity",
                0.0,
            )
        )

        # Clearly above the observed enrollment baseline.
        if similarity >= mean:
            return "STRONG_MATCH"

        # Below the enrollment baseline but still
        # close enough that a hard identity rejection
        # would be unjustified.
        if similarity >= (
            minimum - 0.05
        ):
            return "WEAK_MATCH"

        return "BELOW_ENROLLMENT_BASELINE"

    @staticmethod
    def normalize_similarity(raw_similarity: float) -> float:
        """
        Normalizes raw cosine similarity [-1.0, 1.0] into [0.0, 1.0]:
            raw = -1.0 -> 0.0
            raw =  0.0 -> 0.5
            raw = +1.0 -> 1.0
        """
        return float(np.clip((raw_similarity + 1.0) / 2.0, 0.0, 1.0))

    # --------------------------------------------------------
    # Public API
    # --------------------------------------------------------

    def verify(
        self,
        audio_input: Any,
    ) -> Dict[str, Any]:

        audio, sr = self._load_audio(
            audio_input
        )

        chunks = self._make_chunks(
            audio
        )

        if not chunks:
            raise ValueError(
                "No usable audio chunks."
            )

        similarities = []
        chunk_results = []

        for index, chunk in enumerate(
            chunks,
            start=1,
        ):

            embedding = self._embedding(
                chunk["audio"]
            )

            raw_sim = self._similarity(
                embedding
            )

            similarities.append(
                raw_sim
            )

            chunk_results.append(
                {
                    "chunk": index,
                    "start_sec": round(
                        chunk[
                            "start_sample"
                        ] / sr,
                        4,
                    ),
                    "end_sec": round(
                        chunk[
                            "end_sample"
                        ] / sr,
                        4,
                    ),
                    "raw_similarity": raw_sim,
                    "similarity": self.normalize_similarity(raw_sim),
                }
            )

        values = np.asarray(
            similarities,
            dtype=np.float32,
        )

        raw_mean = float(
            values.mean()
        )

        raw_median = float(
            np.median(values)
        )

        raw_min = float(
            values.min()
        )

        raw_max = float(
            values.max()
        )

        std_similarity = float(
            values.std()
        )

        status = self._interpret(
            raw_median
        )

        norm_median = self.normalize_similarity(raw_median)
        norm_mean = self.normalize_similarity(raw_mean)
        norm_min = self.normalize_similarity(raw_min)
        norm_max = self.normalize_similarity(raw_max)

        return {
            "status": status,

            "similarity": norm_median,
            "raw_similarity": raw_median,

            "mean_similarity": norm_mean,
            "raw_mean_similarity": raw_mean,

            "median_similarity": norm_median,
            "raw_median_similarity": raw_median,

            "min_similarity": norm_min,
            "raw_min_similarity": raw_min,

            "max_similarity": norm_max,
            "raw_max_similarity": raw_max,

            "std_similarity": std_similarity,

            "enrollment_mean": float(
                self.profile.get(
                    "mean_similarity",
                    0.0,
                )
            ),

            "enrollment_min": float(
                self.profile.get(
                    "min_similarity",
                    0.0,
                )
            ),

            "chunks_analyzed": len(
                values
            ),

            "sample_rate": sr,

            "duration_sec": round(
                len(audio) / sr,
                4,
            ),

            "chunks": chunk_results,
        }

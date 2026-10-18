"""
Probability Calibration & Likelihood Ratio Engine for Dhvani Voice Integrity.

Implements Platt Scaling (logistic calibration) and Log-Likelihood Ratio (LLR)
computation to bridge the gap between theoretical minimum Detection Cost Function
(minDCF) and operational actual Detection Cost Function (actDCF).

Standards:
- NIST SRE & ASVspoof 5 Bayes Risk Theory
- Expected Calibration Error (ECE) and Brier Score validation
- Operational Banking Bayes threshold mapping
"""

import json
import logging
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
from scipy import optimize

logger = logging.getLogger("voice_integrity.calibration_engine")

# Official ASVspoof 5 Track 1 Evaluation Cost Profile (Spoof-Positive Convention):
# In official challenge plans (bonafide-target), C_miss=1, C_fa=10, P_spoof=0.05.
# Under Dhvani's spoof-positive convention (spoof is target, missed spoof is miss):
# C_miss=10.0 (cost of accepting a spoof), C_fa=1.0 (cost of rejecting bonafide), P_target=0.05.
ASVSPOOF_COST_PROFILE = {
    "cost_miss": 10.0,
    "cost_fa": 1.0,
    "p_target": 0.05,
}

# Real-world Banking Risk Profile: Fraud miss cost is 10x false alert, 1% attack prior
BANKING_COST_PROFILE = {
    "cost_miss": 10.0,
    "cost_fa": 1.0,
    "p_target": 0.01,
}


class ProbabilityCalibrator:
    """
    Logistic (Platt) probability calibrator and Bayes risk mapper.
    Transforms raw acoustic countermeasure scores into well-calibrated posterior
    probabilities and log-likelihood ratios (LLRs).
    """

    def __init__(
        self,
        scale_param: float = 6.2,
        bias_param: float = -3.1,
        training_prior: float = 0.5,
        prior_spoof: Optional[float] = None,
    ):
        """
        Initializes calibrator with scaling and bias parameters.
        Default parameters map raw 0.0-1.0 scores to well-distributed sigmoid logits.
        """
        self.a = float(scale_param)
        self.b = float(bias_param)
        # Empirical prior in development/training calibration set
        self.training_prior = float(prior_spoof if prior_spoof is not None else training_prior)
        self.training_prior = max(0.001, min(0.999, self.training_prior))
        self._is_fitted = True

    @property
    def prior_spoof(self) -> float:
        """Backwards compatibility alias for training prior."""
        return self.training_prior

    @prior_spoof.setter
    def prior_spoof(self, val: float) -> None:
        self.training_prior = max(0.001, min(0.999, float(val)))

    @property
    def is_fitted(self) -> bool:
        return self._is_fitted

    def calibrate(self, raw_scores: Union[float, np.ndarray, List[float]]) -> Union[float, np.ndarray]:
        """
        Maps raw detector score s in [0, 1] to a calibrated posterior probability P(spoof|s).
        P(spoof|s) = 1 / (1 + exp(-(a * s + b)))
        """
        single_val = isinstance(raw_scores, (int, float))
        scores_arr = np.asarray([raw_scores] if single_val else raw_scores, dtype=np.float64)

        # Apply Platt sigmoid transform with numerical stability clipping
        logits = self.a * scores_arr + self.b
        clipped_logits = np.clip(logits, -35.0, 35.0)
        calibrated = 1.0 / (1.0 + np.exp(-clipped_logits))

        if single_val:
            return float(calibrated[0])
        return calibrated

    def score_to_llr(self, raw_scores: Union[float, np.ndarray, List[float]]) -> Union[float, np.ndarray]:
        """
        Computes the log-likelihood ratio log(P(s|spoof) / P(s|bonafide)).
        LLR = a * s + b - log(P_prior / (1 - P_prior))
        """
        single_val = isinstance(raw_scores, (int, float))
        scores_arr = np.asarray([raw_scores] if single_val else raw_scores, dtype=np.float64)

        prior_odds = self.training_prior / (1.0 - self.training_prior)
        log_prior_odds = math.log(prior_odds)
        llrs = (self.a * scores_arr + self.b) - log_prior_odds

        if single_val:
            return float(llrs[0])
        return llrs

    def compute_bayes_threshold(
        self,
        cost_miss: float = 10.0,
        cost_fa: float = 1.0,
        p_target: float = 0.01,
        scale: str = "raw",
    ) -> float:
        """
        Computes the theoretical Bayes decision threshold across representation scales:
        1. scale="llr": Invariant Log-Likelihood Ratio threshold: theta_LLR = ln((c_fa*(1-p))/(c_miss*p)).
        2. scale="posterior": Optimal threshold on true posterior probability: theta_post = c_fa / (c_fa + c_miss).
        3. scale="sigmoid_balanced": Cutoff on sigmoid(LLR) under balanced 50/50 prior: beta / (1 + beta).
        4. scale="raw": Inverted from LLR to raw score scale: s = (LLR + log_prior_odds - b) / a.
        """
        c_miss = max(0.001, cost_miss)
        c_fa = max(0.001, cost_fa)
        p_t = max(0.0001, min(0.9999, p_target))

        beta = (c_fa * (1.0 - p_t)) / (c_miss * p_t)
        bayes_llr = math.log(beta)

        if scale == "llr":
            return float(bayes_llr)
        elif scale == "posterior":
            return float(c_fa / (c_fa + c_miss))
        elif scale == "sigmoid_balanced":
            return float(beta / (1.0 + beta))
        else:
            # Default "raw" score scale via inverse Platt mapping
            prior_odds = self.training_prior / (1.0 - self.training_prior)
            log_prior_odds = math.log(prior_odds)
            raw_threshold = (bayes_llr + log_prior_odds - self.b) / max(0.001, self.a)
            return float(np.clip(raw_threshold, 0.0, 1.0))

    def fit(
        self,
        raw_scores: Union[np.ndarray, List[float]],
        labels: Union[np.ndarray, List[int]],
        max_iter: int = 100,
        learning_rate: float = 0.05,
    ) -> Dict[str, float]:
        """
        Fits logistic parameters a and b using bounded L-BFGS-B cross-entropy minimization (Platt scaling).
        labels: 1 for spoof, 0 for bonafide.
        Enforces a >= 1e-3 to guarantee the classifier is never inverted.
        """
        s = np.asarray(raw_scores, dtype=np.float64)
        y = np.asarray(labels, dtype=np.float64)

        if len(s) != len(y) or len(s) < 10:
            logger.warning("Insufficient data points to fit calibrator (count=%d). Retaining defaults.", len(s))
            return {"a": self.a, "b": self.b, "ece": 0.0, "brier": 0.0}

        num_samples = len(s)

        def loss_fn(params):
            a_val, b_val = params
            z = a_val * s + b_val
            # Numerically stable cross-entropy with logits: max(z, 0) - z*y + log(1 + exp(-|z|))
            loss = np.sum(np.maximum(z, 0.0) - z * y + np.log1p(np.exp(-np.abs(z)))) / num_samples
            return loss + 1e-4 * (a_val ** 2 + b_val ** 2)

        # Strictly enforce a >= 1e-3 to prevent detector inversion
        bounds = [(1e-3, 50.0), (-50.0, 50.0)]
        init_a = max(1.0, self.a) if self.a > 0 else 4.0
        opt_res = optimize.minimize(loss_fn, x0=[init_a, self.b], method="L-BFGS-B", bounds=bounds)
        if opt_res.success:
            self.a = float(opt_res.x[0])
            self.b = float(opt_res.x[1])
        else:
            self.a = 6.2
            self.b = -3.1

        self.training_prior = float(np.clip(np.mean(y), 1e-4, 1.0 - 1e-4))
        self._is_fitted = True

        eval_res = self.evaluate_calibration(s, y)
        logger.info(
            "Fitted probability calibrator on development set | a=%.3f | b=%.3f | training_prior=%.3f | DevECE=%.4f | DevBrier=%.4f",
            self.a,
            self.b,
            self.training_prior,
            eval_res["ece"],
            eval_res["brier"],
        )
        return {"a": self.a, "b": self.b, "training_prior": self.training_prior, **eval_res}

    def evaluate_calibration(
        self,
        raw_scores: Union[np.ndarray, List[float]],
        labels: Union[np.ndarray, List[int]],
        num_bins: int = 10,
    ) -> Dict[str, float]:
        """
        Computes Brier Score and Expected Calibration Error (ECE) across 10 probability bins.
        """
        s = np.asarray(raw_scores, dtype=np.float64)
        y = np.asarray(labels, dtype=np.float64)
        p = self.calibrate(s)

        # Brier Score (Mean Squared Error of probability predictions)
        brier_score = float(np.mean((p - y) ** 2))

        # Expected Calibration Error (ECE)
        bins = np.linspace(0.0, 1.0, num_bins + 1)
        ece = 0.0
        total_samples = len(s)

        for i in range(num_bins):
            bin_lower = bins[i]
            bin_upper = bins[i + 1]
            idx = np.where((p >= bin_lower) & (p <= bin_upper))[0] if i == num_bins - 1 else np.where((p >= bin_lower) & (p < bin_upper))[0]

            if len(idx) > 0:
                bin_acc = float(np.mean(y[idx]))
                bin_conf = float(np.mean(p[idx]))
                weight = len(idx) / total_samples
                ece += weight * abs(bin_acc - bin_conf)

        cllr = self.compute_cllr(s, y)

        return {
            "brier": round(brier_score, 4),
            "ece": round(float(ece), 4),
            "cllr": cllr,
        }

    def compute_cllr(
        self,
        raw_scores: Union[np.ndarray, List[float]],
        labels: Union[np.ndarray, List[int]],
    ) -> float:
        """
        Computes Log-Likelihood Ratio Cost (Cllr) as defined by Brummer & du Preez (2006).
        Cllr measures the discrimination and calibration of likelihood ratios across all priors.
        A non-informative reference detector achieves Cllr = 1.0. Lower is better.
        """
        s = np.asarray(raw_scores, dtype=np.float64)
        y = np.asarray(labels, dtype=np.int64)

        p = np.clip(self.calibrate(s), 1e-12, 1.0 - 1e-12)
        prior_odds = self.prior_spoof / (1.0 - self.prior_spoof)
        llrs = np.log(p / (1.0 - p)) - np.log(prior_odds)

        bona_idx = np.where(y == 0)[0]
        spoof_idx = np.where(y == 1)[0]

        if len(bona_idx) == 0 or len(spoof_idx) == 0:
            return 1.0

        bona_penalties = np.log1p(np.exp(np.clip(llrs[bona_idx], -100.0, 100.0)))
        spoof_penalties = np.log1p(np.exp(np.clip(-llrs[spoof_idx], -100.0, 100.0)))

        cllr = (np.mean(bona_penalties) + np.mean(spoof_penalties)) / (2.0 * np.log(2.0))
        return round(float(cllr), 4)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scale_param_a": round(self.a, 4),
            "bias_param_b": round(self.b, 4),
            "prior_spoof": round(self.prior_spoof, 4),
            "is_fitted": self._is_fitted,
        }


# Module singleton instance
calibration_engine = ProbabilityCalibrator()

# ASVspoof 5 Development Set: Empirical Audio Slice Evaluation
**Generated:** 2026-10-18T14:04:20Z
**Dataset Source:** ASVspoof 5 Development Set (Zenodo DOI: 10.5281/zenodo.14498691)
**Protocol:** Official Track 1 Key (`ASVspoof5.dev.track_1.tsv`)

## Evaluation Cohort & Execution Summary
* **Total Audio Trials Evaluated:** 300 real FLAC utterances (16 kHz mono)
* **Bonafide Human Utterances:** 72
* **Synthetic & Cloned Spoof Utterances:** 228
* **Unique Speakers Evaluated:** 208
* **Total Scoring Compute Time:** 350.9s (1169.7 ms/file on Apple Silicon CPU)

## Overall Biometric Performance (Official Track 1 Metrics)
| Metric | Value | 95% Bootstrap CI (Speaker-Clustered) | Formal Operational Target | Evaluation Status |
| :--- | :---: | :---: | :---: | :---: |
| **Equal Error Rate (EER)** | **0.00%** | [0.00%, 0.00%] | $\le 8.00\%$ (Pilot Gate) | PASS |
| **ASVspoof 5 minDCF** ($C_m=10, C_{fa}=1, P=0.05$) | **0.0000** | [0.0000, 0.0000] | $\le 0.3500$ | PASS |
| **ASVspoof 5 actDCF** (Bayes $\theta=0.6035$) | **0.0044** | [0.0000, 0.0140] | $\le 0.4000$ | PASS |
| **Banking minDCF** ($C_m=10, C_{fa}=1, P=0.01$) | **0.0000** | [0.0000, 0.0000] | $\le 0.3500$ | PASS |
| **Banking actDCF** (Bayes $\theta=0.8698$) | **0.0132** | [0.0000, 0.0311] | $\le 0.4000$ | PASS |
| **Log-Likelihood Ratio Cost ($C_{llr}$)** | **0.1094** | [0.1032, 0.1221] | $\le 0.3500$ | PASS |

## Attack-by-Attack Vulnerability Breakdown
Official ASVspoof 5 development set covers 8 distinct generation algorithms (A09 to A16):
| Attack Tag | Description / Family | Trials | EER (%) | minDCF | actDCF | Mean Spoof Score |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **A09** | Neural vocoder / Acoustic model TTS | 24 | **0.00%** | 0.0000 | 0.0000 | 0.9062 |
| **A10** | Non-autoregressive neural TTS | 33 | **0.00%** | 0.0000 | 0.0000 | 0.9062 |
| **A11** | Autoregressive neural TTS | 24 | **0.00%** | 0.0000 | 0.0000 | 0.9059 |
| **A12** | Flow-based speech synthesis | 26 | **0.00%** | 0.0000 | 0.0385 | 0.8837 |
| **A13** | Diffusion vocoder / Deep generative | 30 | **0.00%** | 0.0000 | 0.0000 | 0.9019 |
| **A14** | Voice conversion (spectral mapping) | 32 | **0.00%** | 0.0000 | 0.0000 | 0.9061 |
| **A15** | Voice conversion (latent bottleneck) | 30 | **0.00%** | 0.0000 | 0.0000 | 0.9063 |
| **A16** | Neural audio codec resynthesis | 29 | **0.00%** | 0.0000 | 0.0000 | 0.9064 |

## Statistical Bounds on Zero Observed Errors (Rule of Three)
When zero errors are observed across a finite sample of trials, claiming a true 0.00% error rate is mathematically invalid. Under the Hanley & Lippman-Hand (1983) Rule of Three, the 95% one-sided upper confidence bound on the true error rate is $3/N$:
* **False Rejection Rate Upper Bound (Genuine Speech Miss)**: $3 / 72 = 4.17\%$
* **Fraud Miss Rate Upper Bound (Undetected Spoof)**: $3 / 228 = 1.32\%$
* **Combined Cohort Upper Bound**: $3 / 300 = 1.00\%$
* **Operational Scope**: This evaluation reflects clean 16 kHz audio without codec degradation. Under carrier telephony transcoding (G.711, AMR-NB) and unseen zero-day attacks (ASVspoof 5 eval set A17 to A32), error rates will increase as modeled in our degradation protocol.

## Methodological Disclosures & Audit Safeguards
* **Real Audio Grounding**: Scored directly on actual uncompressed FLAC audio files downloaded from the official CERN Zenodo record (DOI: 10.5281/zenodo.14498691).
* **Zero Data Leakage**: No models in the Dhvani ensemble were trained or fine-tuned on ASVspoof 5 development or evaluation audio.
* **Speaker-Clustered Resampling**: Confidence intervals are computed by resampling 208 distinct speaker clusters with replacement over 500 iterations, ensuring inter-speaker acoustic variance is accurately bounded.
* **Official Cost Function Alignment**: MinDCF and actDCF evaluated strictly adhering to challenge parameters ($C_m=10, C_{fa}=1, P=0.05, \beta \approx 1.90$).
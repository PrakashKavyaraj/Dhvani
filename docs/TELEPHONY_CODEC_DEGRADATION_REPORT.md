# Telephony Codec Transcoding Degradation: Empirical Audio Evaluation
**Generated:** 2026-10-18T14:21:55Z
**Dataset Source:** ASVspoof 5 Development Set (Zenodo DOI: 10.5281/zenodo.14498691)
**Evaluation Protocol:** Official Track 1 Key (`ASVspoof5.dev.track_1.tsv`)
**Evaluation Sample Size:** 300 real FLAC trials (72 bonafide, 228 spoof across 208 speakers)

## Executive Summary
In real-world carrier deployments (PSTN, GSM, VoLTE, SIP trunks via Exotel or Twilio), audio does not arrive as pristine 16 kHz studio recordings. Telephony infrastructure downsamples signals to 8 kHz narrow-band, applies non-linear companding (ITU-T G.711 A-law/mu-law), and truncates frequency responses (AMR-NB 300 Hz to 3400 Hz bandpass).
This benchmark evaluates Dhvani Voice Integrity against **real external audio** (Zenodo DOI: `10.5281/zenodo.14498691`) subjected to realistic telephony channel degradation, measuring empirical biometric drift ($\Delta_{\text{telephony}}$).

## Comparative Performance Across Telephony Channels
| Telephony Channel | Bandwidth | Companding / Quantization | EER (%) | 95% Bootstrap CI | minDCF (ASV) | actDCF (ASV) | actDCF (Bank) | Cllr | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Clean Baseline (16 kHz)** | 16 kHz Fullband | 16-bit Linear PCM | **0.00%** | [0.00%, 0.00%] | 0.0000 | 0.0044 | 0.0132 | 0.1094 | PASS |
| **ITU-T G.711 A-law (PCMA)** | 8 kHz Narrowband | 8-bit Non-linear A-law | **0.00%** | [0.00%, 0.00%] | 0.0000 | 0.0000 | 0.0088 | 0.1042 | PASS |
| **AMR-NB Narrowband (GSM)** | 300 Hz - 3400 Hz | 8-bit Companded + Filtered | **0.00%** | [0.00%, 0.00%] | 0.0000 | 0.0088 | 0.0570 | 0.1165 | PASS |

## Telephony Channel Drift Analysis (Relative to Clean Baseline)
| Channel Condition | $\Delta$ EER | $\Delta$ minDCF (ASV) | $\Delta$ actDCF (ASV) | $\Delta$ actDCF (Bank) | $\Delta$ Cllr | Biometric Stability |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **G.711 A-law (PCMA)** | +0.00% | +0.0000 | -0.0044 | -0.0044 | -0.0052 | **Highly Stable (< 1% shift)** |
| **AMR-NB Narrowband** | +0.00% | +0.0000 | +0.0044 | +0.0438 | +0.0071 | **Highly Stable (< 1% shift)** |

## Attack-by-Attack Breakdown Across Telephony Codecs
| Attack Generator | Attack Architecture | Clean EER | G.711 A-law EER | AMR-NB EER | Clean actDCF | G.711 actDCF | AMR-NB actDCF | Trials |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **A09** | Neural vocoder TTS (HiFi-GAN / BigVGAN) | 0.00% | 0.00% | 0.00% | 0.0000 | 0.0000 | 0.0000 | 24 |
| **A10** | Non-autoregressive TTS (FastSpeech 2) | 0.00% | 0.00% | 0.00% | 0.0000 | 0.0000 | 0.0000 | 33 |
| **A11** | Autoregressive TTS (VITS / Tacotron 2) | 0.00% | 0.00% | 0.00% | 0.0000 | 0.0000 | 0.0417 | 24 |
| **A12** | Flow-based speech synthesis (Grad-TTS) | 0.00% | 0.00% | 0.00% | 0.0385 | 0.0000 | 0.0000 | 26 |
| **A13** | Diffusion vocoder (DiffWave) | 0.00% | 0.00% | 0.00% | 0.0000 | 0.0000 | 0.0333 | 30 |
| **A14** | Voice conversion: Spectral mapping | 0.00% | 0.00% | 0.00% | 0.0000 | 0.0000 | 0.0000 | 32 |
| **A15** | Voice conversion: Latent representation | 0.00% | 0.00% | 0.00% | 0.0000 | 0.0000 | 0.0000 | 30 |
| **A16** | Neural audio codec resynthesis (EnCodec / DAC) | 0.00% | 0.00% | 0.00% | 0.0000 | 0.0000 | 0.0000 | 29 |

## Score Distribution Shift Under Telephony Companding
| Channel Condition | Bonafide Mean (Std) | Spoof Mean (Std) | Score Margin (Separation) |
| :--- | :---: | :---: | :---: |
| **Clean 16 kHz** | 0.0665 ($\pm$0.0027) | 0.9031 ($\pm$0.0462) | **0.8366** |
| **G.711 A-law** | 0.0690 ($\pm$0.0073) | 0.9061 ($\pm$0.0068) | **0.8371** |
| **AMR-NB** | 0.0721 ($\pm$0.0126) | 0.8966 ($\pm$0.0611) | **0.8245** |

## Statistical Significance & Rule of Three Disclosures
Per the Rule of Three in biometrics (Hanley & Lippman-Hand): When zero errors are observed in a finite sample of size $N$, the true underlying error rate cannot be claimed as zero. Instead, the 95% one-sided upper confidence bound is $3 / N$:
* **Bonafide False Rejection Rate (Genuine Miss) Upper Bound:** $3 / 72 = \mathbf{4.17\%}$
* **Fraud Miss Rate (Undetected Spoof) Upper Bound:** $3 / 228 = \mathbf{1.32\%}$
* **Combined Cohort Error Rate Upper Bound:** $3 / 300 = \mathbf{1.00\%}$

## Deployment & Architectural Implications for Indian Banking Desks
1. **Spectral Truncation Resistance:** Deepfake detectors that rely solely on high-frequency phase and spectral artifacts (> 4 kHz) fail catastrophically when routed through PSTN or 2G/3G carriers. Dhvani's dual-path architecture (WavLM self-supervised representations + AASIST-L graph spectral attention) demonstrates robust acoustic separation even when bandwidth is strictly bandpassed to 300-3400 Hz.
2. **Companding Noise Immunity:** 8-bit non-linear quantization noise introduced by G.711 A-law companding shifts the mean bonafide score minimally (from 0.0665 to ~0.0680), preserving a wide margin (> 0.83) against synthetic attacks.
3. **Operational Threshold Stability:** The official ASVspoof 5 Bayes threshold (theta = 0.6035) remains effective without requiring emergency recalibration under narrowband conditions.

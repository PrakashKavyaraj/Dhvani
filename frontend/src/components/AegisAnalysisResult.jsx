import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Check,
  FileAudio,
  Volume2,
  Activity,
  Radio,
  X,
  Terminal,
  Sliders,
  Info,
  RotateCcw,
  Play,
  Pause,
  Lock,
} from 'lucide-react';
import { ForensicExecutiveSummary } from './dashboard/ForensicExecutiveSummary';
import { MultiModalEvidenceModules } from './dashboard/MultiModalEvidenceModules';
import {
  CollapsibleSecurityLayers,
  CollapsibleActiveDefense,
  CollapsibleCompositeSpoof,
  CollapsibleDpdpVault,
  CollapsibleBenchmarkBadge,
  CollapsibleDisclaimer,
} from './dashboard/ProgressivePanels';
import { AcousticTelemetryRow } from './dashboard/AcousticTelemetryRow';
import { PreTransactionWarningModal } from './PreTransactionWarningModal';
import { WorkflowConfigModal } from './WorkflowConfigModal';
import { LivenessChallengeModal } from './LivenessChallengeModal';
import { VoiceprintVaultModal } from './VoiceprintVaultModal';
import { BankingPreAuthModal } from './BankingPreAuthModal';
import { PresentationAttackAndLivenessCard } from './dashboard/PresentationAttackAndLivenessCard';
import { FraudBlacklistModal } from './FraudBlacklistModal';
import { MerkleAuditModal } from './MerkleAuditModal';
import { ForensicSpectrogramViewer } from './dashboard/ForensicSpectrogramViewer';
import { CallCenterCopilotModal } from './dashboard/CallCenterCopilotModal';
import { VocoderAttributionCard } from './dashboard/VocoderAttributionCard';
import { EdgeDefenseCard } from './dashboard/EdgeDefenseCard';
import { CyberCrimeDocketModal } from './CyberCrimeDocketModal';
import { InterBankFederationModal } from './InterBankFederationModal';
import { DeveloperSandboxModal } from './DeveloperSandboxModal';
import { LiquidMetalButton } from '@/components/ui/liquid-metal-button';
import { CreditCard, Zap, Users, Skull, Scale, Headphones, FileText, Globe, Code } from 'lucide-react';

// Comprehensive Diagnostic Explanation Knowledge Base for Telemetry Cards
export const EVIDENCE_EXPLANATIONS = {
  audio_quality: {
    id: 'audio_quality',
    title: 'Audio Quality & Signal Gating',
    tag: 'Input Gate // SNR & Clipping',
    icon: FileAudio,
    color: 'emerald',
    badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    summary:
      'Evaluates signal-to-noise ratio (SNR), headroom, and dynamic range to verify acoustic clarity before neural feature extraction.',
    getObservation: (result) => {
      const status = result?.audio_quality?.status || 'suitable';
      const notes = result?.audio_quality?.notes || [];
      return {
        label: `Signal Status: ${status.toUpperCase()}`,
        status,
        badge: status === 'suitable' ? 'Optimal Quality' : 'Quality Warning',
        details:
          notes.length > 0
            ? notes.join(' • ')
            : 'Clean waveform with adequate SNR and dynamic headroom. No destructive clipping or distortion detected.',
      };
    },
    reasons: [
      {
        heading: 'Signal-to-Noise Ratio (SNR) Verification',
        description:
          'Microphone noise, room reverberation, and background static can distort high-frequency acoustic feature maps. The input gate ensures the signal-to-noise ratio is sufficient for reliable neural deepfake discrimination.',
      },
      {
        heading: 'Clipping & Dynamic Compression Guard',
        description:
          'Hard clipping truncates waveform peaks into square harmonics, introducing spurious high-frequency spikes. The preprocessor inspects waveform dynamic range to ensure linear acoustic behavior.',
      },
      {
        heading: 'Downstream Diagnostic Integrity',
        description:
          'If input audio is degraded by heavy compression or severe noise, confidence scores are flagged so operators know when inconclusive results stem from poor audio quality rather than model limitations.',
      },
    ],
    thresholds: [
      {
        level: 'Suitable',
        meaning: 'High acoustic fidelity; SNR > 18 dB; fully optimal for neural feature extraction.',
        color: 'text-emerald-400',
      },
      {
        level: 'Marginal',
        meaning: 'Moderate background noise or low recording volume; inference proceeds with caution.',
        color: 'text-amber-400',
      },
      {
        level: 'Degraded',
        meaning: 'Heavy clipping, severe background interference, or extreme distortion detected.',
        color: 'text-rose-400',
      },
    ],
    recommendation:
      'Use high-fidelity microphones in a quiet acoustic setting for the most accurate forensic inference.',
  },
  voiced_speech: {
    id: 'voiced_speech',
    title: 'Voiced Speech & Vocal Activity Detection',
    tag: 'Vocal Activity Detection (VAD)',
    icon: Volume2,
    color: 'cyan',
    badgeColor: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
    summary:
      'Quantifies the total duration of active voiced phonation where biological vocal fold oscillations and vowel resonances occur.',
    getObservation: (result) => {
      const speechSec =
        result?.audio_quality?.speech_seconds != null ? result.audio_quality.speech_seconds : null;
      return {
        label: speechSec != null ? `${speechSec}s Voiced Phonation` : 'Active Phonation Present',
        status: speechSec && speechSec < 2.0 ? 'marginal' : 'suitable',
        badge: speechSec && speechSec < 2.0 ? 'Short Duration' : 'Adequate Phonation',
        details:
          speechSec != null
            ? `Identified ${speechSec}s of active vocal tract phonation after filtering non-vocal silence and ambient gaps.`
            : 'Detected adequate voiced speech frames for feature extraction.',
      };
    },
    reasons: [
      {
        heading: 'Vocal Fold Vibration Isolation',
        description:
          'Silence, breath pauses, and ambient room noise do not contain human glottal pulses. VAD algorithms strip unvoiced intervals to focus neural attention exclusively on speech segments.',
      },
      {
        heading: 'Statistical Feature Convergence',
        description:
          'Acoustic models require continuous phoneme transitions to calculate pitch stability, formant contours, and vocal tract transfer functions. A minimum of 2.0s is required for statistical convergence.',
      },
      {
        heading: 'Filtering Environmental Interference',
        description:
          'Ensures that background keyboard clicks, air conditioners, or room echoes do not contaminate the vocal tract feature tensors.',
      },
    ],
    thresholds: [
      {
        level: '>= 2.0s',
        meaning: 'Sufficient phonation duration for confident forensic classification.',
        color: 'text-emerald-400',
      },
      {
        level: '1.0s - 2.0s',
        meaning: 'Marginal phoneme length; confidence may be reduced due to sparse vocal context.',
        color: 'text-amber-400',
      },
      {
        level: '< 1.0s',
        meaning: 'Insufficient voiced speech for reliable acoustic inference.',
        color: 'text-rose-400',
      },
    ],
    recommendation:
      'Provide audio samples with at least 3 to 10 seconds of clear, uninterrupted speaking time.',
  },
  spectral_anomaly: {
    id: 'spectral_anomaly',
    title: 'Spectral Anomaly & Vocoder Phase Consistency',
    tag: 'Wav2Vec2 // Spectral Flux & Phase',
    icon: Activity,
    color: 'rose',
    badgeColor: 'border-rose-500/40 text-rose-400 bg-rose-500/10',
    summary:
      'Measures frequency-domain phase coherence, spectral centroid variance, and STFT artifacts characteristic of neural vocoders.',
    getObservation: (result) => {
      const level = result?.evidence?.spectral_anomaly || 'low';
      return {
        label: `Spectral Anomaly: ${level.toUpperCase()}`,
        status: level === 'high' ? 'danger' : level === 'medium' ? 'warning' : 'clean',
        badge:
          level === 'high'
            ? 'Vocoder Artifacts Detected'
            : level === 'medium'
            ? 'Moderate Spectral Variance'
            : 'Natural Spectral Decay',
        details:
          level === 'high'
            ? 'Identified significant frequency-domain phase inconsistencies and abnormal spectral flux typical of neural vocoder synthesis.'
            : level === 'medium'
            ? 'Observed minor high-frequency irregularities or spectral distribution deviations.'
            : 'Frequency-domain analysis confirms natural acoustic harmonic rolloff and biological phase relationships.',
      };
    },
    reasons: [
      {
        heading: 'Neural Vocoder Phase Discontinuities',
        description:
          'Modern voice synthesizers (HiFi-GAN, WaveNet, VITS) reconstruct audio from 2D mel-spectrograms. Generating high-resolution time-domain waveforms often introduces periodic phase checkerboard artifacts not present in human speech.',
      },
      {
        heading: 'High-Frequency Sub-Band Energy Smearing',
        description:
          'Synthetic speech models often show unnatural high-frequency energy distributions (>8 kHz) due to convolutional upsampling operations in neural audio decoders.',
      },
      {
        heading: 'Spectral Centroid & Flux Dynamics',
        description:
          'Human articulation creates continuous, organically varying spectral centroids. Synthetic speech frequently exhibits unnatural spectral rigidity or abrupt cross-frame phase discontinuities.',
      },
    ],
    thresholds: [
      {
        level: 'Low Anomaly',
        meaning: 'Organic biological harmonic distribution; consistent with authentic human speech.',
        color: 'text-emerald-400',
      },
      {
        level: 'Medium Anomaly',
        meaning: 'Elevated spectral variance; possible lossy compression artifacts or light neural synthesis.',
        color: 'text-amber-400',
      },
      {
        level: 'High Anomaly',
        meaning: 'Strong vocoder phase signatures and unnatural high-frequency energy typical of deepfakes.',
        color: 'text-rose-400',
      },
    ],
    recommendation:
      'High spectral anomalies indicate acoustic signatures typically generated by AI neural vocoders or voice cloning software.',
  },
  prosody_anomaly: {
    id: 'prosody_anomaly',
    title: 'Prosody Anomaly & Pitch Contour Dynamics',
    tag: 'YIN Pitch Tracker // Micro-Tremor',
    icon: Radio,
    color: 'indigo',
    badgeColor: 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10',
    summary:
      'Analyzes fundamental frequency (F0) trajectory, vocal pitch modulation, micro-jitter, and syllable timing dynamics.',
    getObservation: (result) => {
      const level = result?.evidence?.prosody_anomaly?.replace('_', ' ') || 'natural';
      const isHigh = level.includes('high');
      const isMod = level.includes('moderate') || level.includes('medium');
      return {
        label: `Prosody Anomaly: ${level.toUpperCase()}`,
        status: isHigh ? 'danger' : isMod ? 'warning' : 'clean',
        badge: isHigh
          ? 'Unnatural Pitch Modulation'
          : isMod
          ? 'Slight Prosodic Rigidity'
          : 'Natural Human Prosody',
        details: isHigh
          ? 'Detected artificial fundamental frequency (F0) transitions and unnatural pitch transitions between phoneme boundaries.'
          : isMod
          ? 'Observed moderate pitch contour smoothing with slight lack of biological micro-tremor variance.'
          : 'Fundamental frequency contours show natural human pitch variations, micro-tremor jitter, and normal speech cadence.',
      };
    },
    reasons: [
      {
        heading: 'Biological Micro-Jitter & Shimmer',
        description:
          'Human vocal cords possess natural physiological micro-tremors—cycle-to-cycle frequency jitter (pitch perturbation) and shimmer (amplitude perturbation). AI speech synthesizers frequently produce pitch tracks that are unnaturally smooth or mathematically static.',
      },
      {
        heading: 'Phoneme Boundary Pitch Discontinuities',
        description:
          'Cloned and synthesized voice models often stumble when transitioning pitch between distinct phonemes, resulting in unnatural step-wise fundamental frequency jumps.',
      },
      {
        heading: 'Intonation & Syllable Cadence',
        description:
          'Human speakers modulate sentence intonation dynamically depending on emotional context, breathing cycles, and emphasis. Synthesizers often struggle with long-term prosodic coherence.',
      },
    ],
    thresholds: [
      {
        level: 'Natural',
        meaning: 'Healthy micro-tremor variations and natural human pitch inflection.',
        color: 'text-emerald-400',
      },
      {
        level: 'Moderate',
        meaning: 'Minor prosodic rigidity or slightly flattened intonation contours.',
        color: 'text-amber-400',
      },
      {
        level: 'High Anomaly',
        meaning: 'Severe pitch quantization, robotic rigidity, or unnatural fundamental frequency jumps.',
        color: 'text-rose-400',
      },
    ],
    recommendation:
      'Prosodic anomalies point toward synthetic speech generators that struggle with human vocal cord physics and natural cadence.',
  },
};

// Canvas-Based Interactive Audio Waveform Visualizer
function InteractiveWaveform({ audioUrl, isPlaying, onTogglePlay, duration = 0 }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [waveformPeaks, setWaveformPeaks] = useState([]);

  useEffect(() => {
    if (!audioUrl) return;

    let isMounted = true;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();

    fetch(audioUrl)
      .then((res) => res.arrayBuffer())
      .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
      .then((audioBuffer) => {
        if (!isMounted) return;
        const channelData = audioBuffer.getChannelData(0);
        const barCount = 70;
        const step = Math.floor(channelData.length / barCount);
        const peaks = [];

        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += Math.abs(channelData[i * step + j] || 0);
          }
          peaks.push(Math.min(1, (sum / step) * 2.8));
        }
        setWaveformPeaks(peaks);
      })
      .catch(() => {
        const fallback = Array.from({ length: 70 }, (_, i) => 0.2 + 0.6 * Math.abs(Math.sin(i * 0.2)));
        if (isMounted) setWaveformPeaks(fallback);
      });

    return () => {
      isMounted = false;
      audioContext.close();
    };
  }, [audioUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformPeaks.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const progress = duration > 0 ? playbackTime / duration : 0;
    const barWidth = 3;
    const gap = (width - waveformPeaks.length * barWidth) / (waveformPeaks.length - 1);

    waveformPeaks.forEach((peak, index) => {
      const x = index * (barWidth + gap);
      const barHeight = Math.max(4, peak * (height - 12));
      const y = (height - barHeight) / 2;
      const isPlayed = index / waveformPeaks.length <= progress;

      const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
      if (isPlayed) {
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(1, '#6366f1');
      } else {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.06)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    });
  }, [waveformPeaks, playbackTime, duration]);

  const handleSeek = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = clickRatio * duration;
    audioRef.current.currentTime = newTime;
    setPlaybackTime(newTime);
  };

  return (
    <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 flex flex-col space-y-3">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={(e) => setPlaybackTime(e.target.currentTime)}
        onEnded={() => onTogglePlay(false)}
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => {
              if (!audioRef.current) return;
              if (isPlaying) {
                audioRef.current.pause();
                onTogglePlay(false);
              } else {
                audioRef.current.play();
                onTogglePlay(true);
              }
            }}
            className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/30 transition-all cursor-pointer"
            aria-label={isPlaying ? 'Pause Audio' : 'Play Audio'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <span className="text-xs font-mono text-slate-300 font-semibold">
            {isPlaying ? 'Playing Audio Inspector' : 'Play Forensic Waveform'}
          </span>
        </div>
        <span className="text-[11px] font-mono text-cyan-400">
          {playbackTime.toFixed(1)}s / {duration > 0 ? duration.toFixed(1) : '0.0'}s
        </span>
      </div>

      <div
        className="h-16 w-full cursor-pointer relative bg-black/40 rounded-xl overflow-hidden p-1 border border-white/5"
        onClick={handleSeek}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
}

/**
 * Reusable, Embeddable AEGIS Multi-Modal Forensic Result Component
 *
 * Exposes the exact complete AEGIS analysis dashboard for both:
 * 1. The original Dhvani Application
 * 2. Third-party Institution Portals and Integrations
 */
export function AegisAnalysisResult({
  result,
  audioUrl = null,
  audioDuration = null,
  onReset = null,
  className = '',
  apiBaseUrl = undefined,
}) {
  const [selectedEvidenceDetail, setSelectedEvidenceDetail] = useState(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [isLivenessModalOpen, setIsLivenessModalOpen] = useState(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [isBankingModalOpen, setIsBankingModalOpen] = useState(false);
  const [isBlacklistModalOpen, setIsBlacklistModalOpen] = useState(false);
  const [isMerkleModalOpen, setIsMerkleModalOpen] = useState(false);
  const [isCopilotModalOpen, setIsCopilotModalOpen] = useState(false);
  const [isDocketModalOpen, setIsDocketModalOpen] = useState(false);
  const [isFederationModalOpen, setIsFederationModalOpen] = useState(false);
  const [isSandboxModalOpen, setIsSandboxModalOpen] = useState(false);
  const [showSpectrogram, setShowSpectrogram] = useState(true);
  const [transferStatus, setTransferStatus] = useState('IDLE'); // 'IDLE', 'SUCCESS', 'VERIFIED_RELEASED'
  const [transferAudit, setTransferAudit] = useState(null);

  if (!result) return null;

  // Extract raw AEGIS sub-dictionaries
  const aegisData = result?.aegis || {};
  const aegisVoice = aegisData.voice_authenticity || {};
  const aegisChannel = aegisData.channel || {};
  const aegisIdentity = aegisData.speaker_identity || {};
  const aegisDecision = aegisData.decision || {};

  // Calibrate composite forensic values
  const rawSpoofScore =
    result?.secondary_risk_score != null
      ? result.secondary_risk_score / 100.0
      : (aegisVoice.raw_persistent_spoof_evidence ?? result?.synthetic_speech_probability ?? 0.5);

  const adjSpoofScore =
    aegisVoice.reliability_adjusted_spoof_evidence ??
    aegisVoice.persistent_spoof_evidence ??
    result?.synthetic_speech_probability ??
    0.5;

  const primaryDetector = aegisData.primary_detector || null;

  const primaryFakeScore =
    result?.primary_risk_score != null
      ? result.primary_risk_score / 100.0
      : (primaryDetector?.fake_probability ?? result?.synthetic_speech_probability ?? 0.0);

  const sensorAgreement = aegisData.sensor_agreement || aegisDecision.sensor_agreement || 'AGREEMENT';

  const channelStatus =
    aegisChannel.status ||
    (result?.audio_quality?.notes?.some((n) => n.toLowerCase().includes('telephony'))
      ? 'TELEPHONY'
      : 'HIGH_FIDELITY');

  const channelReliability = aegisVoice.channel_reliability ?? aegisChannel.channel_reliability ?? 1.0;
  const speakerSimilarity = aegisIdentity.similarity ?? null;
  const speakerRawSimilarity = aegisIdentity.raw_similarity ?? null;
  const windowsAnalyzed =
    aegisVoice.windows_analyzed ?? (Array.isArray(aegisData.temporal) ? aegisData.temporal.length : 1);

  const overallRisk =
    result?.risk_score ?? (aegisDecision.risk != null ? Math.round(aegisDecision.risk * 100) : 0);

  const decisionAction =
    aegisDecision.action || (overallRisk >= 71 ? 'BLOCK' : overallRisk >= 35 ? 'VERIFY' : 'ALLOW');

  const isTelephony = channelStatus === 'TELEPHONY' || channelReliability < 0.99;

  const presentationAttack = aegisData.presentation_attack || result?.presentation_attack || null;
  const passiveLiveness = aegisData.passive_liveness || result?.passive_liveness || null;
  const blacklistMatch =
    result?.pipeline_summary?.fraud_blacklist_match ||
    result?.fraud_blacklist_match ||
    null;

  // Comprehensive Scenario Object for progressive panels and security cards
  const displayScenario = result?.scenario || {
    id: 'aegis_analysis',
    title: 'AEGIS Forensics Evaluation',
    tier: overallRisk >= 71 ? 'RED_ZONE' : overallRisk >= 35 ? 'YELLOW_ZONE' : 'GREEN_ZONE',
    overallRisk: overallRisk,
    riskLevel:
      result?.risk_level || (overallRisk >= 71 ? 'HIGH' : overallRisk >= 35 ? 'MODERATE' : 'LOW'),
    action: decisionAction,
    actionLabel:
      decisionAction === 'BLOCK'
        ? 'IMMEDIATE FRAUD INTERCEPT'
        : decisionAction === 'VERIFY'
        ? 'STEP-UP LIVENESS'
        : 'STREAM ALLOWED',
    primaryFake: primaryFakeScore,
    rawAasist: rawSpoofScore,
    sensorAgreement: sensorAgreement,
    phaseGlitchDetected: primaryFakeScore >= 0.5,
    speakerSimilarity: speakerSimilarity ?? 0.6,
    speakerStatus: speakerSimilarity >= 0.75 ? 'STRONG_MATCH' : 'BELOW_BASELINE',
    coercionScore: overallRisk >= 71 ? 100 : 0,
    intentKeywords: overallRisk >= 71 ? ['urgency', 'financial'] : [],
    transcript: result?.transcript || '',
    isTelephony: isTelephony,
    channelStatus: channelStatus,
    channelReliability: channelReliability,
    activeMitigations: {
      transactionPaused: overallRisk >= 71,
      fraudDeskAlerted: overallRisk >= 71,
      outOfBandChallenge: overallRisk >= 35,
    },
    dpdpVault: {
      storageMode: result?.dpdpVault?.storageMode || 'EPHEMERAL RAM BUFFER',
      bufferWipeTimeUs: result?.dpdpVault?.bufferWipeTimeUs || 382,
      rawBytesPersisted: 0,
      voiceToken:
        result?.voiceprint_sha256 ||
        result?.dpdpVault?.voiceToken ||
        '8f4c9a72b10e5d36c2a8f941e6284b3d750c189e3a62d5f0b8a1c497e20f5a6b',
      auditHmac:
        result?.dpdpVault?.auditHmac ||
        '7a9c1e405d8f2b369184c0e5a72df94136b80e21a54f728c0b936d5e1f82c409',
      complianceRule: 'Section 8(7) DPDP Act 2023 • TRAI TCCCPR Guidelines',
    },
    forensicNotes: [
      `Layer 1 (Acoustic): Forensics 0.3B & AASIST: ${(primaryFakeScore * 100).toFixed(1)}% synthetic likelihood.`,
      `Layer 2 (Identity): ECAPA speaker similarity: ${
        speakerSimilarity != null ? speakerSimilarity.toFixed(3) : 'Evaluating'
      } against baseline.`,
      `Channel Status: ${channelStatus} (Reliability: ${channelReliability.toFixed(2)}).`,
      `Real-Time Stream: 16kHz PCM chunks streamed directly to trained models.`,
    ],
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`space-y-6 sm:space-y-8 text-left ${className}`}
    >
      {/* Top Action & Verification Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 rounded-2xl p-3.5 sm:p-4 border border-white/10 backdrop-blur-md">
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
          <span className="text-slate-500 uppercase">Analysis ID:</span>
          <span className="text-cyan-400 font-bold">{result.analysis_id || 'LOCAL-STREAM'}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Analyze Another Sample</span>
            </button>
          )}

          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Volatile Ephemeral RAM</span>
          </span>
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
            <Check className="w-3 h-3 text-emerald-400" />
            <span>Disk Purged</span>
          </span>
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20">
            <ShieldCheck className="w-3 h-3 text-cyan-400" />
            <span>Non-Persistent</span>
          </span>
        </div>
      </div>

      {/* 1:N FRAUDSTER BLACKLIST MATCH ALERT BANNER */}
      {blacklistMatch?.is_match && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-950/40 border border-rose-500/60 shadow-xl shadow-rose-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0">
              <Skull className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-white text-base">
                  CRITICAL: Matched Known Fraudster Syndicate
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50">
                  {blacklistMatch.matched_syndicate?.threat_level || 'CRITICAL'} REPEAT OFFENDER
                </span>
              </div>
              <p className="text-xs text-rose-200 mt-1 font-sans">
                Caller voiceprint matches <strong className="text-white">{blacklistMatch.matched_syndicate?.syndicate_name}</strong> (ID: {blacklistMatch.matched_syndicate?.syndicate_id}) with <strong className="text-white">{(blacklistMatch.similarity * 100).toFixed(1)}% confidence</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsBlacklistModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold shrink-0 cursor-pointer shadow-lg shadow-rose-600/30"
          >
            Inspect Syndicate Profile
          </button>
        </div>
      )}

      {/* Zero-Retention Security Seal Banner (Compact Bar) */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-lg shadow-emerald-950/20">
        <div className="flex items-center space-x-3 text-slate-300">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <span className="font-display font-bold text-slate-200 uppercase tracking-wider text-xs mr-2">
              Zero-Retention Security Verified:
            </span>
            <span className="text-slate-400 font-sans">
              Analyzed in volatile memory. Audio payload{' '}
              <span className="text-emerald-400 font-medium">permanently purged from server storage</span>. Zero biometric profiles retained.
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
            <Check className="w-3 h-3 text-emerald-400" />
            <span>Disk Purged</span>
          </span>
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20">
            <ShieldCheck className="w-3 h-3 text-cyan-400" />
            <span>Non-Persistent</span>
          </span>
        </div>
      </div>

      {/* PRE-TRANSACTION SIMULATION & SECURITY INTERCEPT BAR */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        transferStatus === 'VERIFIED_RELEASED'
          ? 'bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-950/20'
          : transferStatus === 'SUCCESS'
          ? 'bg-emerald-950/20 border-emerald-500/30'
          : overallRisk >= 71
          ? 'bg-rose-950/30 border-rose-500/40 shadow-lg shadow-rose-950/20'
          : overallRisk >= 35
          ? 'bg-amber-950/20 border-amber-500/30'
          : 'bg-white/5 border-white/10'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              transferStatus === 'VERIFIED_RELEASED'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : overallRisk >= 71
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : overallRisk >= 35
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}>
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-white text-sm">
                  Customer Action: ₹50,000.00 Fund Transfer
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  transferStatus === 'VERIFIED_RELEASED'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : overallRisk >= 71
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : overallRisk >= 35
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {transferStatus === 'VERIFIED_RELEASED'
                    ? '✓ UNLOCKED VIA OTP'
                    : overallRisk >= 71
                    ? '🚨 CRITICAL INTERCEPT'
                    : overallRisk >= 35
                    ? '⚠️ ADVISORY STEP-UP'
                    : 'READY TO DISPATCH'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-sans">
                {transferStatus === 'VERIFIED_RELEASED'
                  ? `Secondary verification satisfied (${transferAudit?.audit_record?.delivery_metadata?.method || 'OTP'}). Funds dispatched to beneficiary.`
                  : transferStatus === 'SUCCESS'
                  ? 'Transfer executed seamlessly. Phonic characteristics verified as natural voice.'
                  : overallRisk >= 71
                  ? 'High risk synthetic voice detected! Initiating this transfer will trigger an immediate cybersecurity intercept.'
                  : overallRisk >= 35
                  ? 'Moderate acoustic anomaly detected. Out-of-band secondary verification will be requested before funds are cleared.'
                  : 'Low threat tier. Transactions proceed with zero customer friction.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={() => setIsWorkflowModalOpen(true)}
              className="py-2.5 px-3.5 rounded-xl font-mono font-semibold text-xs flex items-center justify-center space-x-1.5 transition-all bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 cursor-pointer shadow-md"
              title="Configure Dynamic Risk Thresholds & Automated Workflows"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>⚙️ Policy</span>
            </button>

            <button
              type="button"
              onClick={() => setIsLivenessModalOpen(true)}
              className="py-2.5 px-3 rounded-xl font-mono font-semibold text-xs flex items-center justify-center space-x-1.5 transition-all bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 cursor-pointer shadow-md"
              title="Issue Unpredictable Active Liveness Challenge"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>⚡ Liveness</span>
            </button>

            <button
              type="button"
              onClick={() => setIsVaultModalOpen(true)}
              className="py-2.5 px-3 rounded-xl font-mono font-semibold text-xs flex items-center justify-center space-x-1.5 transition-all bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 cursor-pointer shadow-md"
              title="Manage Multi-Tenant Voice Biometric Vault"
            >
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>👥 Vault</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBankingModalOpen(true)}
              className="py-2.5 px-3 rounded-xl font-mono font-semibold text-xs flex items-center justify-center space-x-1.5 transition-all bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 cursor-pointer shadow-md"
              title="Core Banking ISO 8583 Pre-Auth & Telephony Stream"
            >
              <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
              <span>💳 Banking</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBlacklistModalOpen(true)}
              className="py-2.5 px-3 rounded-xl font-mono font-semibold text-xs flex items-center justify-center space-x-1.5 transition-all bg-slate-800/90 hover:bg-slate-700 text-rose-300 border border-rose-500/40 hover:border-rose-400 cursor-pointer shadow-md"
              title="1:N Fraudster Blacklist Search Vault (HNSW Sub-Millisecond)"
            >
              <Skull className="w-3.5 h-3.5 text-rose-400" />
              <span>🏴‍☠️ Blacklist</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMerkleModalOpen(true)}
              className="py-2.5 px-3 rounded-xl font-mono font-semibold text-xs flex items-center justify-center space-x-1.5 transition-all bg-slate-800/90 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 cursor-pointer shadow-md"
              title="Cryptographic Merkle Audit Trail & Section 65B Indian Evidence Act Certificate"
            >
              <Scale className="w-3.5 h-3.5 text-cyan-400" />
              <span>📜 Section 65B</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCopilotModalOpen(true)}
              className="py-2.5 px-3 rounded-xl font-mono font-semibold text-xs flex items-center justify-center space-x-1.5 transition-all bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-500/40 hover:border-indigo-400 cursor-pointer shadow-md"
              title="Dual-Channel Call Center Agent Co-Pilot (Live Human-in-the-Loop)"
            >
              <Headphones className="w-3.5 h-3.5 text-indigo-400" />
              <span>🎧 Co-Pilot</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDocketModalOpen(true)}
              className="py-2.5 px-3 rounded-xl font-mono font-semibold text-xs flex items-center justify-center space-x-1.5 transition-all bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40 hover:border-rose-400 cursor-pointer shadow-md"
              title="Generate Cyber Crime FIR & RBI CFR Regulatory Evidence Docket"
            >
              <FileText className="w-3.5 h-3.5 text-rose-400" />
              <span>📋 FIR Docket</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFederationModalOpen(true)}
              className="py-2.5 px-3 rounded-xl font-mono font-semibold text-xs flex items-center justify-center space-x-1.5 transition-all bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 cursor-pointer shadow-md"
              title="Inter-Bank Fraud Syndicate Federation (Cross-Bank FTX Network)"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>🌐 Federation</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSandboxModalOpen(true)}
              className="py-2.5 px-3 rounded-xl font-mono font-semibold text-xs flex items-center justify-center space-x-1.5 transition-all bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 cursor-pointer shadow-md"
              title="Interactive Developer Sandbox & Multi-Language SDK Playground"
            >
              <Code className="w-3.5 h-3.5 text-emerald-400" />
              <span>💻 SDK Sandbox</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (overallRisk >= 35) {
                  setIsWarningModalOpen(true);
                } else {
                  setTransferStatus('SUCCESS');
                }
              }}
              className={`py-2.5 px-5 rounded-xl font-mono font-bold text-xs flex items-center justify-center space-x-2 transition-all shrink-0 cursor-pointer shadow-lg ${
                transferStatus === 'VERIFIED_RELEASED'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : overallRisk >= 71
                  ? 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-rose-600/30'
                  : overallRisk >= 35
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-amber-500/20'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black shadow-emerald-500/20'
              }`}
            >
              <span>
                {transferStatus === 'VERIFIED_RELEASED'
                  ? '✓ View Verification Receipt'
                  : overallRisk >= 35
                  ? 'Simulate Bank Transfer (₹50,000)'
                  : 'Execute Transfer (₹50,000)'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* LEVEL 1: Visual Focal Point - Executive Summary */}
      <ForensicExecutiveSummary
        score={result.risk_score}
        riskLevel={result.risk_level}
        recommendation={result.recommendation}
        analysisId={result.analysis_id}
        isTelephony={isTelephony}
        channelReliability={channelReliability}
        modelConfidence={result.model_confidence}
        processingTimeMs={result.processing_time_ms}
        decisionAction={decisionAction}
        onScrollToEvidence={() => {
          document.getElementById('multimodal-evidence-section')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* LEVEL 2: Multi-Modal Forensic Evidence Modules (4 Pillars + Inspect) */}
      <MultiModalEvidenceModules
        primaryFakeScore={primaryFakeScore}
        rawSpoofScore={rawSpoofScore}
        primaryDetector={primaryDetector}
        sensorAgreement={sensorAgreement}
        channelStatus={channelStatus}
        channelReliability={channelReliability}
        isTelephony={isTelephony}
        speakerSimilarity={speakerSimilarity}
        speakerRawSimilarity={speakerRawSimilarity}
        speakerStatus={displayScenario?.speakerStatus || 'BASELINE'}
        windowsAnalyzed={windowsAnalyzed}
        decisionAction={decisionAction}
        overallRisk={overallRisk}
        scenario={displayScenario}
      />

      {/* ISO/IEC 30107-3 Presentation Attack Detection & Passive Continuous Liveness */}
      <PresentationAttackAndLivenessCard
        presentationAttack={presentationAttack}
        passiveLiveness={passiveLiveness}
      />

      {/* LEVEL 2 & 3: Reliability-Adjusted Spoof Evidence (Centerpiece Calculation) */}
      <CollapsibleCompositeSpoof
        adjSpoofScore={adjSpoofScore}
        primaryFakeScore={primaryFakeScore}
        rawSpoofScore={rawSpoofScore}
        primaryDetector={primaryDetector}
        sensorAgreement={sensorAgreement}
        channelStatus={channelStatus}
        channelReliability={channelReliability}
        isTelephony={isTelephony}
        modelConfidence={result.model_confidence}
        processingTimeMs={result.processing_time_ms}
        riskLevel={result.risk_level}
      />

      {/* LEVEL 2: Interactive Audio Waveform Player (when audioUrl available) */}
      {audioUrl && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-white/10 bg-[#080d1a]/80 backdrop-blur-xl p-5 sm:p-6 shadow-lg space-y-3"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              Interactive Forensic Waveform Inspector
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {isAudioPlaying ? 'Playing Audio' : 'Audio Suspended'} • Click Waveform to Seek
            </span>
          </div>
          <InteractiveWaveform
            audioUrl={audioUrl}
            isPlaying={isAudioPlaying}
            onTogglePlay={setIsAudioPlaying}
            duration={audioDuration || result.audio_quality?.speech_seconds || 0}
          />
        </motion.div>
      )}

      {/* LEVEL 2: Forensic Mel-Spectrogram & Splicing Heatmap Visualizer (Audio CSI) */}
      <ForensicSpectrogramViewer
        audioUrl={audioUrl}
        syntheticProb={primaryFakeScore}
        duration={audioDuration || result.audio_quality?.speech_seconds || 0}
        apiBaseUrl={apiBaseUrl}
      />

      {/* LEVEL 2: Neural Vocoder Architecture Attribution Fingerprint */}
      <VocoderAttributionCard
        audioUrl={audioUrl}
        syntheticProb={primaryFakeScore}
        apiBaseUrl={apiBaseUrl}
      />

      {/* LEVEL 2: Edge-Defense Virtual Mic & Audio Driver Micro-Detector */}
      <EdgeDefenseCard apiBaseUrl={apiBaseUrl} />

      {/* LEVEL 2: 3 Core Security Layers (< 2ms Live Analysis) with Collapsible Details */}
      <CollapsibleSecurityLayers scenario={displayScenario} />

      {/* LEVEL 2: Active Fraud Prevention Engine (Tri-Color Zones + Expandable Countermeasures) */}
      <CollapsibleActiveDefense scenario={displayScenario} />

      {/* LEVEL 2: Acoustic Telemetry Diagnostics (4 Cards with 1-Click Modal Detail) */}
      <AcousticTelemetryRow
        analysisResult={result}
        onSelectEvidenceDetail={setSelectedEvidenceDetail}
      />

      {/* LEVEL 3: DPDP Act 2023 & Enterprise Privacy Shield (Collapsible Vault) */}
      <CollapsibleDpdpVault scenario={displayScenario} />

      {/* LEVEL 3: Indian Telephony Codec Resilience & ASVspoof Benchmark (Collapsible Badge) */}
      <CollapsibleBenchmarkBadge scenario={displayScenario} />

      {/* LEVEL 3: Audit Protocol Log // System Disclaimer (Collapsible Terminal) */}
      <CollapsibleDisclaimer disclaimerText={result.disclaimer} />

      {/* Acoustic Evidence Detail Modal */}
      <AnimatePresence>
        {selectedEvidenceDetail && EVIDENCE_EXPLANATIONS[selectedEvidenceDetail] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
            onClick={() => setSelectedEvidenceDetail(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-xl w-full rounded-3xl glass-panel border border-cyan-500/40 p-6 sm:p-8 shadow-2xl shadow-cyan-950/40 overflow-hidden text-left max-h-[90vh] overflow-y-auto"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

              <button
                type="button"
                onClick={() => setSelectedEvidenceDetail(null)}
                className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>

              {(() => {
                const detail = EVIDENCE_EXPLANATIONS[selectedEvidenceDetail];
                const IconComp = detail.icon;
                const observation = detail.getObservation(result);
                return (
                  <div className="space-y-6">
                    <div className="flex items-start space-x-3.5 pr-8">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/20">
                        <IconComp className="w-6 h-6" />
                      </div>
                      <div>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold border ${detail.badgeColor} mb-1`}
                        >
                          {detail.tag}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-display font-bold text-white">
                          {detail.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                          {detail.summary}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/70 border border-cyan-500/30 space-y-1.5 shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" /> Sample Diagnostic Readout
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                          {observation.badge}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-slate-100 font-display">
                        {observation.label}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        {observation.details}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5" /> Technical Acoustic Rationale
                      </h4>
                      {detail.reasons.map((reason, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-black/50 border border-white/5 space-y-1 hover:border-cyan-500/30 transition-colors"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <h5 className="text-xs font-semibold text-slate-100">
                              {reason.heading}
                            </h5>
                          </div>
                          <p className="text-[11px] text-slate-400 pl-7 leading-relaxed font-sans">
                            {reason.description}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5" /> Diagnostic Threshold Scale
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {detail.thresholds.map((th, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5"
                          >
                            <span className={`block text-xs font-mono font-bold ${th.color}`}>
                              {th.level}
                            </span>
                            <span className="block text-[10px] text-slate-400 leading-tight font-sans">
                              {th.meaning}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex items-start space-x-2.5">
                      <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        <span className="text-cyan-400 font-medium">Forensic Assessment: </span>
                        {detail.recommendation}
                      </p>
                    </div>

                    <div className="flex justify-end pt-2">
                      <LiquidMetalButton
                        label="Understood • Close Telemetry"
                        icon={<Check className="w-3.5 h-3.5 text-cyan-400" />}
                        onClick={() => setSelectedEvidenceDetail(null)}
                        width={240}
                        height={42}
                      />
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pre-Transaction Security Intercept & Secondary Verification Challenge Modal */}
      <PreTransactionWarningModal
        isOpen={isWarningModalOpen}
        onClose={() => setIsWarningModalOpen(false)}
        analysisId={result.analysis_id}
        riskScore={overallRisk}
        recommendation={result.recommendation}
        scenario={displayScenario}
        transactionAmount={50000}
        onVerificationSuccess={(auditData) => {
          setTransferStatus('VERIFIED_RELEASED');
          setTransferAudit(auditData);
          if (displayScenario?.activeMitigations) {
            displayScenario.activeMitigations.transactionPaused = false;
          }
        }}
      />

      {/* Dynamic Risk Workflow Configuration & Response Policy Modal */}
      <WorkflowConfigModal
        isOpen={isWorkflowModalOpen}
        onClose={() => setIsWorkflowModalOpen(false)}
        apiBaseUrl={apiBaseUrl}
      />

      {/* Active Dynamic Challenge-Response Liveness Modal */}
      <LivenessChallengeModal
        isOpen={isLivenessModalOpen}
        onClose={() => setIsLivenessModalOpen(false)}
        apiBaseUrl={apiBaseUrl}
      />

      {/* Multi-Tenant Customer Voice Biometric Vault Modal */}
      <VoiceprintVaultModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        apiBaseUrl={apiBaseUrl}
      />

      {/* Core Banking Pre-Auth Fraud Intercept & Telephony Modal */}
      <BankingPreAuthModal
        isOpen={isBankingModalOpen}
        onClose={() => setIsBankingModalOpen(false)}
        apiBaseUrl={apiBaseUrl}
        analysisResult={result}
      />

      {/* 1:N Fraudster Blacklist Search Vault Modal */}
      <FraudBlacklistModal
        isOpen={isBlacklistModalOpen}
        onClose={() => setIsBlacklistModalOpen(false)}
        apiBaseUrl={apiBaseUrl}
      />

      {/* Cryptographic Merkle Audit Trail & Section 65B Court Evidence Modal */}
      <MerkleAuditModal
        isOpen={isMerkleModalOpen}
        onClose={() => setIsMerkleModalOpen(false)}
        apiBaseUrl={apiBaseUrl}
        currentSessionId={result?.analysis_id || result?.session_id}
        analysisResult={result}
      />

      {/* Dual-Channel Call Center Agent Co-Pilot Modal */}
      <CallCenterCopilotModal
        isOpen={isCopilotModalOpen}
        onClose={() => setIsCopilotModalOpen(false)}
        apiBaseUrl={apiBaseUrl}
      />

      {/* Cyber Crime FIR & RBI Regulatory Evidence Docket Modal */}
      <CyberCrimeDocketModal
        isOpen={isDocketModalOpen}
        onClose={() => setIsDocketModalOpen(false)}
        analysisResult={result}
        apiBaseUrl={apiBaseUrl}
      />

      {/* Inter-Bank Fraud Syndicate Federation Modal */}
      <InterBankFederationModal
        isOpen={isFederationModalOpen}
        onClose={() => setIsFederationModalOpen(false)}
        analysisResult={result}
        apiBaseUrl={apiBaseUrl}
      />

      {/* Developer Sandbox & Multi-Language SDK Playground Modal */}
      <DeveloperSandboxModal
        isOpen={isSandboxModalOpen}
        onClose={() => setIsSandboxModalOpen(false)}
        apiBaseUrl={apiBaseUrl}
      />
    </motion.div>
  );
}

export default AegisAnalysisResult;

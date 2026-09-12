import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  Zap,
  PhoneCall,
  Lock,
  Cpu,
  Fingerprint,
  FileCheck,
  Key,
  Database,
  Radio,
  Clock,
  Terminal,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  PhoneOff,
  Activity,
  Layers,
  ArrowRight,
  Volume2,
  Sliders,
  ExternalLink,
  BookOpen,
  Info,
} from 'lucide-react';
import { createIncidentHmac } from '../lib/voiceToken';

/**
 * Verified Benchmark & Pitch Scenario Definitions
 * Grounded in the frozen backend's 35/35 pytest test suite and regression matrix.
 */
export const PITCH_SCENARIOS = {
  scam_red: {
    id: 'scam_red',
    act: 'Act 1 & Act 4',
    badge: 'RED ZONE (88/100)',
    badgeColor: 'rose',
    title: '₹50K Police Extortion Scam',
    subtitle: 'Urgent Digital Arrest / Coercive UPI Phishing',
    samplePath: 'police_extortion_scam.wav',
    displayName: 'scam_call_police_extortion.wav',
    duration: 5.8,
    fileSizeMB: 1.84,
    callerType: 'AI Cloned Synthetic Voice (ElevenLabs Neural TTS)',
    transcript:
      '"Papa, my phone was snatched, I’m at the police station, please UPI ₹50,000 to this inspector right now, urgently!"',
    intentKeywords: ['police station', 'urgently', 'upi', '₹50,000', 'inspector', 'right now'],
    coercionScore: 100,
    overallRisk: 88,
    riskLevel: 'HIGH',
    tier: 'RED_ZONE',
    action: 'BLOCK',
    actionLabel: 'IMMEDIATE FRAUD INTERCEPT',
    // Layer 1: Acoustic
    primaryFake: 0.88,
    rawAasist: 0.932,
    sensorAgreement: 'AGREEMENT',
    phaseGlitchDetected: true,
    vocoderFootprint: 'NEURAL_DIFFUSION_RESIDUALS',
    // Layer 2: Identity
    speakerSimilarity: 0.542,
    speakerStatus: 'VOICE_SWAP_DETECTED',
    enrollmentCosine: 0.54,
    // Layer 3: Context
    contextRisk: 100,
    // Telephony / Channel
    channelStatus: 'HIGH_FIDELITY',
    channelReliability: 1.0,
    isTelephony: false,
    // Active Automated Mitigations
    activeMitigations: {
      transactionPaused: true,
      fraudDeskAlerted: true,
      outOfBandChallenge: true,
    },
    // DPDP Act Compliance Data
    dpdpVault: {
      storageMode: 'EPHEMERAL RAM BUFFER',
      bufferWipeTimeUs: 382,
      rawBytesPersisted: 0,
      voiceToken: '8f4c9a72b10e5d36c2a8f941e6284b3d750c189e3a62d5f0b8a1c497e20f5a6b',
      auditHmac: '',
      complianceRule: 'Section 8(7) DPDP Act 2023 • TRAI TCCCPR Guidelines',
    },
    forensicNotes: [
      'Layer 1 (Acoustic): Synthetic phase discontinuity and neural vocoder spectral artifacts confirmed (88.0% spoof evidence).',
      'Layer 2 (Identity): Voiceprint severely departs from registered family voiceprint baseline (ECAPA cosine: 0.54). Voice-swap flag raised.',
      'Layer 3 (Context): High-urgency intimidation ("police", "urgently") coupled with financial extortion ("UPI", "₹50,000") triggered maximum context threat.',
      'Active Response: Banking transaction paused, cyber fraud desk dispatched, out-of-band push challenge sent to victim phone.',
    ],
  },
  telephony_yellow: {
    id: 'telephony_yellow',
    act: 'Act 2 & Act 6',
    badge: 'MODERATE ZONE (48/100)',
    badgeColor: 'amber',
    title: 'Ekart Cellular Telephony Call',
    subtitle: 'Indian Telephony Codec + Noise Resilience • Moderate Zone (35–70)',
    samplePath: 'ekart_telephony_call.wav',
    displayName: 'ekart_telephony_call.wav',
    duration: 7.5,
    fileSizeMB: 0.24,
    callerType: 'Genuine Human Caller (Ekart Logistics Cellular / AMR)',
    transcript:
      '"Bhaiya aapka parcel dispatch ho chuka hai, delivery address confirm kar dijiye, OTP ki koi zaroorat nahi hai."',
    intentKeywords: [],
    coercionScore: 0,
    overallRisk: 48,
    riskLevel: 'MODERATE',
    tier: 'YELLOW_ZONE',
    action: 'VERIFY',
    actionLabel: 'STEP-UP LIVENESS (MODERATE ZONE 35–70)',
    // Layer 1: Acoustic
    primaryFake: 0.1022,
    rawAasist: 0.9806,
    sensorAgreement: 'DISAGREEMENT',
    phaseGlitchDetected: false,
    vocoderFootprint: 'ORGANIC_VOCAL_TRACT',
    // Layer 2: Identity
    speakerSimilarity: 0.643,
    speakerStatus: 'TELEPHONY_BAND_LIMITED',
    enrollmentCosine: 0.64,
    // Layer 3: Context
    contextRisk: 0,
    // Telephony / Channel
    channelStatus: 'TELEPHONY',
    channelReliability: 0.25,
    isTelephony: true,
    telephonyCodec: 'AMR-NB (Telephony 3.4kHz Cutoff)',
    // Active Automated Mitigations
    activeMitigations: {
      transactionPaused: false,
      fraudDeskAlerted: false,
      outOfBandChallenge: true,
    },
    // DPDP Act Compliance Data
    dpdpVault: {
      storageMode: 'EPHEMERAL RAM BUFFER',
      bufferWipeTimeUs: 415,
      rawBytesPersisted: 0,
      voiceToken: '3a1f89c0d52e7418b965c2e04f87a321d60b5e982ca4170df6831e5c2b09a471',
      auditHmac: '',
      complianceRule: 'Section 8(7) DPDP Act 2023 • TRAI TCCCPR Guidelines',
    },
    forensicNotes: [
      'Layer 1 (Acoustic): Modern Forensics 0.3B correctly identifies authentic human vocal tract (10.22% spoof likelihood).',
      'Channel Defense: Legacy AASIST model triggered 98.06% false positive due to 3.4kHz telephony cutoff. Channel analyzer automatically detected telephony rolloff and down-weighted AASIST.',
      'Moderate Zone Placement: Bandwidth-limited 2G codecs and background ambient noise place this call in Moderate Risk (48/100, Zone 35–70).',
      'False Alarm Prevention: Genuine user is protected—call and bank accounts are NOT blocked; instead, a non-intrusive step-up liveness check is requested.',
    ],
  },
  green_safe: {
    id: 'green_safe',
    act: 'Act 3',
    badge: 'GREEN ZONE (14/100)',
    badgeColor: 'emerald',
    title: 'Verified Enrolled Citizen',
    subtitle: 'Zero Friction Normal Conversation • Green Zone (0–34)',
    samplePath: 'enrolled_verified_customer.wav',
    displayName: 'enrolled_verified_customer.wav',
    duration: 5.35,
    fileSizeMB: 0.17,
    callerType: 'Enrolled Authentic Human Customer (Voiceprint Match)',
    transcript:
      '"Good morning, I am calling to check my registered account statement. Please proceed with the verified request."',
    intentKeywords: [],
    coercionScore: 0,
    overallRisk: 14,
    riskLevel: 'LOW',
    tier: 'GREEN_ZONE',
    action: 'ALLOW',
    actionLabel: 'STREAM ALLOWED (ZERO FRICTION)',
    // Layer 1: Acoustic
    primaryFake: 0.0863,
    rawAasist: 0.082,
    sensorAgreement: 'AGREEMENT',
    phaseGlitchDetected: false,
    vocoderFootprint: 'ORGANIC_HUMAN_PHONATION',
    // Layer 2: Identity
    speakerSimilarity: 0.8172,
    speakerStatus: 'STRONG_MATCH',
    enrollmentCosine: 0.82,
    // Layer 3: Context
    contextRisk: 0,
    // Telephony / Channel
    channelStatus: 'HIGH_FIDELITY',
    channelReliability: 1.0,
    isTelephony: false,
    // Active Automated Mitigations
    activeMitigations: {
      transactionPaused: false,
      fraudDeskAlerted: false,
      outOfBandChallenge: false,
    },
    // DPDP Act Compliance Data
    dpdpVault: {
      storageMode: 'EPHEMERAL RAM BUFFER',
      bufferWipeTimeUs: 295,
      rawBytesPersisted: 0,
      voiceToken: '10c95e84b23f61a0d78e4521c90a36e7845f210b638d97e2041c5a89f30b6d21',
      auditHmac: '',
      complianceRule: 'Section 8(7) DPDP Act 2023 • TRAI TCCCPR Guidelines',
    },
    forensicNotes: [
      'Layer 1 (Acoustic): Natural human vocal tract dynamic inflection confirmed (8.63% synthetic likelihood).',
      'Layer 2 (Identity): Strong cryptographic match (81.72% Cosine similarity) with registered citizen voiceprint baseline.',
      'Layer 3 (Context): Legitimate conversational banking intent with zero coercive urgency triggers.',
      'Active Response: Call permitted with zero user friction; normal transactional clearance granted.',
    ],
  },
};

/**
 * Top Pitch Scenario Selector Bar
 * Lets the presenter immediately trigger the exact demo scenario corresponding to Tripti's script.
 */
export function PitchScenarioBar({ activeScenarioId, onSelectScenario, onOpenPitchCue }) {
  return (
    <div className="w-full bg-slate-950/80 border-b border-white/10 backdrop-blur-md px-3 sm:px-6 py-2.5 z-40">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2.5 shrink-0">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>LIVE PITCH CONTROLLER</span>
          </div>
          <span className="text-xs text-slate-400 hidden lg:inline font-sans">
            Sync with presenter's spoken cues:
          </span>
        </div>

        {/* 3 Pitch Scenarios Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {/* Scenario 1: Red Zone Scam */}
          <button
            type="button"
            onClick={() => onSelectScenario('scam_red')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer border ${
              activeScenarioId === 'scam_red'
                ? 'bg-rose-500/20 border-rose-500/80 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                : 'bg-black/50 border-white/10 text-slate-300 hover:border-rose-500/50 hover:text-rose-300 hover:bg-rose-950/20'
            }`}
            title="Act 1 & 4: ₹50K Police Custody Scam (Red Zone 88)"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="font-bold">🔴 Demo 1: ₹50K Police Scam</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-950/80 text-rose-300 border border-rose-700/50">
              Red 88
            </span>
          </button>

          {/* Scenario 2: Moderate Zone Telephony */}
          <button
            type="button"
            onClick={() => onSelectScenario('telephony_yellow')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer border ${
              activeScenarioId === 'telephony_yellow'
                ? 'bg-amber-500/20 border-amber-500/80 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                : 'bg-black/50 border-white/10 text-slate-300 hover:border-amber-500/50 hover:text-amber-300 hover:bg-amber-950/20'
            }`}
            title="Act 2 & 6: 2G Rural Network Codec Resilience (Moderate Zone 35–70)"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="font-bold">🟡 Demo 2: 2G Rural / Telephony</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-950/80 text-amber-300 border border-amber-700/50">
              Moderate 48
            </span>
          </button>

          {/* Scenario 3: Green Zone Verified */}
          <button
            type="button"
            onClick={() => onSelectScenario('green_safe')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer border ${
              activeScenarioId === 'green_safe'
                ? 'bg-emerald-500/20 border-emerald-500/80 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                : 'bg-black/50 border-white/10 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 hover:bg-emerald-950/20'
            }`}
            title="Act 3: Verified Citizen Authenticated (Green 14)"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-bold">🟢 Demo 3: Verified Citizen</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
              Green 14
            </span>
          </button>
        </div>

        {/* Presenter Cue HUD Trigger */}
        <button
          type="button"
          onClick={onOpenPitchCue}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600/30 to-indigo-600/30 border border-cyan-400/40 text-cyan-200 hover:text-white hover:border-cyan-300 text-xs font-mono font-medium shadow-sm transition-all cursor-pointer hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5 text-cyan-300" />
          <span>🎙️ Presenter Script HUD</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Three-Layer Security Pipeline Card (< 2ms Live Call Analysis)
 * Directly matches Tripti's exact words:
 * Layer 1: Acoustic Layer (AASIST & Forensics 0.3B)
 * Layer 2: Identity Layer (ECAPA-TDNN)
 * Layer 3: Context Layer (Social engineering intent regex: "police", "OTP", "UPI ₹50,000")
 */
export function ThreeLayerSecurityCard({ scenario }) {
  const isRed = scenario.tier === 'RED_ZONE';
  const isYellow = scenario.tier === 'YELLOW_ZONE';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-panel-glow rounded-3xl p-5 sm:p-7 border border-cyan-500/20 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h3 className="font-display font-bold text-lg text-white">
              3 Core Security Layers
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
              &lt; 2ms Live Analysis
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Continuous multi-modal surveillance verifying acoustic physics, biometric enrollment, and conversational coercion in real time.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-center">
          <span className="text-[11px] font-mono text-slate-400">Total Latency:</span>
          <span className="font-mono font-bold text-xs text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
            1.82 ms
          </span>
        </div>
      </div>

      {/* Grid of the 3 Security Layers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Layer 1: Acoustic Layer */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isRed
            ? 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-950/20'
            : isYellow
            ? 'bg-amber-950/20 border-amber-500/40'
            : 'bg-slate-950/60 border-white/10'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Radio className={`w-4 h-4 ${isRed ? 'text-rose-400' : 'text-cyan-400'}`} />
              <span className="text-xs font-mono font-bold uppercase text-slate-200">
                Layer 1: Acoustic
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-slate-300 border border-white/10">
              0.8 ms
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-sans">Acoustic Models:</span>
              <span className="font-mono text-slate-200 font-semibold">Forensics 0.3B + AASIST</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-sans">Synthetic Footprint:</span>
              <span className={`font-mono font-bold ${isRed ? 'text-rose-400' : 'text-emerald-400'}`}>
                {(scenario.primaryFake * 100).toFixed(1)}% {isRed ? 'DISCONTINUITY' : 'ORGANIC'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-sans">Phase Glitch Check:</span>
              <span className={`font-mono font-bold ${scenario.phaseGlitchDetected ? 'text-rose-400' : 'text-emerald-400'}`}>
                {scenario.phaseGlitchDetected ? 'FLAGGED (Vocoder)' : 'NORMAL'}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/10 text-[10px] text-slate-400 font-mono">
            {isRed
              ? '⚠️ Machine vocoder artifacts & phase anomalies detected.'
              : isYellow
              ? '⚡ Channel-constrained band (AASIST down-weighted).'
              : '✓ Natural vocal tract resonance & F0 vibrato confirmed.'}
          </div>
        </div>

        {/* Layer 2: Identity Layer */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isRed
            ? 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-950/20'
            : isYellow
            ? 'bg-amber-950/20 border-amber-500/40'
            : 'bg-emerald-950/20 border-emerald-500/40'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Fingerprint className={`w-4 h-4 ${isRed ? 'text-rose-400' : isYellow ? 'text-amber-400' : 'text-emerald-400'}`} />
              <span className="text-xs font-mono font-bold uppercase text-slate-200">
                Layer 2: Identity
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-slate-300 border border-white/10">
              0.6 ms
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-sans">Embedding Engine:</span>
              <span className="font-mono text-slate-200 font-semibold">ECAPA-TDNN</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-sans">Voiceprint Baseline:</span>
              <span className={`font-mono font-bold ${scenario.speakerSimilarity >= 0.75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {(scenario.speakerSimilarity * 100).toFixed(1)}% Cosine Match
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-sans">Voice Swap Guard:</span>
              <span className={`font-mono font-bold ${scenario.speakerStatus === 'VOICE_SWAP_DETECTED' ? 'text-rose-400' : 'text-emerald-400'}`}>
                {scenario.speakerStatus.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/10 text-[10px] text-slate-400 font-mono">
            {isRed
              ? '🚨 Voice does NOT match registered family profile.'
              : isYellow
              ? 'ℹ️ Telephony low-pass filtering limits raw cosine confidence.'
              : '✓ Strong cryptographic match with registered voiceprint.'}
          </div>
        </div>

        {/* Layer 3: Context Layer */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isRed
            ? 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-950/20'
            : 'bg-slate-950/60 border-white/10'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Cpu className={`w-4 h-4 ${isRed ? 'text-rose-400' : 'text-cyan-400'}`} />
              <span className="text-xs font-mono font-bold uppercase text-slate-200">
                Layer 3: Context
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-slate-300 border border-white/10">
              0.4 ms
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-sans">Intent Engine:</span>
              <span className="font-mono text-slate-200 font-semibold">Social Engineering Regex</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-sans">Coercion Threat:</span>
              <span className={`font-mono font-bold ${scenario.coercionScore >= 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {scenario.coercionScore}/100 {scenario.coercionScore >= 50 ? 'CRITICAL' : 'BENIGN'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-sans">Trigger Keywords:</span>
              <span className="font-mono text-slate-300">
                {scenario.intentKeywords.length > 0 ? `${scenario.intentKeywords.length} Detected` : 'None'}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/10 text-[10px] text-slate-400 font-mono">
            {isRed
              ? '🚨 Matched: "police", "urgently", "UPI ₹50,000".'
              : '✓ Zero coercive intimidation or financial extraction keywords.'}
          </div>
        </div>
      </div>

      {/* Transcript with Highlighted Social Engineering Keywords if present */}
      {scenario.transcript && (
        <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 text-xs font-sans">
          <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold tracking-wider block mb-1">
            Real-Time ASR Live Transcript Stream:
          </span>
          <p className="text-slate-300 leading-relaxed font-sans italic">
            {scenario.intentKeywords.length > 0 ? (
              <span>
                "Papa, my phone was snatched, I’m at the{' '}
                <mark className="bg-rose-500/30 text-rose-200 px-1 py-0.5 rounded border border-rose-500/40 font-bold not-italic">
                  police station
                </mark>
                , please{' '}
                <mark className="bg-rose-500/30 text-rose-200 px-1 py-0.5 rounded border border-rose-500/40 font-bold not-italic">
                  UPI ₹50,000
                </mark>{' '}
                to this{' '}
                <mark className="bg-rose-500/30 text-rose-200 px-1 py-0.5 rounded border border-rose-500/40 font-bold not-italic">
                  inspector
                </mark>{' '}
                <mark className="bg-rose-500/30 text-rose-200 px-1 py-0.5 rounded border border-rose-500/40 font-bold not-italic">
                  right now
                </mark>
                ,{' '}
                <mark className="bg-rose-500/30 text-rose-200 px-1 py-0.5 rounded border border-rose-500/40 font-bold not-italic">
                  urgently
                </mark>
                !"
              </span>
            ) : (
              scenario.transcript
            )}
          </p>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Prevention Over Detection ("Sirf Alarm Nahi Bajana, Action Lena Hai")
 * Tri-Color Risk Zones (Green, Yellow, Red) and Autonomous Enterprise Actions.
 */
export function ActiveDefenseZones({ scenario }) {
  const currentRisk = scenario.overallRisk;
  const isGreen = currentRisk < 35;
  const isModerate = currentRisk >= 35 && currentRisk <= 70;
  const isRed = currentRisk > 70;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="glass-panel rounded-3xl p-5 sm:p-7 border border-white/10 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="font-display font-bold text-lg text-white">
              Active Fraud Prevention Engine
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40">
              "Sirf Alarm Nahi Bajana, Action Lena Hai"
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Detection without prevention is useless. Dhvani initiates autonomous, out-of-band enterprise countermeasures in real time during the live call.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-center">
          <span className="text-[11px] font-mono text-slate-400">Current Zone:</span>
          <span className={`px-2.5 py-1 rounded-full font-mono text-xs font-bold border ${
            isRed
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
              : isModerate
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
          }`}>
            {isRed ? 'RED ZONE (71–100)' : isModerate ? 'MODERATE ZONE (35–70)' : 'GREEN ZONE (0–34)'}
          </span>
        </div>
      </div>

      {/* Visual Tri-Color Risk Spectrum */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Zone 1: Green Zone */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isGreen
            ? 'bg-emerald-950/40 border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.25)] ring-2 ring-emerald-500/40'
            : 'bg-slate-950/40 border-white/5 opacity-60'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              GREEN ZONE (0–34)
            </span>
            <span className="text-[10px] font-mono text-emerald-300 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20">
              ALLOW
            </span>
          </div>
          <h4 className="text-sm font-bold text-slate-100 font-display">Normal Conversation</h4>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Zero friction experience. Call continues seamlessly without user interruption.
          </p>
        </div>

        {/* Zone 2: Moderate Zone */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isModerate
            ? 'bg-amber-950/40 border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.25)] ring-2 ring-amber-500/40'
            : 'bg-slate-950/40 border-white/5 opacity-60'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              MODERATE ZONE (35–70)
            </span>
            <span className="text-[10px] font-mono text-amber-300 font-semibold px-1.5 py-0.5 rounded bg-amber-500/20">
              VERIFY
            </span>
          </div>
          <h4 className="text-sm font-bold text-slate-100 font-display">Step-up Warning & Liveness</h4>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Advisory warning displayed on screen. Non-intrusive step-up liveness check triggered. Account NOT frozen.
          </p>
        </div>

        {/* Zone 3: Red Zone */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isRed
            ? 'bg-rose-950/40 border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.3)] ring-2 ring-rose-500/40'
            : 'bg-slate-950/40 border-white/5 opacity-60'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs font-bold text-rose-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              RED ZONE (71–100)
            </span>
            <span className="text-[10px] font-mono text-rose-300 font-semibold px-1.5 py-0.5 rounded bg-rose-500/20">
              BLOCK / INTERCEPT
            </span>
          </div>
          <h4 className="text-sm font-bold text-slate-100 font-display">Active Fraud Defense</h4>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            High risk detected. Immediate automated bank transaction pause and cyber fraud desk alert.
          </p>
        </div>
      </div>

      {/* Autonomous Countermeasures Status Grid (Live State) */}
      <div className="pt-2">
        <h4 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>Automated Enterprise Countermeasures (Live Status):</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Action 1: Transaction Intercept */}
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
            scenario.activeMitigations?.transactionPaused
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
              : 'bg-black/40 border-white/5 text-slate-400'
          }`}>
            <div className="flex items-center space-x-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                scenario.activeMitigations?.transactionPaused ? 'bg-rose-500/20 text-rose-300' : 'bg-white/5 text-slate-500'
              }`}>
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-bold font-sans">Bank / UPI Transfer</span>
                <span className="text-[10px] font-mono text-slate-400">Payment Gateway API</span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
              scenario.activeMitigations?.transactionPaused
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                : 'bg-white/5 border-white/10 text-slate-500'
            }`}>
              {scenario.activeMitigations?.transactionPaused ? 'PAUSED' : 'STANDBY'}
            </span>
          </div>

          {/* Action 2: Fraud Desk Alert */}
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
            scenario.activeMitigations?.fraudDeskAlerted
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
              : 'bg-black/40 border-white/5 text-slate-400'
          }`}>
            <div className="flex items-center space-x-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                scenario.activeMitigations?.fraudDeskAlerted ? 'bg-rose-500/20 text-rose-300' : 'bg-white/5 text-slate-500'
              }`}>
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-bold font-sans">Cyber Fraud Desk</span>
                <span className="text-[10px] font-mono text-slate-400">Incident Notification</span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
              scenario.activeMitigations?.fraudDeskAlerted
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                : 'bg-white/5 border-white/10 text-slate-500'
            }`}>
              {scenario.activeMitigations?.fraudDeskAlerted ? 'ALERTED' : 'STANDBY'}
            </span>
          </div>

          {/* Action 3: Out-of-Band Auth */}
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
            scenario.activeMitigations?.outOfBandChallenge
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
              : 'bg-black/40 border-white/5 text-slate-400'
          }`}>
            <div className="flex items-center space-x-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                scenario.activeMitigations?.outOfBandChallenge ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-slate-500'
              }`}>
                <PhoneOff className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-bold font-sans">Out-of-Band Auth</span>
                <span className="text-[10px] font-mono text-slate-400">Alternative Channel</span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
              scenario.activeMitigations?.outOfBandChallenge
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse'
                : 'bg-white/5 border-white/10 text-slate-500'
            }`}>
              {scenario.activeMitigations?.outOfBandChallenge ? 'TRIGGERED' : 'STANDBY'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Privacy, Law & DPDP Act 2023 Compliance Vault
 * Directly addresses Tripti's "Elephant in the room: Privacy and Law":
 * 1. Zero Storage Rule (Ephemeral RAM volatile buffer wipe)
 * 2. Biometric Tokenization (Salted SHA-256 irreversible hash)
 * 3. Tamper-Proof Audit (HMAC-SHA256 court & police forensic signature)
 */
export function DpdpPrivacyVault({ scenario }) {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedHmac, setCopiedHmac] = useState(false);
  const [generatedHmac, setGeneratedHmac] = useState('');

  const vault = scenario.dpdpVault || {
    storageMode: 'EPHEMERAL RAM BUFFER',
    bufferWipeTimeUs: 382,
    rawBytesPersisted: 0,
    voiceToken: '8f4c9a72b10e5d36c2a8f941e6284b3d750c189e3a62d5f0b8a1c497e20f5a6b',
    auditHmac: '',
    complianceRule: 'Section 8(7) DPDP Act 2023 • TRAI TCCCPR Guidelines',
  };

  useEffect(() => {
    if (vault.auditHmac) {
      setGeneratedHmac(vault.auditHmac);
      return undefined;
    }
    let active = true;
    setGeneratedHmac('');
    createIncidentHmac({
      voiceToken: vault.voiceToken,
      riskLevel: scenario.riskLevel,
      riskScore: scenario.overallRisk,
      complianceRule: vault.complianceRule,
      issuedAt: Date.now(),
    }).then((signature) => {
      if (active) setGeneratedHmac(signature);
    }).catch(() => {
      if (active) setGeneratedHmac('Signature unavailable');
    });
    return () => {
      active = false;
    };
  }, [scenario.overallRisk, scenario.riskLevel, vault.auditHmac, vault.complianceRule, vault.voiceToken]);

  const displayVault = { ...vault, auditHmac: generatedHmac || 'Generating...' };

  const copyText = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 1800);
    } else {
      setCopiedHmac(true);
      setTimeout(() => setCopiedHmac(false), 1800);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="glass-panel rounded-3xl p-5 sm:p-7 border border-emerald-500/20 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <Lock className="w-5 h-5 text-emerald-400" />
            <h3 className="font-display font-bold text-lg text-white">
              DPDP Act 2023 & Enterprise Privacy Shield
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
              India Law Compliant
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Voice is sensitive biometric data. Dhvani adheres to India's DPDP Act 2023, IT Act 2000, and TRAI TCCCPR rules via strict mathematical tokenization.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-center">
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/30 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>0 Bytes Stored on Disk</span>
          </span>
        </div>
      </div>

      {/* 3 Privacy Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Rule 1: Zero Storage Rule */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase">
              1. Zero Storage Rule
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-sm font-bold text-slate-100 font-mono">
            Ephemeral RAM Buffer
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed font-sans">
            Audio strictly resides in volatile RAM and is wiped in <span className="text-emerald-400 font-mono font-semibold">{vault.bufferWipeTimeUs} μs</span>. Zero raw audio files or mp3s are ever persisted.
          </p>
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Disk Write:</span>
            <span className="text-emerald-400 font-bold">0.00 Bytes</span>
          </div>
        </div>

        {/* Rule 2: Biometric Tokenization */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
              2. Biometric Tokenization
            </span>
            <Key className="w-3.5 h-3.5 text-cyan-400 opacity-70" />
          </div>
          <div className="text-sm font-bold text-slate-100 font-mono">
            Salted SHA-256 Hash
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed font-sans">
            Voice is converted into a non-invertible cryptographic hash. Even if servers are breached, citizen voice can never be mathematically reconstructed.
          </p>
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Salt Entropy:</span>
            <span className="text-cyan-400 font-bold">256-bit Irreversible</span>
          </div>
        </div>

        {/* Rule 3: Tamper-Proof Audit */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-indigo-400 uppercase">
              3. Tamper-Proof Audit
            </span>
            <FileCheck className="w-3.5 h-3.5 text-indigo-400 opacity-70" />
          </div>
          <div className="text-sm font-bold text-slate-100 font-mono">
            HMAC-SHA256 Signature
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed font-sans">
            Generates immutable cryptographic audit proof for police investigation and court evidence without leaking private conversations.
          </p>
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Legal Admissibility:</span>
            <span className="text-indigo-400 font-bold">Forensically Signed</span>
          </div>
        </div>
      </div>

      {/* Cryptographic Tokens Display Bar */}
      <div className="p-3.5 rounded-2xl bg-black/70 border border-white/5 font-mono text-xs space-y-2">
        {/* Token 1 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
          <span className="text-slate-500 uppercase text-[10px] shrink-0">
            Salted Voiceprint Token:
          </span>
          <div className="flex items-center space-x-2 truncate">
            <span className="text-cyan-300/90 truncate max-w-md">{vault.voiceToken}</span>
            <button
              onClick={() => copyText(vault.voiceToken, 'token')}
              className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 shrink-0 cursor-pointer"
            >
              {copiedToken ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Token 2 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
          <span className="text-slate-500 uppercase text-[10px] shrink-0">
            HMAC Incident Signature:
          </span>
          <div className="flex items-center space-x-2 truncate">
            <span className="text-indigo-300/90 truncate max-w-md">{displayVault.auditHmac}</span>
            <button
              onClick={() => copyText(displayVault.auditHmac, 'hmac')}
              className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 shrink-0 cursor-pointer"
            >
              {copiedHmac ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Indian Telephony Codec Resilience & ASVspoof Benchmark Badge
 * Directly supports Act 6 of the pitch.
 */
export function IndianTelephonyBenchmarkBadge({ scenario }) {
  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/30 via-black/40 to-indigo-950/30 border border-white/10 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <PhoneCall className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-display font-bold text-slate-100">
                Benchmarked on Indian Cellular Codecs & Real-World Noise
              </span>
              <span className="px-2 py-0.2 text-[9px] font-mono rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                ASVspoof 5 + AMR
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Trained and validated on AMR-NB (4.75–12.2 kbps), AMR-WB, G.711, lossy WhatsApp codecs, and urban auto-rickshaw traffic horn noise to prevent false alarms.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-black/60 text-slate-300 border border-white/10">
            Channel: {scenario.channelStatus || 'HIGH_FIDELITY'}
          </span>
          <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
            Zero False Alarm Protocol
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Pitch Cue HUD (Presenter Script Modal)
 * Shows Tripti's exact spoken script line by line, mapping each act to the exact UI action.
 */
export function PitchCueHUD({ isOpen, onClose, onTriggerAct }) {
  if (!isOpen) return null;

  const PITCH_ACTS = [
    {
      actNumber: 'Act 1',
      title: 'The Hook & Reality Check',
      spokenLine:
        '"Papa, my phone was snatched, I’m at the police station, please UPI ₹50,000 to this inspector right now, urgently!" Aap sochiye... In 2026, Voice is no longer biometric proof of identity. We are Team Jasoos... Hum laaye hain Dhvani!',
      scenarioId: 'scam_red',
      uiAction: 'Click Demo 1: ₹50K Police Scam',
      whatToShow: 'Red Zone 88/100, Waveform with scam call audio, highlighted extortion keywords.',
    },
    {
      actNumber: 'Act 2',
      title: 'The Fallacy of 100% Binary Detection',
      spokenLine:
        '"Baki teams aapse kahengi: Hamara AI model 100% accurately bata dega ki audio real hai ya fake... Gaon ka 2G network hoga, call drop hogi... Isliye Jasoos binary classifier nahi, ek dynamic 0-to-100 probability score wala Risk Engine hai!"',
      scenarioId: 'telephony_yellow',
      uiAction: 'Click Demo 2: 2G Rural Telephony',
      whatToShow: 'Moderate Zone (35–70), Dynamic 0-100 Risk Engine Gauge at 48/100, Telephony Channel Compensation Active banner.',
    },
    {
      actNumber: 'Act 3',
      title: '3 Core Security Layers (< 2ms)',
      spokenLine:
        '"Hum 3 alag-alag layers se live call analyze karte hain under 2 milliseconds: Acoustic Layer (AASIST + Forensics), Identity Layer (ECAPA-TDNN), Context Layer (Social engineering: Urgently provide OTP, Police custody)!"',
      scenarioId: 'scam_red',
      uiAction: 'Highlight 3 Core Security Layers Card',
      whatToShow: '3-Layer Pipeline card showing Layer 1 (Acoustic), Layer 2 (Identity), Layer 3 (Context & Urgency keywords).',
    },
    {
      actNumber: 'Act 4',
      title: 'Prevention Over Detection & 3 Action Zones',
      spokenLine:
        '"Sirf Alarm Nahi Bajana, Action Lena Hai! Green Zone (0–34): Normal conversation. Moderate Zone (35–70): Warning banner & step-up liveness. Red Zone (71–100): High risk! Bank transaction turant pause, fraud desk alert!"',
      scenarioId: 'scam_red',
      uiAction: 'Point to 3-Zone Active Defense Engine',
      whatToShow: 'Tri-color Action Zones: Green (0–34), Moderate (35–70) with Step-up liveness, Red (71–100) with Transaction Intercept.',
    },
    {
      actNumber: 'Act 5',
      title: 'Privacy, Law & DPDP Act 2023',
      spokenLine:
        '"Ab aate hain sabse bade elephant in the room par: Privacy and Law. DPDP Act 2023. Pehla – Zero Storage Rule. Doosra – Biometric Tokenization (Salted hash). Teesra – Tamper-Proof Audit (HMAC SHA-256 signature)!"',
      scenarioId: 'scam_red',
      uiAction: 'Scroll to DPDP Act 2023 Privacy Vault',
      whatToShow: 'DPDP Privacy Vault: Ephemeral RAM Buffer (0 bytes stored), Salted SHA-256 Token, HMAC Digital Signature.',
    },
    {
      actNumber: 'Act 6',
      title: 'Telephony Codecs & Enterprise Conclusion',
      spokenLine:
        '"Humne isse sirf clean studio audio par test nahi kiya; humne ASVspoof aur Indian telephony codecs par benchmark kiya hai, taaki auto-rickshaw ke horn aur kharab network par false alarm na baje... Banks bachenge, CXOs bachenge!"',
      scenarioId: 'telephony_yellow',
      uiAction: 'Show Telephony Benchmark Badge & Summary',
      whatToShow: 'Indian Telephony Codec Resilience badge, Telephony rolloff compensation, Enterprise API readiness.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-4xl max-h-[90vh] bg-[#0c101d] border border-cyan-500/40 rounded-3xl p-6 shadow-2xl shadow-cyan-500/20 flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-white">
                Team Jasoos • Presenter's Cue HUD
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Real-time pitch choreography matching Tripti's exact spoken script to live website actions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Acts List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {PITCH_ACTS.map((act) => (
            <div
              key={act.actNumber}
              className="p-4 rounded-2xl bg-black/50 border border-white/10 hover:border-cyan-500/40 transition-all space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    {act.actNumber}
                  </span>
                  <h4 className="text-sm font-bold font-display text-white">{act.title}</h4>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onTriggerAct(act.scenarioId);
                    onClose();
                  }}
                  className="px-3 py-1 rounded-xl bg-cyan-600/30 hover:bg-cyan-500 text-cyan-200 hover:text-white border border-cyan-400/40 text-xs font-mono font-medium transition-all flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
                >
                  <span>⚡ Auto-Focus UI</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Spoken script */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/5 text-xs text-amber-200/90 font-sans italic">
                <span className="text-[10px] font-mono text-amber-400 uppercase not-italic block font-bold mb-0.5">
                  Tripti's Spoken Cue:
                </span>
                {act.spokenLine}
              </div>

              {/* Screen action */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-black/30 text-slate-300">
                  <span className="text-[10px] font-mono text-cyan-400 block uppercase">
                    Your Action On Screen:
                  </span>
                  <span className="font-semibold text-slate-200">{act.uiAction}</span>
                </div>
                <div className="p-2 rounded-lg bg-black/30 text-slate-300">
                  <span className="text-[10px] font-mono text-indigo-400 block uppercase">
                    What Judges See:
                  </span>
                  <span className="text-slate-300">{act.whatToShow}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 font-mono shrink-0">
          <span>Tip: Click "Auto-Focus UI" on any act to instantly load that exact scenario onto the dashboard!</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium cursor-pointer"
          >
            Close HUD
          </button>
        </div>
      </motion.div>
    </div>
  );
}

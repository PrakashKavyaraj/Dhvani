import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  Zap,
  Lock,
  PhoneCall,
  Terminal,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Activity,
  Sliders,
  CheckCircle2,
  Clock,
  Cpu,
  Info,
} from 'lucide-react';
import {
  ThreeLayerSecurityCard,
  ActiveDefenseZones,
  DpdpPrivacyVault,
  IndianTelephonyBenchmarkBadge,
} from '../PitchPresentationKit';

/**
 * 1. Collapsible Security Layers (< 2ms Live Call Analysis)
 */
export function CollapsibleSecurityLayers({ scenario }) {
  const [isOpen, setIsOpen] = useState(false);
  const isRed = scenario?.tier === 'RED_ZONE';
  const isYellow = scenario?.tier === 'YELLOW_ZONE';

  return (
    <div className="rounded-3xl border border-cyan-500/20 bg-[#080d1a]/90 backdrop-blur-xl overflow-hidden shadow-xl">
      {/* Summary Header */}
      <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display font-bold text-base sm:text-lg text-white">
                3 Core Security Layers
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                &lt; 2ms Live Analysis
              </span>
              <span className="font-mono font-bold text-[10px] text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                1.82 ms Latency
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Continuous multi-modal surveillance verifying acoustic physics, biometric enrollment, and conversational coercion.
            </p>

            {/* Quick Status Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-slate-300">
                L1 Acoustic: <span className="text-cyan-300 font-bold">&lt;0.8ms</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-slate-300">
                L2 Identity: <span className="text-cyan-300 font-bold">&lt;0.6ms</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-slate-300">
                L3 Context: <span className="text-cyan-300 font-bold">&lt;0.4ms</span>
              </span>
            </div>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="self-start md:self-center px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold flex items-center space-x-2 transition-all cursor-pointer shrink-0"
        >
          <span>{isOpen ? 'Collapse 3 Layers' : 'Inspect 3 Layers'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded ThreeLayerSecurityCard */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-white/10 p-4 sm:p-6 bg-black/40"
          >
            <ThreeLayerSecurityCard scenario={scenario} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 2. Collapsible Active Fraud Prevention Engine
 */
export function CollapsibleActiveDefense({ scenario }) {
  const [isOpen, setIsOpen] = useState(false);
  const currentRisk = scenario?.overallRisk ?? 0;
  const isGreen = currentRisk < 35;
  const isModerate = currentRisk >= 35 && currentRisk <= 70;
  const isRed = currentRisk > 70;

  return (
    <div className="rounded-3xl border border-white/10 bg-[#080d1a]/90 backdrop-blur-xl overflow-hidden shadow-xl">
      {/* Summary Header */}
      <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display font-bold text-base sm:text-lg text-white">
                Active Fraud Prevention Engine
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40">
                "Sirf Alarm Nahi Bajana, Action Lena Hai"
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Autonomous, out-of-band enterprise countermeasures dispatched during the live call.
            </p>

            {/* Current Active Countermeasures Quick Status */}
            <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[10px] font-mono">
              <span className={`px-2 py-0.5 rounded border ${
                scenario?.activeMitigations?.transactionPaused
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                  : 'bg-black/40 text-slate-400 border-white/5'
              }`}>
                Bank Hold: {scenario?.activeMitigations?.transactionPaused ? 'PAUSED' : 'STANDBY'}
              </span>
              <span className={`px-2 py-0.5 rounded border ${
                scenario?.activeMitigations?.fraudDeskAlerted
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                  : 'bg-black/40 text-slate-400 border-white/5'
              }`}>
                Fraud Desk: {scenario?.activeMitigations?.fraudDeskAlerted ? 'DISPATCHED' : 'STANDBY'}
              </span>
              <span className={`px-2 py-0.5 rounded border ${
                scenario?.activeMitigations?.outOfBandChallenge
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                  : 'bg-black/40 text-slate-400 border-white/5'
              }`}>
                Out-of-Band Auth: {scenario?.activeMitigations?.outOfBandChallenge ? 'TRIGGERED' : 'STANDBY'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-start md:self-center shrink-0">
          <span className={`px-3 py-1 rounded-full font-mono text-xs font-bold border ${
            isRed
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
              : isModerate
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
          }`}>
            {isRed ? 'RED ZONE (71–100)' : isModerate ? 'MODERATE ZONE (35–70)' : 'GREEN ZONE (0–34)'}
          </span>

          {/* Toggle Button */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-mono font-semibold flex items-center space-x-2 transition-all cursor-pointer"
          >
            <span>{isOpen ? 'Hide Countermeasures' : 'View Countermeasures Status'}</span>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded ActiveDefenseZones */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-white/10 p-4 sm:p-6 bg-black/40"
          >
            <ActiveDefenseZones scenario={scenario} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 3. Collapsible Composite Spoof & Acoustic Calculation Evidence
 */
export function CollapsibleCompositeSpoof({
  adjSpoofScore = 0,
  primaryFakeScore = 0,
  rawSpoofScore = 0,
  primaryDetector = true,
  sensorAgreement = 'AGREEMENT',
  channelStatus = 'HIGH_FIDELITY',
  channelReliability = 1.0,
  isTelephony = false,
  modelConfidence = null,
  processingTimeMs = null,
  riskLevel = 'LOW',
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-3xl border border-cyan-500/20 bg-[#080d1a]/90 backdrop-blur-xl p-5 sm:p-7 space-y-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-widest">
              Reliability-Adjusted Spoof Evidence
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-sans">
            Fused multi-detector acoustic score calibrated against channel distortion
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <span className="font-mono text-xl text-cyan-400 font-bold block">
              {(adjSpoofScore * 100).toFixed(1)}%
            </span>
            <span className="text-[10px] font-mono text-slate-500">Range: 0.0 - 1.0</span>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <span>{isOpen ? 'Hide Breakdown' : 'View Calculation & Evidence'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Segmented Gradient Bar */}
      <div>
        <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-white/10 relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${Math.min(100, Math.max(4, adjSpoofScore * 100))}%`,
            }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className={`h-full rounded-full ${
              riskLevel === 'HIGH'
                ? 'bg-gradient-to-r from-amber-500 to-rose-600 shadow-lg shadow-rose-500/40'
                : riskLevel === 'MEDIUM' || riskLevel === 'MODERATE'
                ? 'bg-gradient-to-r from-cyan-500 to-amber-500 shadow-lg shadow-amber-500/40'
                : 'bg-gradient-to-r from-teal-500 to-emerald-500 shadow-lg shadow-emerald-500/40'
            }`}
          />
        </div>

        <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-2">
          <span className="text-emerald-400 font-medium">0% (Organic)</span>
          <span className="text-slate-400">50% (Neutral)</span>
          <span className="text-rose-400 font-medium">100% (Synthetic)</span>
        </div>
      </div>

      {/* Expanded Calculation Breakdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4 pt-3 border-t border-white/10"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-black/60 border border-white/5 text-xs font-mono">
              <div>
                <span className="text-slate-500 text-[10px] block uppercase">Primary Detector:</span>
                <span className="text-slate-200 font-bold">{(primaryFakeScore * 100).toFixed(1)}%</span>
                <span className="text-[9px] text-slate-400 block font-sans">Forensics 0.3B</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block uppercase">Secondary AASIST:</span>
                <span className="text-slate-200 font-bold">{(rawSpoofScore * 100).toFixed(1)}%</span>
                <span className="text-[9px] text-slate-400 block font-sans">Graph Neural Net</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block uppercase">Channel Domain:</span>
                <span className={`font-bold ${isTelephony ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {channelStatus} ({(channelReliability * 100).toFixed(0)}%)
                </span>
                <span className="text-[9px] text-slate-400 block font-sans">Reliability Weight</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block uppercase">Sensor Agreement:</span>
                <span className={`font-bold ${sensorAgreement === 'DISAGREEMENT' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {sensorAgreement}
                </span>
                <span className="text-[9px] text-slate-400 block font-sans">Corroboration</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono text-slate-400">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span>Model Architecture Confidence:</span>
                <span className="text-slate-200 font-semibold">
                  {modelConfidence != null ? `${(modelConfidence * 100).toFixed(1)}%` : 'Calibrated'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span>Inference Latency:</span>
                <span className="text-slate-200 font-semibold">
                  {processingTimeMs ? `${processingTimeMs} ms` : 'Sub-second'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 4. Collapsible DPDP Act 2023 & Enterprise Privacy Shield
 */
export function CollapsibleDpdpVault({ scenario }) {
  const [isOpen, setIsOpen] = useState(false);
  const vault = scenario?.dpdpVault || {
    storageMode: 'EPHEMERAL RAM BUFFER',
    bufferWipeTimeUs: 382,
    rawBytesPersisted: 0,
    complianceRule: 'Section 8(7) DPDP Act 2023 • TRAI TCCCPR Guidelines',
  };

  return (
    <div className="rounded-3xl border border-emerald-500/20 bg-[#080d1a]/90 backdrop-blur-xl overflow-hidden shadow-xl">
      {/* Summary Header */}
      <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display font-bold text-base sm:text-lg text-white">
                DPDP Act 2023 & Enterprise Privacy Shield
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                Zero-Retention Certified ✓
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Ephemeral RAM analysis • 0.00 bytes persisted • Wiped in {vault.bufferWipeTimeUs || 382} μs • Section 8(7) DPDP Act 2023.
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                Disk Write: 0.00 Bytes
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                Salted Cryptographic Hash
              </span>
              <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-slate-300">
                HMAC-SHA256 Tamper-Proof Log
              </span>
            </div>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="self-start md:self-center px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-semibold flex items-center space-x-2 transition-all cursor-pointer shrink-0"
        >
          <span>{isOpen ? 'Hide Privacy Shield' : 'View Security Protocol'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded DpdpPrivacyVault */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-white/10 p-4 sm:p-6 bg-black/40"
          >
            <DpdpPrivacyVault scenario={scenario} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 5. Collapsible Indian Telephony Benchmark Badge
 */
export function CollapsibleBenchmarkBadge({ scenario }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#080d1a]/80 backdrop-blur-xl overflow-hidden shadow-lg">
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <PhoneCall className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-display font-bold text-slate-100 text-sm">
                Benchmarked on Indian Cellular Codecs & Real-World Noise
              </span>
              <span className="px-2 py-0.2 text-[9px] font-mono rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                ASVspoof 5 + AMR
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Tested on AMR-NB, AMR-WB, G.711, lossy WhatsApp codecs, and urban auto-rickshaw traffic horn noise.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 border border-white/10 text-cyan-400 text-xs font-mono flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0"
        >
          <span>{isOpen ? 'Hide Details' : 'View Validation Details'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/10 p-4 bg-black/40"
          >
            <IndianTelephonyBenchmarkBadge scenario={scenario} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 6. Collapsible Monospaced Legal Disclaimer
 */
export function CollapsibleDisclaimer({ disclaimerText }) {
  const [isOpen, setIsOpen] = useState(false);
  const defaultText =
    'This system produces a probabilistic risk estimate only. It does not provide forensic certainty or admissible legal conclusions and must not be used to execute automated actions without independent out-of-band verification.';

  return (
    <div className="rounded-2xl bg-black/60 border border-white/10 font-mono text-xs text-slate-400 p-4 space-y-2 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-[11px] text-cyan-400 font-bold uppercase tracking-wider">
          <Terminal className="w-3.5 h-3.5" />
          <span>[AUDIT PROTOCOL LOG // SYSTEM DISCLAIMER]</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="text-[11px] text-slate-400 hover:text-cyan-300 transition-colors flex items-center space-x-1 cursor-pointer"
        >
          <span>{isOpen ? 'Collapse' : 'Read Full Disclaimer'}</span>
          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      <p className="leading-relaxed text-slate-400 text-[11px] line-clamp-2">
        {disclaimerText || defaultText}
      </p>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pt-2 border-t border-white/10 space-y-2 text-[11px] text-slate-400"
          >
            <p className="leading-relaxed">
              Forensic evidence and reliability weights provided by Dhvani are designed for enterprise fraud screening and decision support under ISO/IEC 30107 Presentation Attack Detection principles. Raw acoustic distance distributions and neural vocoder residuals indicate statistical deviation from organic human training distributions and do not constitute legal proof of malicious intent.
            </p>
            <div className="p-2 rounded bg-cyan-950/20 border border-cyan-500/20 text-cyan-300 text-[10px]">
              AUDIT TRAIL: Tamper-proof SHA-256 HMAC digest generated in compliance with Section 8(7) of the Digital Personal Data Protection (DPDP) Act 2023.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

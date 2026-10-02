import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  Radio,
  PhoneCall,
  Mic,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Cpu,
  Fingerprint,
  Activity,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

export function MultiModalEvidenceModules({
  primaryFakeScore = 0,
  rawSpoofScore = 0,
  primaryDetector = true,
  sensorAgreement = 'AGREEMENT',
  channelStatus = 'HIGH_FIDELITY',
  channelReliability = 1.0,
  isTelephony = false,
  speakerSimilarity = null,
  speakerRawSimilarity = null,
  speakerStatus = 'BASELINE',
  windowsAnalyzed = 1,
  decisionAction = 'ALLOW',
  overallRisk = 0,
  scenario = {},
}) {
  // State for expanded module details (can expand individual or all)
  const [expandedModule, setExpandedModule] = useState(null);

  const toggleModule = (moduleName) => {
    setExpandedModule((prev) => (prev === moduleName ? null : moduleName));
  };

  const isBlock = decisionAction === 'BLOCK';
  const isVerify = decisionAction === 'VERIFY';

  const vocoderFootprint =
    scenario.vocoderFootprint ||
    (primaryFakeScore >= 0.7
      ? 'NEURAL_DIFFUSION_RESIDUALS'
      : primaryFakeScore >= 0.35
      ? 'SPECTRAL_INCONSISTENCY'
      : 'ORGANIC_VOCAL_TRACT');

  const phaseGlitch =
    scenario.phaseGlitchDetected != null
      ? scenario.phaseGlitchDetected
      : primaryFakeScore >= 0.5;

  const telephonyCodec = scenario.telephonyCodec || (isTelephony ? 'AMR-NB (Telephony 3.4kHz Cutoff)' : 'PCM 16kHz Uncompressed');

  return (
    <div className="space-y-4" id="multimodal-evidence-section">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-display font-bold text-white flex items-center gap-2">
              DHVANI Multi-Modal Evidence Architecture
            </h3>
            <p className="text-xs text-slate-400 font-sans">
              Level 2 Evidence Modules • 4 Forensic Pillars with 1-Click Technical Drilldown
            </p>
          </div>
        </div>

        {/* Unified Decision Badge */}
        <div className="flex items-center space-x-2 self-start sm:self-center">
          <span className="text-[11px] font-mono text-slate-400">Autonomous Decision:</span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold border flex items-center gap-1.5 shadow-sm ${
              isBlock
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-950/40'
                : isVerify
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-950/40'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-950/40'
            }`}
          >
            {isBlock ? (
              <ShieldAlert className="w-3.5 h-3.5" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span>{isVerify ? 'UNCERTAIN / VERIFY' : decisionAction}</span>
            <span className="opacity-60 text-[10px]">({overallRisk}/100)</span>
          </span>
        </div>
      </div>

      {/* 4 Responsive Forensic Pillar Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pillar 1: Acoustic Authenticity */}
        <div
          className={`rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
            expandedModule === 'acoustic'
              ? 'bg-[#0c1222] border-cyan-500/50 shadow-lg shadow-cyan-950/30'
              : 'bg-[#080d1a]/80 border-white/10 hover:border-cyan-500/30'
          }`}
        >
          <div className="p-4 sm:p-5 flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                1. Acoustic
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  primaryFakeScore >= 0.7
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-bold'
                    : primaryFakeScore >= 0.35
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {primaryFakeScore >= 0.7 ? 'Synthetic' : primaryFakeScore >= 0.35 ? 'Uncertain' : 'Organic'}
              </span>
            </div>

            <div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-display font-bold text-white font-mono">
                  {(primaryFakeScore * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-400 font-sans">spoof evidence</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-sans line-clamp-1">
                {primaryDetector ? 'Primary (Forensics 0.3B)' : 'AASIST-L Graph Neural'}
              </p>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Corroboration:</span>
              <span className={sensorAgreement === 'DISAGREEMENT' ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                {sensorAgreement === 'DISAGREEMENT' ? 'Disagreement' : 'AASIST Corroborating'}
              </span>
            </div>
          </div>

          {/* Expand Details Trigger */}
          <button
            type="button"
            onClick={() => toggleModule('acoustic')}
            className="w-full py-2 px-4 bg-black/40 hover:bg-black/60 border-t border-white/10 text-xs font-mono text-cyan-400 flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>{expandedModule === 'acoustic' ? 'Collapse Details' : 'Inspect Evidence'}</span>
            {expandedModule === 'acoustic' ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Expanded Technical Details Panel */}
          <AnimatePresence>
            {expandedModule === 'acoustic' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-black/80 p-4 border-t border-cyan-500/20 text-xs font-mono space-y-2.5"
              >
                <div className="flex justify-between pb-1 border-b border-white/10">
                  <span className="text-slate-400">Primary Detector:</span>
                  <span className="text-slate-200 font-bold">{(primaryFakeScore * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between pb-1 border-b border-white/10">
                  <span className="text-slate-400">Secondary AASIST-L:</span>
                  <span className="text-slate-200 font-bold">{(rawSpoofScore * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between pb-1 border-b border-white/10">
                  <span className="text-slate-400">Phase Discontinuity:</span>
                  <span className={phaseGlitch ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {phaseGlitch ? 'FLAGGED (Glitch)' : 'CLEAN (Organic)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Neural Vocoder Footprint:</span>
                  <span className="text-cyan-300 text-[11px] block mt-0.5 break-all">
                    {vocoderFootprint}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Pillar 2: Channel Domain */}
        <div
          className={`rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
            expandedModule === 'channel'
              ? 'bg-[#0c1222] border-amber-500/50 shadow-lg shadow-amber-950/30'
              : isTelephony
              ? 'bg-amber-950/15 border-amber-500/30'
              : 'bg-[#080d1a]/80 border-white/10 hover:border-cyan-500/30'
          }`}
        >
          <div className="p-4 sm:p-5 flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                2. Channel
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  isTelephony
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-bold'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {channelStatus}
              </span>
            </div>

            <div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-display font-bold text-white font-mono">
                  {(channelReliability * 100).toFixed(0)}%
                </span>
                <span className="text-xs text-slate-400 font-sans">channel reliability</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-sans line-clamp-1">
                {isTelephony ? 'Down-weighted (AMR 3.4kHz)' : 'High Fidelity Wideband (16kHz)'}
              </p>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Bandwidth:</span>
              <span className="text-slate-300">
                {isTelephony ? '300Hz - 3.4kHz' : '20Hz - 20kHz'}
              </span>
            </div>
          </div>

          {/* Expand Details Trigger */}
          <button
            type="button"
            onClick={() => toggleModule('channel')}
            className="w-full py-2 px-4 bg-black/40 hover:bg-black/60 border-t border-white/10 text-xs font-mono text-amber-400 flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>{expandedModule === 'channel' ? 'Collapse Details' : 'Inspect Evidence'}</span>
            {expandedModule === 'channel' ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Expanded Technical Details Panel */}
          <AnimatePresence>
            {expandedModule === 'channel' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-black/80 p-4 border-t border-amber-500/20 text-xs font-mono space-y-2.5"
              >
                <div className="flex justify-between pb-1 border-b border-white/10">
                  <span className="text-slate-400">Detected Codec:</span>
                  <span className="text-slate-200 font-bold">{telephonyCodec}</span>
                </div>
                <div className="flex justify-between pb-1 border-b border-white/10">
                  <span className="text-slate-400">Reliability Weight:</span>
                  <span className="text-amber-300 font-bold">{channelReliability.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between pb-1 border-b border-white/10">
                  <span className="text-slate-400">False-Alarm Guard:</span>
                  <span className="text-emerald-400 font-bold">ACTIVE</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                  Lossy telephone codec cutoff down-weights acoustic spoofing evidence to prevent false positives on cellular calls.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Pillar 3: Speaker Identity */}
        <div
          className={`rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
            expandedModule === 'identity'
              ? 'bg-[#0c1222] border-cyan-500/50 shadow-lg shadow-cyan-950/30'
              : 'bg-[#080d1a]/80 border-white/10 hover:border-cyan-500/30'
          }`}
        >
          <div className="p-4 sm:p-5 flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-cyan-400" />
                3. Identity
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  speakerStatus === 'VOICE_SWAP_DETECTED'
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-bold'
                    : speakerSimilarity != null && speakerSimilarity >= 0.75
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                }`}
              >
                {speakerStatus === 'VOICE_SWAP_DETECTED'
                  ? 'Voice Swap'
                  : speakerSimilarity != null && speakerSimilarity >= 0.75
                  ? 'Enrolled Match'
                  : 'ECAPA-TDNN'}
              </span>
            </div>

            <div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-display font-bold text-white font-mono">
                  {speakerSimilarity != null ? `${(speakerSimilarity * 100).toFixed(1)}%` : 'Baseline'}
                </span>
                <span className="text-xs text-slate-400 font-sans">similarity score</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-sans line-clamp-1">
                ECAPA-TDNN 192-dim x-vector embedding
              </p>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Cosine Metric:</span>
              <span className="text-slate-300">
                {speakerRawSimilarity != null ? `cos: ${speakerRawSimilarity.toFixed(2)}` : 'Enrollment Print'}
              </span>
            </div>
          </div>

          {/* Expand Details Trigger */}
          <button
            type="button"
            onClick={() => toggleModule('identity')}
            className="w-full py-2 px-4 bg-black/40 hover:bg-black/60 border-t border-white/10 text-xs font-mono text-cyan-400 flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>{expandedModule === 'identity' ? 'Collapse Details' : 'Inspect Evidence'}</span>
            {expandedModule === 'identity' ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Expanded Technical Details Panel */}
          <AnimatePresence>
            {expandedModule === 'identity' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-black/80 p-4 border-t border-cyan-500/20 text-xs font-mono space-y-2.5"
              >
                <div className="flex justify-between pb-1 border-b border-white/10">
                  <span className="text-slate-400">Embedding Engine:</span>
                  <span className="text-slate-200 font-bold">ECAPA-TDNN</span>
                </div>
                <div className="flex justify-between pb-1 border-b border-white/10">
                  <span className="text-slate-400">Enrollment Cosine:</span>
                  <span className="text-slate-200 font-bold">
                    {scenario.enrollmentCosine != null ? scenario.enrollmentCosine.toFixed(2) : '0.54'}
                  </span>
                </div>
                <div className="flex justify-between pb-1 border-b border-white/10">
                  <span className="text-slate-400">Voice-Swap Guard:</span>
                  <span className={speakerStatus === 'VOICE_SWAP_DETECTED' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {speakerStatus === 'VOICE_SWAP_DETECTED' ? 'ALERT (Divergent)' : 'MATCH (Enrolled)'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                  Deep speaker verification compares raw acoustic embeddings against enrolled family/executive voiceprints.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Pillar 4: Temporal Consistency */}
        <div
          className={`rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
            expandedModule === 'temporal'
              ? 'bg-[#0c1222] border-cyan-500/50 shadow-lg shadow-cyan-950/30'
              : 'bg-[#080d1a]/80 border-white/10 hover:border-cyan-500/30'
          }`}
        >
          <div className="p-4 sm:p-5 flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                4. Temporal
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-cyan-500/15 text-cyan-300 border-cyan-500/30">
                Rolling Pool
              </span>
            </div>

            <div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-display font-bold text-white font-mono">
                  {windowsAnalyzed} {windowsAnalyzed === 1 ? 'Window' : 'Windows'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-sans line-clamp-1">
                Multi-window temporal pool (125ms stride)
              </p>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Drift & Decay:</span>
              <span className="text-slate-300">Exponential Memory</span>
            </div>
          </div>

          {/* Expand Details Trigger */}
          <button
            type="button"
            onClick={() => toggleModule('temporal')}
            className="w-full py-2 px-4 bg-black/40 hover:bg-black/60 border-t border-white/10 text-xs font-mono text-cyan-400 flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>{expandedModule === 'temporal' ? 'Collapse Details' : 'Inspect Evidence'}</span>
            {expandedModule === 'temporal' ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Expanded Technical Details Panel */}
          <AnimatePresence>
            {expandedModule === 'temporal' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-black/80 p-4 border-t border-cyan-500/20 text-xs font-mono space-y-2.5"
              >
                <div className="flex justify-between pb-1 border-b border-white/10">
                  <span className="text-slate-400">Stride Interval:</span>
                  <span className="text-slate-200 font-bold">125 ms</span>
                </div>
                <div className="flex justify-between pb-1 border-b border-white/10">
                  <span className="text-slate-400">Buffer Window:</span>
                  <span className="text-slate-200 font-bold">3.0 s In-Memory</span>
                </div>
                <div className="flex justify-between pb-1 border-b border-white/10">
                  <span className="text-slate-400">Temporal Consistency:</span>
                  <span className="text-emerald-400 font-bold">STABLE</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                  Prevents flash false-alarms by aggregating sliding inference windows across conversational turn duration.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

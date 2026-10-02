import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  PhoneCall,
  Activity,
  ChevronDown,
  Info,
  Clock,
  Cpu,
  Lock,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

// Smooth spring-based counter hook
function useCountUp(targetValue, duration = 1.2) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = performance.now();
    const startVal = displayValue;
    const endVal = typeof targetValue === 'number' ? targetValue : 0;

    let frameId;
    const update = (now) => {
      const elapsed = (now - startTime) / (duration * 1000);
      if (elapsed < 1) {
        // Ease out quad
        const progress = 1 - (1 - elapsed) * (1 - elapsed);
        setDisplayValue(startVal + (endVal - startVal) * progress);
        frameId = requestAnimationFrame(update);
      } else {
        setDisplayValue(endVal);
      }
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [targetValue, duration]);

  return displayValue;
}

export function ForensicExecutiveSummary({
  score = 0,
  riskLevel = 'LOW',
  recommendation = '',
  analysisId = '',
  isTelephony = false,
  channelReliability = 1.0,
  modelConfidence = null,
  processingTimeMs = null,
  decisionAction = 'ALLOW',
  onScrollToEvidence = null,
}) {
  const animatedScore = useCountUp(score, 1.4);
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const strokeProgress = (score / 100) * circumference;

  const isRed = riskLevel === 'HIGH';
  const isYellow = riskLevel === 'MEDIUM' || riskLevel === 'MODERATE';
  const isGreen = !isRed && !isYellow;

  const colors = isRed
    ? {
        stroke: '#f43f5e',
        gradientStart: '#fb7185',
        gradientEnd: '#e11d48',
        shadow: 'rgba(244, 63, 94, 0.4)',
        badge: 'bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-rose-950/40',
        label: 'HIGH RISK • SYNTHETIC EVIDENCE FLAGGED',
        bannerBg: 'bg-gradient-to-r from-rose-950/40 via-red-950/25 to-black/60 border-rose-600/40 text-rose-100',
        iconBg: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
        accentText: 'text-rose-400',
      }
    : isYellow
    ? {
        stroke: '#f59e0b',
        gradientStart: '#fbbf24',
        gradientEnd: '#d97706',
        shadow: 'rgba(245, 158, 11, 0.35)',
        badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-amber-950/40',
        label: 'MODERATE ZONE (35–70) • STEP-UP LIVENESS',
        bannerBg: 'bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-black/60 border-amber-500/40 text-amber-100',
        iconBg: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
        accentText: 'text-amber-400',
      }
    : {
        stroke: '#10b981',
        gradientStart: '#06b6d4',
        gradientEnd: '#10b981',
        shadow: 'rgba(16, 185, 129, 0.3)',
        badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-emerald-950/40',
        label: 'LOW RISK • LIKELY AUTHENTIC HUMAN',
        bannerBg: 'bg-gradient-to-r from-emerald-950/40 via-teal-950/25 to-black/60 border-emerald-500/40 text-emerald-100',
        iconBg: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
        accentText: 'text-emerald-400',
      };

  const classificationProtocol =
    score <= 39
      ? 'Likely Authentic Human Speech'
      : score <= 69
      ? 'Uncertain / Secondary Liveness Verification Advised'
      : 'Elevated Synthetic / Cloned Voice Characteristics';

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative rounded-3xl p-6 sm:p-8 bg-[#090d16]/90 border border-cyan-500/30 backdrop-blur-2xl shadow-[0_0_50px_rgba(6,182,212,0.08)] overflow-hidden"
    >
      {/* Subtle Top Ambient Neon Glow */}
      <div
        className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80"
      />

      {/* Header Tag Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-white/10">
        <div className="flex items-center space-x-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-300">
            Level 1 • Executive Forensic Assessment
          </span>
          <span className="hidden sm:inline-block text-slate-600 font-mono">•</span>
          <span className="hidden sm:inline-block font-mono text-xs px-2.5 py-0.5 rounded-full bg-black/40 border border-white/10 text-slate-300">
            ID: {analysisId ? `${analysisId.slice(0, 8)}...` : 'LIVE-STREAM'}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="text-slate-400">Model Confidence:</span>
          <span className="text-slate-200 font-bold px-2 py-0.5 rounded bg-black/50 border border-white/10">
            {modelConfidence != null ? `${(modelConfidence * 100).toFixed(1)}%` : 'Calibrated'}
          </span>
          {processingTimeMs && (
            <span className="text-slate-400 hidden sm:inline">
              ({processingTimeMs}ms)
            </span>
          )}
        </div>
      </div>

      {/* Two-Column Responsive Focal Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-6">
        {/* Left Column: High-Impact Circular Gauge (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center text-center">
          <div className="relative w-52 h-52 sm:w-60 sm:h-60 flex items-center justify-center">
            {/* Ambient Radial Blur */}
            <div
              className="absolute inset-4 rounded-full blur-3xl opacity-50 transition-all duration-1000 pointer-events-none"
              style={{ background: colors.shadow }}
            />

            <svg className="w-full h-full -rotate-90" viewBox="0 0 180 180">
              <defs>
                <linearGradient id="execGaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={colors.gradientStart} />
                  <stop offset="100%" stopColor={colors.gradientEnd} />
                </linearGradient>
                <filter id="execGaugeGlow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Background Track */}
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.07)"
                strokeWidth="11"
              />

              {/* Animated Progress Arc */}
              <motion.circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="url(#execGaugeGrad)"
                strokeWidth="11"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference - strokeProgress }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                filter="url(#execGaugeGlow)"
              />
            </svg>

            {/* Inner Counter Readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-5xl sm:text-6xl font-display font-extrabold tracking-tight font-mono transition-colors duration-500"
                style={{ color: colors.stroke }}
              >
                {Math.round(animatedScore)}
              </span>
              <span className="text-[11px] font-mono text-slate-400 mt-0.5 uppercase tracking-widest">
                Risk Index / 100
              </span>
              <span className={`mt-2 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                decisionAction === 'BLOCK'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : decisionAction === 'VERIFY'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                ACTION: {decisionAction}
              </span>
            </div>
          </div>

          <div className="mt-4 text-center">
            <span className={`inline-block px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wider border shadow-lg ${colors.badge}`}>
              {colors.label}
            </span>
            <p className="text-xs text-slate-300 mt-2 font-sans">
              <span className="text-slate-400">Classification: </span>
              <span className="font-semibold text-slate-100">{classificationProtocol}</span>
            </p>
          </div>
        </div>

        {/* Right Column: Operational Directive & Contextual Alerts (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Operational Recommendation Banner */}
          <div className={`p-5 rounded-2xl border backdrop-blur-xl flex items-start space-x-4 shadow-xl ${colors.bannerBg}`}>
            <div className={`p-3 rounded-xl shrink-0 mt-0.5 ${colors.iconBg}`}>
              {isRed ? (
                <ShieldAlert className="w-6 h-6" />
              ) : isYellow ? (
                <Shield className="w-6 h-6" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-display font-bold uppercase tracking-wider opacity-90 flex items-center gap-1.5">
                  Forensic Protocol Recommendation
                </h4>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                  isRed
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    : isYellow
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                }`}>
                  {isRed ? 'CRITICAL INTERCEPT' : isYellow ? 'STEP-UP CHALLENGE' : 'STREAM VERIFIED'}
                </span>
              </div>
              <p className="text-sm font-medium leading-relaxed font-sans text-slate-100">
                {recommendation ||
                  (isRed
                    ? 'CRITICAL SECURITY INTERCEPT: High probability voice deepfake detected. Automated bank transaction pause and fraud desk alert dispatched.'
                    : isYellow
                    ? 'UNCERTAIN SPEECH EVIDENCE: Secondary verification or out-of-band challenge advised before authorizing privileged transactions.'
                    : 'AUTHENTIC SIGNAL DETECTED: Consistent acoustic vocal tract physics with zero significant synthetic vocoder footprint.')}
              </p>
            </div>
          </div>

          {/* Telephony Channel Compensation Alert (When Active) */}
          {isTelephony && (
            <div className="p-4 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-amber-900/20 to-black/50 text-amber-100 flex items-start gap-3.5 shadow-lg">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
                <PhoneCall className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold uppercase tracking-wider text-amber-300">
                    Telephony Channel Compensation Active ({Math.round(channelReliability * 100)}% Reliability)
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Down-Weighted
                  </span>
                </div>
                <p className="text-amber-200/90 font-sans leading-relaxed">
                  Cellular/AMR channel detected. Acoustic spoof scores are down-weighted to prevent false alarms from lossy telephone codec cutoffs (3.4kHz).
                </p>
              </div>
            </div>
          )}

          {/* Scientific Disclaimer & Quick Drilldown Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-black/50 border border-white/10 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/30 shrink-0">
                FORENSIC PRINCIPLE
              </span>
              <span className="text-slate-200 font-medium font-sans">
                Model Evidence ≠ Probability of Fraud
              </span>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 shrink-0">
              ISO/IEC 30107 Calibrated
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Action Prompt to View Evidence */}
      {onScrollToEvidence && (
        <div className="mt-6 pt-4 border-t border-white/10 flex justify-center">
          <button
            type="button"
            onClick={onScrollToEvidence}
            className="group inline-flex items-center space-x-2 text-xs font-mono font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            <span>Inspect Multi-Modal Evidence Breakdown</span>
            <ChevronDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
          </button>
        </div>
      )}
    </motion.section>
  );
}

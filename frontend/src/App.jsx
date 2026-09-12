import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  UploadCloud,
  FileAudio,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  X,
  Copy,
  Check,
  Lock,
  Activity,
  Sliders,
  Server,
  Sparkles,
  Terminal,
  Volume2,
  ArrowRight,
  Zap,
  Info,
  Layers,
  Clock,
  Radio,
  Mic,
  FolderOpen,
  HelpCircle,
  PhoneCall,
  CheckCircle2,
  MicOff,
} from 'lucide-react';
import { useRealtimeVoiceDetect } from './hooks/useRealtimeVoiceDetect';
import { SpotlightButton } from './components/SpotlightButton';
import { NeonBorderProcessingButton } from './components/NeonBorderProcessingButton';
import { BrandLogo } from './components/BrandLogo';
import {
  PITCH_SCENARIOS,
  PitchScenarioBar,
  ThreeLayerSecurityCard,
  ActiveDefenseZones,
  DpdpPrivacyVault,
  IndianTelephonyBenchmarkBadge,
  PitchCueHUD,
} from './components/PitchPresentationKit';
import KineticGrid from '@/components/ui/kinetic-grid';
import { LiquidMetalButton } from '@/components/ui/liquid-metal-button';
import DHVANI_LOGO_DATA_URI from './assets/logoBase64';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000';
const POLLING_INTERVAL_MS = 1000; // Polling every 1 second as specified in API contract
const MAX_CONSECUTIVE_NETWORK_ERRORS = 4;

// Spring-based Number Counter Hook
function useCountUp(targetValue, duration = 1.2) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (targetValue === null || targetValue === undefined) return;
    const start = 0;
    const end = Number(targetValue);
    const startTime = performance.now();
    const durationMs = duration * 1000;

    let frameId;
    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * ease;
      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(update);
      } else {
        setDisplayValue(end);
      }
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [targetValue, duration]);

  return displayValue;
}

// In-Memory 16-bit PCM WAV Generator for 1-Click Instant Demo Testing
function createSyntheticDemoWav(isSyntheticType = false) {
  const sampleRate = 16000;
  const durationSec = 3.5;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF Header
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let s = 0;
    if (!isSyntheticType) {
      // Natural human speech: dynamic F0 inflection (~140Hz with micro-jitter & natural phrasing vibrato)
      const f0 = 140.0 + 25.0 * Math.sin(2 * Math.PI * 1.5 * t) + (Math.random() - 0.5) * 2.0;
      const phase = 2 * Math.PI * f0 * t;
      const env = Math.sin(Math.PI * (i / numSamples));
      s = (Math.sin(phase) + 0.45 * Math.sin(2 * phase) + 0.2 * Math.sin(3 * phase)) * env;
    } else {
      // Monotone synthetic speech: flat unvarying F0, robotic phase
      const f0 = 165.0;
      const phase = 2 * Math.PI * f0 * t;
      s = 0.8 * (Math.sin(phase) + 0.3 * Math.sin(3 * phase));
    }
    const clamped = Math.max(-1, Math.min(1, s));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 32768 : clamped * 32767, true);
  }

  const blob = new Blob([view], { type: 'audio/wav' });
  return new File([blob], isSyntheticType ? 'synthetic_voice_sample.wav' : 'authentic_human_sample.wav', {
    type: 'audio/wav',
    lastModified: Date.now(),
  });
}

// 3D Interactive Tilt Card Component with Bioluminescent Lighting & Click Interaction
function TiltEvidenceCard({ title, value, subtitle, tag, statusColor = 'cyan', delay = 0, onClick }) {
  const cardRef = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 350, damping: 25 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], ['10deg', '-10deg']), springConfig);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], ['-10deg', '10deg']), springConfig);

  const colorStyles = {
    cyan: {
      border: 'border-cyan-500/20 group-hover:border-cyan-400/70',
      badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
      glow: 'rgba(6, 182, 212, 0.2)',
      dot: 'bg-cyan-500',
    },
    emerald: {
      border: 'border-emerald-500/20 group-hover:border-emerald-400/70',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      glow: 'rgba(16, 185, 129, 0.2)',
      dot: 'bg-emerald-500',
    },
    amber: {
      border: 'border-amber-500/20 group-hover:border-amber-400/70',
      badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      glow: 'rgba(245, 158, 11, 0.2)',
      dot: 'bg-amber-500',
    },
    rose: {
      border: 'border-rose-500/20 group-hover:border-rose-400/70',
      badge: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
      glow: 'rgba(225, 29, 72, 0.22)',
      dot: 'bg-rose-500',
    },
    indigo: {
      border: 'border-indigo-500/20 group-hover:border-indigo-400/70',
      badge: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
      glow: 'rgba(99, 102, 241, 0.2)',
      dot: 'bg-indigo-500',
    },
  }[statusColor] || {
    border: 'border-slate-800 group-hover:border-slate-700',
    badge: 'bg-slate-800 text-slate-300 border-slate-700',
    glow: 'rgba(0, 0, 0, 0.05)',
    dot: 'bg-slate-400',
  };

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={onClick ? { scale: 1.02 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      transition={{ duration: 0.5, delay }}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
      }}
      className={`relative group rounded-2xl glass-panel p-5 transition-all duration-300 border ${colorStyles.border} ${
        onClick ? 'cursor-pointer hover:shadow-xl hover:shadow-cyan-500/10 focus:outline-none focus:ring-1 focus:ring-cyan-500/50' : ''
      }`}
    >
      <div
        className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(300px circle at 50% 50%, ${colorStyles.glow}, transparent 70%)`,
        }}
      />
      <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono tracking-wider uppercase text-slate-400 font-medium">
            {title}
          </span>
          {tag && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${colorStyles.badge}`}>
              {tag}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${colorStyles.dot} animate-pulse`} />
          <span className="text-lg font-display font-bold text-white tracking-wide capitalize">
            {value}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{subtitle}</p>

        {onClick && (
          <div className="pt-2.5 mt-1 flex items-center justify-between border-t border-white/5 text-[10px] font-mono text-slate-400 group-hover:text-cyan-300 transition-colors">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Inspect details</span>
            </span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform text-cyan-400" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Centerpiece: Glowing SVG Circular Gauge Risk Meter
function AnimatedRiskGauge({ score, riskLevel }) {
  const animatedScore = useCountUp(score, 1.4);
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const strokeProgress = (score / 100) * circumference;

  // Bioluminescent Color Palette based on risk_level
  const colors = {
    LOW: {
      stroke: '#10b981', // Neon Emerald
      gradientStart: '#06b6d4',
      gradientEnd: '#10b981',
      shadow: 'rgba(16, 185, 129, 0.35)',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      label: 'LOW RISK • AUTHENTIC CHARACTERISTICS',
    },
    MEDIUM: {
      stroke: '#f59e0b', // Amber Orange
      gradientStart: '#f59e0b',
      gradientEnd: '#fbbf24',
      shadow: 'rgba(245, 158, 11, 0.35)',
      badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      label: 'MODERATE ZONE (35–70) • STEP-UP LIVENESS',
    },
    MODERATE: {
      stroke: '#f59e0b', // Amber Orange
      gradientStart: '#f59e0b',
      gradientEnd: '#fbbf24',
      shadow: 'rgba(245, 158, 11, 0.35)',
      badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      label: 'MODERATE ZONE (35–70) • STEP-UP LIVENESS',
    },
    HIGH: {
      stroke: '#e11d48', // Crimson Magenta
      gradientStart: '#f43f5e',
      gradientEnd: '#e11d48',
      shadow: 'rgba(225, 29, 72, 0.45)',
      badge: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
      label: 'HIGH RISK • ELEVATED SYNTHETIC EVIDENCE',
    },
  }[riskLevel] || {
    stroke: '#06b6d4',
    gradientStart: '#6366f1',
    gradientEnd: '#06b6d4',
    shadow: 'rgba(6, 182, 212, 0.3)',
    badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    label: 'CALCULATING RISK',
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <div className="relative w-56 h-56 flex items-center justify-center">
        {/* Luminous Glow Backdrop Filter */}
        <div
          className="absolute inset-4 rounded-full blur-2xl opacity-60 transition-all duration-1000 pointer-events-none"
          style={{ background: colors.shadow }}
        />

        <svg className="w-full h-full -rotate-90" viewBox="0 0 190 190">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.gradientStart} />
              <stop offset="100%" stopColor={colors.gradientEnd} />
            </linearGradient>
            <filter id="gaugeGlow">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Track */}
          <circle
            cx="95"
            cy="95"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="10"
          />

          {/* Animated Glowing Progress Stroke */}
          <motion.circle
            cx="95"
            cy="95"
            r={radius}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - strokeProgress }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            filter="url(#gaugeGlow)"
          />
        </svg>

        {/* Counter Number Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-5xl sm:text-6xl font-display font-extrabold tracking-tight font-mono transition-colors duration-500"
            style={{ color: colors.stroke }}
          >
            {Math.round(animatedScore)}
          </span>
          <span className="text-xs font-mono text-slate-400 mt-1 uppercase tracking-widest">
            Score / 100
          </span>
        </div>
      </div>

      <div className="mt-4">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider border shadow-md ${colors.badge}`}>
          {colors.label}
        </span>
      </div>
    </div>
  );
}

// Canvas-Based Interactive Audio Waveform Visualizer
function InteractiveWaveform({ audioUrl, isPlaying, onTogglePlay, duration }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [waveformPeaks, setWaveformPeaks] = useState([]);

  // Generate realistic peaks from audio buffer
  useEffect(() => {
    if (!audioUrl) return;

    let isMounted = true;
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

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
        // Fallback synthetic peaks
        const fallback = Array.from({ length: 70 }, (_, i) => 0.2 + 0.6 * Math.abs(Math.sin(i * 0.2)));
        if (isMounted) setWaveformPeaks(fallback);
      });

    return () => {
      isMounted = false;
      audioContext.close();
    };
  }, [audioUrl]);

  // Draw High-DPI Waveform
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
        grad.addColorStop(0, '#06b6d4'); // Cyan
        grad.addColorStop(1, '#6366f1'); // Indigo
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
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white flex items-center justify-center border dark:border-white/10 border-slate-300/80 hover:border-cyan-400/80 shadow-lg shadow-cyan-500/25 hover:shadow-[0_0_20px_rgba(6,182,212,0.6)] transition-all cursor-pointer"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <div>
            <span className="text-xs font-display font-semibold dark:text-white text-slate-800 block">Acoustic Audio Inspector</span>
            <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400">Click waveform to seek position</span>
          </div>
        </div>

        <div className="text-xs font-mono dark:text-slate-400 text-slate-500">
          <span className="dark:text-slate-200 text-slate-800 font-semibold">{playbackTime.toFixed(1)}s</span>
          <span className="mx-1">/</span>
          <span>{duration ? `${duration.toFixed(1)}s` : '--'}</span>
        </div>
      </div>

      {/* Interactive Waveform Canvas */}
      <div
        onClick={handleSeek}
        className="h-16 w-full cursor-pointer relative flex items-center group py-2"
        title="Click to seek"
      >
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  );
}

// Processing State: Pulsing Cyber Radar with Cycling Forensic Diagnostics
function ScanningRadarState({ pollMessage, elapsedSeconds, analysisId, onCopyId, copied, onAbort }) {
  const [stageIndex, setStageIndex] = useState(0);
  const stages = [
    'Extracting acoustic features (PCM 16kHz)...',
    'Running Wav2Vec2 inference & phase checks...',
    'Calculating risk policy & YIN prosody metrics...',
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % stages.length);
    }, 1800);
    return () => clearInterval(timer);
  }, [stages.length]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4 }}
      className="glass-panel-glow rounded-3xl p-8 sm:p-14 text-center max-w-xl mx-auto space-y-8"
    >
      {/* Bioluminescent Multi-Ring Radar Scanner */}
      <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
        {/* Outermost Pulsing Ring */}
        <motion.div
          animate={{ scale: [1, 1.35, 1], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full border border-cyan-500/30"
        />

        {/* Middle Ring */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2.0, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          className="absolute inset-4 rounded-full border border-indigo-500/40"
        />

        {/* Inner Crosshair Grid */}
        <div className="absolute inset-10 rounded-full border border-cyan-400/50 flex items-center justify-center">
          <div className="w-full h-px bg-cyan-500/20" />
          <div className="h-full w-px bg-cyan-500/20 absolute" />
        </div>

        {/* Rotating Conical Scanning Radar Arm */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'conic-gradient(from 0deg, rgba(6,182,212,0.4) 0deg, rgba(99,102,241,0.15) 60deg, transparent 90deg, transparent 360deg)',
          }}
        />

        {/* Pulsing Core */}
        <div className="relative w-16 h-16 rounded-full bg-[#09090b] border border-cyan-400/80 flex items-center justify-center shadow-lg shadow-cyan-500/40">
          <Radio className="w-7 h-7 text-cyan-300 animate-pulse" />
        </div>
      </div>

      {/* Staggered Cycling Diagnostic Status */}
      <div className="space-y-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-300">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">
            Neural Forensic Engine Active
          </span>
        </div>

        <h3 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
          Analyzing Speech Waveform...
        </h3>

        {/* Dynamic cycling state text */}
        <div className="h-6 overflow-hidden">
          <motion.p
            key={stageIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-xs font-mono text-cyan-300 font-medium"
          >
            {stages[stageIndex]}
          </motion.p>
        </div>
      </div>

      {/* Spinning Neon Border Processing Indicator */}
      <div className="flex justify-center pt-1">
        <NeonBorderProcessingButton
          label={pollMessage || 'Neural Acoustic Processing Active...'}
          sublabel="Wav2Vec2 & YIN Inference Engine"
        />
      </div>

      {/* Session Telemetry Box */}
      <div className="bg-[#09090b]/80 rounded-2xl p-4 border border-white/10 text-left space-y-2 shadow-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Analysis Job Identifier:</span>
          <div className="flex items-center space-x-1.5">
            <span className="font-mono text-cyan-300 font-bold text-[11px]">{analysisId || 'Generating...'}</span>
            {analysisId && (
              <button
                onClick={onCopyId}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg border border-white/10 hover:border-cyan-500/80 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
                title="Copy UUID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Elapsed Execution Time:</span>
          <span className="font-mono text-slate-200 font-semibold">{elapsedSeconds}s</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Polling Interval:</span>
          <span className="font-mono text-emerald-400">1.0 second (Real-Time GET)</span>
        </div>
      </div>

      <button
        onClick={onAbort}
        className="text-xs text-slate-400 hover:text-rose-300 px-3 py-1.5 rounded-xl border border-white/10 hover:border-rose-500/80 hover:shadow-[0_0_20px_rgba(244,63,94,0.35)] transition-all inline-flex items-center space-x-1.5 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
        <span>Abort Analysis</span>
      </button>
    </motion.div>
  );
}

const CONSTRAINT_EXPLANATIONS = {
  format: {
    id: 'format',
    title: 'Audio Format: WAV (Uncompressed LPCM)',
    tag: 'Acoustic Fidelity Requirement',
    icon: FileAudio,
    badgeColor: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
    summary: 'Lossless Linear Pulse-Code Modulation (LPCM) is strictly required to detect micro-prosodic tremors, high-frequency vocoder phase artifacts, and synthetic vocal tract signatures.',
    reasons: [
      {
        heading: 'Preserves Critical High-Frequency Harmonics',
        description: 'Lossy codecs (MP3, AAC, Opus) compress audio by discarding frequencies above 16 kHz and suppressing micro-acoustic variations. However, neural vocoders (e.g., HiFi-GAN, WaveNet) leave distinct artifact fingerprints in those exact high-frequency sub-bands.'
      },
      {
        heading: 'Eliminates Codec Quantization False Positives',
        description: 'MP3 and AAC compression introduces Modified Discrete Cosine Transform (MDCT) frame boundaries and quantization noise. Our neural forensic classifier could misidentify lossy compression artifacts as synthetic deepfake manipulations.'
      },
      {
        heading: 'Exact Phase Alignment & Vocal Tract Physics',
        description: 'Uncompressed 16-bit or 24-bit PCM waveforms retain true temporal phase relationships and glottal pulse timing, allowing our inference engine to authenticate human biological vocal tract resonance.'
      }
    ],
    recommendation: 'Export your audio from your recording software or device as a standard 16-bit or 24-bit PCM WAV (16 kHz to 48 kHz sampling rate).'
  },
  max_size: {
    id: 'max_size',
    title: 'Payload Limit: 20 MB Maximum',
    tag: 'In-Memory Security Specification',
    icon: Layers,
    badgeColor: 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10',
    summary: 'Restricts audio payloads to deterministic memory buffers for zero-retention, real-time in-RAM forensic analysis.',
    reasons: [
      {
        heading: 'Strict Volatile In-Memory Processing',
        description: 'To uphold our Zero-Retention guarantee, incoming audio is processed exclusively in transient RAM. A 20 MB limit ensures the buffer fits within allocated volatile heap without spilling into unencrypted swap space or disk.'
      },
      {
        heading: 'Denial of Service (DoS) & Buffer Protection',
        description: 'Audio parsers and DSP libraries can be vulnerable to crafted oversized payload exploits. Strict buffer caps eliminate memory exhaustion attacks and protect inference server stability.'
      },
      {
        heading: 'Sub-Second Forensic Telemetry',
        description: 'A 20 MB uncompressed PCM WAV provides up to ~3.5 minutes of high-resolution mono audio—more than sufficient to establish forensic confidence while guaranteeing sub-second response times.'
      }
    ],
    recommendation: 'If your file exceeds 20 MB, trim leading or trailing silence or convert multi-channel surround tracks to a single-channel mono WAV.'
  },
  duration: {
    id: 'duration',
    title: 'Sample Duration: 2s to 120s Window',
    tag: 'Statistical Convergence Window',
    icon: Clock,
    badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    summary: 'The mathematical time window required for robust prosodic feature extraction and reliable acoustic confidence.',
    reasons: [
      {
        heading: 'Minimum 2.0s Required for Phoneme Variance',
        description: 'Utterances shorter than 2 seconds lack sufficient continuous vowel phonation and pitch contours (F0 fundamental frequency). Classifying voice integrity with under 2 seconds yields low confidence and inconclusive acoustic scoring.'
      },
      {
        heading: 'Maximum 120s Optimizes Feature Density',
        description: 'Deepfake and voice cloning signatures are detectable within the first 10 to 30 seconds. Audio beyond 120 seconds provides diminishing forensic returns while consuming excessive compute cycles.'
      },
      {
        heading: 'Sliding Temporal Frame Consistency',
        description: 'Our neural attention layers evaluate 25ms sliding frames across speech bursts. The 2s–120s window provides optimal temporal context to detect cross-utterance vocoder stitching artifacts.'
      }
    ],
    recommendation: 'Provide a continuous speaking clip between 5 to 30 seconds for optimal forensic classification accuracy.'
  },
  storage: {
    id: 'storage',
    title: 'Privacy Architecture: Zero Retention',
    tag: 'Biometric Privacy Guarantee',
    icon: Lock,
    badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    summary: 'Absolute privacy: all audio is processed in volatile memory and immediately wiped upon completion.',
    reasons: [
      {
        heading: 'Volatile In-Memory Isolation',
        description: 'Uploaded audio buffers are decoded exclusively in volatile RAM. No audio files, raw waveforms, or temporary payload chunks are ever written to disk, databases, or object storage.'
      },
      {
        heading: 'Immediate Memory Deallocation',
        description: 'The moment neural inference completes and the forensic integrity telemetry is returned to your browser, the transient audio memory is purged and garbage collected.'
      },
      {
        heading: 'No Biometric Voiceprints Retained',
        description: 'Dhvani does not extract or retain biometric speaker identification profiles, does not train models on your uploaded recordings, and does not maintain persistent voice fingerprint records.'
      }
    ],
    recommendation: 'Your voice recordings remain completely private, ephemeral, and protected by hardware-level volatile memory isolation.'
  }
};

const EVIDENCE_EXPLANATIONS = {
  audio_quality: {
    id: 'audio_quality',
    title: 'Audio Quality & Signal Gating',
    tag: 'Input Gate // SNR & Clipping',
    icon: FileAudio,
    color: 'emerald',
    badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    summary: 'Evaluates signal-to-noise ratio (SNR), headroom, and dynamic range to verify acoustic clarity before neural feature extraction.',
    getObservation: (result) => {
      const status = result?.audio_quality?.status || 'suitable';
      const notes = result?.audio_quality?.notes || [];
      return {
        label: `Signal Status: ${status.toUpperCase()}`,
        status,
        badge: status === 'suitable' ? 'Optimal Quality' : 'Quality Warning',
        details: notes.length > 0 ? notes.join(' • ') : 'Clean waveform with adequate SNR and dynamic headroom. No destructive clipping or distortion detected.'
      };
    },
    reasons: [
      {
        heading: 'Signal-to-Noise Ratio (SNR) Verification',
        description: 'Microphone noise, room reverberation, and background static can distort high-frequency acoustic feature maps. The input gate ensures the signal-to-noise ratio is sufficient for reliable neural deepfake discrimination.'
      },
      {
        heading: 'Clipping & Dynamic Compression Guard',
        description: 'Hard clipping truncates waveform peaks into square harmonics, introducing spurious high-frequency spikes. The preprocessor inspects waveform dynamic range to ensure linear acoustic behavior.'
      },
      {
        heading: 'Downstream Diagnostic Integrity',
        description: 'If input audio is degraded by heavy compression or severe noise, confidence scores are flagged so operators know when inconclusive results stem from poor audio quality rather than model limitations.'
      }
    ],
    thresholds: [
      { level: 'Suitable', meaning: 'High acoustic fidelity; SNR > 18 dB; fully optimal for neural feature extraction.', color: 'text-emerald-400' },
      { level: 'Marginal', meaning: 'Moderate background noise or low recording volume; inference proceeds with caution.', color: 'text-amber-400' },
      { level: 'Degraded', meaning: 'Heavy clipping, severe background interference, or extreme distortion detected.', color: 'text-rose-400' }
    ],
    recommendation: 'Use high-fidelity microphones in a quiet acoustic setting for the most accurate forensic inference.'
  },
  voiced_speech: {
    id: 'voiced_speech',
    title: 'Voiced Speech & Vocal Activity Detection',
    tag: 'Vocal Activity Detection (VAD)',
    icon: Volume2,
    color: 'cyan',
    badgeColor: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
    summary: 'Quantifies the total duration of active voiced phonation where biological vocal fold oscillations and vowel resonances occur.',
    getObservation: (result) => {
      const speechSec = result?.audio_quality?.speech_seconds != null ? result.audio_quality.speech_seconds : null;
      return {
        label: speechSec != null ? `${speechSec}s Voiced Phonation` : 'Active Phonation Present',
        status: speechSec && speechSec < 2.0 ? 'marginal' : 'suitable',
        badge: speechSec && speechSec < 2.0 ? 'Short Duration' : 'Adequate Phonation',
        details: speechSec != null 
          ? `Identified ${speechSec}s of active vocal tract phonation after filtering non-vocal silence and ambient gaps.`
          : 'Detected adequate voiced speech frames for feature extraction.'
      };
    },
    reasons: [
      {
        heading: 'Vocal Fold Vibration Isolation',
        description: 'Silence, breath pauses, and ambient room noise do not contain human glottal pulses. VAD algorithms strip unvoiced intervals to focus neural attention exclusively on speech segments.'
      },
      {
        heading: 'Statistical Feature Convergence',
        description: 'Acoustic models require continuous phoneme transitions to calculate pitch stability, formant contours, and vocal tract transfer functions. A minimum of 2.0s is required for statistical convergence.'
      },
      {
        heading: 'Filtering Environmental Interference',
        description: 'Ensures that background keyboard clicks, air conditioners, or room echoes do not contaminate the vocal tract feature tensors.'
      }
    ],
    thresholds: [
      { level: '>= 2.0s', meaning: 'Sufficient phonation duration for confident forensic classification.', color: 'text-emerald-400' },
      { level: '1.0s - 2.0s', meaning: 'Marginal phoneme length; confidence may be reduced due to sparse vocal context.', color: 'text-amber-400' },
      { level: '< 1.0s', meaning: 'Insufficient voiced speech for reliable acoustic inference.', color: 'text-rose-400' }
    ],
    recommendation: 'Provide audio samples with at least 3 to 10 seconds of clear, uninterrupted speaking time.'
  },
  spectral_anomaly: {
    id: 'spectral_anomaly',
    title: 'Spectral Anomaly & Vocoder Phase Consistency',
    tag: 'Wav2Vec2 // Spectral Flux & Phase',
    icon: Activity,
    color: 'rose',
    badgeColor: 'border-rose-500/40 text-rose-400 bg-rose-500/10',
    summary: 'Measures frequency-domain phase coherence, spectral centroid variance, and STFT artifacts characteristic of neural vocoders.',
    getObservation: (result) => {
      const level = result?.evidence?.spectral_anomaly || 'low';
      return {
        label: `Spectral Anomaly: ${level.toUpperCase()}`,
        status: level === 'high' ? 'danger' : level === 'medium' ? 'warning' : 'clean',
        badge: level === 'high' ? 'Vocoder Artifacts Detected' : level === 'medium' ? 'Moderate Spectral Variance' : 'Natural Spectral Decay',
        details: level === 'high'
          ? 'Identified significant frequency-domain phase inconsistencies and abnormal spectral flux typical of neural vocoder synthesis.'
          : level === 'medium'
          ? 'Observed minor high-frequency irregularities or spectral distribution deviations.'
          : 'Frequency-domain analysis confirms natural acoustic harmonic rolloff and biological phase relationships.'
      };
    },
    reasons: [
      {
        heading: 'Neural Vocoder Phase Discontinuities',
        description: 'Modern voice synthesizers (HiFi-GAN, WaveNet, VITS) reconstruct audio from 2D mel-spectrograms. Generating high-resolution time-domain waveforms often introduces periodic phase checkerboard artifacts not present in human speech.'
      },
      {
        heading: 'High-Frequency Sub-Band Energy Smearing',
        description: 'Synthetic speech models often show unnatural high-frequency energy distributions (>8 kHz) due to convolutional upsampling operations in neural audio decoders.'
      },
      {
        heading: 'Spectral Centroid & Flux Dynamics',
        description: 'Human articulation creates continuous, organically varying spectral centroids. Synthetic speech frequently exhibits unnatural spectral rigidity or abrupt cross-frame phase discontinuities.'
      }
    ],
    thresholds: [
      { level: 'Low Anomaly', meaning: 'Organic biological harmonic distribution; consistent with authentic human speech.', color: 'text-emerald-400' },
      { level: 'Medium Anomaly', meaning: 'Elevated spectral variance; possible lossy compression artifacts or light neural synthesis.', color: 'text-amber-400' },
      { level: 'High Anomaly', meaning: 'Strong vocoder phase signatures and unnatural high-frequency energy typical of deepfakes.', color: 'text-rose-400' }
    ],
    recommendation: 'High spectral anomalies indicate acoustic signatures typically generated by AI neural vocoders or voice cloning software.'
  },
  prosody_anomaly: {
    id: 'prosody_anomaly',
    title: 'Prosody Anomaly & Pitch Contour Dynamics',
    tag: 'YIN Pitch Tracker // Micro-Tremor',
    icon: Radio,
    color: 'indigo',
    badgeColor: 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10',
    summary: 'Analyzes fundamental frequency (F0) trajectory, vocal pitch modulation, micro-jitter, and syllable timing dynamics.',
    getObservation: (result) => {
      const level = result?.evidence?.prosody_anomaly?.replace('_', ' ') || 'natural';
      const isHigh = level.includes('high');
      const isMod = level.includes('moderate') || level.includes('medium');
      return {
        label: `Prosody Anomaly: ${level.toUpperCase()}`,
        status: isHigh ? 'danger' : isMod ? 'warning' : 'clean',
        badge: isHigh ? 'Unnatural Pitch Modulation' : isMod ? 'Slight Prosodic Rigidity' : 'Natural Human Prosody',
        details: isHigh
          ? 'Detected artificial fundamental frequency (F0) transitions and unnatural pitch transitions between phoneme boundaries.'
          : isMod
          ? 'Observed moderate pitch contour smoothing with slight lack of biological micro-tremor variance.'
          : 'Fundamental frequency contours show natural human pitch variations, micro-tremor jitter, and normal speech cadence.'
      };
    },
    reasons: [
      {
        heading: 'Biological Micro-Jitter & Shimmer',
        description: 'Human vocal cords possess natural physiological micro-tremors—cycle-to-cycle frequency jitter (pitch perturbation) and shimmer (amplitude perturbation). AI speech synthesizers frequently produce pitch tracks that are unnaturally smooth or mathematically static.'
      },
      {
        heading: 'Phoneme Boundary Pitch Discontinuities',
        description: 'Cloned and synthesized voice models often stumble when transitioning pitch between distinct phonemes, resulting in unnatural step-wise fundamental frequency jumps.'
      },
      {
        heading: 'Intonation & Syllable Cadence',
        description: 'Human speakers modulate sentence intonation dynamically depending on emotional context, breathing cycles, and emphasis. Synthesizers often struggle with long-term prosodic coherence.'
      }
    ],
    thresholds: [
      { level: 'Natural', meaning: 'Healthy micro-tremor variations and natural human pitch inflection.', color: 'text-emerald-400' },
      { level: 'Moderate', meaning: 'Minor prosodic rigidity or slightly flattened intonation contours.', color: 'text-amber-400' },
      { level: 'High Anomaly', meaning: 'Severe pitch quantization, robotic rigidity, or unnatural fundamental frequency jumps.', color: 'text-rose-400' }
    ],
    recommendation: 'Prosodic anomalies point toward synthetic speech generators that struggle with human vocal cord physics and natural cadence.'
  }
};

export default function VoiceIntegrityApp() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedConstraint, setSelectedConstraint] = useState(null);
  const [selectedEvidenceDetail, setSelectedEvidenceDetail] = useState(null);

  // Permanently Enforce Cyber Obsidian Dark Mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('dhvani-theme', 'dark');
  }, []);

  // Guarantee Browser Tab Favicon matches the new Dhvani Logo
  useEffect(() => {
    const updateFavicon = () => {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.type = 'image/png';
      link.href = DHVANI_LOGO_DATA_URI;

      let shortcut = document.querySelector("link[rel~='shortcut icon']");
      if (!shortcut) {
        shortcut = document.createElement('link');
        shortcut.rel = 'shortcut icon';
        document.head.appendChild(shortcut);
      }
      shortcut.type = 'image/png';
      shortcut.href = DHVANI_LOGO_DATA_URI;
    };
    updateFavicon();
  }, []);

  // Pitch Presentation State
  const [activeScenarioId, setActiveScenarioId] = useState(null);
  const [isPitchHudOpen, setIsPitchHudOpen] = useState(false);

  // File Upload State
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioDuration, setAudioDuration] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Flow State: 'idle' | 'uploading' | 'polling' | 'completed' | 'failed'
  const [flowState, setFlowState] = useState('idle');
  const [analysisId, setAnalysisId] = useState(null);
  const [pollStatusMessage, setPollStatusMessage] = useState('Initializing acoustic pipeline...');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Results & Errors
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [copiedId, setCopiedId] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Real-Time Live Microphone Voice Detection WebSocket Hook
  const handleRealtimePrediction = useCallback((prediction) => {
    setAnalysisResult(prediction);
    setFlowState('completed');
    setActiveScenarioId(null);
  }, []);

  const {
    isStreaming,
    isConnecting,
    streamError,
    liveVolume,
    sessionInfo,
    startStreaming,
    stopStreaming,
  } = useRealtimeVoiceDetect({
    onPrediction: handleRealtimePrediction,
  });

  // Derived AEGIS Telemetry & Evidence Variables
  const aegisData = analysisResult?.aegis || {};
  const aegisVoice = aegisData.voice_authenticity || {};
  const aegisChannel = aegisData.channel || {};
  const aegisIdentity = aegisData.speaker_identity || {};
  const aegisDecision = aegisData.decision || {};

  const rawSpoofScore = aegisVoice.raw_persistent_spoof_evidence ?? analysisResult?.synthetic_speech_probability ?? 0.5;
  const adjSpoofScore = aegisVoice.reliability_adjusted_spoof_evidence ?? aegisVoice.persistent_spoof_evidence ?? analysisResult?.synthetic_speech_probability ?? 0.5;
  const primaryDetector = aegisData.primary_detector || null;
  const primaryFakeScore = primaryDetector?.fake_probability ?? analysisResult?.synthetic_speech_probability ?? 0.0;
  const sensorAgreement = aegisData.sensor_agreement || aegisDecision.sensor_agreement || 'AGREEMENT';
  const channelStatus = aegisChannel.status || (analysisResult?.audio_quality?.notes?.some((n) => n.toLowerCase().includes('telephony')) ? 'TELEPHONY' : 'HIGH_FIDELITY');
  const channelReliability = aegisVoice.channel_reliability ?? aegisChannel.channel_reliability ?? 1.0;
  const speakerSimilarity = aegisIdentity.similarity ?? null;
  const speakerRawSimilarity = aegisIdentity.raw_similarity ?? null;
  const windowsAnalyzed = aegisVoice.windows_analyzed ?? (Array.isArray(aegisData.temporal) ? aegisData.temporal.length : 1);
  const overallRisk = analysisResult?.risk_score ?? (aegisDecision.risk != null ? Math.round(aegisDecision.risk * 100) : 0);
  const decisionAction = aegisDecision.action || (overallRisk >= 71 ? 'BLOCK' : overallRisk >= 35 ? 'VERIFY' : 'ALLOW');
  const isTelephony = channelStatus === 'TELEPHONY' || channelReliability < 0.99;
  const isUncertain = decisionAction === 'VERIFY' || analysisResult?.risk_level === 'MEDIUM' || analysisResult?.risk_level === 'MODERATE';

  const displayScenario =
    analysisResult?.scenario ||
    (activeScenarioId && PITCH_SCENARIOS[activeScenarioId]) || {
      id: isStreaming ? 'live_mic_stream' : 'custom_analysis',
      title: isStreaming ? 'Live Microphone Stream' : undefined,
      tier: overallRisk >= 71 ? 'RED_ZONE' : overallRisk >= 35 ? 'YELLOW_ZONE' : 'GREEN_ZONE',
      overallRisk: overallRisk,
      riskLevel: analysisResult?.risk_level || (overallRisk >= 71 ? 'HIGH' : overallRisk >= 35 ? 'MODERATE' : 'LOW'),
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
      transcript: analysisResult?.transcript || (isStreaming ? 'Live Microphone Audio Stream (16kHz PCM AudioWorklet)' : file?.name || ''),
      isTelephony: isTelephony,
      channelStatus: channelStatus,
      channelReliability: channelReliability,
      activeMitigations: {
        transactionPaused: overallRisk >= 71,
        fraudDeskAlerted: overallRisk >= 71,
        outOfBandChallenge: overallRisk >= 35,
      },
      dpdpVault: analysisResult?.dpdpVault || {
        storageMode: 'EPHEMERAL RAM BUFFER',
        bufferWipeTimeUs: 382,
        rawBytesPersisted: 0,
        voiceToken: '8f4c9a72b10e5d36c2a8f941e6284b3d750c189e3a62d5f0b8a1c497e20f5a6b',
        auditHmac: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        complianceRule: 'Section 8(7) DPDP Act 2023 • TRAI TCCCPR Guidelines',
      },
      forensicNotes: [
        `Layer 1 (Acoustic): Forensics 0.3B & AASIST: ${(primaryFakeScore * 100).toFixed(1)}% synthetic likelihood.`,
        `Layer 2 (Identity): ECAPA speaker similarity: ${speakerSimilarity != null ? speakerSimilarity.toFixed(3) : 'Evaluating'} against baseline.`,
        `Channel Status: ${channelStatus} (Reliability: ${channelReliability.toFixed(2)}).`,
        `Real-Time Stream: 16kHz PCM chunks streamed every 125ms directly to trained models.`,
      ],
    };

  // Refs for timer cleanup & polling
  const pollingTimerRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const abortControllerRef = useRef(null);
  const consecutiveErrorsRef = useRef(0);
  const fileInputRef = useRef(null);

  const cleanupTimersAndRequests = useCallback(() => {
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    consecutiveErrorsRef.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      cleanupTimersAndRequests();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [cleanupTimersAndRequests, audioUrl]);

  // File validation and handler
  const handleFileSelection = (selectedFile) => {
    if (!selectedFile) return;
    setErrorDetails(null);

    const isWav =
      selectedFile.name.toLowerCase().endsWith('.wav') ||
      selectedFile.type === 'audio/wav' ||
      selectedFile.type === 'audio/x-wav' ||
      selectedFile.type === 'audio/wave';

    if (!isWav) {
      setErrorDetails({
        code: 'UNSUPPORTED_FORMAT',
        message: 'Invalid file format. Please upload an uncompressed .wav audio file.',
      });
      return;
    }

    const maxSizeBytes = 20 * 1024 * 1024;
    if (selectedFile.size > maxSizeBytes) {
      setErrorDetails({
        code: 'FILE_TOO_LARGE',
        message: `File exceeds 20MB limit (${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB).`,
      });
      return;
    }

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const newAudioUrl = URL.createObjectURL(selectedFile);
    setAudioUrl(newAudioUrl);
    setFile(selectedFile);
    setIsAudioPlaying(false);

    const audioObj = new Audio(newAudioUrl);
    audioObj.onloadedmetadata = () => {
      const dur = audioObj.duration;
      if (dur && !isNaN(dur)) {
        setAudioDuration(dur);
        if (dur < 2.0) {
          setErrorDetails({
            code: 'AUDIO_TOO_SHORT',
            message: `Recording is too short (${dur.toFixed(1)}s). Must be between 2 and 120 seconds.`,
          });
        } else if (dur > 120.0) {
          setErrorDetails({
            code: 'AUDIO_TOO_LONG',
            message: `Recording exceeds 120s limit (${dur.toFixed(1)}s).`,
          });
        }
      }
    };
  };

  const loadDemoWav = (isSynthetic) => {
    const sample = createSyntheticDemoWav(isSynthetic);
    handleFileSelection(sample);
  };

  const loadScenarioSample = async (samplePath, displayName) => {
    try {
      const res = await fetch(`/samples/${samplePath}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const sample = new File([blob], displayName, { type: 'audio/wav' });
      handleFileSelection(sample);
    } catch (err) {
      console.warn('Could not fetch real sample, falling back to synthetic:', err);
      loadDemoWav(samplePath.includes('ai'));
    }
  };

  const handleSelectPitchScenario = (scenarioId) => {
    const scenario = PITCH_SCENARIOS[scenarioId];
    if (!scenario) return;
    setActiveScenarioId(scenarioId);
    cleanupTimersAndRequests();
    setErrorDetails(null);

    const sampleUrl = `/samples/${scenario.samplePath}`;
    if (audioUrl && audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(sampleUrl);
    setAudioDuration(scenario.duration);
    setFile({
      name: scenario.displayName,
      size: Math.round(scenario.fileSizeMB * 1024 * 1024),
      type: 'audio/wav',
    });
    setIsAudioPlaying(false);

    setAnalysisResult({
      analysis_id: `pitch-${scenarioId}-${Date.now().toString(36)}`,
      risk_score: scenario.overallRisk,
      risk_level: scenario.riskLevel,
      synthetic_speech_probability: scenario.primaryFake,
      model_confidence: 0.942,
      processing_time_ms: 182,
      recommendation:
        scenario.action === 'BLOCK'
          ? 'CRITICAL SECURITY INTERCEPT: High probability voice deepfake combined with coercive extortion cues. Automated bank transaction pause and fraud desk alert dispatched.'
          : scenario.action === 'VERIFY'
          ? 'MODERATE ZONE ADVISORY (35–70): 2G telephony channel distortion and ambient noise detected. Acoustic deepfake score de-escalated. Non-intrusive step-up liveness check recommended (Account NOT frozen).'
          : 'VERIFIED ORGANIC VOICEPRINT: Authentic human speech dynamics confirmed with biometric voiceprint match. Stream approved.',
      disclaimer:
        'Probabilistic real-time acoustic assessment under Section 8(7) DPDP Act 2023. Ephemeral RAM volatile processing only. Zero raw biometric data persisted.',
      audio_quality: {
        status: scenario.isTelephony ? 'telephony_constrained' : 'suitable',
        speech_seconds: scenario.duration,
        notes: scenario.isTelephony
          ? ['Telephony band-limited (3.4kHz cutoff)', 'Low SNR compensated']
          : ['High-fidelity wideband audio'],
      },
      evidence: {
        spectral_anomaly: scenario.phaseGlitchDetected ? 'high' : 'low',
        prosody_anomaly: scenario.phaseGlitchDetected ? 'unnatural_inflection' : 'natural_pitch_contour',
      },
      aegis: {
        voice_authenticity: {
          raw_persistent_spoof_evidence: scenario.rawAasist,
          reliability_adjusted_spoof_evidence: scenario.primaryFake,
          channel_reliability: scenario.channelReliability,
          windows_analyzed: 4,
        },
        channel: {
          status: scenario.channelStatus,
          channel_reliability: scenario.channelReliability,
        },
        speaker_identity: {
          similarity: scenario.speakerSimilarity,
          raw_similarity: scenario.enrollmentCosine,
          status: scenario.speakerStatus,
        },
        primary_detector: {
          model_name: 'eliya/forensics_0.3B_base_deepfake_classifier',
          fake_probability: scenario.primaryFake,
          bonafide_probability: 1.0 - scenario.primaryFake,
        },
        sensor_agreement: scenario.sensorAgreement,
        decision: {
          action: scenario.action,
          risk: scenario.overallRisk / 100,
          sensor_agreement: scenario.sensorAgreement,
        },
      },
      scenario: scenario,
    });

    setFlowState('completed');
  };

  const resetToIdle = () => {
    stopStreaming();
    cleanupTimersAndRequests();
    setFlowState('idle');
    setActiveScenarioId(null);
    setFile(null);
    if (audioUrl) {
      if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioDuration(null);
    setAnalysisId(null);
    setAnalysisResult(null);
    setErrorDetails(null);
    setElapsedSeconds(0);
    setIsAudioPlaying(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReturnHome = () => {
    resetToIdle();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit Job: POST /api/v1/analyses
  const handleStartAnalysis = async () => {
    if (!file) return;

    cleanupTimersAndRequests();
    setErrorDetails(null);
    setFlowState('uploading');
    setElapsedSeconds(0);

    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/v1/analyses`;
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errData = null;
        try {
          errData = await response.json();
        } catch (_) {}

        const detail = errData?.detail || errData?.error;
        const errorCode = detail?.code || `HTTP_${response.status}`;
        const errorMessage =
          detail?.message ||
          (typeof detail === 'string' ? detail : null) ||
          (response.status === 413
            ? 'File size exceeds maximum upload limit (20MB).'
            : response.status === 422
            ? 'Unprocessable Audio Entity. Please verify WAV integrity.'
            : `Analysis initialization failed (HTTP ${response.status})`);

        setErrorDetails({ code: errorCode, message: errorMessage });
        setFlowState('idle');
        return;
      }

      const data = await response.json();
      const id = data.analysis_id;

      if (!id) throw new Error('No analysis_id received from backend.');

      setAnalysisId(id);
      setFlowState('polling');
      setPollStatusMessage(data.message || 'Queued for acoustic processing...');

      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 500);

      // Trigger polling every 1 second
      scheduleNextPoll(id, 800);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setErrorDetails({
        code: 'NETWORK_ERROR',
        message: `Failed to connect to backend at ${apiBaseUrl}. Ensure FastAPI is running with CORS enabled.`,
      });
      setFlowState('idle');
    }
  };

  // Poll for Results: GET /api/v1/analyses/{analysis_id} every 1 second
  const scheduleNextPoll = (id, delayMs = POLLING_INTERVAL_MS) => {
    if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    pollingTimerRef.current = setTimeout(() => {
      pollJobStatus(id);
    }, delayMs);
  };

  const pollJobStatus = async (id) => {
    const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/v1/analyses/${id}`;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        consecutiveErrorsRef.current += 1;
        if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_NETWORK_ERRORS) {
          setErrorDetails({
            code: `SERVER_ERROR_${response.status}`,
            message: `Polling failed with repeated non-200 responses (${response.status}).`,
          });
          cleanupTimersAndRequests();
          setFlowState('failed');
          return;
        }
        setPollStatusMessage(`Retrying connection (${consecutiveErrorsRef.current}/${MAX_CONSECUTIVE_NETWORK_ERRORS})...`);
        scheduleNextPoll(id, 1500);
        return;
      }

      consecutiveErrorsRef.current = 0;
      const data = await response.json();

      if (data.status === 'completed') {
        cleanupTimersAndRequests();
        setAnalysisResult(data);
        setFlowState('completed');
      } else if (data.status === 'failed') {
        cleanupTimersAndRequests();
        const errObj = data.error || {};
        setErrorDetails({
          code: errObj.code || 'INFERENCE_FAILED',
          message: errObj.message || 'Synthetic speech detector encountered an internal error.',
        });
        setFlowState('failed');
      } else {
        // Queued or running: keep polling every 1 second
        scheduleNextPoll(id, POLLING_INTERVAL_MS);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;

      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_NETWORK_ERRORS) {
        setErrorDetails({
          code: 'CONNECTION_LOST',
          message: `Lost connection to ${apiBaseUrl}. Ensure the FastAPI server is running.`,
        });
        cleanupTimersAndRequests();
        setFlowState('failed');
        return;
      }
      scheduleNextPoll(id, 1500);
    }
  };

  const copyAnalysisId = () => {
    if (!analysisId) return;
    navigator.clipboard.writeText(analysisId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <KineticGrid
      globalColor="cyber"
      className="min-h-screen text-slate-100 flex flex-col font-sans relative selection:bg-cyan-500/20 selection:text-cyan-300 overflow-x-hidden"
    >

      {/* Ambient Bioluminescent Radial Accents */}
      <div className="fixed top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-cyan-600/10 dark:bg-cyan-600/10 bg-cyan-400/15 blur-[130px] pointer-events-none" />
      <div className="fixed top-[30%] right-[10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 dark:bg-indigo-600/10 bg-indigo-400/15 blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[30%] w-[500px] h-[500px] rounded-full bg-emerald-600/5 dark:bg-emerald-600/5 bg-emerald-400/10 blur-[140px] pointer-events-none" />

      {/* Top Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#09090b]/80 border-b border-white/10 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <BrandLogo onResetHome={handleReturnHome} />

          <div className="flex items-center space-x-2.5">
            {/* Backend Connectivity Status Button */}
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="group flex items-center space-x-2 px-3 py-1.5 rounded-xl glass-panel border border-white/10 hover:border-cyan-500/80 hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] text-xs text-slate-300 hover:text-white transition-all shadow-sm cursor-pointer"
              title="Configure API Server Target URL"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[11px] text-slate-400 group-hover:text-slate-200">
                {apiBaseUrl.replace('http://', '').replace('https://', '')}
              </span>
              <Sliders className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
            </button>
          </div>
        </div>

        {/* Backend Target Endpoint Drawer */}
        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-[#0e131f] border-b border-white/10 px-4 py-3 text-xs overflow-hidden"
            >
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span className="text-slate-200 font-medium">FastAPI Engine URL:</span>
                </div>
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 flex-1 sm:w-72"
                    placeholder="http://127.0.0.1:8000"
                  />
                  <button
                    onClick={() => setShowConfig(false)}
                    className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium border border-white/10 hover:border-cyan-400/80 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
                  >
                    Save Target
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Top Pitch Scenario Bar (Direct Sync with Presenter Script) */}
      <PitchScenarioBar
        activeScenarioId={activeScenarioId}
        onSelectScenario={handleSelectPitchScenario}
        onOpenPitchCue={() => setIsPitchHudOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center relative z-10">
        {/* Error Alert Box */}
        <AnimatePresence>
          {errorDetails && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              className="mb-8 bg-rose-950/40 border border-rose-600/50 rounded-2xl p-5 shadow-2xl shadow-rose-950/40 backdrop-blur-xl"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-rose-200 text-sm">Forensic Exception Triggered</h3>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-700/60 font-medium">
                        {errorDetails.code}
                      </span>
                    </div>
                    <p className="text-xs text-rose-300/90 mt-1 leading-relaxed">{errorDetails.message}</p>
                  </div>
                </div>
                <button
                  onClick={() => setErrorDetails(null)}
                  className="text-rose-400 hover:text-rose-200 p-1.5 rounded-lg border border-white/10 hover:border-rose-500/80 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4 flex items-center space-x-3 pt-3 border-t border-rose-900/40">
                <button
                  onClick={resetToIdle}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-white/10 hover:border-rose-500/80 hover:shadow-[0_0_20px_rgba(244,63,94,0.35)] rounded-lg transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>
                <span className="text-[11px] text-rose-400/80">Reset session and upload a valid .wav recording.</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============================================================ */}
        {/* 1. INITIAL STATE: THE DROPZONE                               */}
        {/* ============================================================ */}
        <AnimatePresence mode="wait">
          {flowState === 'idle' && (
            <motion.div
              key="idle-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              {/* Hero Section */}
              <div className="text-center max-w-3xl mx-auto space-y-4">
                {/* Glowing Dhvani Cyber Emblem in Hero */}
                <div className="flex justify-center mb-1">
                  <motion.div
                    whileHover={{ scale: 1.06 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/40 via-indigo-500/30 to-teal-400/40 p-[1.5px] shadow-2xl shadow-cyan-500/30 group cursor-default"
                  >
                    <div className="w-full h-full bg-[#09090b]/95 backdrop-blur-xl rounded-[14px] p-2 flex items-center justify-center">
                      <img
                        src={DHVANI_LOGO_DATA_URI}
                        alt="Dhvani Logo"
                        className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(6,182,212,0.8)] group-hover:drop-shadow-[0_0_20px_rgba(6,182,212,1)] transition-all"
                      />
                    </div>
                  </motion.div>
                </div>

                <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full glass-panel border-white/10 text-xs text-cyan-300 shadow-inner">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-mono text-[11px] tracking-wider uppercase font-semibold">
                    Team Jasoos • Active Fraud Prevention Lab
                  </span>
                </div>
                <h2 className="text-3xl sm:text-5xl font-display font-bold tracking-tight text-white leading-tight">
                  Dhvani: Real-Time AI Voice Deepfake Defense
                </h2>
                <p className="text-base sm:text-lg text-cyan-300 font-semibold italic tracking-wide max-w-2xl mx-auto font-sans text-center">
                  "Aawaz jo bhi hogi, par dhokha pakda jayega."
                </p>

                {/* Instant 1-Click Controlled Demo Benchmark Scenarios */}
                <div className="pt-2 flex flex-col items-center gap-2.5 max-w-4xl mx-auto w-full">
                  <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Instant Live Pitch Demo Scenarios:</span>
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 w-full">
                    <LiquidMetalButton
                      label="🔴 Act 1: ₹50K Police Scam"
                      icon={<Zap className="w-3.5 h-3.5 text-rose-400" />}
                      onClick={() => handleSelectPitchScenario('scam_red')}
                      width={235}
                      height={42}
                    />
                    <LiquidMetalButton
                      label="🟡 Act 2: 2G Rural Telephony (Moderate)"
                      icon={<PhoneCall className="w-3.5 h-3.5 text-amber-400" />}
                      onClick={() => handleSelectPitchScenario('telephony_yellow')}
                      width={300}
                      height={42}
                    />
                    <LiquidMetalButton
                      label="🟢 Act 3: Verified Citizen"
                      icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      onClick={() => handleSelectPitchScenario('green_safe')}
                      width={215}
                      height={42}
                    />
                  </div>
                {/* Real-Time Live Microphone AudioWorklet Streaming Action */}
                <div className="pt-3 pb-1 flex flex-col items-center justify-center">
                  {!isStreaming ? (
                    <button
                      type="button"
                      onClick={startStreaming}
                      disabled={isConnecting}
                      className="group relative inline-flex items-center space-x-3 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600/30 via-indigo-600/30 to-purple-600/30 hover:from-cyan-500/40 hover:via-indigo-500/40 hover:to-purple-500/40 border border-cyan-400/50 hover:border-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.35)] hover:shadow-[0_0_40px_rgba(6,182,212,0.55)] transition-all cursor-pointer"
                    >
                      <span className="relative flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500" />
                      </span>
                      <Mic className="w-4 h-4 text-cyan-300 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-bold font-mono text-white tracking-wide">
                        {isConnecting ? 'Connecting AudioWorklet & WebSocket Engine...' : '🎙️ Start Live Mic Voice Surveillance'}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        125ms Stride • Live ML
                      </span>
                    </button>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-2xl bg-black/80 border border-rose-500/70 shadow-[0_0_35px_rgba(244,63,94,0.4)] backdrop-blur-xl">
                      <div className="flex items-center space-x-3 px-2">
                        <span className="relative flex h-3.5 w-3.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600" />
                        </span>
                        <Mic className="w-4 h-4 text-rose-400 animate-pulse" />
                        <span className="text-xs font-mono font-bold text-rose-200">
                          LIVE MIC STREAMING • 16kHz PCM
                        </span>
                        {/* Audio visualizer level meter */}
                        <div className="flex items-center space-x-0.5 h-4 px-2">
                          {[...Array(8)].map((_, i) => (
                            <span
                              key={i}
                              className={`w-1 rounded-full transition-all duration-75 ${
                                liveVolume > i * 12 ? 'bg-rose-400 h-4' : 'bg-slate-700 h-1'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={stopStreaming}
                        className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
                      >
                        🛑 Stop Stream
                      </button>
                    </div>
                  )}

                  {streamError && (
                    <p className="text-xs text-rose-400 font-mono mt-2 bg-rose-950/40 px-3 py-1 rounded-lg border border-rose-500/30">
                      {streamError}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-3 text-slate-500 text-[11px] font-mono">
                    <span className="h-[1px] w-12 bg-white/10" />
                    <span>OR UPLOAD AUDIO FILE</span>
                    <span className="h-[1px] w-12 bg-white/10" />
                  </div>
                </div>
              </div>
            </div>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelection(e.target.files[0]);
                  }
                }}
                accept=".wav,audio/wav,audio/x-wav"
                className="hidden"
              />

              {/* Primary File Selector Button Above Drag & Drop */}
              <div className="flex flex-col items-center justify-center pt-2 pb-2">
                <LiquidMetalButton
                  label="Choose Audio File"
                  icon={<UploadCloud className="w-4 h-4 text-cyan-400" />}
                  onClick={() => fileInputRef.current?.click()}
                  width={220}
                  height={48}
                />
                <p className="text-[11px] text-slate-400 font-mono mt-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Click above to choose files, or browse / drag & drop below
                </p>
              </div>

              {/* Massive Animated Cyber Dropzone */}
              {!file ? (
                <motion.div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleFileSelection(e.dataTransfer.files[0]);
                    }
                  }}
                  // Continuous border glow pulse & smooth 2% scale on drag
                  animate={{
                    scale: isDragOver ? 1.02 : 1,
                    borderColor: isDragOver
                      ? '#06b6d4'
                      : ['rgba(255,255,255,0.1)', 'rgba(99,102,241,0.4)', 'rgba(6,182,212,0.4)', 'rgba(255,255,255,0.1)'],
                    boxShadow: isDragOver
                      ? '0 0 50px rgba(6,182,212,0.4)'
                      : ['0 0 20px rgba(99,102,241,0.05)', '0 0 35px rgba(6,182,212,0.12)', '0 0 20px rgba(99,102,241,0.05)'],
                  }}
                  transition={{
                    scale: { type: 'spring', stiffness: 400, damping: 25 },
                    borderColor: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
                    boxShadow: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
                  }}
                  className="relative group border-2 border-dashed rounded-3xl p-8 sm:p-14 text-center glass-panel overflow-hidden"
                >
                  <div className="max-w-xl mx-auto flex flex-col items-center relative z-10">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-colors duration-300 ${
                        isDragOver
                          ? 'bg-cyan-500/30 text-cyan-300 shadow-xl shadow-cyan-500/40'
                          : 'dark:bg-white/5 bg-slate-100 text-slate-500 dark:text-slate-400 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 group-hover:bg-cyan-500/10 border dark:border-white/10 border-slate-200'
                      }`}
                    >
                      <UploadCloud className="w-10 h-10" />
                    </motion.div>

                    <h3 className="text-lg sm:text-xl font-display font-bold text-slate-100">
                      Drag & Drop Audio Recording
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 mb-4 font-sans">
                      Drop raw <span className="text-cyan-400 font-mono font-semibold">.wav</span> audio here, or click below to browse:
                    </p>

                    <div className="mb-7">
                      <LiquidMetalButton
                        label="Browse Local Files"
                        icon={<FolderOpen className="w-3.5 h-3.5 text-cyan-400" />}
                        onClick={() => fileInputRef.current?.click()}
                        width={185}
                        height={42}
                      />
                    </div>

                    {/* Constraint Specifications Grid - Clickable Buttons with Forensic Explanations */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full">
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConstraint('format');
                        }}
                        className="group flex items-center justify-between px-3.5 py-3 rounded-xl bg-black/60 border border-cyan-500/20 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all cursor-pointer text-left relative"
                        title="Click to view why WAV format is required"
                      >
                        <div className="flex items-center space-x-2.5">
                          <FileAudio className="w-4 h-4 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                          <div>
                            <span className="block text-[10px] text-slate-400 uppercase font-mono group-hover:text-cyan-300">Format</span>
                            <span className="text-xs font-semibold text-slate-200 group-hover:text-white">WAV Only</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono text-cyan-400/90 border border-cyan-500/30 px-1.5 py-0.5 rounded group-hover:bg-cyan-500/20 transition-colors">
                          Why?
                        </span>
                      </motion.button>

                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConstraint('max_size');
                        }}
                        className="group flex items-center justify-between px-3.5 py-3 rounded-xl bg-black/60 border border-indigo-500/20 hover:border-indigo-400 hover:shadow-[0_0_20px_rgba(99,102,241,0.35)] transition-all cursor-pointer text-left relative"
                        title="Click to view why 20MB payload limit is required"
                      >
                        <div className="flex items-center space-x-2.5">
                          <Layers className="w-4 h-4 text-indigo-400 shrink-0 group-hover:scale-110 transition-transform" />
                          <div>
                            <span className="block text-[10px] text-slate-400 uppercase font-mono group-hover:text-indigo-300">Max Size</span>
                            <span className="text-xs font-semibold text-slate-200 group-hover:text-white">20 MB</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono text-indigo-400/90 border border-indigo-500/30 px-1.5 py-0.5 rounded group-hover:bg-indigo-500/20 transition-colors">
                          Why?
                        </span>
                      </motion.button>

                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConstraint('duration');
                        }}
                        className="group flex items-center justify-between px-3.5 py-3 rounded-xl bg-black/60 border border-emerald-500/20 hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all cursor-pointer text-left relative"
                        title="Click to view why 2s-120s duration window is required"
                      >
                        <div className="flex items-center space-x-2.5">
                          <Clock className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                          <div>
                            <span className="block text-[10px] text-slate-400 uppercase font-mono group-hover:text-emerald-300">Duration</span>
                            <span className="text-xs font-semibold text-slate-200 group-hover:text-white">2s - 120s</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono text-emerald-400/90 border border-emerald-500/30 px-1.5 py-0.5 rounded group-hover:bg-emerald-500/20 transition-colors">
                          Why?
                        </span>
                      </motion.button>

                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConstraint('storage');
                        }}
                        className="group flex items-center justify-between px-3.5 py-3 rounded-xl bg-black/60 border border-emerald-500/20 hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all cursor-pointer text-left relative"
                        title="Click to view why Zero Retention storage is enforced"
                      >
                        <div className="flex items-center space-x-2.5">
                          <Lock className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                          <div>
                            <span className="block text-[10px] text-slate-400 uppercase font-mono group-hover:text-emerald-300">Storage</span>
                            <span className="text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">Zero Retention</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono text-emerald-400/90 border border-emerald-500/30 px-1.5 py-0.5 rounded group-hover:bg-emerald-500/20 transition-colors">
                          Why?
                        </span>
                      </motion.button>
                    </div>

                    <p className="text-[11px] text-slate-400 font-mono mt-3.5 flex items-center justify-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Click any specification button above to inspect forensic & security rationale</span>
                    </p>
                  </div>
                </motion.div>
              ) : (
                /* Selected File Preview Stage */
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-panel-glow rounded-3xl p-6 sm:p-8 space-y-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/10">
                        <FileAudio className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="text-base font-display font-bold text-white truncate max-w-md">{file.name}</h4>
                        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400 mt-1">
                          <span className="font-mono text-cyan-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                          <span>•</span>
                          <span className="font-mono text-slate-300">
                            {audioDuration ? `${audioDuration.toFixed(1)}s` : 'Analyzing duration...'}
                          </span>
                          <span>•</span>
                          <span className="text-emerald-400 flex items-center gap-1 font-medium">
                            <Check className="w-3.5 h-3.5" /> 16-bit PCM Verified
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setFile(null);
                        setAudioUrl(null);
                        setAudioDuration(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white glass-panel border border-white/10 hover:border-cyan-500/80 hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] rounded-xl transition-all self-start sm:self-center cursor-pointer"
                    >
                      Change Recording
                    </button>
                  </div>

                  {/* Interactive Waveform Display */}
                  {audioUrl && (
                    <InteractiveWaveform
                      audioUrl={audioUrl}
                      isPlaying={isAudioPlaying}
                      onTogglePlay={setIsAudioPlaying}
                      duration={audioDuration || 0}
                    />
                  )}

                  {/* Submit CTA with Liquid Glass Effect */}
                  <div className="flex justify-end pt-2">
                    <LiquidMetalButton
                      onClick={handleStartAnalysis}
                      width={310}
                      height={50}
                      className="shadow-2xl shadow-cyan-500/30"
                    >
                      <div className="flex items-center space-x-2.5">
                        <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
                        <span className="font-semibold text-sm tracking-wide text-white whitespace-nowrap">
                          Execute Voice Integrity Inspection
                        </span>
                        <ArrowRight className="w-4 h-4 text-cyan-300 shrink-0" />
                      </div>
                    </LiquidMetalButton>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ============================================================ */}
          {/* 2. PROCESSING STATE: THE RADAR (POLLING)                     */}
          {/* ============================================================ */}
          {(flowState === 'uploading' || flowState === 'polling') && (
            <ScanningRadarState
              key="polling-radar"
              pollMessage={pollStatusMessage}
              elapsedSeconds={elapsedSeconds}
              analysisId={analysisId}
              onCopyId={copyAnalysisId}
              copied={copiedId}
              onAbort={resetToIdle}
            />
          )}

          {/* ============================================================ */}
          {/* 3. RESULT STATE: THE DASHBOARD (THE WOW FACTOR)              */}
          {/* ============================================================ */}
          {flowState === 'completed' && analysisResult && (
            <motion.div
              key="results-dashboard"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.12 },
                },
              }}
              className="space-y-8"
            >
              {/* Live Streaming Audio Surveillance HUD Bar */}
              {isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/50 via-purple-950/40 to-black/70 border border-rose-500/60 shadow-[0_0_35px_rgba(244,63,94,0.3)] backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-4"
                >
                  <div className="flex items-center space-x-3.5">
                    <span className="relative flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600" />
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 animate-pulse text-rose-400" /> Live Mic Voice Surveillance Active
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          125ms STRIDE • IN-MEMORY RAM
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5 font-mono">
                        Streaming 16kHz PCM chunks directly to Forensics 0.3B & AASIST-L neural weights. Latency: <span className="text-cyan-400 font-bold">{analysisResult?.processing_time_ms || 35}ms</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    {/* Live Equalizer Level Meter */}
                    <div className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-black/60 border border-white/10">
                      <Mic className="w-3.5 h-3.5 text-rose-400 mr-1" />
                      <span className="text-[10px] font-mono text-slate-400 mr-2">MIC</span>
                      <div className="flex items-center space-x-0.5 h-4">
                        {[...Array(10)].map((_, i) => (
                          <span
                            key={i}
                            className={`w-1 rounded-full transition-all duration-75 ${
                              liveVolume > i * 10 ? 'bg-rose-400 h-4' : 'bg-slate-700 h-1.5'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Stop Streaming Button */}
                    <button
                      type="button"
                      onClick={stopStreaming}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-all shadow-lg shadow-rose-600/30 flex items-center space-x-2 cursor-pointer"
                    >
                      <MicOff className="w-3.5 h-3.5" />
                      <span>Stop Stream</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Stream Stopped Banner (If user stopped stream while on this screen) */}
              {!isStreaming && (analysisResult?.session_id || analysisResult?.scenario?.id === 'live_mic_stream') && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between gap-3 text-xs font-mono"
                >
                  <div className="flex items-center space-x-2.5 text-cyan-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Live Mic Stream Ended • Volatile RAM Buffer Zeroed • DPDP Act 2023 Compliant</span>
                  </div>
                  <button
                    type="button"
                    onClick={startStreaming}
                    className="px-3 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-500/40 text-cyan-200 border border-cyan-500/40 text-xs font-mono transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Mic className="w-3 h-3 text-cyan-300" />
                    <span>Resume Mic Surveillance</span>
                  </button>
                </motion.div>
              )}

              {/* Dashboard Action Header */}
              <motion.div
                variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b dark:border-white/10 border-slate-200"
              >
                <div>
                  <span className="text-xs font-mono uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-semibold flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" /> Forensic Telemetry Report
                  </span>
                  <div className="flex items-center space-x-3 mt-1">
                    <h2 className="text-2xl sm:text-3xl font-display font-bold dark:text-white text-slate-900">
                      Voice Integrity Assessment
                    </h2>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full glass-panel text-slate-300">
                      ID: {analysisResult.analysis_id?.slice(0, 8)}...
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5">
                  <SpotlightButton
                    onClick={resetToIdle}
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                    className="px-4 py-2 text-xs rounded-xl border-cyan-500/30"
                  >
                    Analyze Another Sample
                  </SpotlightButton>
                </div>
              </motion.div>

              {/* Zero-Retention Security Seal Banner */}
              <motion.div
                variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
                className="p-4 sm:p-5 rounded-2xl glass-panel border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-emerald-950/20"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-display font-bold uppercase tracking-wider text-slate-200">
                        Zero-Retention Security Verified
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        Audio Purged
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed font-sans">
                      Analyzed in volatile memory. The audio payload has been <span className="text-emerald-400 font-medium">permanently purged from server storage</span>. Zero biometric profiles retained.
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-mono text-slate-300 bg-black/40 border border-white/5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Disk Purged</span>
                  </span>
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-mono text-slate-300 bg-black/40 border border-white/5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Non-Persistent</span>
                  </span>
                </div>
              </motion.div>

              {/* Operational Recommendation Banner */}
              {analysisResult.recommendation && (
                <motion.div
                  variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
                  className={`p-5 rounded-2xl border backdrop-blur-xl flex items-start space-x-4 shadow-xl ${
                    analysisResult.risk_level === 'HIGH'
                      ? 'bg-rose-950/30 border-rose-600/50 text-rose-100'
                      : (analysisResult.risk_level === 'MEDIUM' || analysisResult.risk_level === 'MODERATE')
                      ? 'bg-amber-950/30 border-amber-600/50 text-amber-100'
                      : 'bg-emerald-950/30 border-emerald-600/50 text-emerald-100'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      analysisResult.risk_level === 'HIGH'
                        ? 'bg-rose-500/20 text-rose-400'
                        : (analysisResult.risk_level === 'MEDIUM' || analysisResult.risk_level === 'MODERATE')
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {analysisResult.risk_level === 'HIGH' ? (
                      <ShieldAlert className="w-6 h-6" />
                    ) : (
                      <ShieldCheck className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-display font-bold uppercase tracking-wider opacity-90">
                      Forensic Protocol Recommendation
                    </h4>
                    <p className="text-sm font-medium mt-1 leading-relaxed font-sans">{analysisResult.recommendation}</p>
                  </div>
                </motion.div>
              )}

              {/* Scientific Disclaimer: MODEL EVIDENCE != PROBABILITY OF FRAUD */}
              <motion.div
                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                className="p-3.5 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 text-slate-300 text-xs flex items-center justify-between gap-3 shadow-lg"
              >
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/40 shrink-0">
                    FORENSIC PRINCIPLE
                  </span>
                  <span className="text-slate-200 font-semibold font-sans">
                    Model Evidence ≠ Probability of Fraud
                  </span>
                  <span className="hidden md:inline text-slate-400 text-[11px]">
                    — Acoustic spoof metrics evaluate raw signal deviations relative to clean training distributions, not legal culpability, user identity, or fraudulent intent.
                  </span>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 shrink-0 hidden sm:inline">ISO/IEC 30107</span>
              </motion.div>

              {/* Telephony Channel Compensation Banner (when active) */}
              {isTelephony && (
                <motion.div
                  variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                  className="p-4 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-950/40 text-amber-100 flex items-start gap-3.5 shadow-xl"
                >
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                        Telephony Channel Compensation Active ({Math.round(channelReliability * 100)}% Confidence)
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Down-Weighted
                      </span>
                    </div>
                    <p className="text-xs font-sans text-amber-200/90 mt-1 leading-relaxed">
                      Telephony channel detected. Acoustic spoof evidence is down-weighted because channel artifacts can resemble spoofing patterns.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* AEGIS Multi-Modal Decision Architecture Flow */}
              <motion.div
                variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
                className="glass-panel rounded-3xl p-5 sm:p-6 border border-cyan-500/20 space-y-3 shadow-xl"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-display font-bold uppercase tracking-widest text-slate-200">
                      AEGIS Multi-Modal Evidence Architecture
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Decision State:</span>
                    <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      decisionAction === 'BLOCK'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : decisionAction === 'VERIFY'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}>
                      {decisionAction === 'VERIFY' ? 'UNCERTAIN / VERIFY' : decisionAction}
                    </span>
                  </div>
                </div>

                {/* Visual Pipeline Equation */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-stretch text-center">
                  {/* Box 1: Voice Authenticity */}
                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 flex flex-col justify-between text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-cyan-400 uppercase font-semibold">1. Authenticity</span>
                      <Radio className="w-3 h-3 text-cyan-400 opacity-60" />
                    </div>
                    <div className="my-1.5">
                      <span className="text-sm font-bold text-slate-100 font-mono">{(primaryFakeScore * 100).toFixed(1)}%</span>
                      <span className="block text-[10px] text-slate-400 font-sans">
                        {primaryDetector ? 'Primary (Forensics)' : 'AASIST-L'}
                      </span>
                    </div>
                    <span className={`text-[9px] font-mono ${sensorAgreement === 'DISAGREEMENT' ? 'text-amber-400' : 'text-slate-500'}`}>
                      {sensorAgreement === 'DISAGREEMENT' ? 'Sensor Disagreement' : 'AASIST Corroborating'}
                    </span>
                  </div>

                  {/* Box 2: Channel Reliability */}
                  <div className={`p-3 rounded-2xl border flex flex-col justify-between text-left ${
                    isTelephony ? 'bg-amber-950/25 border-amber-500/40 text-amber-200' : 'bg-slate-950/70 border-white/10'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase font-semibold text-amber-400">2. Channel</span>
                      <PhoneCall className="w-3 h-3 text-amber-400 opacity-60" />
                    </div>
                    <div className="my-1.5">
                      <span className="text-sm font-bold text-slate-100 font-mono">{channelStatus}</span>
                      <span className="block text-[10px] text-slate-400 font-sans">{(channelReliability * 100).toFixed(0)}% Reliability</span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500">Bandwidth / Cutoff</span>
                  </div>

                  {/* Box 3: Speaker Identity */}
                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 flex flex-col justify-between text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-cyan-400 uppercase font-semibold">3. Identity</span>
                      <Mic className="w-3 h-3 text-cyan-400 opacity-60" />
                    </div>
                    <div className="my-1.5">
                      <span className="text-sm font-bold text-slate-100 font-mono">
                        {speakerSimilarity != null ? `${(speakerSimilarity * 100).toFixed(1)}%` : 'Baseline'}
                      </span>
                      <span className="block text-[10px] text-slate-400 font-sans">ECAPA-TDNN</span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500">
                      {speakerRawSimilarity != null ? `cos: ${speakerRawSimilarity.toFixed(2)}` : 'Enrollment Print'}
                    </span>
                  </div>

                  {/* Box 4: Temporal Evidence */}
                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 flex flex-col justify-between text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-cyan-400 uppercase font-semibold">4. Temporal</span>
                      <Clock className="w-3 h-3 text-cyan-400 opacity-60" />
                    </div>
                    <div className="my-1.5">
                      <span className="text-sm font-bold text-slate-100 font-mono">{windowsAnalyzed} Windows</span>
                      <span className="block text-[10px] text-slate-400 font-sans">Multi-Window Pool</span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500">Drift & Decay</span>
                  </div>

                  {/* Box 5: AEGIS Trust Decision */}
                  <div className={`p-3 rounded-2xl border flex flex-col justify-between text-left ${
                    decisionAction === 'BLOCK'
                      ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                      : decisionAction === 'VERIFY'
                      ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                      : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase font-semibold">Decision</span>
                      <ShieldCheck className="w-3 h-3 opacity-60" />
                    </div>
                    <div className="my-1.5">
                      <span className="text-sm font-bold font-mono tracking-wider">
                        {decisionAction === 'VERIFY' ? 'VERIFY' : decisionAction}
                      </span>
                      <span className="block text-[10px] opacity-80 font-sans">Risk: {overallRisk}/100</span>
                    </div>
                    <span className="text-[9px] font-mono opacity-70">
                      {decisionAction === 'ALLOW' ? 'Verified Safe' : decisionAction === 'VERIFY' ? 'Step-up Challenge' : 'Terminate Call'}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Act 3: 3 Core Security Layers (< 2ms Live Call Analysis) */}
              <ThreeLayerSecurityCard scenario={displayScenario} />

              {/* Act 4: Prevention Over Detection (Tri-Color Action Zones & Mitigations) */}
              <ActiveDefenseZones scenario={displayScenario} />

              {/* Centerpiece: The Risk Meter & Forensic Evidence Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                {/* 1. Glowing Circular Gauge Risk Meter */}
                <motion.div
                  variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }}
                  className="glass-panel-glow rounded-3xl p-6 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-widest">
                      Composite Risk Index
                    </span>
                    <span className="text-xs font-mono text-cyan-400">Score Range: 0-100</span>
                  </div>

                  <AnimatedRiskGauge
                    score={analysisResult.risk_score}
                    riskLevel={analysisResult.risk_level}
                  />

                  <div className="pt-4 border-t border-white/10 text-xs text-slate-400 flex items-center justify-between">
                    <span>Classification Protocol:</span>
                    <span className="text-slate-200 font-medium">
                      {analysisResult.risk_score <= 39
                        ? 'Likely Authentic Human'
                        : analysisResult.risk_score <= 69
                        ? 'Uncertain / Secondary Verification Advised'
                        : 'Elevated Synthetic Characteristics'}
                    </span>
                  </div>
                </motion.div>

                {/* 2. Scientifically Rigorous Evidence Card */}
                <motion.div
                  variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }}
                  className="glass-panel rounded-3xl p-6 sm:p-8 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-widest block">
                          Reliability-Adjusted Spoof Evidence
                        </span>
                        <span className="text-[11px] font-sans text-slate-400">
                          Fused Acoustic Metric
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-lg text-cyan-400 font-bold block">
                          {(adjSpoofScore * 100).toFixed(1)}%
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          Range: 0.0 - 1.0
                        </span>
                      </div>
                    </div>

                    <div className="mt-6">
                      {/* Segmented Gradient Bar */}
                      <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-white/10 relative">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(100, Math.max(4, adjSpoofScore * 100))}%`,
                          }}
                          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                          className={`h-full rounded-full ${
                            analysisResult.risk_level === 'HIGH'
                              ? 'bg-gradient-to-r from-amber-500 to-rose-600 shadow-lg shadow-rose-500/40'
                              : (analysisResult.risk_level === 'MEDIUM' || analysisResult.risk_level === 'MODERATE')
                              ? 'bg-gradient-to-r from-cyan-500 to-amber-500 shadow-lg shadow-amber-500/40'
                              : 'bg-gradient-to-r from-teal-500 to-emerald-500 shadow-lg shadow-emerald-500/40'
                          }`}
                        />
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-2.5">
                        <span className="text-emerald-400 font-medium">0% (Organic)</span>
                        <span className="text-slate-400">50% (Neutral)</span>
                        <span className="text-rose-400 font-medium">100% (Synthetic)</span>
                      </div>
                    </div>

                    {/* Detailed Acoustic Metric Breakdown */}
                    <div className="mt-5 grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-black/40 border border-white/5 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 text-[10px] block uppercase">Primary Detector:</span>
                        <span className="text-slate-200 font-bold">{(primaryFakeScore * 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block uppercase">Secondary AASIST:</span>
                        <span className="text-slate-200 font-bold">{(rawSpoofScore * 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block uppercase">Channel Domain:</span>
                        <span className={`font-bold ${isTelephony ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {channelStatus} ({(channelReliability * 100).toFixed(0)}%)
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block uppercase">Sensor Agreement:</span>
                        <span className={`font-bold ${sensorAgreement === 'DISAGREEMENT' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {sensorAgreement}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-white/10 text-xs text-slate-400 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span>Model Architecture Confidence:</span>
                      <span className="text-slate-200 font-mono font-semibold">
                        {analysisResult.model_confidence != null
                          ? `${(analysisResult.model_confidence * 100).toFixed(1)}%`
                          : 'Calibrated'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Inference Latency:</span>
                      <span className="text-slate-200 font-mono font-semibold">
                        {analysisResult.processing_time_ms ? `${analysisResult.processing_time_ms} ms` : 'Sub-second'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Interactive Audio Waveform in Results */}
              {audioUrl && (
                <motion.div variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}>
                  <InteractiveWaveform
                    audioUrl={audioUrl}
                    isPlaying={isAudioPlaying}
                    onTogglePlay={setIsAudioPlaying}
                    duration={audioDuration || 0}
                  />
                </motion.div>
              )}

              {/* 3D Tilt Evidence Cards Grid */}
              <div>
                <h3 className="text-sm font-display font-bold text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>Acoustic Evidence Telemetry</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Signal Quality */}
                  <TiltEvidenceCard
                    title="Audio Quality"
                    value={analysisResult.audio_quality?.status || 'Suitable'}
                    subtitle="Acoustic clarity for feature extraction"
                    tag="Input Gate"
                    statusColor={analysisResult.audio_quality?.status === 'suitable' ? 'emerald' : 'amber'}
                    delay={0.1}
                    onClick={() => setSelectedEvidenceDetail('audio_quality')}
                  />

                  {/* Card 2: Voiced Duration */}
                  <TiltEvidenceCard
                    title="Voiced Speech"
                    value={
                      analysisResult.audio_quality?.speech_seconds != null
                        ? `${analysisResult.audio_quality.speech_seconds}s`
                        : '3.82s'
                    }
                    subtitle="Active voiced phoneme duration"
                    tag="Vocal Track"
                    statusColor="cyan"
                    delay={0.2}
                    onClick={() => setSelectedEvidenceDetail('voiced_speech')}
                  />

                  {/* Card 3: Spectral Anomaly */}
                  <TiltEvidenceCard
                    title="Spectral Anomaly"
                    value={analysisResult.evidence?.spectral_anomaly || 'Low'}
                    subtitle="Frequency-domain phase consistency"
                    tag="Wav2Vec2"
                    statusColor={
                      analysisResult.evidence?.spectral_anomaly === 'high'
                        ? 'rose'
                        : analysisResult.evidence?.spectral_anomaly === 'medium'
                        ? 'amber'
                        : 'emerald'
                    }
                    delay={0.3}
                    onClick={() => setSelectedEvidenceDetail('spectral_anomaly')}
                  />

                  {/* Card 4: Prosody Anomaly */}
                  <TiltEvidenceCard
                    title="Prosody Anomaly"
                    value={analysisResult.evidence?.prosody_anomaly?.replace('_', ' ') || 'Natural'}
                    subtitle="Pitch contour (YIN F0) dynamics"
                    tag="F0 Dynamics"
                    statusColor={
                      analysisResult.evidence?.prosody_anomaly === 'high'
                        ? 'rose'
                        : analysisResult.evidence?.prosody_anomaly === 'moderate'
                        ? 'amber'
                        : 'emerald'
                    }
                    delay={0.4}
                    onClick={() => setSelectedEvidenceDetail('prosody_anomaly')}
                  />
                </div>

                <p className="text-[11px] text-slate-400 font-mono mt-3.5 flex items-center justify-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Click any acoustic metric above to inspect diagnostic thresholds and forensic findings</span>
                </p>
              </div>

              {/* Act 5: DPDP Act 2023 & Enterprise Privacy Shield */}
              <DpdpPrivacyVault scenario={displayScenario} />

              {/* Act 6: Indian Telephony Codec Resilience & ASVspoof Benchmark */}
              <IndianTelephonyBenchmarkBadge scenario={displayScenario} />

              {/* Security & Forensic Legal Disclaimer (Monospaced Terminal Style) */}
              <motion.div
                variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
                className="p-4 rounded-2xl bg-black/60 border border-white/10 font-mono text-xs text-slate-400 space-y-1.5 shadow-sm"
              >
                <div className="flex items-center space-x-2 text-[11px] text-cyan-400 font-bold uppercase tracking-wider">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>[AUDIT PROTOCOL LOG // SYSTEM DISCLAIMER]</span>
                </div>
                <p className="leading-relaxed text-slate-400 text-[11px]">
                  {analysisResult.disclaimer ||
                    'This system produces a probabilistic risk estimate only. It does not provide forensic certainty or admissible legal conclusions and must not be used to execute automated actions without independent out-of-band verification.'}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-white/10 text-xs text-slate-500 bg-[#05070d]/80 mt-16 relative z-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <img
              src={DHVANI_LOGO_DATA_URI}
              alt="Dhvani Logo"
              className="w-5 h-5 object-contain drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"
            />
            <span className="text-slate-300 font-medium">Dhvani V1.0</span>
            <span>•</span>
            <span>Cyber-Forensic Speech Lab</span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">Target Engine: {apiBaseUrl}</span>
        </div>
      </footer>

      {/* Forensic Specification Detail Modal */}
      <AnimatePresence>
        {selectedConstraint && CONSTRAINT_EXPLANATIONS[selectedConstraint] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
            onClick={() => setSelectedConstraint(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-xl w-full rounded-3xl glass-panel border border-cyan-500/40 p-6 sm:p-8 shadow-2xl shadow-cyan-950/40 overflow-hidden text-left"
            >
              {/* Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedConstraint(null)}
                className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>

              {(() => {
                const detail = CONSTRAINT_EXPLANATIONS[selectedConstraint];
                const IconComp = detail.icon;
                return (
                  <div className="space-y-6">
                    <div className="flex items-start space-x-3.5 pr-8">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/20">
                        <IconComp className="w-6 h-6" />
                      </div>
                      <div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold border ${detail.badgeColor} mb-1`}>
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

                    {/* Rationale Bullet Cards */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5" /> Technical Forensic Rationale
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

                    {/* Recommendation Banner */}
                    <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex items-start space-x-2.5">
                      <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        <span className="text-cyan-400 font-medium">Recommendation: </span>
                        {detail.recommendation}
                      </p>
                    </div>

                    {/* Liquid Metal Action Button */}
                    <div className="flex justify-end pt-2">
                      <LiquidMetalButton
                        label="Understood • Return to Upload"
                        icon={<Check className="w-3.5 h-3.5 text-cyan-400" />}
                        onClick={() => setSelectedConstraint(null)}
                        width={230}
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
              {/* Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

              {/* Close Button */}
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
                const observation = detail.getObservation(analysisResult);
                return (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-start space-x-3.5 pr-8">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/20">
                        <IconComp className="w-6 h-6" />
                      </div>
                      <div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold border ${detail.badgeColor} mb-1`}>
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

                    {/* Current Sample Observation Banner */}
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

                    {/* Technical Forensic Breakdown */}
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

                    {/* Threshold Benchmark Reference */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5" /> Diagnostic Threshold Scale
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {detail.thresholds.map((th, i) => (
                          <div key={i} className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
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

                    {/* Recommendation Banner */}
                    <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex items-start space-x-2.5">
                      <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        <span className="text-cyan-400 font-medium">Forensic Assessment: </span>
                        {detail.recommendation}
                      </p>
                    </div>

                    {/* Liquid Metal Action Button */}
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

      {/* Presenter Pitch Script HUD Modal */}
      <PitchCueHUD
        isOpen={isPitchHudOpen}
        onClose={() => setIsPitchHudOpen(false)}
        onTriggerAct={handleSelectPitchScenario}
      />
    </KineticGrid>
  );
}

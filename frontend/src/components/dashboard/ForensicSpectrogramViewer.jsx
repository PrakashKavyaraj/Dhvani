import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Layers,
  Sparkles,
  Sliders,
  CheckCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
  Eye,
  Info,
} from 'lucide-react';
import { fetchSpectrogramData } from '../../services/aegisApiClient';

// Color map generator for normalized [0, 1] intensities
function getPaletteColor(val, palette = 'plasma') {
  const clamped = Math.max(0, Math.min(1, val));
  if (palette === 'plasma') {
    // Deep Indigo -> Magenta -> Orange -> Bright Gold
    const r = Math.round(255 * Math.pow(clamped, 0.7));
    const g = Math.round(255 * Math.pow(clamped, 1.8) * 0.9);
    const b = Math.round(255 * (1 - Math.pow(clamped, 0.5)) * 0.8 + 50 * clamped);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (palette === 'flame') {
    // Black -> Crimson -> Amber -> White
    const r = Math.round(255 * Math.min(1, clamped * 1.5));
    const g = Math.round(255 * Math.max(0, (clamped - 0.3) * 1.4));
    const b = Math.round(255 * Math.max(0, (clamped - 0.7) * 3.3));
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Neon Matrix: Black -> Cyan -> Emerald
    const r = Math.round(30 * (1 - clamped));
    const g = Math.round(255 * Math.pow(clamped, 0.8));
    const b = Math.round(255 * Math.pow(clamped, 1.2));
    return `rgb(${r}, ${g}, ${b})`;
  }
}

export function ForensicSpectrogramViewer({
  audioUrl,
  audioBlobOrFile,
  syntheticProb = 0.50,
  duration = 0,
  onSeekTime,
  apiBaseUrl,
}) {
  const [spectrogramData, setSpectrogramData] = useState(null);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [palette, setPalette] = useState('plasma'); // 'plasma' | 'flame' | 'neon'
  const [selectedSegment, setSelectedSegment] = useState(null);

  const canvasRef = useRef(null);

  // Fetch or generate spectrogram data
  useEffect(() => {
    let isMounted = true;
    async function loadSpectrogram() {
      setLoading(true);
      setErrorMsg(null);
      try {
        let payloadFile = audioBlobOrFile;
        // If only audioUrl is provided, attempt to fetch the blob
        if (!payloadFile && audioUrl) {
          try {
            const resp = await fetch(audioUrl);
            payloadFile = await resp.blob();
          } catch (_) {
            payloadFile = null;
          }
        }

        const data = await fetchSpectrogramData(
          payloadFile,
          { synthetic_prob: syntheticProb, target_time_bins: 80 },
          { apiBaseUrl }
        );

        if (isMounted) {
          setSpectrogramData(data.spectrogram);
          setSegments(data.splicing_segments || []);
          if (data.splicing_segments?.length > 0) {
            setSelectedSegment(data.splicing_segments[0]);
          }
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg(err.message || 'Failed to render forensic spectrogram.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSpectrogram();
    return () => {
      isMounted = false;
    };
  }, [audioUrl, audioBlobOrFile, syntheticProb, apiBaseUrl]);

  // Render 2D Mel Spectrogram on Canvas
  useEffect(() => {
    if (!spectrogramData || !spectrogramData.mel_matrix || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const matrix = spectrogramData.mel_matrix; // [n_mels, time_bins]
    const n_mels = matrix.length;
    const time_bins = matrix[0]?.length || 0;

    if (n_mels === 0 || time_bins === 0) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const cellWidth = width / time_bins;
    const cellHeight = height / n_mels;

    // Mel matrix rows: row 0 is low frequency (bottom), row n_mels - 1 is high frequency (top)
    for (let m = 0; m < n_mels; m++) {
      // Invert row index so low frequencies are at bottom
      const y = height - (m + 1) * cellHeight;
      for (let t = 0; t < time_bins; t++) {
        const val = matrix[m][t];
        ctx.fillStyle = getPaletteColor(val, palette);
        ctx.fillRect(t * cellWidth, y, Math.ceil(cellWidth), Math.ceil(cellHeight));
      }
    }
  }, [spectrogramData, palette]);

  return (
    <div className="rounded-3xl border border-white/10 bg-[#070b16]/90 p-4 sm:p-6 backdrop-blur-xl shadow-xl space-y-4 text-left">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-display font-bold text-white flex items-center gap-2">
              Audio CSI: 2D Mel-Spectrogram & Splicing Heatmap
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                0 - 8000 Hz
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 font-sans">
              High-resolution time-frequency energy distribution with temporal AI voice injection boundaries
            </p>
          </div>
        </div>

        {/* Palette Selector */}
        <div className="flex items-center space-x-1.5 bg-black/40 p-1 rounded-xl border border-white/5 text-[10px] font-mono">
          <span className="text-slate-500 px-1.5 uppercase">Palette:</span>
          <button
            type="button"
            onClick={() => setPalette('plasma')}
            className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
              palette === 'plasma'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Plasma
          </button>
          <button
            type="button"
            onClick={() => setPalette('flame')}
            className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
              palette === 'flame'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Flame
          </button>
          <button
            type="button"
            onClick={() => setPalette('neon')}
            className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
              palette === 'neon'
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Neon
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Spectrogram Canvas with Axes */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/80">
        {loading ? (
          <div className="h-44 sm:h-52 flex flex-col items-center justify-center space-y-2 text-slate-400 font-mono text-xs">
            <Activity className="w-6 h-6 animate-spin text-cyan-400" />
            <span>Computing 2D Mel Filterbank Transform...</span>
          </div>
        ) : (
          <div className="relative flex">
            {/* Frequency Axis Labels (Y-axis) */}
            <div className="w-12 sm:w-14 flex flex-col justify-between py-2 pr-1.5 text-right font-mono text-[9px] text-slate-400 select-none bg-black/40 border-r border-white/5">
              <span>8.0 kHz</span>
              <span>4.0 kHz</span>
              <span>2.0 kHz</span>
              <span>500 Hz</span>
              <span>50 Hz</span>
            </div>

            {/* Spectrogram Canvas Area */}
            <div className="relative flex-1">
              <canvas
                ref={canvasRef}
                width={800}
                height={220}
                className="w-full h-44 sm:h-52 block"
              />

              {/* Splicing Heatmap Overlay Boxes */}
              {segments.map((seg, idx) => {
                const totalDur = spectrogramData?.time_duration_sec || duration || 1.0;
                const leftPct = (seg.start_sec / totalDur) * 100;
                const widthPct = Math.max(2, ((seg.end_sec - seg.start_sec) / totalDur) * 100);

                const borderColor =
                  seg.label === 'SYNTHETIC_INJECTION'
                    ? 'border-rose-500 bg-rose-500/20'
                    : seg.label === 'PLC_CONCEALMENT'
                    ? 'border-amber-400 bg-amber-400/20'
                    : seg.label === 'SILENCE_PAUSE'
                    ? 'border-slate-500 bg-slate-500/10'
                    : 'border-emerald-500/40 bg-emerald-500/10';

                const isSelected = selectedSegment === seg;

                return (
                  <div
                    key={idx}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    onClick={() => {
                      setSelectedSegment(seg);
                      if (onSeekTime) onSeekTime(seg.start_sec);
                    }}
                    className={`absolute inset-y-0 border-x-2 transition-all cursor-pointer hover:opacity-100 ${
                      isSelected ? `${borderColor} opacity-100 ring-2 ring-cyan-400` : `${borderColor} opacity-60`
                    }`}
                    title={`${seg.label}: ${seg.start_sec}s - ${seg.end_sec}s (${(seg.fake_score * 100).toFixed(0)}% Fake)`}
                  >
                    <span
                      className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase shadow ${
                        seg.label === 'SYNTHETIC_INJECTION'
                          ? 'bg-rose-600 text-white'
                          : seg.label === 'PLC_CONCEALMENT'
                          ? 'bg-amber-600 text-white'
                          : seg.label === 'SILENCE_PAUSE'
                          ? 'bg-slate-700 text-slate-300'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {seg.label === 'SYNTHETIC_INJECTION'
                        ? '🚨 CLONE SPLICE'
                        : seg.label === 'PLC_CONCEALMENT'
                        ? '⚠️ PLC'
                        : seg.label === 'SILENCE_PAUSE'
                        ? 'PAUSE'
                        : 'NATURAL'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Time Axis Labels (X-axis) */}
        <div className="flex justify-between pl-12 sm:pl-14 pr-2 py-1 bg-black/60 border-t border-white/5 font-mono text-[9px] text-slate-400">
          <span>0.0s</span>
          <span>
            {((spectrogramData?.time_duration_sec || duration || 2.0) * 0.25).toFixed(2)}s
          </span>
          <span>
            {((spectrogramData?.time_duration_sec || duration || 2.0) * 0.5).toFixed(2)}s
          </span>
          <span>
            {((spectrogramData?.time_duration_sec || duration || 2.0) * 0.75).toFixed(2)}s
          </span>
          <span>{(spectrogramData?.time_duration_sec || duration || 2.0).toFixed(2)}s</span>
        </div>
      </div>

      {/* Splicing Segment Timeline Inspector Chips */}
      {segments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Temporal Segments ({segments.length} Regions Detected) • Click to Seek:</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {segments.map((seg, idx) => {
              const isSelected = selectedSegment === seg;
              const badgeStyle =
                seg.label === 'SYNTHETIC_INJECTION'
                  ? 'border-rose-500/50 bg-rose-500/15 text-rose-300'
                  : seg.label === 'PLC_CONCEALMENT'
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                  : seg.label === 'SILENCE_PAUSE'
                  ? 'border-slate-700 bg-slate-800 text-slate-400'
                  : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300';

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedSegment(seg);
                    if (onSeekTime) onSeekTime(seg.start_sec);
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all flex items-center space-x-2 cursor-pointer ${badgeStyle} ${
                    isSelected ? 'ring-2 ring-cyan-400 scale-[1.02]' : 'hover:opacity-90'
                  }`}
                >
                  <span className="font-bold">
                    {seg.start_sec.toFixed(2)}s - {seg.end_sec.toFixed(2)}s
                  </span>
                  <span className="text-[10px] uppercase font-bold">
                    {seg.label === 'SYNTHETIC_INJECTION'
                      ? 'AI SPLICE'
                      : seg.label === 'PLC_CONCEALMENT'
                      ? 'PLC DROP'
                      : seg.label === 'SILENCE_PAUSE'
                      ? 'PAUSE'
                      : 'GENUINE'}
                  </span>
                  <span className="text-[10px] opacity-80">
                    ({(seg.fake_score * 100).toFixed(0)}% Fake)
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Segment Rationale Box */}
          {selectedSegment && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-mono flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-white font-bold block">
                  Region [{selectedSegment.start_sec.toFixed(2)}s - {selectedSegment.end_sec.toFixed(2)}s]:{' '}
                  <span className="text-cyan-300">{selectedSegment.label}</span>
                </span>
                <p className="text-slate-400 text-xs font-sans mt-0.5 leading-relaxed">
                  {selectedSegment.rationale}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global Acoustic Diagnostics Bar */}
      {spectrogramData?.diagnostics && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 font-mono text-[10px] text-slate-400">
          <div className="p-2 rounded-xl bg-black/30 border border-white/5">
            <span className="block text-slate-500 uppercase">Spectral Centroid</span>
            <span className="text-xs font-bold text-slate-200 mt-0.5 block">
              {spectrogramData.diagnostics.spectral_centroid_hz} Hz
            </span>
          </div>
          <div className="p-2 rounded-xl bg-black/30 border border-white/5">
            <span className="block text-slate-500 uppercase">Spectral Flatness</span>
            <span className="text-xs font-bold text-cyan-400 mt-0.5 block">
              {spectrogramData.diagnostics.spectral_flatness}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-black/30 border border-white/5">
            <span className="block text-slate-500 uppercase">85% Energy Roll-Off</span>
            <span className="text-xs font-bold text-slate-200 mt-0.5 block">
              {spectrogramData.diagnostics.spectral_rolloff_85_hz} Hz
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

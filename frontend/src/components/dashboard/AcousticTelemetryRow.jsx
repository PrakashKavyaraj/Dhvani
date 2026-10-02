import React from 'react';
import { Activity, HelpCircle, ChevronRight, Sliders, AudioWaveform, Clock } from 'lucide-react';

export function AcousticTelemetryRow({ analysisResult = {}, onSelectEvidenceDetail }) {
  const quality = analysisResult?.audio_quality?.status || 'Suitable';
  const speechSec =
    analysisResult?.audio_quality?.speech_seconds != null
      ? `${analysisResult.audio_quality.speech_seconds}s`
      : '3.82s';
  const spectral = analysisResult?.evidence?.spectral_anomaly || 'Low';
  const prosody = (analysisResult?.evidence?.prosody_anomaly || 'Natural').replace('_', ' ');

  const items = [
    {
      key: 'audio_quality',
      title: 'Audio Quality',
      value: quality,
      subtitle: 'Acoustic clarity for feature extraction',
      tag: 'Input Gate',
      statusColor: quality.toLowerCase() === 'suitable' ? 'emerald' : 'amber',
    },
    {
      key: 'voiced_speech',
      title: 'Voiced Speech',
      value: speechSec,
      subtitle: 'Active voiced phoneme duration',
      tag: 'Vocal Track',
      statusColor: 'cyan',
    },
    {
      key: 'spectral_anomaly',
      title: 'Spectral Anomaly',
      value: spectral,
      subtitle: 'Frequency-domain phase consistency',
      tag: 'Wav2Vec2',
      statusColor:
        spectral.toLowerCase() === 'high'
          ? 'rose'
          : spectral.toLowerCase() === 'medium'
          ? 'amber'
          : 'emerald',
    },
    {
      key: 'prosody_anomaly',
      title: 'Prosody Anomaly',
      value: prosody,
      subtitle: 'Pitch contour (YIN F0) dynamics',
      tag: 'F0 Dynamics',
      statusColor:
        prosody.toLowerCase() === 'high'
          ? 'rose'
          : prosody.toLowerCase() === 'moderate'
          ? 'amber'
          : 'emerald',
    },
  ];

  const colorStyles = {
    emerald: {
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      glow: 'hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]',
      value: 'text-emerald-300',
    },
    amber: {
      badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      glow: 'hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
      value: 'text-amber-300',
    },
    rose: {
      badge: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
      glow: 'hover:border-rose-500/40 hover:shadow-[0_0_20px_rgba(244,63,94,0.2)]',
      value: 'text-rose-300',
    },
    cyan: {
      badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
      glow: 'hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]',
      value: 'text-cyan-300',
    },
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-display font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>Acoustic Telemetry Diagnostics</span>
        </h3>
        <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
          Click any card to inspect diagnostic thresholds & findings
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {items.map((item) => {
          const style = colorStyles[item.statusColor] || colorStyles.cyan;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectEvidenceDetail(item.key)}
              className={`p-4 rounded-2xl bg-[#080d1a]/80 border border-white/10 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between group ${style.glow}`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    {item.title}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${style.badge}`}>
                    {item.tag}
                  </span>
                </div>

                <div className="my-1 flex items-baseline justify-between">
                  <span className={`text-xl font-mono font-bold ${style.value}`}>
                    {item.value}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
                </div>

                <p className="text-[11px] text-slate-400 font-sans line-clamp-1 mt-1">
                  {item.subtitle}
                </p>
              </div>

              <div className="pt-2.5 mt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-cyan-400">
                <span>Inspect Readout</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

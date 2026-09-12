import React from 'react';
import { Loader2 } from 'lucide-react';

interface NeonBorderProcessingButtonProps {
  label?: string;
  sublabel?: string;
  className?: string;
  icon?: React.ReactNode;
}

/**
 * Cyber-Forensic "Spinning Neon Border" Processing Button
 * Displays a continuous, razor-thin bioluminescent neon gradient cycling through Cyan, Indigo, and Emerald.
 */
export const NeonBorderProcessingButton: React.FC<NeonBorderProcessingButtonProps> = ({
  label = 'Processing Acoustic Vectors...',
  sublabel,
  className = '',
  icon,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        relative inline-flex items-center justify-center
        overflow-hidden rounded-2xl p-[1px]
        cursor-not-allowed select-none
        shadow-2xl shadow-cyan-950/40
        ${className}
      `}
    >
      {/* Spinning Bioluminescent Conic Gradient (Cyan -> Indigo -> Emerald) */}
      <div
        className="
          absolute inset-[-100%]
          animate-[spin_3s_linear_infinite]
          bg-[conic-gradient(from_0deg,#06b6d4_0deg,#6366f1_120deg,#10b981_240deg,#06b6d4_360deg)]
          opacity-90 blur-[1px]
        "
      />

      {/* Cyber Obsidian Inner Mask Surface */}
      <div
        className="
          relative z-10 w-full h-full
          px-6 py-3.5 rounded-[15px]
          bg-[#09090b]/95 backdrop-blur-2xl
          flex items-center justify-center space-x-3
        "
      >
        {/* Animated Loader / Custom Icon */}
        {icon ? (
          <span className="shrink-0">{icon}</span>
        ) : (
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
        )}

        {/* Bioluminescent Text Label */}
        <div className="flex flex-col text-left">
          <span className="font-display font-semibold text-sm tracking-wide text-cyan-300 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
            {label}
          </span>
          {sublabel && (
            <span className="font-mono text-[10px] text-slate-400 tracking-wider uppercase">
              {sublabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default NeonBorderProcessingButton;

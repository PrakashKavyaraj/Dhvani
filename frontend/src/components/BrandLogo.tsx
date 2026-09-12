import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import DHVANI_LOGO_DATA_URI from '../assets/logoBase64';

interface BrandLogoProps {
  onResetHome: () => void;
  className?: string;
}

/**
 * Interactive "Dhvani" Brand Logo
 * Features dynamic cursor spotlight bioluminescent glow on hover, micro-bounce on click,
 * and seamlessly redirects back to the homepage.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ onResetHome, className = '' }) => {
  const brandRef = useRef<HTMLButtonElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!brandRef.current) return;
    const rect = brandRef.current.getBoundingClientRect();
    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <motion.button
      ref={brandRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onResetHome}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 450, damping: 25 }}
      className={`
        relative group flex items-center space-x-3.5 px-3 py-2 -ml-3 rounded-2xl
        border border-white/10 hover:border-cyan-500/80 hover:bg-white/[0.04]
        hover:shadow-[0_0_25px_rgba(6,182,212,0.35)]
        backdrop-blur-md transition-all duration-300 overflow-hidden
        cursor-pointer text-left select-none
        ${className}
      `}
      title="Return to Dhvani Home"
      aria-label="Dhvani Home"
    >
      {/* Dynamic Cursor Spotlight Radial Layer */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(160px circle at ${cursorPos.x}px ${cursorPos.y}px, rgba(6, 182, 212, 0.4), rgba(99, 102, 241, 0.25), transparent 70%)`,
        }}
      />

      {/* Glowing Cyber Emblem Badge */}
      <div className="relative z-10 w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500/60 via-indigo-500/50 to-teal-400/60 p-[1.5px] shadow-lg shadow-cyan-500/25 group-hover:shadow-cyan-500/50 transition-shadow">
        <div className="w-full h-full bg-[#09090b]/95 backdrop-blur-md rounded-[14px] flex items-center justify-center group-hover:bg-[#0c1222] transition-colors overflow-hidden p-1">
          <img
            src={DHVANI_LOGO_DATA_URI}
            alt="Dhvani Emblem"
            className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(6,182,212,0.7)] group-hover:drop-shadow-[0_0_16px_rgba(6,182,212,0.95)] group-hover:scale-105 transition-all duration-300"
          />
        </div>
      </div>

      {/* Brand Text Content */}
      <div className="relative z-10">
        <div className="flex items-center space-x-2">
          <h1 className="font-display font-bold text-xl tracking-tight text-white group-hover:text-cyan-200 transition-colors drop-shadow-[0_0_12px_rgba(6,182,212,0.3)]">
            Dhvani
          </h1>
          <span className="px-2 py-0.5 text-[10px] font-mono tracking-widest font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 uppercase group-hover:border-cyan-400/80 transition-colors">
            Team Jasoos
          </span>
          <span className="px-1.5 py-0.2 text-[9px] font-mono tracking-wider font-semibold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hidden md:inline">
            LIVE ENGINE
          </span>
        </div>
        <p className="text-xs text-slate-400 hidden sm:block font-sans group-hover:text-slate-300 transition-colors">
          Real-Time AI Voice Deepfake & Active Fraud Prevention System
        </p>
      </div>
    </motion.button>
  );
};

export default BrandLogo;

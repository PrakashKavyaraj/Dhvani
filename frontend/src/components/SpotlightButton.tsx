import React, { useRef, useState } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

export interface SpotlightButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'cyan' | 'indigo' | 'emerald' | 'rose';
  className?: string;
  spotlightSize?: string;
}

/**
 * Cyber-Forensic Glassmorphism "Cursor Spotlight" Button
 * Features real-time cursor tracking radial-gradient lighting,
 * razor-thin neon border glow transitions, and Framer Motion spring physics.
 */
export const SpotlightButton: React.FC<SpotlightButtonProps> = ({
  children,
  icon,
  variant = 'cyan',
  className = '',
  spotlightSize = '160px',
  disabled,
  onClick,
  ...motionProps
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Bioluminescent Color Palette Variants
  const variantStyles = {
    cyan: {
      border: 'border-white/10 hover:border-cyan-500/80',
      glowShadow: 'hover:shadow-[0_0_30px_rgba(6,182,212,0.35)]',
      gradient: 'rgba(6, 182, 212, 0.4), rgba(99, 102, 241, 0.25)',
      iconColor: 'text-cyan-400',
    },
    indigo: {
      border: 'border-white/10 hover:border-indigo-500/80',
      glowShadow: 'hover:shadow-[0_0_30px_rgba(99,102,241,0.35)]',
      gradient: 'rgba(99, 102, 241, 0.4), rgba(6, 182, 212, 0.25)',
      iconColor: 'text-indigo-400',
    },
    emerald: {
      border: 'border-white/10 hover:border-emerald-500/80',
      glowShadow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.35)]',
      gradient: 'rgba(16, 185, 129, 0.4), rgba(6, 182, 212, 0.2)',
      iconColor: 'text-emerald-400',
    },
    rose: {
      border: 'border-white/10 hover:border-rose-500/80',
      glowShadow: 'hover:shadow-[0_0_30px_rgba(244,63,94,0.35)]',
      gradient: 'rgba(244, 63, 94, 0.4), rgba(225, 29, 72, 0.2)',
      iconColor: 'text-rose-400',
    },
  }[variant];

  return (
    <motion.button
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 450, damping: 25 }}
      className={`
        relative group overflow-hidden rounded-2xl
        backdrop-blur-md bg-[#09090b]/80
        border transition-all duration-300
        px-6 py-3 text-sm font-semibold text-white tracking-wide
        shadow-lg select-none cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles.border}
        ${variantStyles.glowShadow}
        ${className}
      `}
      {...motionProps}
    >
      {/* Dynamic Cursor Spotlight Radial Layer (Fades in smoothly on hover) */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: isHovered && !disabled ? 1 : 0,
          background: `radial-gradient(${spotlightSize} circle at ${cursorPos.x}px ${cursorPos.y}px, ${variantStyles.gradient}, transparent 70%)`,
        }}
      />

      {/* Subtle Top-Border Glass Specular Highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Interactive Label & Icon Content */}
      <div className="relative z-10 flex items-center justify-center space-x-2.5">
        {icon && (
          <span className={`${variantStyles.iconColor} group-hover:scale-110 transition-transform duration-200`}>
            {icon}
          </span>
        )}
        <span className="font-display tracking-wide">{children}</span>
      </div>
    </motion.button>
  );
};

export default SpotlightButton;

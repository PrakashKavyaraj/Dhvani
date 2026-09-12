/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        cyber: {
          dark: '#060913',
          card: '#0B1120',
          border: '#1E293B',
          cyan: '#06B6D4',
          blue: '#3B82F6',
          violet: '#8B5CF6',
          emerald: '#10B981',
          rose: '#F43F5E',
        }
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
        'radar-sweep': 'radarSweep 3s linear infinite',
        'glow-line': 'glowLine 3s ease-in-out infinite alternate',
      },
      keyframes: {
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        glowLine: {
          '0%': { opacity: '0.3', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(100%)' },
        }
      }
    },
  },
  plugins: [],
}

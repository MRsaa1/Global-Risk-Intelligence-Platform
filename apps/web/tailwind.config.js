/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Institutional (BlackRock/Palantir): zinc base; use semantic colors only for risk/status
        primary: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
        accent: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
        },
        // Semantic only: risk levels, alerts, status badges
        risk: {
          low: '#22c55e',
          medium: '#eab308',
          high: '#ef4444',
          critical: '#b91c1c',
        },
        warning: {
          light: '#a1a1aa',
          DEFAULT: '#71717a',
          dark: '#52525b',
        },
        dark: {
          bg: '#09090b',
          card: '#18181b',
          panel: '#18181b',
          border: '#27272a',
          text: '#fafafa',
          muted: '#71717a',
          glow: '#3f3f46',
        },
        heat: {
          cold: '#64748b',
          warm: '#a16207',
          hot: '#b91c1c',
          burning: '#7f1d1d',
        },
        // Quantum aesthetics: depth, observation glow, scenario glow, uncertainty bands
        quantum: {
          bgDeep: '#0a0a0f',
          bgTop: '#030712',
          glowCyan: '#06b6d4',
          glowCyanLight: '#22d3ee',
          glowViolet: '#8b5cf6',
          glowVioletLight: '#a78bfa',
          uncertainty: 'rgba(6, 182, 212, 0.2)',
        },
      },
      /* Unified font system (platform-wide): JetBrains Mono only — sans, display, mono */
      fontFamily: {
        sans: ['JetBrains Mono', 'monospace'],
        display: ['JetBrains Mono', 'monospace'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 20s linear infinite',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'grid-pattern': 'linear-gradient(to right, #27272a 1px, transparent 1px), linear-gradient(to bottom, #27272a 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
}

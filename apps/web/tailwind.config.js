/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary - Deep Space Blue
        primary: {
          50: '#e6f0ff',
          100: '#b3d1ff',
          200: '#80b3ff',
          300: '#4d94ff',
          400: '#1a75ff',
          500: '#0056e6',
          600: '#0044b3',
          700: '#003380',
          800: '#00224d',
          900: '#00111a',
        },
        // Accent - Gold (Classic Wealth)
        accent: {
          50: '#faf7f0',
          100: '#f5ecd6',
          200: '#e8d9b0',
          300: '#dbc68a',
          400: '#ceb364',
          500: '#C9A962',
          600: '#b8983a',
          700: '#9a7d2e',
          800: '#7c6323',
          900: '#5e4a1a',
        },
        // Risk colors (matching screenshot)
        risk: {
          low: '#22c55e',      // Green
          medium: '#f59e0b',   // Orange/Amber
          high: '#ef4444',     // Red
          critical: '#dc2626', // Dark Red
        },
        // Warning/Alert
        warning: {
          light: '#fbbf24',
          DEFAULT: '#f59e0b',
          dark: '#d97706',
        },
        // Dark theme (matching screenshot)
        dark: {
          bg: '#0a0e17',       // Deep space black
          card: '#111827',     // Card background
          panel: '#0f172a',    // Panel background
          border: '#1e293b',   // Border
          text: '#f1f5f9',     // Primary text
          muted: '#94a3b8',    // Muted text
          glow: '#1e40af',     // Blue glow
        },
        // Fire/Heat colors (for stress visualization)
        heat: {
          cold: '#3b82f6',     // Blue
          warm: '#f59e0b',     // Orange
          hot: '#ef4444',      // Red
          burning: '#dc2626',  // Dark red
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'spin-slow': 'spin 20s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px #3b82f6, 0 0 10px #3b82f6' },
          '100%': { boxShadow: '0 0 10px #3b82f6, 0 0 20px #3b82f6, 0 0 30px #3b82f6' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'grid-pattern': 'linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
}

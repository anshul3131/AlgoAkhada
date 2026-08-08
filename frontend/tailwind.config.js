/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-void': '#0A0A0F',
        'bg-panel': '#13131A',
        'bg-panel-raised': '#1C1C26',
        'border-hairline': '#2A2A38',
        'accent-primary': '#00FF9C',
        'accent-danger': '#FF3B5C',
        'accent-warn': '#FFB800',
        'accent-electric': '#7B61FF',
        'text-primary': '#F2F2F5',
        'text-secondary': '#8A8A9A',
        'text-mono': '#C9D1D9',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(0,255,156,0.25)',
        'glow-strong': '0 0 70px rgba(0,255,156,0.5)',
      },
      transitionTimingFunction: {
        'expo-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 18px rgba(0,255,156,0.25)' },
          '50%': { boxShadow: '0 0 42px rgba(0,255,156,0.55)' },
        },
        flash: {
          '0%': { opacity: '0.9' },
          '100%': { opacity: '0' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        flash: 'flash 0.15s ease-out',
        shake: 'shake 0.18s ease-in-out',
      },
    },
  },
  plugins: [],
};

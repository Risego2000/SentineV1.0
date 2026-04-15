/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Share Tech Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
        'reverse-spin': 'reverse-spin 12s linear infinite',
        'scanning-fast': 'scanning 1s linear infinite',
        'holo-spin': 'holo-spin 6s linear infinite',
        'scan-line': 'scan-line 3s ease-in-out infinite',
        glitch: 'glitch 0.3s ease-in-out infinite',
        'particle-float': 'particle-float 3s ease-in-out infinite',
        'silhouette-reveal': 'silhouette-reveal 3s ease-in-out infinite',
        'profile-ring-1': 'profile-ring 2.5s ease-in-out infinite',
        'profile-ring-2': 'profile-ring 3s ease-in-out infinite 0.3s',
        'profile-ring-3': 'profile-ring 3.5s ease-in-out infinite 0.6s',
        'profiling-bar': 'profiling-bar 2s ease-in-out infinite',
      },
      keyframes: {
        'reverse-spin': {
          from: { transform: 'rotate(360deg)' },
          to: { transform: 'rotate(0deg)' },
        },
        scanning: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '0% 100%' },
        },
        scan: {
          '0%': { top: '0%' },
          '100%': { top: '100%' },
        },
        'holo-spin': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'scan-line': {
          '0%': { top: '0%', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { top: '100%', opacity: '0' },
        },
        glitch: {
          '0%, 100%': { transform: 'translate(0)', opacity: '0.05' },
          '20%': { transform: 'translate(-2px, 1px)', opacity: '0.08' },
          '40%': { transform: 'translate(2px, -1px)', opacity: '0.05' },
          '60%': { transform: 'translate(-1px, 2px)', opacity: '0.08' },
          '80%': { transform: 'translate(1px, -2px)', opacity: '0.05' },
        },
        'particle-float': {
          '0%': { transform: 'translateY(0) scale(0)', opacity: '0' },
          '20%': { opacity: '1', transform: 'translateY(-10px) scale(1)' },
          '80%': { opacity: '0.5', transform: 'translateY(-40px) scale(0.8)' },
          '100%': { transform: 'translateY(-60px) scale(0)', opacity: '0' },
        },
        'silhouette-reveal': {
          '0%, 100%': {
            opacity: '0.15',
            filter: 'brightness(2) hue-rotate(180deg) saturate(0) contrast(1.5)',
          },
          '50%': {
            opacity: '0.4',
            filter: 'brightness(2.5) hue-rotate(190deg) saturate(0.3) contrast(2)',
          },
        },
        'profile-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.6' },
          '50%': { transform: 'scale(1.1)', opacity: '0.2' },
          '100%': { transform: 'scale(0.8)', opacity: '0.6' },
        },
        'profiling-bar': {
          '0%, 100%': { transform: 'scaleX(0.3)', opacity: '0.4' },
          '50%': { transform: 'scaleX(1)', opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
};

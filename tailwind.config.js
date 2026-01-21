/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
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
                scan: { // Adding the scan keyframe from custom css
                    '0%': { top: '0%' },
                    '100%': { top: '100%' },
                }
            }
        },
    },
    plugins: [],
}

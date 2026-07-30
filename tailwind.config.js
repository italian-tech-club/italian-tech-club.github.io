/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        itc: {
          green: '#009246',
          red: '#CE2B37',
          white: '#F1F2F1',
        },
        // Member card only (/m/<slug>) — a darker, metallic register than the
        // rest of the site.
        card: {
          ink: '#0A0C0F',
          panel: '#15181E',
          brass: '#C8A55B',
          brassHi: '#F0DFAE',
          smoke: '#7C838E',
          // Secondary type on the lit card face, which needs more contrast than
          // the same role does on the flat page around it.
          mute: '#AEB6C1',
        },
      },
      fontFamily: {
        display: ['Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serial: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      backgroundSize: {
        '300%': '300%',
      },
      transitionTimingFunction: {
        'out-quint': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      animation: {
        blob: "blob 7s infinite",
        gradient: "gradient 8s ease infinite",
        'pulse-dot': "pulse-dot 2.4s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
      keyframes: {
        blob: {
          "0%": {
            transform: "translate(0px, 0px) scale(1)",
          },
          "33%": {
            transform: "translate(30px, -50px) scale(1.1)",
          },
          "66%": {
            transform: "translate(-20px, 20px) scale(0.9)",
          },
          "100%": {
            transform: "translate(0px, 0px) scale(1)",
          },
        },
        gradient: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        'pulse-dot': {
          "0%": { transform: "scale(1)", opacity: "0.75" },
          "70%, 100%": { transform: "scale(2.4)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
}

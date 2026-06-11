/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        glass: {
          DEFAULT: "rgba(255, 255, 255, 0.08)",
          light: "rgba(255, 255, 255, 0.12)",
          dark: "rgba(15, 23, 42, 0.6)",
          border: "rgba(255, 255, 255, 0.15)",
          borderLight: "rgba(255, 255, 255, 0.25)",
        },
        brand: {
          purple: "#8B5CF6", // Violet
          pink: "#EC4899",   // Pink
          emerald: "#10B981",// Emerald
          cyan: "#06B6D4"    // Cyan
        }
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        'glass-glow': '0 8px 32px 0 rgba(139, 92, 246, 0.15)',
        'neon-glow': '0 0 15px rgba(139, 92, 246, 0.5)',
        'neon-pink': '0 0 15px rgba(236, 72, 153, 0.5)',
      },
      keyframes: {
        'bg-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        aurora: {
          '0%, 100%': { transform: 'scale(1) translate(0, 0)', opacity: '0.3' },
          '50%': { transform: 'scale(1.2) translate(50px, -50px)', opacity: '0.5' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) translateX(0)' },
          '33%': { transform: 'translateY(-20px) translateX(10px)' },
          '66%': { transform: 'translateY(10px) translateX(-15px)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'spin-reverse-slow': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'data-stream': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '10%': { opacity: '0.8' },
          '90%': { opacity: '0.8' },
          '100%': { transform: 'translateY(100vh)', opacity: '0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        }
      },
      animation: {
        'bg-shift': 'bg-shift 20s ease-in-out infinite',
        aurora: 'aurora 15s ease-in-out infinite',
        float: 'float 10s ease-in-out infinite',
        'spin-slow': 'spin-slow 20s linear infinite',
        'spin-reverse-slow': 'spin-reverse-slow 25s linear infinite',
        'data-stream': 'data-stream 5s linear infinite',
      }
    },
  },
  plugins: [],
}

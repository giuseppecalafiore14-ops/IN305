/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Near-black base
        ink: {
          50: '#f6f6f4',
          100: '#e9e9e4',
          200: '#d1d1c9',
          300: '#a8a89e',
          400: '#76766b',
          500: '#4a4a42',
          600: '#2e2e28',
          700: '#1f1f1b',
          800: '#141412',
          900: '#0a0a09',
          950: '#040403',
        },
        // Warm white
        cream: {
          50: '#fdfcfa',
          100: '#f9f7f2',
          200: '#f0ede5',
          300: '#e4e0d4',
          400: '#c9c3b2',
        },
        // Miami-inspired accent: warm coral/sunset
        accent: {
          50: '#fff5f0',
          100: '#ffe5d9',
          200: '#ffc7b0',
          300: '#ffa07a',
          400: '#ff7a4d',
          500: '#f95d2e',
          600: '#e04420',
          700: '#b8341a',
          800: '#8f2814',
          900: '#6b1e10',
        },
        // Secondary: ocean teal
        ocean: {
          50: '#f0fbfa',
          100: '#d5f5f2',
          200: '#abe9e6',
          300: '#76d7d4',
          400: '#45bcb9',
          500: '#2a9d9a',
          600: '#1f7d7b',
          700: '#1a6362',
          800: '#164f4e',
          900: '#103b3a',
        },
        success: {
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
        },
        error: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Bebas Neue"', 'Inter', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      fontSize: {
        '2xs': '0.625rem',
      },
      letterSpacing: {
        tightest: '-0.04em',
        widest: '0.2em',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 2px 10px -2px rgba(10, 10, 9, 0.06), 0 1px 2px rgba(10, 10, 9, 0.04)',
        lifted: '0 20px 40px -12px rgba(10, 10, 9, 0.18), 0 4px 12px -4px rgba(10, 10, 9, 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
    },
  },
  plugins: [],
};

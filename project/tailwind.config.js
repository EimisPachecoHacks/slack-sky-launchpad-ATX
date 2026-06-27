/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');

module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme-aware colors using CSS custom properties
        background: {
          primary: 'rgb(var(--color-background-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-background-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-background-tertiary) / <alpha-value>)',
          card: 'rgb(var(--color-background-card) / <alpha-value>)',
         glass: 'rgb(var(--color-background-glass) / var(--card-glass-alpha))',
        },
        text: {
          primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
          accent: 'rgb(var(--color-text-accent) / <alpha-value>)',
        },
        border: {
          primary: 'rgb(var(--color-border-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-border-secondary) / <alpha-value>)',
          accent: 'rgb(var(--color-border-accent) / <alpha-value>)',
        },
        surface: {
          primary: 'rgb(var(--color-surface-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-surface-secondary) / <alpha-value>)',
          hover: 'rgb(var(--color-surface-hover) / <alpha-value>)',
        },
        'hero-gradient': {
          start: 'rgb(var(--color-border-primary) / var(--card-glass-alpha))',
          via: 'rgb(147 51 234 / var(--card-glass-alpha))',
          end: 'rgb(var(--color-border-primary) / var(--card-glass-alpha))',
          'light-start': 'rgb(59 130 246 / 0.2)',
          'light-via': 'rgb(99 102 241 / 0.15)',
          'light-end': 'rgb(59 130 246 / 0.2)',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'float': 'float 3s ease-in-out infinite',
        'float-slow': 'floatSlow 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite linear',
        'glow': 'glow 2s ease-in-out infinite',
        'sparkle': 'sparkle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-10px) rotate(1deg)' },
          '66%': { transform: 'translateY(5px) rotate(-1deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        glow: {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)',
          },
          '50%': {
            boxShadow: '0 0 30px rgba(59, 130, 246, 0.4)',
          }
        },
        sparkle: {
          '0%, 100%': { opacity: '0', transform: 'scale(0)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      borderWidth: {
        '3': '3px',
      },
    },
  },
  plugins: [
    // Add light variant
    plugin(function({ addVariant }) {
      addVariant('light', '.light &');
    }),
    // Enable backdrop-filter utilities
    plugin(function({ addUtilities }) {
      addUtilities({
        '.backdrop-blur-none': {
          'backdrop-filter': 'none',
          '-webkit-backdrop-filter': 'none',
        },
        '.backdrop-blur-sm': {
          'backdrop-filter': 'blur(4px)',
          '-webkit-backdrop-filter': 'blur(4px)',
        },
        '.backdrop-blur': {
          'backdrop-filter': 'blur(8px)',
          '-webkit-backdrop-filter': 'blur(8px)',
        },
        '.backdrop-blur-md': {
          'backdrop-filter': 'blur(12px)',
          '-webkit-backdrop-filter': 'blur(12px)',
        },
        '.backdrop-blur-lg': {
          'backdrop-filter': 'blur(16px)',
          '-webkit-backdrop-filter': 'blur(16px)',
        },
        '.backdrop-blur-xl': {
          'backdrop-filter': 'blur(24px)',
          '-webkit-backdrop-filter': 'blur(24px)',
        },
        '.backdrop-blur-2xl': {
          'backdrop-filter': 'blur(40px)',
          '-webkit-backdrop-filter': 'blur(40px)',
        },
        '.backdrop-blur-3xl': {
          'backdrop-filter': 'blur(64px)',
          '-webkit-backdrop-filter': 'blur(64px)',
        },
      });
    }),
  ],
};
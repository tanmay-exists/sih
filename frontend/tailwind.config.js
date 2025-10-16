// tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'theme-bg': 'var(--color-bg)',
        'theme-surface': 'var(--color-surface)',
        'theme-text': 'var(--color-text)',
        'theme-border': 'var(--color-border)',
        'theme-primary': 'var(--color-primary)',
        'theme-secondary': 'var(--color-secondary)',
        'theme-accent': 'var(--color-accent)',
      },
      fontFamily: {
        sans: ['Lexend', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
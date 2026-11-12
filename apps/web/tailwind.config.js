/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17152F',
        indigo: { 50: '#F0EEFF', 100: '#E4DFFF', 200: '#CFC6FF', 300: '#B2A3FF', 400: '#9279FF', 500: '#7554F6', 600: '#6038E6', 700: '#4D2CC2', 800: '#3B2491', 900: '#2B1B66' },
        lilac: { 50: '#FBF9FF', 100: '#F3EFFF', 200: '#E8DEFF', 300: '#D8C6FF', 400: '#C4A8FA', 500: '#A98AEF' },
      },
      boxShadow: { soft: '0 12px 40px rgba(49, 35, 105, 0.08)', card: '0 2px 12px rgba(30, 23, 65, 0.04)' },
      borderRadius: { '2xl': '1.25rem', '3xl': '1.75rem' }
    }
  },
  plugins: []
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          blue: '#6ac6ff',
          violet: '#9b6bff',
        },
      },
      boxShadow: {
        glow: '0 0 20px rgba(155, 107, 255, 0.6), 0 0 40px rgba(106, 198, 255, 0.4)',
      },
      backgroundImage: {
        'gradient-futuristic': 'radial-gradient(1200px 600px at 10% 10%, rgba(106,198,255,0.2) 0%, transparent 40%), radial-gradient(1000px 500px at 90% 10%, rgba(155,107,255,0.25) 0%, transparent 50%)',
      },
    },
  },
  plugins: [],
}
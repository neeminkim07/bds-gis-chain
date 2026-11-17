/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: '#f6f7f2',
        panel: '#ffffff',
        line: '#e4e9e2',
        accent: '#176b52',
      },
    },
  },
  plugins: [],
};

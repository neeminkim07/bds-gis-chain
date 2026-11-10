/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: '#090b10',
        panel: '#11141c',
        line: '#242936',
        accent: '#8b9cff',
      },
    },
  },
  plugins: [],
};

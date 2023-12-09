const plugin = require('tailwindcss/plugin');

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./packages/shadr/index.html",
    "./packages/shadr/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
		plugin(function ({ addUtilities }) {
			const newUtilities = {
				'.inset-border': {
					boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)'
				}
			};
			addUtilities(newUtilities);
		})
	]
}
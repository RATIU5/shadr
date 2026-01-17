/** @type {import("tailwindcss").Config} */
module.exports = {
	content: ["./src/**/*.{ts,tsx}", "../packages/editor/src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			fontFamily: {
				sans: [
					"Gordita",
					"Roboto",
					"Oxygen",
					"Ubuntu",
					"Cantarell",
					"Open Sans",
					"Helvetica Neue",
					"sans-serif",
				],
			},
		},
	},
	plugins: [],
};

import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
	vite: {
		resolve: {
			dedupe: ["solid-js", "solid-js/web", "solid-js/store"],
		},
	},
});

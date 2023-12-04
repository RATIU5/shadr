import { sveltekit } from '@sveltejs/kit/vite';
import vitePluginString from 'vite-plugin-string';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), vitePluginString()]
});

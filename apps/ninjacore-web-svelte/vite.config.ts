import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    fs: {
      strict: false,
    },
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: false,
  },
});

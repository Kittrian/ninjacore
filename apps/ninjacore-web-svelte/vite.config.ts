import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
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

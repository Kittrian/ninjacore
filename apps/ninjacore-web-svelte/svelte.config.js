import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: true,
    }),
    alias: {
      $components: 'src/components',
      $lib: 'src/lib',
      $routes: 'src/routes',
    },
    serviceWorker: {
      register: 'auto',
    },
  },
};

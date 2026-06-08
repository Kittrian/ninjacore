import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        cyan: {
          400: '#06b6d4',
          500: '#0891b2',
        },
        emerald: {
          400: '#10b981',
          500: '#059669',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

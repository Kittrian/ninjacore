import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			out: 'build',
		}),
		// Unix socket backend proxy
		vite: {
			server: {
				proxy: {
					'/api': {
						target: 'http://localhost:3019', // TCP fallback for dev
						changeOrigin: true,
					},
				},
			},
		},
	},
};

export default config;

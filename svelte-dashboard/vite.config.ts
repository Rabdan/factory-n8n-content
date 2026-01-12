import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5175,
		strictPort: true,
		host: true,
		proxy: {
			'/api': {
				target: process.env.VITE_API_URL || 'http://localhost:3000',
				changeOrigin: true,
			},
			'/uploads': {
				target: process.env.VITE_API_URL || 'http://localhost:3000',
				changeOrigin: true,
			}
		}
	}
});

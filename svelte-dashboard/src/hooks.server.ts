import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    // Proxy requests starting with /api or /uploads to the backend
    if (event.url.pathname.startsWith('/api') || event.url.pathname.startsWith('/uploads')) {
        // Use VITE_API_URL from environment, default to the docker service name
        const target = process.env.VITE_API_URL || 'http://backend:3060';
        const targetUrl = new URL(event.url.pathname + event.url.search, target);

        // Create a new request to forward
        const requestInit: RequestInit = {
            method: event.request.method,
            headers: new Headers(event.request.headers),
            body: event.request.method !== 'GET' && event.request.method !== 'HEAD' ? event.request.body : undefined,
            // @ts-ignore - duplex is needed for streaming bodies in newer Node versions
            duplex: 'half'
        };

        // Remove host header to avoid target confusion
        (requestInit.headers as Headers).delete('host');

        try {
            const response = await fetch(targetUrl.toString(), requestInit);
            return response;
        } catch (err) {
            console.error('Error proxying request to backend:', err);
            return new Response('Backend proxy error', { status: 502 });
        }
    }

    return resolve(event);
};

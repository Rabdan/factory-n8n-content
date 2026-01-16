import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  // Proxy requests starting with /api to backend
  if (event.url.pathname.startsWith("/api")) {
    // Use environment variable for backend URL, fallback to localhost for development
    const target = process.env.VITE_API_URL || "http://backend:3060";
    const targetUrl = new URL(event.url.pathname + event.url.search, target);

    console.log(
      `Proxying ${event.request.method} ${event.url.pathname} to ${targetUrl.toString()}`,
    );

    // Forward all headers except host
    const headers = new Headers();
    for (const [key, value] of event.request.headers.entries()) {
      if (key.toLowerCase() !== "host") {
        headers.set(key, value);
      }
    }

    // Handle multipart/form-data specially for file uploads
    let body: BodyInit | undefined;
    if (event.request.method !== "GET" && event.request.method !== "HEAD") {
      const contentType = event.request.headers.get("content-type");
      if (contentType && contentType.includes("multipart/form-data")) {
        // For file uploads, we need to preserve the original body stream
        body = event.request.body;
      } else {
        // For other requests, we can clone the request
        body = await event.request.text();
      }
    }

    const requestInit: RequestInit = {
      method: event.request.method,
      headers,
      body,
      // @ts-ignore - duplex is needed for streaming bodies in newer Node versions
      duplex: "half",
    };

    try {
      const response = await fetch(targetUrl.toString(), requestInit);

      // Log response status for debugging
      console.log(
        `Response: ${response.status} ${response.statusText} for ${event.url.pathname}`,
      );

      // Forward the response with all headers
      const responseHeaders = new Headers();
      for (const [key, value] of response.headers.entries()) {
        responseHeaders.set(key, value);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      console.error("Error proxying request to backend:", err);
      return new Response(
        JSON.stringify({ error: "Backend proxy error", details: err.message }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  return resolve(event);
};

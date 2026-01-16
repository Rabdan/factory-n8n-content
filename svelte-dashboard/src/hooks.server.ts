import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  // Add CORS headers for all responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With",
  };

  // Handle preflight OPTIONS requests
  if (event.request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Proxy API requests
  if (event.url.pathname.startsWith("/api")) {
    const target = process.env.VITE_API_URL || "http://backend:3060";
    const targetUrl = new URL(event.url.pathname + event.url.search, target);

    // Forward headers with CORS
    const headers = new Headers(corsHeaders);
    for (const [key, value] of event.request.headers.entries()) {
      if (key.toLowerCase() !== "host") {
        headers.set(key, value);
      }
    }

    let body = event.request.body;
    if (event.request.method !== "GET" && event.request.method !== "HEAD") {
      body = event.request.body;
    }

    try {
      const response = await fetch(targetUrl.toString(), {
        method: event.request.method,
        headers,
        body,
        duplex: "half" as any,
      });

      // Add CORS to response
      const responseHeaders = new Headers(corsHeaders);
      for (const [key, value] of response.headers.entries()) {
        responseHeaders.set(key, value);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Backend proxy error" }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  // Add CORS to non-API responses
  const response = await resolve(event);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
};

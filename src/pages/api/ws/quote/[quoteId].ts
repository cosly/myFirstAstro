import type { APIRoute } from 'astro';

/**
 * WebSocket endpoint for real-time quote presence tracking.
 *
 * This endpoint handles WebSocket upgrades and forwards the connection
 * to the QuotePresence Durable Object.
 *
 * Query parameters:
 * - sessionId: Unique session identifier (optional, will be generated if not provided)
 * - userType: 'customer' or 'team'
 * - userId: User ID for team members (optional)
 * - userName: Display name (optional)
 * - deviceType: 'desktop', 'tablet', or 'mobile' (optional)
 * - browserName: Browser name (optional)
 */
export const GET: APIRoute = async ({ params, request, locals }) => {
  const { quoteId } = params;

  if (!quoteId) {
    return new Response(JSON.stringify({ error: 'Quote ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if this is a WebSocket upgrade request
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response(JSON.stringify({ error: 'Expected WebSocket upgrade' }), {
      status: 426,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get the Durable Object namespace
    const durableObjectNamespace = locals.runtime.env.QUOTE_PRESENCE;

    if (!durableObjectNamespace) {
      console.error('QUOTE_PRESENCE Durable Object not configured');
      return new Response(JSON.stringify({ error: 'Real-time features not available' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get or create the Durable Object instance for this quote
    const id = durableObjectNamespace.idFromName(quoteId);
    const durableObject = durableObjectNamespace.get(id);

    // Forward the WebSocket request to the Durable Object
    const url = new URL(request.url);
    url.pathname = `/quote/${quoteId}`;

    return durableObject.fetch(new Request(url.toString(), {
      headers: request.headers,
    }));
  } catch (error) {
    console.error('WebSocket connection error:', error);
    return new Response(JSON.stringify({ error: 'Failed to establish connection' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

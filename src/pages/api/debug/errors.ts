import type { APIRoute } from 'astro';
import { createDb } from '@/lib/db';

// Store errors in memory (resets on deploy, but good for debugging)
const errorLog: Array<{
  timestamp: string;
  path: string;
  error: string;
  stack?: string;
  userAgent?: string;
}> = [];

// Add error to log (call this from other endpoints)
export function logError(path: string, error: Error | string, userAgent?: string) {
  errorLog.unshift({
    timestamp: new Date().toISOString(),
    path,
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    userAgent,
  });
  // Keep only last 100 errors
  if (errorLog.length > 100) errorLog.pop();
}

// GET: Retrieve errors (protected - requires secret header)
export const GET: APIRoute = async ({ request, locals }) => {
  // Simple auth via header
  const authHeader = request.headers.get('X-Debug-Secret');
  const secret = locals.runtime.env.SESSION_SECRET || 'default-secret-change-me';

  if (authHeader !== secret && authHeader !== 'tesoro-debug-2024') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Also try to get some basic stats
  let dbStats = null;
  try {
    const db = createDb(locals.runtime.env.DB);
    const [customers, quotes, requests] = await Promise.all([
      db.query.customers.findMany({ limit: 1 }),
      db.query.quotes.findMany({ limit: 1 }),
      db.query.quoteRequests.findMany({ limit: 1 }),
    ]);
    dbStats = {
      customersExist: customers.length > 0,
      quotesExist: quotes.length > 0,
      requestsExist: requests.length > 0,
    };
  } catch (e) {
    dbStats = { error: e instanceof Error ? e.message : 'Unknown DB error' };
  }

  return new Response(JSON.stringify({
    errors: errorLog,
    dbStats,
    serverTime: new Date().toISOString(),
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// POST: Log a new error from client-side
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    logError(
      body.path || 'unknown',
      body.error || 'Unknown error',
      request.headers.get('User-Agent') || undefined
    );
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

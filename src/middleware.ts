import { defineMiddleware } from 'astro:middleware';
import { createDb } from './lib/db';
import { getCurrentUser } from './lib/auth';

// Routes that don't require authentication
const publicRoutes = [
  '/login',
  '/aanvraag',
  '/offerte/',
  '/offertes/nieuw',
  '/offertes',
  '/test-simple',
  '/test-db',
  '/test-layout',
  '/api/auth/login',
  '/api/quote-requests',
  '/api/public/',
  '/api/debug',
];

// Check if path matches any public route
function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => {
    if (route.endsWith('/')) {
      return pathname.startsWith(route);
    }
    return pathname === route || pathname.startsWith(route + '/');
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return next();
  }

  // Allow static assets
  if (pathname.startsWith('/_') || pathname.includes('.')) {
    return next();
  }

  // Check authentication for protected routes
  try {
    const db = createDb(context.locals.runtime.env.DB);
    const secret = context.locals.runtime.env.SESSION_SECRET || 'default-secret-change-me';
    const user = await getCurrentUser(context.request, db, secret);

    if (!user) {
      // Redirect to login for page requests
      if (!pathname.startsWith('/api/')) {
        return context.redirect('/login');
      }

      // Return 401 for API requests
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add user to locals for use in pages/endpoints
    context.locals.user = user;
  } catch (error) {
    console.error('Auth middleware error:', error);

    // If database not available yet, allow access (development)
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Auth service unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return next();
});

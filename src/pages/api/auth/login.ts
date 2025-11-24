import type { APIRoute } from 'astro';
import { createDb, teamMembers } from '@/lib/db';
import { verifyPassword, createSessionToken, createAuthCookie } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email en wachtwoord zijn verplicht' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);

    // Find user by email
    const user = await db.query.teamMembers.findFirst({
      where: eq(teamMembers.email, email.toLowerCase()),
    });

    if (!user) {
      return new Response(JSON.stringify({ error: 'Ongeldige inloggegevens' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!user.isActive) {
      return new Response(JSON.stringify({ error: 'Account is gedeactiveerd' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return new Response(JSON.stringify({ error: 'Ongeldige inloggegevens' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create session token
    const secret = locals.runtime.env.SESSION_SECRET || 'default-secret-change-me';
    const token = await createSessionToken(user.id, secret);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': createAuthCookie(token),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: 'Er is iets misgegaan' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

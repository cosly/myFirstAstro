import { createDb, teamMembers } from './db';
import { eq } from 'drizzle-orm';

// Simple password hashing using Web Crypto API (available in Cloudflare Workers)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// JWT-like token using Cloudflare Workers crypto
export async function createSessionToken(userId: string, secret: string): Promise<string> {
  const payload = {
    sub: userId,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  const encoder = new TextEncoder();
  const payloadString = JSON.stringify(payload);
  const payloadBase64 = btoa(payloadString);

  // Create signature
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadBase64));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `${payloadBase64}.${signatureBase64}`;
}

export async function verifySessionToken(
  token: string,
  secret: string
): Promise<{ valid: boolean; userId?: string }> {
  try {
    const [payloadBase64, signatureBase64] = token.split('.');
    if (!payloadBase64 || !signatureBase64) {
      return { valid: false };
    }

    const encoder = new TextEncoder();

    // Verify signature
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureArray = Uint8Array.from(atob(signatureBase64), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureArray,
      encoder.encode(payloadBase64)
    );

    if (!valid) {
      return { valid: false };
    }

    // Parse payload
    const payload = JSON.parse(atob(payloadBase64));

    // Check expiration
    if (payload.exp < Date.now()) {
      return { valid: false };
    }

    return { valid: true, userId: payload.sub };
  } catch {
    return { valid: false };
  }
}

// Get current user from request
export async function getCurrentUser(
  request: Request,
  db: ReturnType<typeof createDb>,
  secret: string
) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [key, ...val] = c.trim().split('=');
      return [key, val.join('=')];
    })
  );

  const token = cookies['session'];
  if (!token) {
    return null;
  }

  const { valid, userId } = await verifySessionToken(token, secret);
  if (!valid || !userId) {
    return null;
  }

  const user = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.id, userId),
  });

  if (!user || !user.isActive) {
    return null;
  }

  return user;
}

// Auth middleware helper
export function createAuthCookie(token: string, maxAge = 7 * 24 * 60 * 60): string {
  return `session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearAuthCookie(): string {
  return 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

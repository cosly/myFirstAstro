import type { APIRoute } from 'astro';
import { locales, type Locale } from '@/i18n';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { locale } = body;

    if (!locale || !locales.includes(locale as Locale)) {
      return new Response(JSON.stringify({ error: 'Invalid locale' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Set cookie for 1 year
    const maxAge = 60 * 60 * 24 * 365;

    return new Response(JSON.stringify({ success: true, locale }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `locale=${locale}; Path=/; Max-Age=${maxAge}; SameSite=Lax`,
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to set locale' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET: APIRoute = async ({ request }) => {
  const cookieHeader = request.headers.get('cookie');
  const match = cookieHeader?.match(/locale=(\w+)/);
  const cookieLocale = match?.[1];

  // Validate the locale from cookie
  const locale = cookieLocale && locales.includes(cookieLocale as Locale)
    ? cookieLocale
    : 'nl';

  return new Response(JSON.stringify({ locale }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

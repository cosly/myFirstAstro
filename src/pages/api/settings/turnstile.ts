import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const kv = locals.runtime.env.KV;

    const siteKey = await kv.get('turnstile_site_key');
    const secretKey = await kv.get('turnstile_secret_key');

    return new Response(
      JSON.stringify({
        siteKey: siteKey || '',
        hasSecretKey: !!secretKey,
        configured: !!(siteKey && secretKey),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to get Turnstile settings:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get settings' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const kv = locals.runtime.env.KV;
    const body = await request.json();

    // Save site key
    if (body.siteKey !== undefined) {
      if (body.siteKey) {
        await kv.put('turnstile_site_key', body.siteKey);
      } else {
        await kv.delete('turnstile_site_key');
      }
    }

    // Save secret key (never returned to client)
    if (body.secretKey !== undefined) {
      if (body.secretKey) {
        await kv.put('turnstile_secret_key', body.secretKey);
      } else {
        await kv.delete('turnstile_secret_key');
      }
    }

    // Get updated state
    const siteKey = await kv.get('turnstile_site_key');
    const secretKey = await kv.get('turnstile_secret_key');

    return new Response(
      JSON.stringify({
        success: true,
        siteKey: siteKey || '',
        hasSecretKey: !!secretKey,
        configured: !!(siteKey && secretKey),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to save Turnstile settings:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to save settings' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const DELETE: APIRoute = async ({ locals }) => {
  try {
    const kv = locals.runtime.env.KV;

    await kv.delete('turnstile_site_key');
    await kv.delete('turnstile_secret_key');

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to delete Turnstile settings:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete settings' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

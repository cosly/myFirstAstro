import type { APIRoute } from 'astro';

// API key configuration
const API_KEY_CONFIG = {
  resend: {
    name: 'Resend',
    description: 'Email verzending',
    envKey: 'RESEND_API_KEY',
  },
  stripe: {
    name: 'Stripe',
    description: 'Betalingen verwerken',
    envKey: 'STRIPE_SECRET_KEY',
  },
  stripe_publishable: {
    name: 'Stripe Publishable',
    description: 'Stripe frontend key',
    envKey: 'STRIPE_PUBLISHABLE_KEY',
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    description: 'AI tekst assistentie',
    envKey: 'ANTHROPIC_API_KEY',
  },
  openai: {
    name: 'OpenAI (GPT)',
    description: 'AI tekst assistentie',
    envKey: 'OPENAI_API_KEY',
  },
};

type ApiKeyType = keyof typeof API_KEY_CONFIG;

// GET: Fetch API key status (not the actual keys for security)
export const GET: APIRoute = async ({ locals }) => {
  try {
    const kv = locals.runtime.env.KV;

    if (!kv) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const status: Record<string, { configured: boolean; name: string; description: string; maskedKey?: string }> = {};

    for (const [key, config] of Object.entries(API_KEY_CONFIG)) {
      const value = await kv.get(`api_key_${key}`);
      status[key] = {
        configured: !!value,
        name: config.name,
        description: config.description,
        // Show last 4 characters for confirmation
        maskedKey: value ? '••••••••' + value.slice(-4) : undefined,
      };
    }

    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch API key status:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch API key status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST: Save an API key
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const kv = locals.runtime.env.KV;

    if (!kv) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { type, apiKey } = body;

    if (!type || !apiKey) {
      return new Response(JSON.stringify({ error: 'Type and apiKey are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!Object.keys(API_KEY_CONFIG).includes(type)) {
      return new Response(JSON.stringify({ error: 'Invalid API key type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Store the API key in KV
    await kv.put(`api_key_${type}`, apiKey);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to save API key:', error);
    return new Response(JSON.stringify({ error: 'Failed to save API key' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// DELETE: Remove an API key
export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const kv = locals.runtime.env.KV;

    if (!kv) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { type } = body;

    if (!type) {
      return new Response(JSON.stringify({ error: 'Type is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!Object.keys(API_KEY_CONFIG).includes(type)) {
      return new Response(JSON.stringify({ error: 'Invalid API key type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete the API key from KV
    await kv.delete(`api_key_${type}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to delete API key:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete API key' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Helper function to get API key (for use in other parts of the app)
export async function getApiKey(kv: KVNamespace, type: ApiKeyType): Promise<string | null> {
  try {
    return await kv.get(`api_key_${type}`);
  } catch {
    return null;
  }
}

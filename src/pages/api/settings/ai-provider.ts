import type { APIRoute } from 'astro';
import type { AIProvider } from '@/lib/ai';

const VALID_PROVIDERS: AIProvider[] = ['anthropic', 'openai'];

// GET: Get current AI provider setting
export const GET: APIRoute = async ({ locals }) => {
  try {
    const kv = locals.runtime.env.KV;
    if (!kv) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const provider = (await kv.get('ai_provider')) as AIProvider || 'anthropic';
    const anthropicKey = await kv.get('api_key_anthropic');
    const openaiKey = await kv.get('api_key_openai');

    return new Response(JSON.stringify({
      provider,
      providers: [
        {
          id: 'anthropic',
          name: 'Anthropic (Claude)',
          description: 'Claude Sonnet 4 - Uitstekend voor zakelijke teksten',
          configured: !!anthropicKey,
          active: provider === 'anthropic',
        },
        {
          id: 'openai',
          name: 'OpenAI (GPT)',
          description: 'GPT-4o - Veelzijdig en snel',
          configured: !!openaiKey,
          active: provider === 'openai',
        },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to get AI provider:', error);
    return new Response(JSON.stringify({ error: 'Failed to get AI provider' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// PUT: Update AI provider setting
export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const kv = locals.runtime.env.KV;
    if (!kv) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { provider } = body as { provider: AIProvider };

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return new Response(JSON.stringify({ error: 'Invalid provider' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if the provider has an API key configured
    const apiKeyKey = provider === 'anthropic' ? 'api_key_anthropic' : 'api_key_openai';
    const apiKey = await kv.get(apiKeyKey);

    if (!apiKey) {
      return new Response(JSON.stringify({
        error: `${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key is not configured. Please add the API key first.`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await kv.put('ai_provider', provider);

    return new Response(JSON.stringify({ success: true, provider }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to update AI provider:', error);
    return new Response(JSON.stringify({ error: 'Failed to update AI provider' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

import type { APIRoute } from 'astro';
import { enhanceText, getAIConfig, type EnhanceTextOptions } from '@/lib/ai';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const kv = locals.runtime.env.KV;
    if (!kv) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const config = await getAIConfig(kv);

    // Check if the selected provider has an API key
    if (!config.apiKey) {
      const providerName = config.provider === 'openai' ? 'OpenAI' : 'Anthropic';
      return new Response(JSON.stringify({ error: `${providerName} API key not configured` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { text, style, context } = body as {
      text: string;
      style?: EnhanceTextOptions['style'];
      context?: EnhanceTextOptions['context'];
    };

    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const enhanced = await enhanceText(text, config, { style, context });

    return new Response(JSON.stringify({ result: enhanced, provider: config.provider }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI enhance error:', error);
    return new Response(JSON.stringify({ error: 'Failed to enhance text' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

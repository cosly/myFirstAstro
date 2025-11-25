import type { APIRoute } from 'astro';
import { translateText, getAIConfig } from '@/lib/ai';

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
    const { text, targetLanguage } = body as {
      text: string;
      targetLanguage: 'en' | 'de' | 'fr' | 'es';
    };

    if (!text || !targetLanguage) {
      return new Response(JSON.stringify({ error: 'Text and target language are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const translated = await translateText(text, config, targetLanguage);

    return new Response(JSON.stringify({ result: translated, provider: config.provider }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI translate error:', error);
    return new Response(JSON.stringify({ error: 'Failed to translate text' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

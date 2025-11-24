import type { APIRoute } from 'astro';
import { translateText } from '@/lib/ai';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const apiKey = locals.runtime.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
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

    const translated = await translateText(text, apiKey, targetLanguage);

    return new Response(JSON.stringify({ result: translated }), {
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

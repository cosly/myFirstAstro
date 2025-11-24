import type { APIRoute } from 'astro';
import { enhanceText, type EnhanceTextOptions } from '@/lib/ai';

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

    const enhanced = await enhanceText(text, apiKey, { style, context });

    return new Response(JSON.stringify({ result: enhanced }), {
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

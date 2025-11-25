import type { APIRoute } from 'astro';
import { getAIConfig } from '@/lib/ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

interface TranslateTemplateRequest {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  targetLanguage: 'nl' | 'en' | 'de' | 'fr' | 'es';
  sourceLanguage?: 'nl' | 'en' | 'de' | 'fr' | 'es';
}

const languageNames: Record<string, string> = {
  nl: 'Nederlands',
  en: 'Engels',
  de: 'Duits',
  fr: 'Frans',
  es: 'Spaans',
};

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
    if (config.provider === 'anthropic' && !config.anthropicKey) {
      return new Response(JSON.stringify({ error: 'Anthropic API key niet geconfigureerd' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (config.provider === 'openai' && !config.openaiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key niet geconfigureerd' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body: TranslateTemplateRequest = await request.json();
    const { subject, bodyHtml, bodyText, targetLanguage, sourceLanguage = 'nl' } = body;

    if (!subject || !bodyHtml || !targetLanguage) {
      return new Response(JSON.stringify({ error: 'Subject, bodyHtml en targetLanguage zijn vereist' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const targetLangName = languageNames[targetLanguage] || targetLanguage;
    const sourceLangName = languageNames[sourceLanguage] || sourceLanguage;

    // Create a prompt for translating email templates
    const prompt = `Je bent een professionele vertaler voor zakelijke email templates. Vertaal de volgende email template van ${sourceLangName} naar ${targetLangName}.

BELANGRIJKE REGELS:
1. Behoud ALLE template variabelen exact zoals ze zijn (bijv. {{customer_name}}, {{quote_number}}, {{quote_url}})
2. Behoud ALLE HTML structuur en opmaak exact zoals ze zijn
3. Vertaal alleen de leesbare tekst, niet de code of variabelen
4. Houd de zakelijke, professionele toon aan
5. Pas uitdrukkingen aan naar wat natuurlijk klinkt in de doeltaal

Geef je antwoord in exact dit JSON formaat:
{
  "subject": "vertaalde onderwerpregel",
  "bodyHtml": "vertaalde HTML body",
  "bodyText": "vertaalde platte tekst body"
}

=== TE VERTALEN TEMPLATE ===

SUBJECT:
${subject}

BODY HTML:
${bodyHtml}

BODY TEXT:
${bodyText}

=== EINDE TEMPLATE ===

Geef alleen de JSON terug, zonder extra uitleg.`;

    let result: string;

    if (config.provider === 'anthropic') {
      const client = new Anthropic({ apiKey: config.anthropicKey });
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      const content = response.content[0];
      result = content.type === 'text' ? content.text : '';
    } else {
      const client = new OpenAI({ apiKey: config.openaiKey });
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      result = response.choices[0]?.message?.content || '';
    }

    // Parse the JSON response
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanResult = result.trim();
      if (cleanResult.startsWith('```json')) {
        cleanResult = cleanResult.slice(7);
      } else if (cleanResult.startsWith('```')) {
        cleanResult = cleanResult.slice(3);
      }
      if (cleanResult.endsWith('```')) {
        cleanResult = cleanResult.slice(0, -3);
      }
      cleanResult = cleanResult.trim();

      const translated = JSON.parse(cleanResult);

      return new Response(JSON.stringify({
        success: true,
        translated: {
          subject: translated.subject || subject,
          bodyHtml: translated.bodyHtml || bodyHtml,
          bodyText: translated.bodyText || bodyText,
        },
        provider: config.provider,
        targetLanguage,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (parseError) {
      console.error('Failed to parse AI response:', result);
      return new Response(JSON.stringify({
        error: 'Kon de vertaling niet verwerken. Probeer opnieuw.',
        rawResponse: result,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Template translation error:', error);
    return new Response(JSON.stringify({ error: 'Vertaling mislukt' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

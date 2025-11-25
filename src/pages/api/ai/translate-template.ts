import type { APIRoute } from 'astro';
import { getAIConfig } from '@/lib/ai';

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

    if (!config.apiKey) {
      return new Response(JSON.stringify({
        error: `${config.provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key niet geconfigureerd`
      }), {
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

    // Build API URL (with or without CF AI Gateway)
    if (config.provider === 'openai') {
      const url = config.gateway
        ? `https://gateway.ai.cloudflare.com/v1/${config.gateway.accountId}/${config.gateway.gatewayName}/openai/chat/completions`
        : 'https://api.openai.com/v1/chat/completions';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data = await response.json();
      result = data.choices?.[0]?.message?.content || '';
    } else {
      const url = config.gateway
        ? `https://gateway.ai.cloudflare.com/v1/${config.gateway.accountId}/${config.gateway.gatewayName}/anthropic/v1/messages`
        : 'https://api.anthropic.com/v1/messages';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${error}`);
      }

      const data = await response.json();
      const content = data.content?.[0];
      result = content?.type === 'text' ? content.text : '';
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
        gateway: !!config.gateway,
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
    const errorMessage = error instanceof Error ? error.message : 'Vertaling mislukt';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

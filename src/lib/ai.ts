/**
 * AI module with Cloudflare AI Gateway support
 *
 * Cloudflare AI Gateway provides:
 * - Unified endpoint for multiple AI providers
 * - Caching to reduce costs
 * - Rate limiting and analytics
 * - Fallback support
 * - Request logging
 */

export type AIProvider = 'anthropic' | 'openai';

export interface AIGatewayConfig {
  accountId: string;
  gatewayName: string;
  provider: AIProvider;
  apiKey: string;  // The provider's API key (still needed for auth)
}

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  gateway?: {
    accountId: string;
    gatewayName: string;
  };
}

// Model configurations
const MODELS = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
};

/**
 * Build the API URL - either via CF AI Gateway or direct
 */
function getApiUrl(config: AIConfig, endpoint: string): string {
  if (config.gateway?.accountId && config.gateway?.gatewayName) {
    // Use Cloudflare AI Gateway
    const baseUrl = `https://gateway.ai.cloudflare.com/v1/${config.gateway.accountId}/${config.gateway.gatewayName}`;

    if (config.provider === 'openai') {
      return `${baseUrl}/openai/${endpoint}`;
    } else if (config.provider === 'anthropic') {
      return `${baseUrl}/anthropic/${endpoint}`;
    }
  }

  // Direct API calls (fallback)
  if (config.provider === 'openai') {
    return `https://api.openai.com/v1/${endpoint}`;
  } else if (config.provider === 'anthropic') {
    return `https://api.anthropic.com/${endpoint}`;
  }

  throw new Error(`Unknown provider: ${config.provider}`);
}

/**
 * Generic completion function using fetch (works with both direct API and Gateway)
 */
async function complete(
  config: AIConfig,
  prompt: string,
  maxTokens: number = 1024
): Promise<string> {
  if (!config.apiKey) {
    throw new Error(`API key not configured for ${config.provider}`);
  }

  if (config.provider === 'openai') {
    const url = getApiUrl(config, 'chat/completions');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: MODELS.openai,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';

  } else if (config.provider === 'anthropic') {
    const url = getApiUrl(config, 'v1/messages');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELS.anthropic,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    const content = data.content?.[0];
    return content?.type === 'text' ? content.text : '';
  }

  throw new Error(`Unknown provider: ${config.provider}`);
}

export interface EnhanceTextOptions {
  style?: 'professional' | 'friendly' | 'technical' | 'concise';
  context?: 'quote' | 'email' | 'description';
}

export async function enhanceText(
  text: string,
  config: AIConfig,
  options: EnhanceTextOptions = {}
): Promise<string> {
  const styleGuides = {
    professional: 'zakelijk en professioneel, formele toon',
    friendly: 'vriendelijk en toegankelijk, maar nog steeds professioneel',
    technical: 'technisch en gedetailleerd, voor experts',
    concise: 'kort en bondig, alleen de essentie',
  };

  const contextGuides = {
    quote: 'Dit is voor een zakelijke offerte.',
    email: 'Dit is voor een zakelijke email.',
    description: 'Dit is voor een product/dienst beschrijving.',
  };

  const style = styleGuides[options.style || 'professional'];
  const context = contextGuides[options.context || 'quote'];

  const prompt = `Verbeter de volgende Nederlandse tekst. Maak het ${style}. ${context}

Behoud de oorspronkelijke betekenis maar maak het professioneler en duidelijker.
Geef alleen de verbeterde tekst terug, zonder uitleg of commentaar.

Tekst:
${text}`;

  const result = await complete(config, prompt, 1024);
  return result || text;
}

export async function translateText(
  text: string,
  config: AIConfig,
  targetLanguage: 'en' | 'de' | 'fr' | 'es'
): Promise<string> {
  const languageNames = {
    en: 'English',
    de: 'Deutsch',
    fr: 'Français',
    es: 'Español',
  };

  const prompt = `Vertaal de volgende Nederlandse tekst naar ${languageNames[targetLanguage]}.
Dit is voor een zakelijke offerte, dus behoud een professionele toon.
Geef alleen de vertaling terug, zonder uitleg of commentaar.

Tekst:
${text}`;

  const result = await complete(config, prompt, 2048);
  return result || text;
}

export async function generateDescription(
  productName: string,
  config: AIConfig,
  context?: string
): Promise<string> {
  const prompt = `Genereer een korte, professionele Nederlandse beschrijving voor het volgende product/dienst in een offerte.

Product/Dienst: ${productName}
${context ? `Extra context: ${context}` : ''}

Eisen:
- Maximaal 2-3 zinnen
- Zakelijke toon
- Focus op waarde voor de klant
- Geen marketingtaal of overdrijving

Geef alleen de beschrijving terug, zonder uitleg.`;

  return await complete(config, prompt, 512);
}

export async function summarizeQuote(
  quoteData: {
    title: string;
    blocks: Array<{
      title?: string;
      lines: Array<{ description: string; quantity: number; unitPrice: number }>;
    }>;
    total: number;
  },
  config: AIConfig
): Promise<string> {
  const quoteDescription = quoteData.blocks
    .map((block) => {
      const lines = block.lines.map((l) => `- ${l.description}`).join('\n');
      return `${block.title || 'Onderdeel'}:\n${lines}`;
    })
    .join('\n\n');

  const prompt = `Schrijf een korte, professionele introductietekst voor de volgende offerte.

Titel: ${quoteData.title}
Totaalbedrag: €${quoteData.total.toFixed(2)}

Inhoud:
${quoteDescription}

Eisen:
- 2-3 zinnen
- Zakelijke maar vriendelijke toon
- Benoem kort wat er geleverd wordt
- Eindig positief

Geef alleen de introductietekst terug.`;

  return await complete(config, prompt, 512);
}

/**
 * Helper to build AI config from KV storage
 * Supports both CF AI Gateway and direct API calls
 */
export async function getAIConfig(kv: KVNamespace): Promise<AIConfig> {
  // Get provider preference
  const provider = (await kv.get('ai_provider')) as AIProvider || 'anthropic';

  // Get API key for the selected provider
  const apiKey = await kv.get(`api_key_${provider}`) || '';

  // Get gateway configuration (optional)
  const gatewayAccountId = await kv.get('ai_gateway_account_id');
  const gatewayName = await kv.get('ai_gateway_name');

  const config: AIConfig = {
    provider,
    apiKey,
  };

  // Add gateway config if both values are set
  if (gatewayAccountId && gatewayName) {
    config.gateway = {
      accountId: gatewayAccountId,
      gatewayName: gatewayName,
    };
  }

  return config;
}

/**
 * Check if AI is properly configured
 */
export async function isAIConfigured(kv: KVNamespace): Promise<{
  configured: boolean;
  provider: AIProvider;
  hasGateway: boolean;
  error?: string;
}> {
  const config = await getAIConfig(kv);

  const hasGateway = !!(config.gateway?.accountId && config.gateway?.gatewayName);

  if (!config.apiKey) {
    return {
      configured: false,
      provider: config.provider,
      hasGateway,
      error: `${config.provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key niet geconfigureerd`,
    };
  }

  return {
    configured: true,
    provider: config.provider,
    hasGateway,
  };
}

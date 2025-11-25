import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type AIProvider = 'anthropic' | 'openai';

interface AIConfig {
  provider: AIProvider;
  anthropicKey?: string;
  openaiKey?: string;
}

// Client instances
let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

function getAnthropicClient(apiKey: string): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

function getOpenAIClient(apiKey: string): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// Generic completion function that works with both providers
async function complete(
  config: AIConfig,
  prompt: string,
  maxTokens: number = 1024
): Promise<string> {
  if (config.provider === 'anthropic') {
    if (!config.anthropicKey) {
      throw new Error('Anthropic API key not configured');
    }
    const client = getAnthropicClient(config.anthropicKey);
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    return '';
  } else if (config.provider === 'openai') {
    if (!config.openaiKey) {
      throw new Error('OpenAI API key not configured');
    }
    const client = getOpenAIClient(config.openaiKey);
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0]?.message?.content || '';
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

// Legacy functions for backward compatibility (single API key)
export async function enhanceTextLegacy(
  text: string,
  apiKey: string,
  options: EnhanceTextOptions = {}
): Promise<string> {
  return enhanceText(text, { provider: 'anthropic', anthropicKey: apiKey }, options);
}

export async function translateTextLegacy(
  text: string,
  apiKey: string,
  targetLanguage: 'en' | 'de' | 'fr' | 'es'
): Promise<string> {
  return translateText(text, { provider: 'anthropic', anthropicKey: apiKey }, targetLanguage);
}

export async function generateDescriptionLegacy(
  productName: string,
  apiKey: string,
  context?: string
): Promise<string> {
  return generateDescription(productName, { provider: 'anthropic', anthropicKey: apiKey }, context);
}

export async function summarizeQuoteLegacy(
  quoteData: {
    title: string;
    blocks: Array<{
      title?: string;
      lines: Array<{ description: string; quantity: number; unitPrice: number }>;
    }>;
    total: number;
  },
  apiKey: string
): Promise<string> {
  return summarizeQuote(quoteData, { provider: 'anthropic', anthropicKey: apiKey });
}

// Helper to build config from KV
export async function getAIConfig(kv: KVNamespace): Promise<AIConfig> {
  const provider = (await kv.get('ai_provider')) as AIProvider || 'anthropic';
  const anthropicKey = await kv.get('api_key_anthropic');
  const openaiKey = await kv.get('api_key_openai');

  return {
    provider,
    anthropicKey: anthropicKey || undefined,
    openaiKey: openaiKey || undefined,
  };
}

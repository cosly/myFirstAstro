import Anthropic from '@anthropic-ai/sdk';

let anthropic: Anthropic | null = null;

function getClient(apiKey: string): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

export interface EnhanceTextOptions {
  style?: 'professional' | 'friendly' | 'technical' | 'concise';
  context?: 'quote' | 'email' | 'description';
}

export async function enhanceText(
  text: string,
  apiKey: string,
  options: EnhanceTextOptions = {}
): Promise<string> {
  const client = getClient(apiKey);

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

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Verbeter de volgende Nederlandse tekst. Maak het ${style}. ${context}

Behoud de oorspronkelijke betekenis maar maak het professioneler en duidelijker.
Geef alleen de verbeterde tekst terug, zonder uitleg of commentaar.

Tekst:
${text}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text;
  }

  return text;
}

export async function translateText(
  text: string,
  apiKey: string,
  targetLanguage: 'en' | 'de' | 'fr' | 'es'
): Promise<string> {
  const client = getClient(apiKey);

  const languageNames = {
    en: 'English',
    de: 'Deutsch',
    fr: 'Français',
    es: 'Español',
  };

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Vertaal de volgende Nederlandse tekst naar ${languageNames[targetLanguage]}.
Dit is voor een zakelijke offerte, dus behoud een professionele toon.
Geef alleen de vertaling terug, zonder uitleg of commentaar.

Tekst:
${text}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text;
  }

  return text;
}

export async function generateDescription(
  productName: string,
  apiKey: string,
  context?: string
): Promise<string> {
  const client = getClient(apiKey);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Genereer een korte, professionele Nederlandse beschrijving voor het volgende product/dienst in een offerte.

Product/Dienst: ${productName}
${context ? `Extra context: ${context}` : ''}

Eisen:
- Maximaal 2-3 zinnen
- Zakelijke toon
- Focus op waarde voor de klant
- Geen marketingtaal of overdrijving

Geef alleen de beschrijving terug, zonder uitleg.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text;
  }

  return '';
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
  apiKey: string
): Promise<string> {
  const client = getClient(apiKey);

  const quoteDescription = quoteData.blocks
    .map((block) => {
      const lines = block.lines.map((l) => `- ${l.description}`).join('\n');
      return `${block.title || 'Onderdeel'}:\n${lines}`;
    })
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Schrijf een korte, professionele introductietekst voor de volgende offerte.

Titel: ${quoteData.title}
Totaalbedrag: €${quoteData.total.toFixed(2)}

Inhoud:
${quoteDescription}

Eisen:
- 2-3 zinnen
- Zakelijke maar vriendelijke toon
- Benoem kort wat er geleverd wordt
- Eindig positief

Geef alleen de introductietekst terug.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text;
  }

  return '';
}

/**
 * AI-powered Quote Request Analysis
 *
 * This module provides intelligent analysis of incoming quote requests:
 * - Automatic categorization and service matching
 * - Budget estimation based on description
 * - Description improvement suggestions
 * - Urgency detection
 * - Sentiment analysis
 */

import { getAIConfig, isAIConfigured } from './ai';

export interface QuoteRequestAnalysis {
  // Service matching
  suggestedServiceTypes: string[];
  confidence: number;

  // Budget analysis
  estimatedBudgetRange: {
    min: number;
    max: number;
    currency: 'EUR';
  };
  budgetJustification: string;

  // Content analysis
  improvedDescription: string;
  keyRequirements: string[];
  potentialChallenges: string[];

  // Metadata
  urgencyLevel: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'moderate' | 'complex';
  sentiment: 'positive' | 'neutral' | 'negative';

  // Suggestions for the team
  suggestedQuestions: string[];
  suggestedApproach: string;

  // Processing info
  processedAt: string;
  aiProvider: string;
}

interface AIConfig {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  gateway?: {
    accountId: string;
    gatewayName: string;
  };
}

const MODELS = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
};

function getApiUrl(config: AIConfig, endpoint: string): string {
  if (config.gateway?.accountId && config.gateway?.gatewayName) {
    const baseUrl = `https://gateway.ai.cloudflare.com/v1/${config.gateway.accountId}/${config.gateway.gatewayName}`;
    if (config.provider === 'openai') {
      return `${baseUrl}/openai/${endpoint}`;
    } else if (config.provider === 'anthropic') {
      return `${baseUrl}/anthropic/${endpoint}`;
    }
  }

  if (config.provider === 'openai') {
    return `https://api.openai.com/v1/${endpoint}`;
  } else if (config.provider === 'anthropic') {
    return `https://api.anthropic.com/${endpoint}`;
  }

  throw new Error(`Unknown provider: ${config.provider}`);
}

async function complete(
  config: AIConfig,
  prompt: string,
  maxTokens: number = 2048
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
        response_format: { type: 'json_object' },
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

/**
 * Analyze a quote request and provide intelligent insights
 */
export async function analyzeQuoteRequest(
  request: {
    serviceType: string;
    description: string;
    budgetIndication?: string;
    companyName?: string;
  },
  kv: KVNamespace
): Promise<QuoteRequestAnalysis | null> {
  // Check if AI is configured
  const aiStatus = await isAIConfigured(kv);
  if (!aiStatus.configured) {
    console.warn('AI not configured:', aiStatus.error);
    return null;
  }

  const config = await getAIConfig(kv);

  const prompt = `Je bent een expert sales consultant bij een Nederlands webbureau (Tesoro CRM).
Analyseer de volgende offerte-aanvraag en geef een gestructureerde analyse.

AANVRAAG:
- Service type: ${request.serviceType}
- Beschrijving: ${request.description}
- Budget indicatie: ${request.budgetIndication || 'Niet opgegeven'}
- Bedrijfsnaam: ${request.companyName || 'Niet opgegeven'}

ONZE DIENSTEN:
- website: Websites, webshops, landingspagina's, redesigns (€500 - €15.000)
- crm_setup: CRM implementatie en configuratie (€1.000 - €5.000)
- marketing: Marketing materialen, branding, design (€250 - €3.000)
- support: Onderhoud en ondersteuning (€75 - €150/uur)

Geef je analyse als JSON met exact deze structuur:
{
  "suggestedServiceTypes": ["service1", "service2"],
  "confidence": 0.85,
  "estimatedBudgetRange": {
    "min": 1000,
    "max": 3000,
    "currency": "EUR"
  },
  "budgetJustification": "Korte uitleg waarom dit budget realistisch is",
  "improvedDescription": "Een verbeterde, duidelijkere versie van de klantbeschrijving",
  "keyRequirements": ["requirement1", "requirement2"],
  "potentialChallenges": ["challenge1", "challenge2"],
  "urgencyLevel": "medium",
  "complexity": "moderate",
  "sentiment": "positive",
  "suggestedQuestions": ["vraag1", "vraag2"],
  "suggestedApproach": "Aanbevolen aanpak voor deze aanvraag"
}

Zorg dat:
- suggestedServiceTypes alleen waarden bevat uit: website, crm_setup, marketing, support
- confidence een getal is tussen 0 en 1
- urgencyLevel een van: low, medium, high
- complexity een van: simple, moderate, complex
- sentiment een van: positive, neutral, negative
- Alle teksten in het Nederlands zijn

Geef ALLEEN de JSON terug, zonder markdown of extra tekst.`;

  try {
    const result = await complete(config, prompt, 2048);

    // Parse JSON from response (handle potential markdown wrapping)
    let jsonStr = result.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const analysis = JSON.parse(jsonStr);

    return {
      ...analysis,
      processedAt: new Date().toISOString(),
      aiProvider: config.provider,
    };
  } catch (error) {
    console.error('Failed to analyze quote request:', error);
    return null;
  }
}

/**
 * Generate a quick budget estimate without full analysis
 */
export async function estimateBudget(
  description: string,
  serviceType: string,
  kv: KVNamespace
): Promise<{ min: number; max: number } | null> {
  const aiStatus = await isAIConfigured(kv);
  if (!aiStatus.configured) {
    return null;
  }

  const config = await getAIConfig(kv);

  const prompt = `Schat het budget voor deze aanvraag:

Service: ${serviceType}
Beschrijving: ${description}

Geef alleen JSON terug in dit formaat:
{"min": 1000, "max": 3000}

Baseer je schatting op standaard Nederlandse marktprijzen.`;

  try {
    const result = await complete(config, prompt, 256);
    let jsonStr = result.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
    }
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Improve/clarify a description
 */
export async function improveDescription(
  description: string,
  kv: KVNamespace
): Promise<string | null> {
  const aiStatus = await isAIConfigured(kv);
  if (!aiStatus.configured) {
    return null;
  }

  const config = await getAIConfig(kv);

  const prompt = `Verbeter de volgende project beschrijving. Maak het duidelijker en professioneler, maar behoud de oorspronkelijke intentie. Schrijf in het Nederlands.

Origineel:
${description}

Geef alleen de verbeterde beschrijving terug, zonder uitleg of quotes.`;

  try {
    const result = await complete(config, prompt, 1024);
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Detect if a request might be spam or low-quality
 */
export async function detectLowQuality(
  description: string,
  kv: KVNamespace
): Promise<{ isLowQuality: boolean; reason?: string } | null> {
  const aiStatus = await isAIConfigured(kv);
  if (!aiStatus.configured) {
    return null;
  }

  // Simple heuristics first
  if (description.length < 20) {
    return { isLowQuality: true, reason: 'Beschrijving te kort' };
  }

  const config = await getAIConfig(kv);

  const prompt = `Analyseer of deze offerte-aanvraag legitiem lijkt of mogelijk spam/laagwaardig is:

"${description}"

Geef JSON terug:
{"isLowQuality": false, "reason": null}

of als het problematisch is:
{"isLowQuality": true, "reason": "korte uitleg"}

Check op: onzinnige tekst, spam keywords, geen echte vraag, automatisch gegenereerd.`;

  try {
    const result = await complete(config, prompt, 256);
    let jsonStr = result.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
    }
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Generate suggested response for the team
 */
export async function generateResponseSuggestion(
  request: {
    contactName: string;
    companyName?: string;
    serviceType: string;
    description: string;
  },
  kv: KVNamespace
): Promise<string | null> {
  const aiStatus = await isAIConfigured(kv);
  if (!aiStatus.configured) {
    return null;
  }

  const config = await getAIConfig(kv);

  const prompt = `Schrijf een korte, vriendelijke eerste reactie email voor deze offerte-aanvraag.
De email is van Tesoro CRM team naar de klant.

Klant: ${request.contactName}${request.companyName ? ` (${request.companyName})` : ''}
Aanvraag: ${request.serviceType}
Beschrijving: ${request.description}

Eisen:
- Bedank voor de aanvraag
- Bevestig ontvangst
- Stel 1-2 verhelderende vragen als relevant
- Vermeld dat we binnen 24 uur een offerte sturen
- Professionele maar vriendelijke toon
- In het Nederlands
- Maximaal 150 woorden

Geef alleen de emailtekst terug (zonder onderwerp of afzender).`;

  try {
    return await complete(config, prompt, 512);
  } catch {
    return null;
  }
}

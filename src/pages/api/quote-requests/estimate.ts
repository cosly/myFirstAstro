import type { APIRoute } from 'astro';
import { isAIConfigured, getAIConfig } from '@/lib/ai';

interface BudgetEstimate {
  min: number;
  max: number;
  confidence: number;
  reasoning: string;
}

const SERVICE_BASE_PRICES: Record<string, { min: number; max: number }> = {
  website: { min: 500, max: 15000 },
  crm_setup: { min: 1000, max: 5000 },
  marketing: { min: 250, max: 3000 },
  support: { min: 75, max: 2000 },
};

/**
 * Quick budget estimation endpoint for real-time feedback
 * POST /api/quote-requests/estimate
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { serviceType, description } = body;

    if (!serviceType || !description) {
      return new Response(
        JSON.stringify({ error: 'serviceType and description required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Minimum description length for estimation
    if (description.length < 20) {
      return new Response(
        JSON.stringify({
          estimate: null,
          message: 'Description too short for estimation'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const kv = locals.runtime.env.KV;

    // Check if AI is configured
    const aiStatus = await isAIConfigured(kv);

    if (!aiStatus.configured) {
      // Fallback to rule-based estimation
      const estimate = getRuleBasedEstimate(serviceType, description);
      return new Response(
        JSON.stringify({ estimate, source: 'rules' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use AI for estimation
    const estimate = await getAIEstimate(serviceType, description, kv);

    return new Response(
      JSON.stringify({ estimate, source: 'ai' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Budget estimation error:', error);
    return new Response(
      JSON.stringify({ error: 'Estimation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * Rule-based estimation when AI is not available
 */
function getRuleBasedEstimate(serviceType: string, description: string): BudgetEstimate {
  const base = SERVICE_BASE_PRICES[serviceType] || { min: 500, max: 5000 };
  const descLower = description.toLowerCase();

  let multiplier = 1;
  let confidence = 0.5;

  // Complexity indicators
  const complexityKeywords = {
    high: ['complex', 'uitgebreid', 'groot', 'enterprise', 'integratie', 'api', 'custom', 'maatwerk', 'multiple', 'meerdere'],
    medium: ['aanpassing', 'wijziging', 'update', 'toevoegen', 'feature', 'functie'],
    low: ['simpel', 'eenvoudig', 'klein', 'basic', 'standaard', 'simple'],
  };

  // Check for complexity indicators
  for (const word of complexityKeywords.high) {
    if (descLower.includes(word)) {
      multiplier = Math.max(multiplier, 1.5);
      confidence = 0.6;
    }
  }

  for (const word of complexityKeywords.low) {
    if (descLower.includes(word)) {
      multiplier = Math.min(multiplier, 0.7);
      confidence = 0.6;
    }
  }

  // Urgency indicators
  if (descLower.includes('spoed') || descLower.includes('urgent') || descLower.includes('snel')) {
    multiplier *= 1.2;
  }

  // Description length affects estimate range
  if (description.length > 500) {
    // Detailed description usually means more complex project
    multiplier *= 1.1;
    confidence += 0.1;
  }

  return {
    min: Math.round(base.min * multiplier),
    max: Math.round(base.max * multiplier),
    confidence: Math.min(confidence, 0.8),
    reasoning: 'Schatting op basis van service type en beschrijving keywords',
  };
}

/**
 * AI-powered budget estimation
 */
async function getAIEstimate(
  serviceType: string,
  description: string,
  kv: KVNamespace
): Promise<BudgetEstimate> {
  const config = await getAIConfig(kv);

  const prompt = `Je bent een Nederlandse web agency prijscalculator. Schat het budget voor dit project.

Service: ${serviceType}
Beschrijving: ${description}

Onze standaard prijzen:
- Website: €500 - €15.000
- CRM Setup: €1.000 - €5.000
- Marketing: €250 - €3.000
- Support: €75 - €150/uur

Geef ALLEEN JSON terug in exact dit formaat (geen markdown):
{"min": 1000, "max": 3000, "confidence": 0.7, "reasoning": "Korte uitleg in 1 zin"}

confidence is 0.0 - 1.0 (hoe zeker je bent)`;

  try {
    let result: string;

    if (config.provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) throw new Error('Anthropic API error');
      const data = await response.json();
      result = data.content?.[0]?.text || '';
    } else {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 256,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) throw new Error('OpenAI API error');
      const data = await response.json();
      result = data.choices?.[0]?.message?.content || '';
    }

    // Parse JSON response
    let jsonStr = result.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
    }

    const parsed = JSON.parse(jsonStr);
    return {
      min: parsed.min || 500,
      max: parsed.max || 5000,
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || 'AI schatting',
    };
  } catch (error) {
    console.error('AI estimation failed:', error);
    // Fallback to rule-based
    return getRuleBasedEstimate(serviceType, description);
  }
}

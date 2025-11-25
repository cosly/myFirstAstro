import type { APIRoute } from 'astro';
import type { AIProvider } from '@/lib/ai';

interface AIGatewaySettings {
  // Gateway configuration (optional)
  gatewayAccountId: string | null;
  gatewayName: string | null;
  gatewayEnabled: boolean;

  // Provider selection
  provider: AIProvider;

  // Provider status
  providers: {
    id: AIProvider;
    name: string;
    configured: boolean;
    active: boolean;
  }[];
}

// GET: Get AI Gateway and provider settings
export const GET: APIRoute = async ({ locals }) => {
  try {
    const kv = locals.runtime.env.KV;
    if (!kv) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch all settings
    const [
      gatewayAccountId,
      gatewayName,
      provider,
      anthropicKey,
      openaiKey,
    ] = await Promise.all([
      kv.get('ai_gateway_account_id'),
      kv.get('ai_gateway_name'),
      kv.get('ai_provider'),
      kv.get('api_key_anthropic'),
      kv.get('api_key_openai'),
    ]);

    const activeProvider = (provider as AIProvider) || 'anthropic';
    const gatewayEnabled = !!(gatewayAccountId && gatewayName);

    const settings: AIGatewaySettings = {
      gatewayAccountId: gatewayAccountId ? maskValue(gatewayAccountId) : null,
      gatewayName: gatewayName || null,
      gatewayEnabled,
      provider: activeProvider,
      providers: [
        {
          id: 'anthropic',
          name: 'Anthropic (Claude)',
          configured: !!anthropicKey,
          active: activeProvider === 'anthropic',
        },
        {
          id: 'openai',
          name: 'OpenAI (GPT)',
          configured: !!openaiKey,
          active: activeProvider === 'openai',
        },
      ],
    };

    return new Response(JSON.stringify(settings), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to get AI gateway settings:', error);
    return new Response(JSON.stringify({ error: 'Failed to get settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// PUT: Update AI Gateway and provider settings
export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const kv = locals.runtime.env.KV;
    if (!kv) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const {
      gatewayAccountId,
      gatewayName,
      provider,
      anthropicKey,
      openaiKey,
    } = body as {
      gatewayAccountId?: string;
      gatewayName?: string;
      provider?: AIProvider;
      anthropicKey?: string;
      openaiKey?: string;
    };

    const updates: Promise<void>[] = [];

    // Update gateway settings
    if (gatewayAccountId !== undefined) {
      if (gatewayAccountId && !gatewayAccountId.startsWith('••••')) {
        updates.push(kv.put('ai_gateway_account_id', gatewayAccountId));
      } else if (gatewayAccountId === '') {
        updates.push(kv.delete('ai_gateway_account_id'));
      }
    }

    if (gatewayName !== undefined) {
      if (gatewayName) {
        updates.push(kv.put('ai_gateway_name', gatewayName));
      } else {
        updates.push(kv.delete('ai_gateway_name'));
      }
    }

    // Update provider
    if (provider && ['anthropic', 'openai'].includes(provider)) {
      // Check if the provider has an API key
      const keyName = provider === 'anthropic' ? 'api_key_anthropic' : 'api_key_openai';
      const existingKey = await kv.get(keyName);

      // Also check if a new key is being provided in this request
      const newKey = provider === 'anthropic' ? anthropicKey : openaiKey;

      if (!existingKey && !newKey) {
        return new Response(JSON.stringify({
          error: `${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key moet eerst worden geconfigureerd`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      updates.push(kv.put('ai_provider', provider));
    }

    // Update API keys (only if provided and not masked)
    if (anthropicKey && !anthropicKey.startsWith('••••')) {
      updates.push(kv.put('api_key_anthropic', anthropicKey));
    }

    if (openaiKey && !openaiKey.startsWith('••••')) {
      updates.push(kv.put('api_key_openai', openaiKey));
    }

    await Promise.all(updates);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to update AI gateway settings:', error);
    return new Response(JSON.stringify({ error: 'Failed to update settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST: Test AI connection
export const POST: APIRoute = async ({ locals }) => {
  try {
    const kv = locals.runtime.env.KV;
    if (!kv) {
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { getAIConfig } = await import('@/lib/ai');
    const config = await getAIConfig(kv);

    if (!config.apiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: `API key niet geconfigureerd voor ${config.provider}`,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Try a simple completion to test the connection
    const testPrompt = 'Respond with exactly: OK';
    let response: string;

    const startTime = Date.now();

    if (config.provider === 'openai') {
      const url = config.gateway
        ? `https://gateway.ai.cloudflare.com/v1/${config.gateway.accountId}/${config.gateway.gatewayName}/openai/chat/completions`
        : 'https://api.openai.com/v1/chat/completions';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',  // Use cheaper model for test
          max_tokens: 10,
          messages: [{ role: 'user', content: testPrompt }],
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }

      const data = await res.json();
      response = data.choices?.[0]?.message?.content || '';
    } else {
      const url = config.gateway
        ? `https://gateway.ai.cloudflare.com/v1/${config.gateway.accountId}/${config.gateway.gatewayName}/anthropic/v1/messages`
        : 'https://api.anthropic.com/v1/messages';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',  // Use cheaper model for test
          max_tokens: 10,
          messages: [{ role: 'user', content: testPrompt }],
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }

      const data = await res.json();
      response = data.content?.[0]?.text || '';
    }

    const duration = Date.now() - startTime;

    return new Response(JSON.stringify({
      success: true,
      provider: config.provider,
      gateway: !!config.gateway,
      response: response.trim(),
      duration: `${duration}ms`,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('AI test failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Verbinding mislukt';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function maskValue(value: string): string {
  if (value.length <= 8) {
    return '••••••••';
  }
  return '••••' + value.slice(-4);
}

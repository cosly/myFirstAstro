import type { APIRoute } from 'astro';
import { createDb } from '@/lib/db';
import {
  getDiscordSettings,
  saveDiscordSettings,
  testDiscordWebhook,
  type DiscordSettings,
} from '@/lib/discord';

// GET: Fetch Discord settings
export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const settings = await getDiscordSettings(db);

    // Don't expose full webhook URL in GET response for security
    // Only show if it's configured
    return new Response(
      JSON.stringify({
        ...settings,
        webhookUrl: settings.webhookUrl ? '••••••••' + settings.webhookUrl.slice(-20) : '',
        hasWebhookUrl: !!settings.webhookUrl,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to fetch Discord settings:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch Discord settings' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

// PUT: Update Discord settings
export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    // Get current settings
    const currentSettings = await getDiscordSettings(db);

    // Build new settings
    const newSettings: DiscordSettings = {
      webhookUrl: body.webhookUrl !== undefined
        ? body.webhookUrl
        : currentSettings.webhookUrl,
      enabled: body.enabled !== undefined
        ? body.enabled
        : currentSettings.enabled,
      events: body.events !== undefined
        ? { ...currentSettings.events, ...body.events }
        : currentSettings.events,
    };

    // Validate webhook URL format if provided
    if (newSettings.webhookUrl && !newSettings.webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid Discord webhook URL' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    await saveDiscordSettings(db, newSettings);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to update Discord settings:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update Discord settings' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

// POST: Test Discord webhook
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    // Get webhook URL from body or from saved settings
    let webhookUrl = body.webhookUrl;

    if (!webhookUrl) {
      const settings = await getDiscordSettings(db);
      webhookUrl = settings.webhookUrl;
    }

    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ error: 'No webhook URL provided' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate URL format
    if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid Discord webhook URL' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Test the webhook
    const result = await testDiscordWebhook(webhookUrl);

    if (result.success) {
      return new Response(
        JSON.stringify({ success: true, message: 'Test notification sent!' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } else {
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to send test notification' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Failed to test Discord webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to test Discord webhook' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

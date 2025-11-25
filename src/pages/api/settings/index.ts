import type { APIRoute } from 'astro';
import { createDb, appSettings } from '@/lib/db';
import { eq } from 'drizzle-orm';

// Settings keys
const SETTINGS_KEYS = [
  'company_name',
  'company_email',
  'company_phone',
  'company_address',
  'company_kvk',
  'company_btw',
  'quote_validity_days',
  'quote_number_prefix',
  'auto_reminders_enabled',
] as const;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);

    const settings = await db.select().from(appSettings);

    // Convert to object
    const settingsObj: Record<string, unknown> = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });

    return new Response(JSON.stringify(settingsObj), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    // Update each setting
    for (const [key, value] of Object.entries(body)) {
      if (!SETTINGS_KEYS.includes(key as typeof SETTINGS_KEYS[number])) {
        continue;
      }

      // Check if setting exists
      const existing = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, key))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(appSettings)
          .set({ value: JSON.stringify(value), updatedAt: new Date() })
          .where(eq(appSettings.key, key));
      } else {
        await db.insert(appSettings).values({
          key,
          value: JSON.stringify(value),
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to update settings:', error);
    return new Response(JSON.stringify({ error: 'Failed to update settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

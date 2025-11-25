import type { APIRoute } from 'astro';
import { createDb, emailTemplates } from '@/lib/db';
import { defaultTemplates } from '@/lib/email';

// GET: Fetch all email templates
export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);

    // Fetch from database
    const dbTemplates = await db.select().from(emailTemplates);

    // Merge with defaults
    const templateTypes = [
      'quote_sent',
      'quote_reminder',
      'quote_accepted',
      'quote_declined',
      'payment_received',
      'question_received',
      'question_answered',
    ];

    const templates = templateTypes.map(type => {
      const dbTemplate = dbTemplates.find(t => t.type === type);
      const defaultTemplate = defaultTemplates[type as keyof typeof defaultTemplates];

      return {
        type,
        subject: dbTemplate?.subject || defaultTemplate?.subject || '',
        bodyHtml: dbTemplate?.bodyHtml || defaultTemplate?.bodyHtml || '',
        bodyText: dbTemplate?.bodyText || defaultTemplate?.bodyText || '',
        isCustomized: !!dbTemplate,
        availableVariables: dbTemplate?.availableVariables || [
          'quote_number',
          'quote_title',
          'quote_total',
          'quote_valid_until',
          'quote_url',
          'customer_name',
          'customer_company',
          'customer_email',
          'company_name',
          'company_email',
          'company_phone',
        ],
      };
    });

    return new Response(JSON.stringify(templates), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch email templates:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch email templates' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

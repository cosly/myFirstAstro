import type { APIRoute } from 'astro';
import { createDb, emailTemplates } from '@/lib/db';
import { defaultTemplates } from '@/lib/email';
import { eq } from 'drizzle-orm';
import { formatCurrency, formatDate } from '@/lib/utils';

// Mock data for preview
const mockData = {
  // Quote
  quote_number: 'OFF-2024-0042',
  quote_title: 'Website Redesign & Development',
  quote_total: formatCurrency(4750),
  quote_valid_until: formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
  quote_url: 'https://quote.tesorohq.io/offerte/abc123',

  // Customer
  customer_name: 'Jan de Vries',
  customer_company: 'Voorbeeld BV',
  customer_email: 'jan@voorbeeld.nl',

  // Company
  company_name: 'Tesoro CRM',
  company_email: 'info@tesorocrm.nl',
  company_phone: '020-1234567',

  // Signature
  signed_by: 'Jan de Vries',
  signed_at: formatDate(new Date()),
};

function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] || `{{${key}}}`;
  });
}

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const type = url.searchParams.get('type');

    if (!type) {
      return new Response(JSON.stringify({ error: 'Type is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);

    // Try to get template from database
    let template: { subject: string; bodyHtml: string; bodyText: string } | null = null;

    try {
      const dbTemplate = await db.query.emailTemplates.findFirst({
        where: eq(emailTemplates.type, type as typeof emailTemplates.type.enumValues[number]),
      });

      if (dbTemplate) {
        template = {
          subject: dbTemplate.subject,
          bodyHtml: dbTemplate.bodyHtml,
          bodyText: dbTemplate.bodyText,
        };
      }
    } catch (error) {
      console.error('Failed to fetch template from DB:', error);
    }

    // Fall back to default template
    if (!template) {
      const defaultTemplate = defaultTemplates[type as keyof typeof defaultTemplates];
      if (defaultTemplate) {
        template = defaultTemplate;
      }
    }

    if (!template) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Replace variables with mock data
    const renderedSubject = replaceVariables(template.subject, mockData);
    const renderedHtml = replaceVariables(template.bodyHtml, mockData);

    return new Response(JSON.stringify({
      subject: renderedSubject,
      html: renderedHtml,
      mockData,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to generate preview:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate preview' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

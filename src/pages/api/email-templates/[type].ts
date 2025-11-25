import type { APIRoute } from 'astro';
import { createDb, emailTemplates } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { defaultTemplates } from '@/lib/email';
import { generateId } from '@/lib/utils';

type EmailTemplateType = 'quote_sent' | 'quote_reminder' | 'quote_accepted' | 'quote_declined' | 'payment_received' | 'question_received' | 'question_answered';
type Locale = 'nl' | 'en' | 'es';

const validTypes: EmailTemplateType[] = ['quote_sent', 'quote_reminder', 'quote_accepted', 'quote_declined', 'payment_received', 'question_received', 'question_answered'];
const validLocales: Locale[] = ['nl', 'en', 'es'];

function isValidType(type: string): type is EmailTemplateType {
  return validTypes.includes(type as EmailTemplateType);
}

function isValidLocale(locale: string): locale is Locale {
  return validLocales.includes(locale as Locale);
}

// GET: Fetch a specific email template
export const GET: APIRoute = async ({ params, locals, url }) => {
  try {
    const { type } = params;
    const locale = (url.searchParams.get('locale') || 'nl') as Locale;

    if (!type || !isValidType(type)) {
      return new Response(JSON.stringify({ error: 'Invalid template type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!isValidLocale(locale)) {
      return new Response(JSON.stringify({ error: 'Invalid locale' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);

    // Fetch from database for specific locale
    const dbTemplate = await db.query.emailTemplates.findFirst({
      where: and(
        eq(emailTemplates.type, type),
        eq(emailTemplates.locale, locale)
      ),
    });

    // Get default if not in database (defaults are in Dutch)
    const defaultTemplate = locale === 'nl' ? defaultTemplates[type as keyof typeof defaultTemplates] : null;

    if (!dbTemplate && !defaultTemplate) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const template = {
      type,
      locale,
      subject: dbTemplate?.subject || defaultTemplate?.subject || '',
      bodyHtml: dbTemplate?.bodyHtml || defaultTemplate?.bodyHtml || '',
      bodyText: dbTemplate?.bodyText || defaultTemplate?.bodyText || '',
      isCustomized: !!dbTemplate,
      availableVariables: [
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
        'signed_by',
        'signed_at',
      ],
    };

    return new Response(JSON.stringify(template), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch email template:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch email template' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// PUT: Update or create email template
export const PUT: APIRoute = async ({ params, request, locals, url }) => {
  try {
    const { type } = params;
    const locale = (url.searchParams.get('locale') || 'nl') as Locale;

    if (!type || !isValidType(type)) {
      return new Response(JSON.stringify({ error: 'Invalid template type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!isValidLocale(locale)) {
      return new Response(JSON.stringify({ error: 'Invalid locale' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    // Validate required fields
    if (!body.subject || !body.bodyHtml) {
      return new Response(JSON.stringify({ error: 'Subject and body are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if template exists for this type AND locale
    const existingTemplate = await db.query.emailTemplates.findFirst({
      where: and(
        eq(emailTemplates.type, type),
        eq(emailTemplates.locale, locale)
      ),
    });

    if (existingTemplate) {
      // Update existing
      await db.update(emailTemplates)
        .set({
          subject: body.subject,
          bodyHtml: body.bodyHtml,
          bodyText: body.bodyText || '',
          updatedAt: new Date(),
        })
        .where(eq(emailTemplates.id, existingTemplate.id));
    } else {
      // Create new
      await db.insert(emailTemplates).values({
        id: generateId(),
        type,
        locale,
        subject: body.subject,
        bodyHtml: body.bodyHtml,
        bodyText: body.bodyText || '',
        availableVariables: JSON.stringify([
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
        ]),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to update email template:', error);
    return new Response(JSON.stringify({ error: 'Failed to update email template' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// DELETE: Reset template to default
export const DELETE: APIRoute = async ({ params, locals, url }) => {
  try {
    const { type } = params;
    const locale = (url.searchParams.get('locale') || 'nl') as Locale;

    if (!type || !isValidType(type)) {
      return new Response(JSON.stringify({ error: 'Invalid template type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!isValidLocale(locale)) {
      return new Response(JSON.stringify({ error: 'Invalid locale' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);

    // Delete custom template for specific locale (reverts to default)
    await db.delete(emailTemplates).where(
      and(
        eq(emailTemplates.type, type),
        eq(emailTemplates.locale, locale)
      )
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to reset email template:', error);
    return new Response(JSON.stringify({ error: 'Failed to reset email template' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

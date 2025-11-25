import type { APIRoute } from 'astro';
import { createDb, quotes, customers, appSettings } from '@/lib/db';
import { sendQuoteEmail } from '@/lib/email';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    const { type, quoteId } = body;

    if (!type || !quoteId) {
      return new Response(JSON.stringify({ error: 'Type and quoteId are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate type
    const validTypes = ['quote_sent', 'quote_accepted', 'quote_reminder', 'quote_declined'];
    if (!validTypes.includes(type)) {
      return new Response(JSON.stringify({ error: 'Invalid email type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch quote with customer
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, quoteId),
      with: { customer: true },
    });

    if (!quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!quote.customer) {
      return new Response(JSON.stringify({ error: 'Quote has no customer' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Resend API key from environment or settings
    const resendApiKey = locals.runtime.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not configured, email not sent');
      return new Response(JSON.stringify({
        success: false,
        error: 'Email service not configured',
        skipped: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get app URL
    const appUrl = locals.runtime.env.APP_URL || 'https://quote.tesorohq.io';

    // Send email
    const result = await sendQuoteEmail(
      type as 'quote_sent' | 'quote_accepted' | 'quote_reminder' | 'quote_declined',
      quote,
      quote.customer,
      resendApiKey,
      appUrl
    );

    if (!result.success) {
      console.error('Failed to send email:', result.error);
      return new Response(JSON.stringify({
        success: false,
        error: result.error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Email send error:', error);
    return new Response(JSON.stringify({ error: 'Failed to send email' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

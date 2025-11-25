import type { APIRoute } from 'astro';
import { createDb, quotes, quoteComments, auditLog } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const { token } = params;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    // Validate message
    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get quote
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.publicToken, token),
      with: {
        customer: true,
      },
    });

    if (!quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add comment (optionally linked to a specific line)
    await db.insert(quoteComments).values({
      id: generateId(),
      quoteId: quote.id,
      lineId: body.lineId || null, // Optional: link to specific line
      authorType: 'customer',
      authorEmail: quote.customer?.email,
      authorName: quote.customer?.contactName,
      message: body.message.trim(),
      isRead: false,
    });

    // Log the question
    await db.insert(auditLog).values({
      id: generateId(),
      entityType: 'quote',
      entityId: quote.id,
      action: 'question_asked',
      changes: JSON.stringify({ message: body.message.trim() }),
      userType: 'customer',
      userEmail: quote.customer?.email,
      ipAddress: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For'),
      userAgent: request.headers.get('User-Agent'),
    });

    // TODO: Send notification email to team with the question

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Question sent successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to send question:', error);
    return new Response(JSON.stringify({ error: 'Failed to send question' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

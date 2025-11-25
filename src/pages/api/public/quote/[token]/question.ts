import type { APIRoute } from 'astro';
import { createDb, quotes, quoteComments, quoteLines, auditLog } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { eq, desc } from 'drizzle-orm';

// GET: Fetch all comments for this quote
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { token } = params;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);

    // Get quote
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.publicToken, token),
    });

    if (!quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch all comments for this quote
    const comments = await db
      .select({
        id: quoteComments.id,
        lineId: quoteComments.lineId,
        authorType: quoteComments.authorType,
        authorName: quoteComments.authorName,
        authorEmail: quoteComments.authorEmail,
        message: quoteComments.message,
        createdAt: quoteComments.createdAt,
      })
      .from(quoteComments)
      .where(eq(quoteComments.quoteId, quote.id))
      .orderBy(quoteComments.createdAt);

    // Get line descriptions for comments linked to lines
    const lineIds = comments.filter(c => c.lineId).map(c => c.lineId as string);
    let lineMap = new Map<string, string | null>();

    if (lineIds.length > 0) {
      // Fetch all lines that have comments
      const lines = await db
        .select({ id: quoteLines.id, description: quoteLines.description })
        .from(quoteLines);

      lineMap = new Map(
        lines
          .filter(l => lineIds.includes(l.id))
          .map(l => [l.id, l.description])
      );
    }

    const commentsWithLineInfo = comments.map(c => ({
      ...c,
      lineDescription: c.lineId ? lineMap.get(c.lineId) : null,
    }));

    return new Response(JSON.stringify(commentsWithLineInfo), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch comments' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

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

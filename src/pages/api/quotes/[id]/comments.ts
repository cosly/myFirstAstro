import type { APIRoute } from 'astro';
import { createDb, quotes, quoteComments, quoteLines } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';

// GET: Fetch all comments for a quote (admin view)
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Quote ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);

    // Check quote exists
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, id),
    });

    if (!quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch all comments
    const comments = await db
      .select({
        id: quoteComments.id,
        lineId: quoteComments.lineId,
        authorType: quoteComments.authorType,
        authorId: quoteComments.authorId,
        authorName: quoteComments.authorName,
        authorEmail: quoteComments.authorEmail,
        message: quoteComments.message,
        isRead: quoteComments.isRead,
        createdAt: quoteComments.createdAt,
      })
      .from(quoteComments)
      .where(eq(quoteComments.quoteId, id))
      .orderBy(quoteComments.createdAt);

    // Get line descriptions
    const lineIds = comments.filter(c => c.lineId).map(c => c.lineId as string);
    let lineMap = new Map<string, string | null>();

    if (lineIds.length > 0) {
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
      lineDescription: c.lineId ? lineMap.get(c.lineId) || null : null,
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

// POST: Add a team reply
export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Quote ID required' }), {
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

    // Check quote exists
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, id),
    });

    if (!quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get current user from session
    const user = locals.user;

    // Add team comment
    const commentId = generateId();
    await db.insert(quoteComments).values({
      id: commentId,
      quoteId: id,
      lineId: body.lineId || null,
      authorType: 'team',
      authorId: user?.id || null,
      authorName: user?.name || 'Team',
      authorEmail: user?.email || null,
      message: body.message.trim(),
      isRead: true, // Team comments are already "read" by team
    });

    // Mark all customer comments as read
    await db.update(quoteComments)
      .set({ isRead: true })
      .where(eq(quoteComments.quoteId, id));

    // TODO: Send email notification to customer about the reply

    return new Response(
      JSON.stringify({
        success: true,
        commentId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to add comment:', error);
    return new Response(JSON.stringify({ error: 'Failed to add comment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

import type { APIRoute } from 'astro';
import { createDb, quotes, quoteBlocks, quoteLines, quoteVersions, auditLog } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';

// Get quote by public token
export const GET: APIRoute = async ({ params, locals, request }) => {
  try {
    const { token } = params;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);

    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.publicToken, token),
      with: {
        customer: true,
        blocks: {
          with: {
            lines: true,
          },
          orderBy: (blocks, { asc }) => [asc(blocks.position)],
        },
      },
    });

    if (!quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Mark as viewed if first time
    if (quote.status === 'sent' && !quote.viewedAt) {
      await db
        .update(quotes)
        .set({
          status: 'viewed',
          viewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, quote.id));

      // Log the view
      await db.insert(auditLog).values({
        id: generateId(),
        entityType: 'quote',
        entityId: quote.id,
        action: 'viewed',
        userType: 'customer',
        userEmail: quote.customer?.email,
        ipAddress: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For'),
        userAgent: request.headers.get('User-Agent'),
      });
    }

    return new Response(JSON.stringify(quote), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch quote:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch quote' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Update selections
export const PATCH: APIRoute = async ({ params, request, locals }) => {
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

    // Get quote
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.publicToken, token),
      with: {
        blocks: {
          with: { lines: true },
        },
      },
    });

    if (!quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if quote can be modified
    if (!['sent', 'viewed'].includes(quote.status)) {
      return new Response(JSON.stringify({ error: 'Quote cannot be modified' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update block selection
    if (body.blockId && body.lineId === null) {
      await db
        .update(quoteBlocks)
        .set({ isSelectedByCustomer: body.selected })
        .where(eq(quoteBlocks.id, body.blockId));
    }

    // Update line selection
    if (body.blockId && body.lineId) {
      await db
        .update(quoteLines)
        .set({ isSelectedByCustomer: body.selected })
        .where(eq(quoteLines.id, body.lineId));
    }

    // Create version snapshot
    const latestVersion = await db.query.quoteVersions.findFirst({
      where: eq(quoteVersions.quoteId, quote.id),
      orderBy: (versions, { desc }) => [desc(versions.versionNumber)],
    });

    await db.insert(quoteVersions).values({
      id: generateId(),
      quoteId: quote.id,
      versionNumber: (latestVersion?.versionNumber || 0) + 1,
      snapshot: JSON.stringify({ ...quote, selections: body }),
      changeSummary: `Klant heeft optie ${body.selected ? 'toegevoegd' : 'verwijderd'}`,
      changedBy: `customer:${quote.customer?.email}`,
      changeType: 'options_changed',
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to update quote:', error);
    return new Response(JSON.stringify({ error: 'Failed to update quote' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

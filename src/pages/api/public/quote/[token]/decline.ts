import type { APIRoute } from 'astro';
import { createDb, quotes, quoteVersions, auditLog } from '@/lib/db';
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

    // Check if quote can be declined
    if (!['sent', 'viewed'].includes(quote.status)) {
      return new Response(JSON.stringify({ error: 'Quote cannot be declined' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update quote
    await db
      .update(quotes)
      .set({
        status: 'declined',
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quote.id));

    // Create version snapshot
    const latestVersion = await db.query.quoteVersions.findFirst({
      where: eq(quoteVersions.quoteId, quote.id),
      orderBy: (versions, { desc }) => [desc(versions.versionNumber)],
    });

    await db.insert(quoteVersions).values({
      id: generateId(),
      quoteId: quote.id,
      versionNumber: (latestVersion?.versionNumber || 0) + 1,
      snapshot: JSON.stringify({ ...quote, declineReason: body.reason }),
      changeSummary: body.reason ? `Offerte afgewezen: ${body.reason}` : 'Offerte afgewezen',
      changedBy: `customer:${quote.customer?.email}`,
      changeType: 'declined',
    });

    // Log the decline
    await db.insert(auditLog).values({
      id: generateId(),
      entityType: 'quote',
      entityId: quote.id,
      action: 'declined',
      changes: JSON.stringify({ reason: body.reason }),
      userType: 'customer',
      userEmail: quote.customer?.email,
      ipAddress: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For'),
      userAgent: request.headers.get('User-Agent'),
    });

    // TODO: Send notification email to team

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Quote declined',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to decline quote:', error);
    return new Response(JSON.stringify({ error: 'Failed to decline quote' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

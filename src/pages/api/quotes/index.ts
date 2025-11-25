import type { APIRoute } from 'astro';
import { createDb, quotes, quoteBlocks, quoteLines, quoteVersions } from '@/lib/db';
import { generateId, generateQuoteNumber, generatePublicToken } from '@/lib/utils';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);

    const allQuotes = await db.query.quotes.findMany({
      with: {
        customer: true,
        createdByMember: true,
      },
      orderBy: (quotes, { desc }) => [desc(quotes.createdAt)],
    });

    return new Response(JSON.stringify(allQuotes), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch quotes:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch quotes' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    // Get user from auth context
    const user = locals.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate required fields
    if (!body.customerId) {
      return new Response(JSON.stringify({ error: 'Customer ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const quoteId = generateId();
    const quoteNumber = generateQuoteNumber();
    const publicToken = generatePublicToken();
    const status = body.status === 'sent' ? 'sent' : 'draft';
    const sentAt = status === 'sent' ? new Date() : null;

    // Create quote
    await db.insert(quotes).values({
      id: quoteId,
      quoteNumber,
      customerId: body.customerId,
      requestId: body.requestId || null,
      createdBy: user.id,
      title: body.title || 'Offerte',
      introText: body.introText || null,
      footerText: body.footerText || null,
      subtotal: body.subtotal || 0,
      btwAmount: body.btwAmount || 0,
      total: body.total || 0,
      status,
      sentAt,
      publicToken,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
    });

    // Create blocks and lines
    if (body.blocks && Array.isArray(body.blocks)) {
      for (const block of body.blocks) {
        const blockId = generateId();

        await db.insert(quoteBlocks).values({
          id: blockId,
          quoteId,
          blockType: block.blockType,
          title: block.title,
          description: block.description,
          imageUrl: block.imageUrl,
          isOptional: block.isOptional || false,
          isSelectedByCustomer: block.isSelectedByCustomer ?? true,
          position: block.position,
        });

        if (block.lines && Array.isArray(block.lines)) {
          for (const line of block.lines) {
            await db.insert(quoteLines).values({
              id: generateId(),
              blockId,
              serviceId: line.serviceId,
              description: line.description,
              quantity: line.quantity,
              unit: line.unit,
              unitPrice: line.unitPrice,
              btwRate: line.btwRate,
              discountType: line.discountType,
              discountValue: line.discountValue,
              lineTotal: line.lineTotal || line.quantity * line.unitPrice,
              isOptional: line.isOptional || false,
              isSelectedByCustomer: line.isSelectedByCustomer ?? true,
              position: line.position,
            });
          }
        }
      }
    }

    // Create initial version
    await db.insert(quoteVersions).values({
      id: generateId(),
      quoteId,
      versionNumber: 1,
      snapshot: JSON.stringify(body),
      changeSummary: status === 'sent' ? 'Offerte aangemaakt en verstuurd' : 'Offerte aangemaakt',
      changedBy: `team:${user.id}`,
      changeType: 'created',
    });

    return new Response(
      JSON.stringify({
        id: quoteId,
        quoteNumber,
        publicToken,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to create quote:', error);
    return new Response(JSON.stringify({ error: 'Failed to create quote' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

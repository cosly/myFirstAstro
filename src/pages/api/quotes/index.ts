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

    const quoteId = generateId();
    const quoteNumber = generateQuoteNumber();
    const publicToken = generatePublicToken();

    // Create quote
    await db.insert(quotes).values({
      id: quoteId,
      quoteNumber,
      customerId: body.customerId,
      requestId: body.requestId,
      createdBy: body.createdBy || 'system', // TODO: get from auth
      title: body.title,
      introText: body.introText,
      footerText: body.footerText,
      subtotal: body.subtotal || 0,
      btwAmount: body.btwAmount || 0,
      total: body.total || 0,
      status: 'draft',
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
      changeSummary: 'Offerte aangemaakt',
      changedBy: body.createdBy || 'system',
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

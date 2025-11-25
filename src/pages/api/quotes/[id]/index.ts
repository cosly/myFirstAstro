import type { APIRoute } from 'astro';
import { createDb, quotes, quoteBlocks, quoteLines } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/utils';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Quote ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, id),
      with: {
        customer: true,
        blocks: {
          with: {
            lines: true,
          },
        },
      },
    });

    if (!quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
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

export const PUT: APIRoute = async ({ params, request, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const { id } = params;
    const body = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'Quote ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check quote exists
    const existing = await db.query.quotes.findFirst({
      where: eq(quotes.id, id),
    });

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update quote
    await db
      .update(quotes)
      .set({
        customerId: body.customerId || existing.customerId,
        title: body.title || existing.title,
        introText: body.introText !== undefined ? body.introText : existing.introText,
        footerText: body.footerText !== undefined ? body.footerText : existing.footerText,
        subtotal: body.subtotal !== undefined ? body.subtotal : existing.subtotal,
        btwAmount: body.btwAmount !== undefined ? body.btwAmount : existing.btwAmount,
        total: body.total !== undefined ? body.total : existing.total,
        status: body.status || existing.status,
        validUntil: body.validUntil ? new Date(body.validUntil) : existing.validUntil,
        sentAt: body.status === 'sent' && existing.status !== 'sent' ? new Date() : existing.sentAt,
      })
      .where(eq(quotes.id, id));

    // Delete existing blocks and lines
    const existingBlocks = await db
      .select({ id: quoteBlocks.id })
      .from(quoteBlocks)
      .where(eq(quoteBlocks.quoteId, id));

    for (const block of existingBlocks) {
      await db.delete(quoteLines).where(eq(quoteLines.blockId, block.id));
    }
    await db.delete(quoteBlocks).where(eq(quoteBlocks.quoteId, id));

    // Create new blocks and lines
    if (body.blocks && Array.isArray(body.blocks)) {
      for (const block of body.blocks) {
        const blockId = generateId();

        await db.insert(quoteBlocks).values({
          id: blockId,
          quoteId: id,
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

    return new Response(JSON.stringify({ success: true, id }), {
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

export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Quote ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete blocks and lines first (cascade)
    const existingBlocks = await db
      .select({ id: quoteBlocks.id })
      .from(quoteBlocks)
      .where(eq(quoteBlocks.quoteId, id));

    for (const block of existingBlocks) {
      await db.delete(quoteLines).where(eq(quoteLines.blockId, block.id));
    }
    await db.delete(quoteBlocks).where(eq(quoteBlocks.quoteId, id));
    await db.delete(quotes).where(eq(quotes.id, id));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to delete quote:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete quote' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

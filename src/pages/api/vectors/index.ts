import type { APIRoute } from 'astro';
import { createDb, quotes, quoteRequests, quoteLines } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { indexQuote, indexQuoteRequest, deleteVector } from '@/lib/vectorize';

/**
 * Vector indexing API
 * POST /api/vectors/index - Index a single item
 * DELETE /api/vectors/index - Remove a vector
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { type, id } = body;

    if (!type || !id) {
      return new Response(
        JSON.stringify({ error: 'type and id required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const kv = locals.runtime.env.KV;
    const vectorize = locals.runtime.env.VECTORIZE;
    const db = createDb(locals.runtime.env.DB);

    if (!vectorize) {
      return new Response(
        JSON.stringify({ error: 'Vectorize not configured' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let success = false;

    if (type === 'quote') {
      const quote = await db.query.quotes.findFirst({
        where: eq(quotes.id, id),
        with: { lines: true },
      });

      if (!quote) {
        return new Response(
          JSON.stringify({ error: 'Quote not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      success = await indexQuote(vectorize, kv, {
        id: quote.id,
        title: quote.title,
        description: quote.description || undefined,
        serviceType: quote.serviceType || undefined,
        totalAmount: quote.totalAmount,
        customerId: quote.customerId || undefined,
        status: quote.status,
        createdAt: quote.createdAt,
        lines: quote.lines,
      });
    } else if (type === 'quote_request') {
      const request = await db.query.quoteRequests.findFirst({
        where: eq(quoteRequests.id, id),
      });

      if (!request) {
        return new Response(
          JSON.stringify({ error: 'Quote request not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      success = await indexQuoteRequest(vectorize, kv, {
        id: request.id,
        serviceType: request.serviceType,
        description: request.description,
        companyName: request.companyName || undefined,
        budgetIndication: request.budgetIndication || undefined,
        createdAt: request.createdAt,
      });
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Use "quote" or "quote_request"' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success, indexed: type, id }),
      { status: success ? 200 : 500, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Vector index error:', error);
    return new Response(
      JSON.stringify({ error: 'Indexing failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { type, id } = body;

    if (!type || !id) {
      return new Response(
        JSON.stringify({ error: 'type and id required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const vectorize = locals.runtime.env.VECTORIZE;

    if (!vectorize) {
      return new Response(
        JSON.stringify({ error: 'Vectorize not configured' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const success = await deleteVector(vectorize, type, id);

    return new Response(
      JSON.stringify({ success, deleted: type, id }),
      { status: success ? 200 : 500, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Vector delete error:', error);
    return new Response(
      JSON.stringify({ error: 'Delete failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

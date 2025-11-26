import type { APIRoute } from 'astro';
import { createDb, quotes, quoteRequests } from '@/lib/db';
import { indexQuote, indexQuoteRequest } from '@/lib/vectorize';

/**
 * Batch reindex all quotes and quote requests
 * POST /api/vectors/reindex
 *
 * This endpoint should be called to populate the vector index
 * with existing data. It processes items in batches to avoid timeouts.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { type = 'all', batchSize = 10, offset = 0 } = body;

    const kv = locals.runtime.env.KV;
    const vectorize = locals.runtime.env.VECTORIZE;
    const db = createDb(locals.runtime.env.DB);

    if (!vectorize) {
      return new Response(
        JSON.stringify({ error: 'Vectorize not configured' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      quotes: { total: 0, indexed: 0, failed: 0 },
      requests: { total: 0, indexed: 0, failed: 0 },
    };

    // Index quotes
    if (type === 'all' || type === 'quotes') {
      const allQuotes = await db.query.quotes.findMany({
        with: { lines: true },
        limit: batchSize,
        offset,
        orderBy: (q, { desc }) => [desc(q.createdAt)],
      });

      results.quotes.total = allQuotes.length;

      for (const quote of allQuotes) {
        const success = await indexQuote(vectorize, kv, {
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

        if (success) {
          results.quotes.indexed++;
        } else {
          results.quotes.failed++;
        }
      }
    }

    // Index quote requests
    if (type === 'all' || type === 'requests') {
      const allRequests = await db.query.quoteRequests.findMany({
        limit: batchSize,
        offset,
        orderBy: (r, { desc }) => [desc(r.createdAt)],
      });

      results.requests.total = allRequests.length;

      for (const req of allRequests) {
        const success = await indexQuoteRequest(vectorize, kv, {
          id: req.id,
          serviceType: req.serviceType,
          description: req.description,
          companyName: req.companyName || undefined,
          budgetIndication: req.budgetIndication || undefined,
          createdAt: req.createdAt,
        });

        if (success) {
          results.requests.indexed++;
        } else {
          results.requests.failed++;
        }
      }
    }

    // Check if there are more items to process
    const hasMore = results.quotes.total === batchSize || results.requests.total === batchSize;
    const nextOffset = offset + batchSize;

    return new Response(
      JSON.stringify({
        success: true,
        results,
        pagination: {
          offset,
          batchSize,
          hasMore,
          nextOffset: hasMore ? nextOffset : null,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Batch reindex error:', error);
    return new Response(
      JSON.stringify({ error: 'Reindex failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

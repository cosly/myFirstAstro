import type { APIRoute } from 'astro';
import { createDb, quoteRequests, quotes } from '@/lib/db';
import { eq, inArray } from 'drizzle-orm';
import { findSimilarQuotes } from '@/lib/vectorize';

/**
 * Find similar historical quotes for a quote request
 * GET /api/quote-requests/[id]/similar-quotes
 *
 * Uses vector similarity search to find quotes with similar
 * descriptions, service types, and requirements.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Request ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = createDb(locals.runtime.env.DB);
    const kv = locals.runtime.env.KV;
    const vectorize = locals.runtime.env.VECTORIZE;

    // Get the quote request
    const request = await db.query.quoteRequests.findFirst({
      where: eq(quoteRequests.id, id),
    });

    if (!request) {
      return new Response(
        JSON.stringify({ error: 'Quote request not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // If Vectorize is not configured, use fallback matching
    if (!vectorize) {
      // Fallback: find quotes with same service type
      const fallbackQuotes = await db.query.quotes.findMany({
        where: eq(quotes.serviceType, request.serviceType),
        limit: 5,
        orderBy: (q, { desc }) => [desc(q.createdAt)],
        with: {
          customer: true,
          lines: true,
        },
      });

      return new Response(
        JSON.stringify({
          results: fallbackQuotes.map(q => ({
            id: q.id,
            title: q.title,
            description: q.description,
            serviceType: q.serviceType,
            totalAmount: q.totalAmount,
            status: q.status,
            createdAt: q.createdAt,
            customer: q.customer ? {
              name: q.customer.name,
              company: q.customer.company,
            } : null,
            lineCount: q.lines.length,
            score: null, // No similarity score for fallback
          })),
          source: 'fallback',
          message: 'Using fallback matching (Vectorize not configured)',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build search query from request
    const searchQuery = [
      request.description,
      `Service: ${request.serviceType}`,
      request.companyName ? `Company: ${request.companyName}` : '',
    ].filter(Boolean).join(' | ');

    // Find similar quotes using vector search
    const similarResults = await findSimilarQuotes(vectorize, kv, searchQuery, {
      serviceType: request.serviceType,
      limit: 10,
      minScore: 0.65, // Slightly lower threshold for more results
    });

    if (similarResults.length === 0) {
      // No vector matches, try fallback
      const fallbackQuotes = await db.query.quotes.findMany({
        where: eq(quotes.serviceType, request.serviceType),
        limit: 5,
        orderBy: (q, { desc }) => [desc(q.createdAt)],
        with: {
          customer: true,
          lines: true,
        },
      });

      return new Response(
        JSON.stringify({
          results: fallbackQuotes.map(q => ({
            id: q.id,
            title: q.title,
            description: q.description,
            serviceType: q.serviceType,
            totalAmount: q.totalAmount,
            status: q.status,
            createdAt: q.createdAt,
            customer: q.customer ? {
              name: q.customer.name,
              company: q.customer.company,
            } : null,
            lineCount: q.lines.length,
            score: null,
          })),
          source: 'fallback',
          message: 'No vector matches found, using service type fallback',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get full quote details for matched IDs
    const quoteIds = similarResults.map(r => r.id);
    const matchedQuotes = await db.query.quotes.findMany({
      where: inArray(quotes.id, quoteIds),
      with: {
        customer: true,
        lines: true,
      },
    });

    // Combine with similarity scores
    const resultsWithScores = matchedQuotes.map(q => {
      const match = similarResults.find(r => r.id === q.id);
      return {
        id: q.id,
        title: q.title,
        description: q.description,
        serviceType: q.serviceType,
        totalAmount: q.totalAmount,
        status: q.status,
        createdAt: q.createdAt,
        customer: q.customer ? {
          name: q.customer.name,
          company: q.customer.company,
        } : null,
        lineCount: q.lines.length,
        score: match?.score || 0,
      };
    }).sort((a, b) => (b.score || 0) - (a.score || 0));

    return new Response(
      JSON.stringify({
        results: resultsWithScores,
        source: 'vectorize',
        count: resultsWithScores.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Similar quotes error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to find similar quotes' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

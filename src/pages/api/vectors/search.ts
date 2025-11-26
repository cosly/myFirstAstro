import type { APIRoute } from 'astro';
import { findSimilarQuotes, getRAGContext } from '@/lib/vectorize';

/**
 * Semantic search API for quotes
 * POST /api/vectors/search
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { query, serviceType, limit = 5, includeContext = false } = body;

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query string required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const kv = locals.runtime.env.KV;
    const vectorize = locals.runtime.env.VECTORIZE;

    if (!vectorize) {
      return new Response(
        JSON.stringify({ error: 'Vectorize not configured', results: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find similar quotes
    const results = await findSimilarQuotes(vectorize, kv, query, {
      serviceType,
      limit,
      minScore: 0.7,
    });

    // Optionally include RAG context
    let ragContext = '';
    if (includeContext) {
      ragContext = await getRAGContext(vectorize, kv, query, {
        types: ['quote', 'quote_request'],
        limit: 10,
      });
    }

    return new Response(
      JSON.stringify({
        results,
        context: ragContext,
        count: results.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Vector search error:', error);
    return new Response(
      JSON.stringify({ error: 'Search failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

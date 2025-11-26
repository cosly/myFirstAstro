import type { APIRoute } from 'astro';
import { analyzeQuoteRequest, type QuoteRequestAnalysis } from '@/lib/quote-request-ai';
import { createDb, quoteRequests } from '@/lib/db';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Request ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Try to get cached analysis from KV
    const cachedAnalysis = await locals.runtime.env.KV.get(`quote_request_ai:${id}`);

    if (cachedAnalysis) {
      return new Response(cachedAnalysis, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // No cached analysis - return 404
    return new Response(JSON.stringify({ error: 'Analysis not available yet' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to get AI analysis:', error);
    return new Response(JSON.stringify({ error: 'Failed to get analysis' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST to trigger new analysis
export const POST: APIRoute = async ({ params, locals }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Request ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const db = createDb(locals.runtime.env.DB);

    // Get the quote request from database
    const quoteRequest = await db.query.quoteRequests.findFirst({
      where: eq(quoteRequests.id, id),
    });

    if (!quoteRequest) {
      return new Response(JSON.stringify({ error: 'Quote request not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Run AI analysis
    const analysis = await analyzeQuoteRequest(
      {
        serviceType: quoteRequest.serviceType,
        description: quoteRequest.description,
        budgetIndication: quoteRequest.budgetIndication || undefined,
        companyName: quoteRequest.companyName || undefined,
      },
      locals.runtime.env.KV
    );

    if (!analysis) {
      return new Response(JSON.stringify({ error: 'AI analysis not available. Check AI configuration.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Cache the analysis
    await locals.runtime.env.KV.put(
      `quote_request_ai:${id}`,
      JSON.stringify(analysis),
      { expirationTtl: 60 * 60 * 24 * 90 } // 90 days
    );

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to run AI analysis:', error);
    return new Response(JSON.stringify({ error: 'Failed to run analysis' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

import type { APIRoute } from 'astro';
import { createDb, quoteRequests, customers } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';
import { notifyQuoteRequestReceived } from '@/lib/discord';
import { performSpamChecks, getClientIP, generateFingerprint } from '@/lib/spam-protection';
import { analyzeQuoteRequest } from '@/lib/quote-request-ai';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);

    const allRequests = await db.query.quoteRequests.findMany({
      with: {
        customer: true,
        assignedMember: true,
      },
      orderBy: (requests, { desc }) => [desc(requests.createdAt)],
    });

    return new Response(JSON.stringify(allRequests), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch quote requests:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch quote requests' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    // Get Turnstile secret key from KV or environment
    const turnstileSecretKey = await locals.runtime.env.KV.get('turnstile_secret_key') ||
                               locals.runtime.env.TURNSTILE_SECRET_KEY;

    // Perform spam checks (honeypot, rate limiting, Turnstile)
    const spamCheck = await performSpamChecks(request, body, {
      KV: locals.runtime.env.KV,
      TURNSTILE_SECRET_KEY: turnstileSecretKey || undefined,
    });

    if (!spamCheck.passed) {
      console.warn('Spam check failed:', spamCheck.error, {
        ip: getClientIP(request),
        email: body.email,
      });
      return new Response(
        JSON.stringify({ error: spamCheck.error }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate required fields (form sends 'email', not 'contactEmail')
    const contactEmail = body.contactEmail || body.email;
    if (!body.serviceType || !body.description || !contactEmail || !body.contactName) {
      return new Response(
        JSON.stringify({ error: 'Vul alle verplichte velden in' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      return new Response(
        JSON.stringify({ error: 'Voer een geldig e-mailadres in' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if customer exists by email
    let customerId: string | null = null;
    if (body.isTesororClient) {
      const existingCustomer = await db.query.customers.findFirst({
        where: eq(customers.email, body.email),
      });

      if (existingCustomer) {
        customerId = existingCustomer.id;
      }
    }

    // Generate fingerprint for tracking
    const fingerprint = generateFingerprint(request);
    const clientIP = getClientIP(request);

    // Create quote request
    const requestId = generateId();
    await db.insert(quoteRequests).values({
      id: requestId,
      customerId,
      contactEmail,
      contactName: body.contactName,
      companyName: body.companyName,
      phone: body.phone,
      serviceType: body.serviceType,
      description: body.description,
      budgetIndication: body.budgetIndication,
      status: 'new',
    });

    // Log submission metadata for security auditing (in KV for now)
    await locals.runtime.env.KV.put(
      `quote_request_meta:${requestId}`,
      JSON.stringify({
        ip: clientIP,
        fingerprint,
        userAgent: request.headers.get('User-Agent'),
        submittedAt: new Date().toISOString(),
      }),
      { expirationTtl: 60 * 60 * 24 * 30 } // 30 days
    );

    // Send Discord notification
    const appUrl = new URL(request.url).origin;
    const createdRequest = await db.query.quoteRequests.findFirst({
      where: eq(quoteRequests.id, requestId),
    });
    if (createdRequest) {
      notifyQuoteRequestReceived(db, createdRequest, appUrl).catch(err => {
        console.error('Failed to send Discord notification:', err);
      });
    }

    // Run AI analysis in background (non-blocking)
    analyzeQuoteRequest(
      {
        serviceType: body.serviceType,
        description: body.description,
        budgetIndication: body.budgetIndication,
        companyName: body.companyName,
      },
      locals.runtime.env.KV
    ).then(async (analysis) => {
      if (analysis) {
        // Store AI analysis in KV for later retrieval
        await locals.runtime.env.KV.put(
          `quote_request_ai:${requestId}`,
          JSON.stringify(analysis),
          { expirationTtl: 60 * 60 * 24 * 90 } // 90 days
        );
        console.log('AI analysis completed for request:', requestId);
      }
    }).catch(err => {
      console.error('Failed to run AI analysis:', err);
    });

    return new Response(
      JSON.stringify({
        id: requestId,
        message: 'Quote request submitted successfully',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to create quote request:', error);
    return new Response(JSON.stringify({ error: 'Er is iets misgegaan. Probeer het later opnieuw.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

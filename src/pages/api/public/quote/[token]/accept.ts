import type { APIRoute } from 'astro';
import { createDb, quotes, quoteVersions, auditLog } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { sendQuoteEmail } from '@/lib/email';
import { eq } from 'drizzle-orm';
import { notifyQuoteAccepted } from '@/lib/discord';

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

    // Validate signature data
    if (!body.signatureDataUrl || !body.name) {
      return new Response(JSON.stringify({ error: 'Signature and name required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get quote
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.publicToken, token),
      with: {
        customer: true,
        blocks: { with: { lines: true } },
      },
    });

    if (!quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if quote can be accepted
    if (!['sent', 'viewed'].includes(quote.status)) {
      return new Response(JSON.stringify({ error: 'Quote cannot be accepted' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Upload signature to R2
    const signatureBuffer = Buffer.from(
      body.signatureDataUrl.replace(/^data:image\/png;base64,/, ''),
      'base64'
    );

    const signatureKey = `signatures/${quote.id}-${Date.now()}.png`;
    await locals.runtime.env.STORAGE.put(signatureKey, signatureBuffer, {
      httpMetadata: { contentType: 'image/png' },
    });

    // Update quote
    await db
      .update(quotes)
      .set({
        status: 'accepted',
        signedAt: new Date(),
        signatureUrl: signatureKey,
        signedByName: body.name,
        signedByFunction: body.function,
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
      snapshot: JSON.stringify({ ...quote, signedBy: body.name }),
      changeSummary: `Offerte geaccepteerd door ${body.name}`,
      changedBy: `customer:${quote.customer?.email}`,
      changeType: 'accepted',
    });

    // Log the acceptance
    await db.insert(auditLog).values({
      id: generateId(),
      entityType: 'quote',
      entityId: quote.id,
      action: 'accepted',
      changes: JSON.stringify({ signedBy: body.name, signedByFunction: body.function }),
      userType: 'customer',
      userEmail: quote.customer?.email,
      ipAddress: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For'),
      userAgent: request.headers.get('User-Agent'),
    });

    // Send confirmation email to team
    const resendApiKey = locals.runtime.env.RESEND_API_KEY;
    const appUrl = locals.runtime.env.APP_URL || 'https://quote.tesorohq.io';

    if (resendApiKey && quote.customer) {
      // Get the updated quote with signed info
      const updatedQuote = await db.query.quotes.findFirst({
        where: eq(quotes.id, quote.id),
        with: { customer: true },
      });

      if (updatedQuote && updatedQuote.customer) {
        try {
          // Note: This sends the "quote_accepted" email which goes to the team
          // The customer confirmation could be a separate template
          await sendQuoteEmail(
            'quote_accepted',
            updatedQuote,
            updatedQuote.customer,
            resendApiKey,
            appUrl
          );
        } catch (emailError) {
          console.error('Failed to send acceptance email:', emailError);
          // Don't fail the request if email fails
        }
      }
    }

    // Send Discord notification
    if (quote.customer) {
      const updatedQuoteForDiscord = await db.query.quotes.findFirst({
        where: eq(quotes.id, quote.id),
      });
      if (updatedQuoteForDiscord) {
        notifyQuoteAccepted(db, updatedQuoteForDiscord, quote.customer, appUrl).catch(err => {
          console.error('Failed to send Discord notification:', err);
        });
      }
    }

    // TODO: Generate PDF with signature
    // TODO: Add to queue for follow-up tasks

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Quote accepted successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to accept quote:', error);
    return new Response(JSON.stringify({ error: 'Failed to accept quote' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

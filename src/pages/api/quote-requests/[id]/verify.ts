import type { APIRoute } from 'astro';
import { createDb, quoteRequests } from '@/lib/db';
import { eq } from 'drizzle-orm';
import {
  createVerificationToken,
  getExistingToken,
  isEmailVerified,
  buildVerificationUrl,
  getVerificationEmailContent,
} from '@/lib/email-verification';

/**
 * Email verification endpoints for quote requests
 *
 * GET /api/quote-requests/[id]/verify - Check verification status
 * POST /api/quote-requests/[id]/verify - Send/resend verification email
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

    const kv = locals.runtime.env.KV;
    const verified = await isEmailVerified(kv, id);

    return new Response(
      JSON.stringify({ verified }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Verification status error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to check verification status' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Request ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const kv = locals.runtime.env.KV;
    const db = createDb(locals.runtime.env.DB);

    // Get the quote request
    const quoteRequest = await db.query.quoteRequests.findFirst({
      where: eq(quoteRequests.id, id),
    });

    if (!quoteRequest) {
      return new Response(
        JSON.stringify({ error: 'Quote request not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if already verified
    const alreadyVerified = await isEmailVerified(kv, id);
    if (alreadyVerified) {
      return new Response(
        JSON.stringify({ message: 'Email already verified', verified: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing token (to avoid spam)
    const existingToken = await getExistingToken(kv, id);

    // Rate limit: check last send time
    const lastSendKey = `email_verify_sent:${id}`;
    const lastSend = await kv.get(lastSendKey);
    if (lastSend) {
      const lastSendTime = new Date(lastSend);
      const timeSince = Date.now() - lastSendTime.getTime();
      const minWait = 60 * 1000; // 1 minute between resends

      if (timeSince < minWait) {
        const waitSeconds = Math.ceil((minWait - timeSince) / 1000);
        return new Response(
          JSON.stringify({
            error: `Wacht ${waitSeconds} seconden voordat u opnieuw kunt versturen`,
            waitSeconds,
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Generate new token if needed
    const token = existingToken || await createVerificationToken(kv, id, quoteRequest.contactEmail);

    // Build verification URL
    const baseUrl = new URL(request.url).origin;
    const verificationUrl = buildVerificationUrl(baseUrl, token);

    // Get email content
    const locale = quoteRequest.locale || 'nl';
    const emailContent = getVerificationEmailContent(
      locale,
      verificationUrl,
      quoteRequest.contactName,
      quoteRequest.companyName || undefined
    );

    // Send email using configured email service
    // For now, we'll use a simple approach - check for email API config
    const emailApiKey = await kv.get('email_api_key');
    const emailApiEndpoint = await kv.get('email_api_endpoint');

    if (emailApiKey && emailApiEndpoint) {
      // Send via configured email API
      const emailResponse = await fetch(emailApiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${emailApiKey}`,
        },
        body: JSON.stringify({
          to: quoteRequest.contactEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        }),
      });

      if (!emailResponse.ok) {
        console.error('Email API error:', await emailResponse.text());
        return new Response(
          JSON.stringify({ error: 'Kon verificatie e-mail niet versturen' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Log email for debugging (no email service configured)
      console.log('=== VERIFICATION EMAIL (no email service configured) ===');
      console.log('To:', quoteRequest.contactEmail);
      console.log('Subject:', emailContent.subject);
      console.log('URL:', verificationUrl);
      console.log('=== END EMAIL ===');
    }

    // Record send time for rate limiting
    await kv.put(lastSendKey, new Date().toISOString(), { expirationTtl: 300 });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verificatie e-mail verstuurd',
        // Only include URL in dev/debug mode
        ...(emailApiKey ? {} : { verificationUrl }),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Send verification error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send verification email' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

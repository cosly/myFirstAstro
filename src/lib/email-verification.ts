/**
 * Email Verification System
 *
 * This module handles email verification for quote requests:
 * - Generates secure verification tokens
 * - Stores tokens in KV with expiration
 * - Validates tokens and updates request status
 */

import { generateId } from './utils';

// Token expires in 24 hours
const TOKEN_EXPIRY_HOURS = 24;
const TOKEN_EXPIRY_SECONDS = TOKEN_EXPIRY_HOURS * 60 * 60;

export interface VerificationToken {
  token: string;
  requestId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

export interface VerificationResult {
  success: boolean;
  requestId?: string;
  error?: string;
  alreadyVerified?: boolean;
}

/**
 * Generate a secure verification token
 */
function generateToken(): string {
  // Generate a URL-safe random token
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Create a verification token for a quote request
 */
export async function createVerificationToken(
  kv: KVNamespace,
  requestId: string,
  email: string
): Promise<string> {
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_SECONDS * 1000);

  const tokenData: VerificationToken = {
    token,
    requestId,
    email,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  // Store token with expiration
  await kv.put(
    `email_verify:${token}`,
    JSON.stringify(tokenData),
    { expirationTtl: TOKEN_EXPIRY_SECONDS }
  );

  // Also store a reverse lookup by request ID (for resending)
  await kv.put(
    `email_verify_request:${requestId}`,
    token,
    { expirationTtl: TOKEN_EXPIRY_SECONDS }
  );

  return token;
}

/**
 * Verify a token and return the request ID if valid
 */
export async function verifyToken(
  kv: KVNamespace,
  token: string
): Promise<VerificationResult> {
  const tokenDataStr = await kv.get(`email_verify:${token}`);

  if (!tokenDataStr) {
    return {
      success: false,
      error: 'Token ongeldig of verlopen',
    };
  }

  try {
    const tokenData: VerificationToken = JSON.parse(tokenDataStr);

    // Check if expired
    if (new Date(tokenData.expiresAt) < new Date()) {
      await kv.delete(`email_verify:${token}`);
      return {
        success: false,
        error: 'Token is verlopen',
      };
    }

    // Check if already verified
    const verifiedStatus = await kv.get(`email_verified:${tokenData.requestId}`);
    if (verifiedStatus) {
      return {
        success: true,
        requestId: tokenData.requestId,
        alreadyVerified: true,
      };
    }

    // Mark as verified
    await kv.put(
      `email_verified:${tokenData.requestId}`,
      JSON.stringify({
        email: tokenData.email,
        verifiedAt: new Date().toISOString(),
      }),
      { expirationTtl: 60 * 60 * 24 * 365 } // Keep for 1 year
    );

    // Clean up the token
    await kv.delete(`email_verify:${token}`);
    await kv.delete(`email_verify_request:${tokenData.requestId}`);

    return {
      success: true,
      requestId: tokenData.requestId,
    };
  } catch {
    return {
      success: false,
      error: 'Kon token niet verwerken',
    };
  }
}

/**
 * Check if a request's email is verified
 */
export async function isEmailVerified(
  kv: KVNamespace,
  requestId: string
): Promise<boolean> {
  const verifiedStatus = await kv.get(`email_verified:${requestId}`);
  return !!verifiedStatus;
}

/**
 * Get the existing token for a request (for resending)
 */
export async function getExistingToken(
  kv: KVNamespace,
  requestId: string
): Promise<string | null> {
  return await kv.get(`email_verify_request:${requestId}`);
}

/**
 * Build verification URL
 */
export function buildVerificationUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/aanvragen/verify?token=${token}`;
}

/**
 * Get verification email content (multilingual)
 */
export function getVerificationEmailContent(
  locale: string,
  verificationUrl: string,
  contactName: string,
  companyName?: string
): { subject: string; html: string; text: string } {
  const templates: Record<string, {
    subject: string;
    greeting: string;
    intro: string;
    button: string;
    expiry: string;
    ignore: string;
    footer: string;
  }> = {
    nl: {
      subject: 'Bevestig uw offerte aanvraag',
      greeting: `Beste ${contactName}`,
      intro: 'Bedankt voor uw offerte aanvraag. Klik op de onderstaande knop om uw e-mailadres te bevestigen.',
      button: 'E-mail Bevestigen',
      expiry: 'Deze link is 24 uur geldig.',
      ignore: 'Als u deze aanvraag niet heeft ingediend, kunt u deze e-mail negeren.',
      footer: 'Met vriendelijke groet,\nHet Tesoro Team',
    },
    en: {
      subject: 'Confirm your quote request',
      greeting: `Dear ${contactName}`,
      intro: 'Thank you for your quote request. Please click the button below to verify your email address.',
      button: 'Verify Email',
      expiry: 'This link is valid for 24 hours.',
      ignore: 'If you did not submit this request, you can ignore this email.',
      footer: 'Best regards,\nThe Tesoro Team',
    },
    es: {
      subject: 'Confirme su solicitud de presupuesto',
      greeting: `Estimado/a ${contactName}`,
      intro: 'Gracias por su solicitud de presupuesto. Haga clic en el botón de abajo para verificar su dirección de correo electrónico.',
      button: 'Verificar Email',
      expiry: 'Este enlace es válido durante 24 horas.',
      ignore: 'Si no envió esta solicitud, puede ignorar este correo electrónico.',
      footer: 'Atentamente,\nEl equipo de Tesoro',
    },
  };

  const t = templates[locale] || templates.nl;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #FF6B35; }
    .content { background: #f9f9f9; border-radius: 8px; padding: 30px; }
    .button { display: inline-block; background: #FF6B35; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 500; margin: 20px 0; }
    .button:hover { background: #e55a2b; }
    .footer { margin-top: 30px; font-size: 14px; color: #666; }
    .note { font-size: 13px; color: #888; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Tesoro</div>
    </div>
    <div class="content">
      <p>${t.greeting}${companyName ? ` (${companyName})` : ''},</p>
      <p>${t.intro}</p>
      <p style="text-align: center;">
        <a href="${verificationUrl}" class="button">${t.button}</a>
      </p>
      <p class="note">${t.expiry}</p>
      <p class="note">${t.ignore}</p>
    </div>
    <div class="footer">
      <p>${t.footer.replace('\n', '<br>')}</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
${t.greeting}${companyName ? ` (${companyName})` : ''},

${t.intro}

${t.button}: ${verificationUrl}

${t.expiry}

${t.ignore}

${t.footer}
  `.trim();

  return {
    subject: t.subject,
    html,
    text,
  };
}

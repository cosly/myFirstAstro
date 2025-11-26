/**
 * Spam Protection Module
 *
 * Provides:
 * - Cloudflare Turnstile verification
 * - Rate limiting via KV
 * - Honeypot field detection
 */

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  quote_request: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000, // 5 per hour
  },
  quote_request_ip: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 10 per hour per IP
  },
};

/**
 * Verify Cloudflare Turnstile token
 */
export async function verifyTurnstile(
  token: string,
  secretKey: string,
  ip?: string
): Promise<{ success: boolean; error?: string }> {
  if (!token) {
    return { success: false, error: 'Turnstile token ontbreekt' };
  }

  if (!secretKey) {
    // If no secret key configured, skip verification (for development)
    console.warn('Turnstile secret key not configured, skipping verification');
    return { success: true };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (ip) {
      formData.append('remoteip', ip);
    }

    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const result: TurnstileVerifyResponse = await response.json();

    if (!result.success) {
      const errorCodes = result['error-codes'] || [];
      console.error('Turnstile verification failed:', errorCodes);
      return {
        success: false,
        error: 'Verificatie mislukt. Vernieuw de pagina en probeer opnieuw.',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return { success: false, error: 'Verificatie service niet beschikbaar' };
  }
}

/**
 * Check rate limit using KV storage
 */
export async function checkRateLimit(
  kv: KVNamespace,
  identifier: string,
  limitType: keyof typeof RATE_LIMITS = 'quote_request'
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const config = RATE_LIMITS[limitType];
  const key = `rate_limit:${limitType}:${identifier}`;

  try {
    const data = await kv.get(key, 'json') as { count: number; resetAt: number } | null;
    const now = Date.now();

    if (!data || now >= data.resetAt) {
      // First request or window expired
      const resetAt = now + config.windowMs;
      await kv.put(
        key,
        JSON.stringify({ count: 1, resetAt }),
        { expirationTtl: Math.ceil(config.windowMs / 1000) }
      );
      return { allowed: true, remaining: config.maxRequests - 1, resetAt };
    }

    if (data.count >= config.maxRequests) {
      // Rate limit exceeded
      return { allowed: false, remaining: 0, resetAt: data.resetAt };
    }

    // Increment counter
    const newCount = data.count + 1;
    await kv.put(
      key,
      JSON.stringify({ count: newCount, resetAt: data.resetAt }),
      { expirationTtl: Math.ceil((data.resetAt - now) / 1000) }
    );

    return {
      allowed: true,
      remaining: config.maxRequests - newCount,
      resetAt: data.resetAt,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the request but log it
    return { allowed: true, remaining: config.maxRequests, resetAt: Date.now() + config.windowMs };
  }
}

/**
 * Detect honeypot field submission (spam bots fill hidden fields)
 */
export function detectHoneypot(formData: Record<string, unknown>): boolean {
  // Check for honeypot fields - these should always be empty
  const honeypotFields = ['website', 'url', 'fax_number', 'company_website'];

  for (const field of honeypotFields) {
    if (formData[field] && String(formData[field]).trim() !== '') {
      console.warn('Honeypot field filled:', field);
      return true; // Bot detected
    }
  }

  return false;
}

/**
 * Generate a simple fingerprint from request
 */
export function generateFingerprint(request: Request): string {
  const ip = request.headers.get('CF-Connecting-IP') ||
             request.headers.get('X-Forwarded-For')?.split(',')[0] ||
             'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  const acceptLang = request.headers.get('Accept-Language') || '';

  // Simple hash of the combination
  const combined = `${ip}-${userAgent.slice(0, 50)}-${acceptLang.slice(0, 20)}`;
  return btoa(combined).slice(0, 32);
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         request.headers.get('X-Real-IP') ||
         'unknown';
}

/**
 * Validate submission timing (bot detection)
 * Legitimate users take at least a few seconds to fill out forms
 */
export function validateSubmissionTiming(
  submissionTime: number,
  minTimeMs: number = 3000 // 3 seconds minimum
): boolean {
  return submissionTime >= minTimeMs;
}

/**
 * Combined spam check for quote requests
 */
export async function performSpamChecks(
  request: Request,
  formData: Record<string, unknown>,
  env: { KV: KVNamespace; TURNSTILE_SECRET_KEY?: string }
): Promise<{ passed: boolean; error?: string }> {
  const ip = getClientIP(request);

  // 1. Check honeypot
  if (detectHoneypot(formData)) {
    return { passed: false, error: 'Spam gedetecteerd' };
  }

  // 2. Check rate limit by IP
  const ipLimit = await checkRateLimit(env.KV, ip, 'quote_request_ip');
  if (!ipLimit.allowed) {
    const resetDate = new Date(ipLimit.resetAt);
    return {
      passed: false,
      error: `Te veel aanvragen. Probeer opnieuw na ${resetDate.toLocaleTimeString('nl-NL')}`,
    };
  }

  // 3. Check rate limit by email
  const email = formData.email || formData.contactEmail;
  if (email && typeof email === 'string') {
    const emailLimit = await checkRateLimit(env.KV, email.toLowerCase(), 'quote_request');
    if (!emailLimit.allowed) {
      return {
        passed: false,
        error: 'U heeft al recent een aanvraag ingediend. We nemen spoedig contact met u op.',
      };
    }
  }

  // 4. Verify Turnstile token
  const turnstileToken = formData.turnstileToken || formData['cf-turnstile-response'];
  if (turnstileToken && typeof turnstileToken === 'string') {
    const turnstileResult = await verifyTurnstile(
      turnstileToken,
      env.TURNSTILE_SECRET_KEY || '',
      ip
    );
    if (!turnstileResult.success) {
      return { passed: false, error: turnstileResult.error };
    }
  }

  // 5. Validate submission timing
  const formStartTime = formData._formStartTime;
  if (formStartTime && typeof formStartTime === 'number') {
    const submissionTime = Date.now() - formStartTime;
    if (!validateSubmissionTiming(submissionTime)) {
      return { passed: false, error: 'Aanvraag te snel ingediend. Probeer opnieuw.' };
    }
  }

  return { passed: true };
}

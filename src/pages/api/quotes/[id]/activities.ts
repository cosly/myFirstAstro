import type { APIRoute } from 'astro';
import { createDb, quotes, quoteActivities, quoteSessions } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { eq, desc, and, gte } from 'drizzle-orm';

/**
 * GET: Fetch activities for a quote
 * Query params:
 * - limit: Number of activities to return (default: 50)
 * - sessionId: Filter by session ID
 * - since: Timestamp to get activities after (for real-time updates)
 */
export const GET: APIRoute = async ({ params, request, locals }) => {
  try {
    const { id: quoteId } = params;
    if (!quoteId) {
      return new Response(JSON.stringify({ error: 'Quote ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);
    const url = new URL(request.url);

    const limit = parseInt(url.searchParams.get('limit') || '50');
    const sessionId = url.searchParams.get('sessionId');
    const since = url.searchParams.get('since');

    // Build query conditions
    const conditions = [eq(quoteActivities.quoteId, quoteId)];

    if (sessionId) {
      conditions.push(eq(quoteActivities.sessionId, sessionId));
    }

    if (since) {
      conditions.push(gte(quoteActivities.createdAt, new Date(parseInt(since))));
    }

    // Fetch activities
    const activities = await db
      .select()
      .from(quoteActivities)
      .where(and(...conditions))
      .orderBy(desc(quoteActivities.createdAt))
      .limit(limit);

    // Fetch active sessions for this quote
    const activeSessions = await db
      .select()
      .from(quoteSessions)
      .where(and(
        eq(quoteSessions.quoteId, quoteId),
        eq(quoteSessions.isActive, true)
      ));

    return new Response(JSON.stringify({
      activities,
      activeSessions,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch activities:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch activities' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * POST: Record a new activity event
 * Body:
 * - sessionId: Session identifier
 * - eventType: Type of event
 * - eventData: Additional event data
 * - deviceType, browserName, osName, etc.
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const { id: quoteId } = params;
    if (!quoteId) {
      return new Response(JSON.stringify({ error: 'Quote ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    // Verify quote exists
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, quoteId),
    });

    if (!quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract client info from headers
    const ipAddress = request.headers.get('CF-Connecting-IP') ||
                      request.headers.get('X-Forwarded-For') ||
                      null;
    const userAgent = request.headers.get('User-Agent') || null;
    const country = request.headers.get('CF-IPCountry') || null;
    const city = request.headers.get('CF-IPCity') || null;

    const sessionId = body.sessionId || crypto.randomUUID();

    // Check if this is a new session
    let session = await db.query.quoteSessions.findFirst({
      where: eq(quoteSessions.sessionId, sessionId),
    });

    // Create or update session
    if (!session) {
      // Create new session
      await db.insert(quoteSessions).values({
        id: generateId(),
        quoteId,
        sessionId,
        ipAddress,
        userAgent,
        deviceType: body.deviceType || null,
        browserName: body.browserName || null,
        osName: body.osName || null,
        country,
        city,
        isActive: true,
        sectionsViewed: JSON.stringify([]),
      });
    } else {
      // Update existing session
      const updates: Record<string, unknown> = {
        lastActiveAt: new Date(),
        isActive: true,
      };

      // Update engagement metrics based on event type
      if (body.eventType === 'scroll' && body.eventData?.scrollDepth) {
        const currentMaxScroll = session.maxScrollDepth || 0;
        if (body.eventData.scrollDepth > currentMaxScroll) {
          updates.maxScrollDepth = body.eventData.scrollDepth;
        }
      }

      if (body.eventType === 'section_view' && body.eventData?.sectionId) {
        const viewed = JSON.parse((session.sectionsViewed as string) || '[]');
        if (!viewed.includes(body.eventData.sectionId)) {
          viewed.push(body.eventData.sectionId);
          updates.sectionsViewed = JSON.stringify(viewed);
        }
      }

      if (body.eventType === 'option_toggle') {
        updates.optionsToggled = (session.optionsToggled || 0) + 1;
      }

      if (body.eventType === 'page_close') {
        updates.isActive = false;
        updates.endedAt = new Date();
        // Calculate total time
        const startTime = session.startedAt?.getTime() || Date.now();
        updates.totalTimeSeconds = Math.floor((Date.now() - startTime) / 1000);
      }

      await db
        .update(quoteSessions)
        .set(updates)
        .where(eq(quoteSessions.sessionId, sessionId));
    }

    // Insert activity event
    const activityId = generateId();
    await db.insert(quoteActivities).values({
      id: activityId,
      quoteId,
      sessionId,
      eventType: body.eventType,
      eventData: body.eventData ? JSON.stringify(body.eventData) : null,
      deviceType: body.deviceType || null,
      browserName: body.browserName || null,
      osName: body.osName || null,
      ipAddress,
      userAgent,
      country,
      city,
      pageLoadTime: body.pageLoadTime || null,
    });

    return new Response(JSON.stringify({
      success: true,
      activityId,
      sessionId,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to record activity:', error);
    return new Response(JSON.stringify({ error: 'Failed to record activity' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

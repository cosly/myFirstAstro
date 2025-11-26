import type { APIRoute } from 'astro';
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
    const db = createDb(locals.runtime.env.DB);

    const request = await db.query.quoteRequests.findFirst({
      where: eq(quoteRequests.id, id),
      with: {
        customer: true,
        assignedMember: true,
      },
    });

    if (!request) {
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(request), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to get quote request:', error);
    return new Response(JSON.stringify({ error: 'Failed to get request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Request ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    // Validate status if provided
    const validStatuses = ['new', 'in_progress', 'quoted', 'closed'];
    if (body.status && !validStatuses.includes(body.status)) {
      return new Response(JSON.stringify({ error: 'Invalid status' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.status) updates.status = body.status;
    if (body.assignedTo !== undefined) updates.assignedTo = body.assignedTo;
    if (body.internalNotes !== undefined) updates.internalNotes = body.internalNotes;

    // Update the request
    await db
      .update(quoteRequests)
      .set(updates)
      .where(eq(quoteRequests.id, id));

    // Fetch updated request
    const updated = await db.query.quoteRequests.findFirst({
      where: eq(quoteRequests.id, id),
    });

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to update quote request:', error);
    return new Response(JSON.stringify({ error: 'Failed to update request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Request ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const db = createDb(locals.runtime.env.DB);

    await db
      .delete(quoteRequests)
      .where(eq(quoteRequests.id, id));

    // Also delete associated KV data
    await locals.runtime.env.KV.delete(`quote_request_ai:${id}`);
    await locals.runtime.env.KV.delete(`quote_request_meta:${id}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to delete quote request:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

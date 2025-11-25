import type { APIRoute } from 'astro';
import { createDb, services } from '@/lib/db';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Service ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const service = await db.query.services.findFirst({
      where: eq(services.id, id),
      with: { category: true },
    });

    if (!service) {
      return new Response(JSON.stringify({ error: 'Service not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(service), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch service:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch service' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const { id } = params;
    const body = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'Service ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check service exists
    const existing = await db.query.services.findFirst({
      where: eq(services.id, id),
    });

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Service not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update service
    await db
      .update(services)
      .set({
        categoryId: body.categoryId !== undefined ? body.categoryId : existing.categoryId,
        name: body.name || existing.name,
        description: body.description !== undefined ? body.description : existing.description,
        defaultPrice: body.defaultPrice !== undefined ? parseFloat(body.defaultPrice) : existing.defaultPrice,
        unit: body.unit || existing.unit,
        btwRate: body.btwRate !== undefined ? parseFloat(body.btwRate) : existing.btwRate,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
        sortOrder: body.sortOrder !== undefined ? body.sortOrder : existing.sortOrder,
      })
      .where(eq(services.id, id));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to update service:', error);
    return new Response(JSON.stringify({ error: 'Failed to update service' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Service ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Soft delete - set isActive to false
    await db
      .update(services)
      .set({ isActive: false })
      .where(eq(services.id, id));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to delete service:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete service' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

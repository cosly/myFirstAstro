import type { APIRoute } from 'astro';
import { createDb, serviceCategories } from '@/lib/db';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Category ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const category = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.id, id),
    });

    if (!category) {
      return new Response(JSON.stringify({ error: 'Category not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(category), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch category:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch category' }), {
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
      return new Response(JSON.stringify({ error: 'Category ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check category exists
    const existing = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.id, id),
    });

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Category not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update category
    await db
      .update(serviceCategories)
      .set({
        name: body.name || existing.name,
        icon: body.icon !== undefined ? body.icon : existing.icon,
        description: body.description !== undefined ? body.description : existing.description,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
        sortOrder: body.sortOrder !== undefined ? body.sortOrder : existing.sortOrder,
      })
      .where(eq(serviceCategories.id, id));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to update category:', error);
    return new Response(JSON.stringify({ error: 'Failed to update category' }), {
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
      return new Response(JSON.stringify({ error: 'Category ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Soft delete - set isActive to false
    await db
      .update(serviceCategories)
      .set({ isActive: false })
      .where(eq(serviceCategories.id, id));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to delete category:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete category' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

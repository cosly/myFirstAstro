import type { APIRoute } from 'astro';
import { createDb, serviceCategories } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { asc, eq } from 'drizzle-orm';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);

    const categories = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.isActive, true))
      .orderBy(asc(serviceCategories.sortOrder));

    return new Response(JSON.stringify(categories), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch categories' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    if (!body.name) {
      return new Response(JSON.stringify({ error: 'Category name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const categoryId = generateId();

    // Get max sort order
    const existing = await db
      .select()
      .from(serviceCategories)
      .orderBy(asc(serviceCategories.sortOrder));

    const maxSortOrder = existing.length > 0
      ? Math.max(...existing.map(c => c.sortOrder || 0)) + 1
      : 0;

    await db.insert(serviceCategories).values({
      id: categoryId,
      name: body.name,
      icon: body.icon || null,
      description: body.description || null,
      isActive: true,
      sortOrder: maxSortOrder,
    });

    return new Response(JSON.stringify({ id: categoryId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to create category:', error);
    return new Response(JSON.stringify({ error: 'Failed to create category' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

import type { APIRoute } from 'astro';
import { createDb, serviceCategories } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { asc } from 'drizzle-orm';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);

    const categories = await db.query.serviceCategories.findMany({
      with: {
        services: true,
      },
      orderBy: [asc(serviceCategories.sortOrder)],
    });

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
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const categoryId = generateId();
    await db.insert(serviceCategories).values({
      id: categoryId,
      name: body.name,
      description: body.description || null,
      icon: body.icon || null,
      sortOrder: body.sortOrder || 0,
      isActive: true,
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

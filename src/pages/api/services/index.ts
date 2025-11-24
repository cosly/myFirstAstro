import type { APIRoute } from 'astro';
import { createDb, services, serviceCategories } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { asc } from 'drizzle-orm';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);

    const allServices = await db.query.services.findMany({
      with: {
        category: true,
      },
      orderBy: [asc(services.sortOrder)],
    });

    return new Response(JSON.stringify(allServices), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch services:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch services' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    if (!body.name || !body.defaultPrice || !body.unit) {
      return new Response(JSON.stringify({ error: 'Required fields missing' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const serviceId = generateId();
    await db.insert(services).values({
      id: serviceId,
      categoryId: body.categoryId || null,
      name: body.name,
      description: body.description || null,
      defaultPrice: parseFloat(body.defaultPrice),
      unit: body.unit,
      btwRate: parseFloat(body.btwRate) || 21,
      isActive: true,
      sortOrder: 0,
    });

    return new Response(JSON.stringify({ id: serviceId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to create service:', error);
    return new Response(JSON.stringify({ error: 'Failed to create service' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

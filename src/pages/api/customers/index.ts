import type { APIRoute } from 'astro';
import { createDb, customers } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { desc } from 'drizzle-orm';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);

    const allCustomers = await db
      .select()
      .from(customers)
      .orderBy(desc(customers.createdAt));

    return new Response(JSON.stringify(allCustomers), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch customers' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    if (!body.companyName || !body.contactName || !body.email) {
      return new Response(JSON.stringify({ error: 'Required fields missing' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const customerId = generateId();
    await db.insert(customers).values({
      id: customerId,
      companyName: body.companyName,
      contactName: body.contactName,
      email: body.email.toLowerCase(),
      phone: body.phone || null,
      address: body.address || null,
      city: body.city || null,
      postalCode: body.postalCode || null,
      btwNumber: body.btwNumber || null,
      kvkNumber: body.kvkNumber || null,
      isTesororClient: body.isTesororClient || false,
      notes: body.notes || null,
      locale: body.locale || 'nl',
    });

    return new Response(JSON.stringify({ id: customerId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to create customer:', error);
    return new Response(JSON.stringify({ error: 'Failed to create customer' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

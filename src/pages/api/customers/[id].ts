import type { APIRoute } from 'astro';
import { createDb, customers } from '@/lib/db';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);

    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, id),
    });

    if (!customer) {
      return new Response(JSON.stringify({ error: 'Customer not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(customer), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch customer:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch customer' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    await db
      .update(customers)
      .set({
        companyName: body.companyName,
        contactName: body.contactName,
        email: body.email?.toLowerCase(),
        phone: body.phone,
        address: body.address,
        city: body.city,
        postalCode: body.postalCode,
        btwNumber: body.btwNumber,
        kvkNumber: body.kvkNumber,
        isTesororClient: body.isTesororClient,
        notes: body.notes,
        locale: body.locale,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to update customer:', error);
    return new Response(JSON.stringify({ error: 'Failed to update customer' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);

    await db.delete(customers).where(eq(customers.id, id));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to delete customer:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete customer' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

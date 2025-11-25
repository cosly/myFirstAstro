import type { APIRoute } from 'astro';
import { createDb, quoteRequests, customers } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';
import { notifyQuoteRequestReceived } from '@/lib/discord';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);

    const allRequests = await db.query.quoteRequests.findMany({
      with: {
        customer: true,
        assignedMember: true,
      },
      orderBy: (requests, { desc }) => [desc(requests.createdAt)],
    });

    return new Response(JSON.stringify(allRequests), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch quote requests:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch quote requests' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    // Validate required fields (form sends 'email', not 'contactEmail')
    const contactEmail = body.contactEmail || body.email;
    if (!body.serviceType || !body.description || !contactEmail || !body.contactName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if customer exists by email
    let customerId: string | null = null;
    if (body.isTesororClient) {
      const existingCustomer = await db.query.customers.findFirst({
        where: eq(customers.email, body.email),
      });

      if (existingCustomer) {
        customerId = existingCustomer.id;
      }
    }

    // Create quote request
    const requestId = generateId();
    await db.insert(quoteRequests).values({
      id: requestId,
      customerId,
      contactEmail,
      contactName: body.contactName,
      companyName: body.companyName,
      phone: body.phone,
      serviceType: body.serviceType,
      description: body.description,
      budgetIndication: body.budgetIndication,
      status: 'new',
    });

    // Send Discord notification
    const appUrl = new URL(request.url).origin;
    const createdRequest = await db.query.quoteRequests.findFirst({
      where: eq(quoteRequests.id, requestId),
    });
    if (createdRequest) {
      notifyQuoteRequestReceived(db, createdRequest, appUrl).catch(err => {
        console.error('Failed to send Discord notification:', err);
      });
    }

    // TODO: Send notification email to team
    // await sendNotificationEmail(...)

    return new Response(
      JSON.stringify({
        id: requestId,
        message: 'Quote request submitted successfully',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to create quote request:', error);
    return new Response(JSON.stringify({ error: 'Failed to create quote request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

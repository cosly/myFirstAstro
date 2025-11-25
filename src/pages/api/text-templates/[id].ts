import type { APIRoute } from 'astro';
import { createDb, textTemplates } from '@/lib/db';
import { eq } from 'drizzle-orm';

// GET: Fetch a specific text template
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Template ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);

    const template = await db.query.textTemplates.findFirst({
      where: eq(textTemplates.id, id),
    });

    if (!template) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(template), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch text template:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch text template' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// PUT: Update a text template
export const PUT: APIRoute = async ({ params, request, locals }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Template ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    // Check template exists
    const existing = await db.query.textTemplates.findFirst({
      where: eq(textTemplates.id, id),
    });

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // If setting as default, unset other defaults of same type
    if (body.isDefault && !existing.isDefault) {
      await db
        .update(textTemplates)
        .set({ isDefault: false })
        .where(eq(textTemplates.type, existing.type));
    }

    // Update template
    await db
      .update(textTemplates)
      .set({
        name: body.name ?? existing.name,
        description: body.description !== undefined ? body.description : existing.description,
        content: body.content ?? existing.content,
        isDefault: body.isDefault !== undefined ? body.isDefault : existing.isDefault,
        updatedAt: new Date(),
      })
      .where(eq(textTemplates.id, id));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to update text template:', error);
    return new Response(JSON.stringify({ error: 'Failed to update text template' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// DELETE: Delete a text template
export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Template ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);

    // Check template exists
    const existing = await db.query.textTemplates.findFirst({
      where: eq(textTemplates.id, id),
    });

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete template
    await db.delete(textTemplates).where(eq(textTemplates.id, id));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to delete text template:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete text template' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

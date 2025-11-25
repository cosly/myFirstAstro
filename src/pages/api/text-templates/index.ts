import type { APIRoute } from 'astro';
import { createDb, textTemplates } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';

// GET: Fetch all text templates
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const type = url.searchParams.get('type');

    let templates;
    if (type) {
      templates = await db
        .select()
        .from(textTemplates)
        .where(eq(textTemplates.type, type as 'intro' | 'footer' | 'terms' | 'custom'));
    } else {
      templates = await db.select().from(textTemplates);
    }

    return new Response(JSON.stringify(templates), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch text templates:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch text templates' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST: Create a new text template
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    // Validate required fields
    if (!body.type || !body.name || !body.content) {
      return new Response(JSON.stringify({ error: 'Type, name and content are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate type
    const validTypes = ['intro', 'footer', 'terms', 'custom'];
    if (!validTypes.includes(body.type)) {
      return new Response(JSON.stringify({ error: 'Invalid template type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const id = `tt_${generateId()}`;

    // If setting as default, unset other defaults of same type
    if (body.isDefault) {
      await db
        .update(textTemplates)
        .set({ isDefault: false })
        .where(eq(textTemplates.type, body.type));
    }

    await db.insert(textTemplates).values({
      id,
      type: body.type,
      name: body.name,
      description: body.description || null,
      content: body.content,
      isDefault: body.isDefault || false,
    });

    return new Response(JSON.stringify({ success: true, id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to create text template:', error);
    return new Response(JSON.stringify({ error: 'Failed to create text template' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

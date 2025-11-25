import type { APIRoute } from 'astro';
import { createDb, teamMembers } from '@/lib/db';
import { hashPassword } from '@/lib/utils';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Member ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const member = await db
      .select({
        id: teamMembers.id,
        email: teamMembers.email,
        name: teamMembers.name,
        role: teamMembers.role,
        avatarUrl: teamMembers.avatarUrl,
        locale: teamMembers.locale,
        isActive: teamMembers.isActive,
        createdAt: teamMembers.createdAt,
      })
      .from(teamMembers)
      .where(eq(teamMembers.id, id))
      .limit(1);

    if (member.length === 0) {
      return new Response(JSON.stringify({ error: 'Member not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(member[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch team member:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch team member' }), {
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
      return new Response(JSON.stringify({ error: 'Member ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check member exists
    const existing = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, id))
      .limit(1);

    if (existing.length === 0) {
      return new Response(JSON.stringify({ error: 'Member not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.name) updateData.name = body.name;
    if (body.email) updateData.email = body.email;
    if (body.role) updateData.role = body.role;
    if (body.locale) updateData.locale = body.locale;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.password) updateData.passwordHash = await hashPassword(body.password);

    await db
      .update(teamMembers)
      .set(updateData)
      .where(eq(teamMembers.id, id));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to update team member:', error);
    return new Response(JSON.stringify({ error: 'Failed to update team member' }), {
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
      return new Response(JSON.stringify({ error: 'Member ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Soft delete - set isActive to false
    await db
      .update(teamMembers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(teamMembers.id, id));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to delete team member:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete team member' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

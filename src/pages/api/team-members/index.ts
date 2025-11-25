import type { APIRoute } from 'astro';
import { createDb, teamMembers } from '@/lib/db';
import { generateId, hashPassword } from '@/lib/utils';
import { eq, desc } from 'drizzle-orm';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);

    const members = await db
      .select({
        id: teamMembers.id,
        email: teamMembers.email,
        name: teamMembers.name,
        role: teamMembers.role,
        avatarUrl: teamMembers.avatarUrl,
        isActive: teamMembers.isActive,
        createdAt: teamMembers.createdAt,
      })
      .from(teamMembers)
      .orderBy(desc(teamMembers.createdAt));

    return new Response(JSON.stringify(members), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch team members:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch team members' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);
    const body = await request.json();

    // Validate required fields
    if (!body.email || !body.name || !body.password) {
      return new Response(JSON.stringify({ error: 'Email, name, and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if email already exists
    const existing = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.email, body.email))
      .limit(1);

    if (existing.length > 0) {
      return new Response(JSON.stringify({ error: 'Email already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const memberId = generateId();
    const passwordHash = await hashPassword(body.password);

    await db.insert(teamMembers).values({
      id: memberId,
      email: body.email,
      name: body.name,
      passwordHash,
      role: body.role || 'member',
      isActive: true,
    });

    return new Response(JSON.stringify({ id: memberId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to create team member:', error);
    return new Response(JSON.stringify({ error: 'Failed to create team member' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

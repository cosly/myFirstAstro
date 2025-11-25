import type { APIRoute } from 'astro';
import { createDb, customers, teamMembers, quotes, services, serviceCategories } from '@/lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: {},
    database: {},
    user: null,
  };

  try {
    // Check environment
    results.environment = {
      hasDB: !!locals.runtime?.env?.DB,
      hasSessionSecret: !!locals.runtime?.env?.SESSION_SECRET,
      hasResendKey: !!locals.runtime?.env?.RESEND_API_KEY,
      appUrl: locals.runtime?.env?.APP_URL || 'not set',
    };

    // Check user from middleware
    results.user = locals.user ? {
      id: locals.user.id,
      email: locals.user.email,
      name: locals.user.name,
      role: locals.user.role,
    } : null;

    // Check database
    if (locals.runtime?.env?.DB) {
      const db = createDb(locals.runtime.env.DB);

      try {
        // Count records in each table
        const [customerCount] = await db.select({ count: customers.id }).from(customers);
        const [teamMemberCount] = await db.select({ count: teamMembers.id }).from(teamMembers);
        const [quoteCount] = await db.select({ count: quotes.id }).from(quotes);
        const [serviceCount] = await db.select({ count: services.id }).from(services);
        const [categoryCount] = await db.select({ count: serviceCategories.id }).from(serviceCategories);

        results.database = {
          connected: true,
          counts: {
            customers: customerCount?.count ? 1 : 0,
            teamMembers: teamMemberCount?.count ? 1 : 0,
            quotes: quoteCount?.count ? 1 : 0,
            services: serviceCount?.count ? 1 : 0,
            categories: categoryCount?.count ? 1 : 0,
          },
        };

        // Try to fetch actual data
        const allCustomers = await db.select().from(customers).limit(5);
        const allTeamMembers = await db.select({ id: teamMembers.id, email: teamMembers.email, name: teamMembers.name }).from(teamMembers).limit(5);

        (results.database as Record<string, unknown>).sampleData = {
          customers: allCustomers.length,
          teamMembers: allTeamMembers,
        };
      } catch (dbError) {
        results.database = {
          connected: false,
          error: String(dbError),
        };
      }
    } else {
      results.database = {
        connected: false,
        error: 'DB not available in runtime.env',
      };
    }

    return new Response(JSON.stringify(results, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

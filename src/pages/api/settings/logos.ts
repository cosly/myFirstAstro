import type { APIRoute } from 'astro';
import { createDb, appSettings } from '@/lib/db';
import { eq } from 'drizzle-orm';

// Logo types
const LOGO_TYPES = [
  'logo_primary',   // Main logo for dashboard/header
  'logo_email',     // Logo for email templates
  'logo_pdf',       // Logo for PDF generation
  'logo_favicon',   // Favicon
  'logo_dark',      // Dark mode variant
] as const;

type LogoType = typeof LOGO_TYPES[number];

// Allowed file types
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// GET: Retrieve all logos
export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = createDb(locals.runtime.env.DB);

    // Fetch all logo settings
    const settings = await db
      .select()
      .from(appSettings);

    const logos: Record<string, string> = {};
    settings.forEach(s => {
      if (LOGO_TYPES.includes(s.key as LogoType)) {
        try {
          logos[s.key] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
        } catch {
          logos[s.key] = s.value as string;
        }
      }
    });

    return new Response(JSON.stringify({ logos }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch logos:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch logos' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST: Upload a new logo
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const storage = locals.runtime.env.STORAGE;
    if (!storage) {
      return new Response(JSON.stringify({ error: 'Storage not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const logoType = formData.get('type') as string;

    // Validate logo type
    if (!logoType || !LOGO_TYPES.includes(logoType as LogoType)) {
      return new Response(JSON.stringify({
        error: 'Invalid logo type',
        validTypes: LOGO_TYPES
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate file
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return new Response(JSON.stringify({
        error: 'Invalid file type',
        allowedTypes: ALLOWED_TYPES
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({
        error: 'File too large',
        maxSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate filename
    const ext = file.name.split('.').pop() || 'png';
    const filename = `logos/${logoType}_${Date.now()}.${ext}`;

    // Delete old logo if exists
    const db = createDb(locals.runtime.env.DB);
    const existing = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, logoType))
      .limit(1);

    if (existing.length > 0) {
      try {
        const oldUrl = typeof existing[0].value === 'string'
          ? JSON.parse(existing[0].value)
          : existing[0].value;
        if (typeof oldUrl === 'string' && oldUrl.includes('/logos/')) {
          const oldKey = oldUrl.split('/').slice(-2).join('/');
          await storage.delete(oldKey);
        }
      } catch {
        // Old logo doesn't exist, ignore
      }
    }

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await storage.put(filename, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Generate public URL
    // For R2 with public access or using worker as proxy
    const baseUrl = locals.runtime.env.APP_URL || 'https://tesoro-quotes.pages.dev';
    const logoUrl = `${baseUrl}/api/storage/${filename}`;

    // Save URL to database
    if (existing.length > 0) {
      await db
        .update(appSettings)
        .set({ value: JSON.stringify(logoUrl), updatedAt: new Date() })
        .where(eq(appSettings.key, logoType));
    } else {
      await db.insert(appSettings).values({
        key: logoType,
        value: JSON.stringify(logoUrl),
      });
    }

    return new Response(JSON.stringify({
      success: true,
      logoType,
      url: logoUrl
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to upload logo:', error);
    return new Response(JSON.stringify({ error: 'Failed to upload logo' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// DELETE: Remove a logo
export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const storage = locals.runtime.env.STORAGE;
    const { type: logoType } = await request.json();

    if (!logoType || !LOGO_TYPES.includes(logoType as LogoType)) {
      return new Response(JSON.stringify({ error: 'Invalid logo type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = createDb(locals.runtime.env.DB);

    // Get current logo URL
    const existing = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, logoType))
      .limit(1);

    if (existing.length > 0 && storage) {
      try {
        const oldUrl = typeof existing[0].value === 'string'
          ? JSON.parse(existing[0].value)
          : existing[0].value;
        if (typeof oldUrl === 'string' && oldUrl.includes('/logos/')) {
          const oldKey = oldUrl.split('/').slice(-2).join('/');
          await storage.delete(oldKey);
        }
      } catch {
        // File doesn't exist, ignore
      }

      // Remove from database
      await db
        .delete(appSettings)
        .where(eq(appSettings.key, logoType));
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to delete logo:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete logo' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

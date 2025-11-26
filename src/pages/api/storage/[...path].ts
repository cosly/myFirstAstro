import type { APIRoute } from 'astro';

// Proxy R2 storage files
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const storage = locals.runtime.env.STORAGE;
    if (!storage) {
      return new Response('Storage not configured', { status: 500 });
    }

    const path = params.path;
    if (!path) {
      return new Response('Path required', { status: 400 });
    }

    // Get object from R2
    const object = await storage.get(path);

    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    // Get content type from metadata or guess from extension
    const contentType = object.httpMetadata?.contentType || getContentType(path);

    // Convert R2 body to ArrayBuffer for compatibility
    const body = await object.arrayBuffer();

    // Return the file with caching headers
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': object.httpEtag,
      },
    });
  } catch (error) {
    console.error('Storage fetch error:', error);
    return new Response('Internal error', { status: 500 });
  }
};

function getContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'pdf': 'application/pdf',
  };
  return types[ext || ''] || 'application/octet-stream';
}

import type { APIRoute } from 'astro';
import { createDb, quotes } from '@/lib/db';
import { generateQuotePdfHtml } from '@/lib/pdf';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { token } = params;
    if (!token) {
      return new Response('Token required', { status: 400 });
    }

    const db = createDb(locals.runtime.env.DB);

    // Fetch quote with all relations using public token
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.publicToken, token),
      with: {
        customer: true,
        blocks: {
          with: {
            lines: true,
          },
          orderBy: (blocks, { asc }) => [asc(blocks.position)],
        },
      },
    });

    if (!quote || !quote.customer) {
      return new Response('Quote not found', { status: 404 });
    }

    // Only allow PDF access for accepted quotes via public endpoint
    if (quote.status !== 'accepted') {
      return new Response('PDF not available for this quote', { status: 403 });
    }

    // Generate HTML
    const html = generateQuotePdfHtml(quote as any);

    // Return printable HTML (can be printed to PDF from browser)
    const printableHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Offerte ${quote.quoteNumber}</title>
        <style>
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;

    return new Response(printableHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    return new Response('Failed to generate PDF', { status: 500 });
  }
};

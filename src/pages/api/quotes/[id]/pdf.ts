import type { APIRoute } from 'astro';
import { createDb, quotes } from '@/lib/db';
import { generateQuotePdfHtml } from '@/lib/pdf';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async ({ params, locals, request }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response('Quote ID required', { status: 400 });
    }

    const db = createDb(locals.runtime.env.DB);

    // Fetch quote with all relations
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, id),
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

    // Check for format query param
    const url = new URL(request.url);
    const format = url.searchParams.get('format');

    // Generate HTML
    const html = generateQuotePdfHtml(quote as any);

    // If format=html, return HTML for preview/debugging
    if (format === 'html') {
      return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // For actual PDF, you would integrate with a PDF service here
    // Options:
    // 1. Use Cloudflare Browser Rendering (requires paid plan)
    // 2. Use external API like PDFShift, DocRaptor, etc.
    // 3. Use client-side generation with html2pdf.js

    // For now, return HTML with print styles (can be printed to PDF from browser)
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

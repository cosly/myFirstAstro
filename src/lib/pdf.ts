import { formatCurrency, formatDate, calculateLineTotal } from './utils';
import type { Quote, QuoteBlock, QuoteLine, Customer } from './db';

interface QuoteWithBlocks extends Quote {
  blocks: (QuoteBlock & { lines: QuoteLine[] })[];
  customer: Customer;
}

interface CompanySettings {
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  logo_pdf?: string;
}

// Generate HTML for PDF
export function generateQuotePdfHtml(quote: QuoteWithBlocks, companySettings?: CompanySettings): string {
  // Company info with fallbacks
  const companyName = companySettings?.company_name || 'Tesoro CRM';
  const companyEmail = companySettings?.company_email || 'info@quote.tesorohq.io';
  const companyPhone = companySettings?.company_phone || '020-1234567';
  const logoUrl = companySettings?.logo_pdf;

  // Generate logo HTML
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 50px; max-width: 180px;" />`
    : `<span class="logo-text">${companyName}</span>`;

  const styles = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.5; color: #333; }
      .page { max-width: 800px; margin: 0 auto; padding: 40px; }
      .header { display: flex; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #f97316; }
      .logo { display: flex; align-items: center; }
      .logo-text { font-size: 28px; font-weight: bold; color: #f97316; }
      .quote-info { text-align: right; }
      .quote-number { font-size: 18px; font-weight: bold; }
      .quote-date { color: #666; }
      .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
      .party { width: 45%; }
      .party-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
      .party-name { font-weight: bold; font-size: 14px; }
      .intro { margin-bottom: 30px; padding: 20px; background: #f9fafb; border-radius: 8px; }
      .block { margin-bottom: 30px; }
      .block-title { font-size: 14px; font-weight: bold; padding: 10px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 10px; }
      .block-optional { color: #f97316; font-size: 10px; font-weight: normal; }
      table { width: 100%; border-collapse: collapse; }
      th { text-align: left; padding: 8px; font-size: 10px; color: #666; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; }
      td { padding: 8px; border-bottom: 1px solid #f3f4f6; }
      .text-right { text-align: right; }
      .line-optional { color: #f97316; font-size: 10px; }
      .line-excluded { text-decoration: line-through; color: #999; }
      .totals { margin-top: 30px; margin-left: auto; width: 300px; }
      .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
      .totals-row.total { font-size: 16px; font-weight: bold; border-top: 2px solid #333; margin-top: 8px; padding-top: 16px; }
      .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #666; }
      .signature { margin-top: 40px; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; }
      .signature-title { font-weight: bold; margin-bottom: 10px; }
      .signature-image { max-height: 80px; margin: 10px 0; }
      .signature-info { font-size: 11px; color: #666; }
      .valid-until { margin-top: 20px; padding: 10px; background: #fef3c7; border-radius: 4px; text-align: center; }
    </style>
  `;

  // Calculate totals
  let subtotal = 0;
  let btwAmount = 0;

  quote.blocks.forEach((block) => {
    if (!block.isOptional || block.isSelectedByCustomer) {
      block.lines.forEach((line) => {
        if (!line.isOptional || line.isSelectedByCustomer) {
          const lineTotal = calculateLineTotal(
            line.quantity,
            line.unitPrice,
            line.discountType,
            line.discountValue
          );
          subtotal += lineTotal;
          btwAmount += lineTotal * (line.btwRate / 100);
        }
      });
    }
  });

  const total = subtotal + btwAmount;

  // Generate blocks HTML
  const blocksHtml = quote.blocks
    .map((block) => {
      const isBlockIncluded = !block.isOptional || block.isSelectedByCustomer;

      if (block.blockType === 'text') {
        return `
          <div class="block ${!isBlockIncluded ? 'line-excluded' : ''}">
            <div class="block-title">
              ${block.title || 'Toelichting'}
              ${block.isOptional ? '<span class="block-optional">(optioneel)</span>' : ''}
            </div>
            <p>${block.description || ''}</p>
          </div>
        `;
      }

      if (block.blockType === 'pricing_table') {
        const linesHtml = block.lines
          .map((line) => {
            const lineTotal = calculateLineTotal(
              line.quantity,
              line.unitPrice,
              line.discountType,
              line.discountValue
            );
            const isIncluded = isBlockIncluded && (!line.isOptional || line.isSelectedByCustomer);

            return `
              <tr class="${!isIncluded ? 'line-excluded' : ''}">
                <td>
                  ${line.description}
                  ${line.isOptional ? '<div class="line-optional">optioneel</div>' : ''}
                </td>
                <td class="text-right">${line.quantity} ${line.unit}</td>
                <td class="text-right">${formatCurrency(line.unitPrice)}</td>
                <td class="text-right">${formatCurrency(lineTotal)}</td>
              </tr>
            `;
          })
          .join('');

        return `
          <div class="block">
            <div class="block-title">
              ${block.title || 'Prijsopgave'}
              ${block.isOptional ? '<span class="block-optional">(optioneel blok)</span>' : ''}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Omschrijving</th>
                  <th class="text-right">Aantal</th>
                  <th class="text-right">Prijs</th>
                  <th class="text-right">Totaal</th>
                </tr>
              </thead>
              <tbody>
                ${linesHtml}
              </tbody>
            </table>
          </div>
        `;
      }

      return '';
    })
    .join('');

  // Signature section
  const signatureHtml = quote.signedAt
    ? `
      <div class="signature">
        <div class="signature-title">Ondertekend</div>
        ${quote.signatureUrl ? `<img src="${quote.signatureUrl}" class="signature-image" alt="Handtekening" />` : ''}
        <div class="signature-info">
          <strong>${quote.signedByName || 'Onbekend'}</strong>
          ${quote.signedByFunction ? `<br>${quote.signedByFunction}` : ''}
          <br>Ondertekend op ${formatDate(quote.signedAt)}
        </div>
      </div>
    `
    : '';

  return `
    <!DOCTYPE html>
    <html lang="nl">
    <head>
      <meta charset="UTF-8">
      <title>Offerte ${quote.quoteNumber}</title>
      ${styles}
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="logo">${logoHtml}</div>
          <div class="quote-info">
            <div class="quote-number">Offerte ${quote.quoteNumber}</div>
            <div class="quote-date">${formatDate(quote.createdAt)}</div>
          </div>
        </div>

        <div class="parties">
          <div class="party">
            <div class="party-label">Van</div>
            <div class="party-name">${companyName}</div>
            <div>${companyEmail}</div>
            <div>${companyPhone}</div>
          </div>
          <div class="party">
            <div class="party-label">Aan</div>
            <div class="party-name">${quote.customer.companyName}</div>
            <div>${quote.customer.contactName}</div>
            <div>${quote.customer.email}</div>
            ${quote.customer.phone ? `<div>${quote.customer.phone}</div>` : ''}
          </div>
        </div>

        <h1 style="font-size: 20px; margin-bottom: 20px;">${quote.title}</h1>

        ${quote.introText ? `<div class="intro">${quote.introText}</div>` : ''}

        ${blocksHtml}

        <div class="totals">
          <div class="totals-row">
            <span>Subtotaal</span>
            <span>${formatCurrency(subtotal)}</span>
          </div>
          <div class="totals-row">
            <span>BTW</span>
            <span>${formatCurrency(btwAmount)}</span>
          </div>
          <div class="totals-row total">
            <span>Totaal</span>
            <span>${formatCurrency(total)}</span>
          </div>
        </div>

        ${quote.validUntil ? `
          <div class="valid-until">
            Offerte geldig tot ${formatDate(quote.validUntil)}
          </div>
        ` : ''}

        ${quote.footerText ? `<div class="footer">${quote.footerText}</div>` : ''}

        ${signatureHtml}
      </div>
    </body>
    </html>
  `;
}

// API endpoint will use a service like Cloudflare Browser Rendering or external PDF service
export async function generatePdf(_html: string): Promise<Uint8Array> {
  // In production, use one of these options:
  // 1. Cloudflare Browser Rendering (puppeteer in Workers)
  // 2. External service like PDFShift, DocRaptor, or html2pdf.app
  // 3. Client-side PDF generation with html2pdf.js or jspdf

  // For now, return the HTML as a placeholder
  // The actual implementation would call an external service
  throw new Error('PDF generation requires external service configuration');
}

// Generate PDF download URL
export function getQuotePdfUrl(quoteId: string): string {
  return `/api/quotes/${quoteId}/pdf`;
}

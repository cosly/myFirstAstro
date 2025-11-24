import { createDb, emailTemplates, type Quote, type Customer } from './db';
import { formatCurrency, formatDate } from './utils';
import { eq } from 'drizzle-orm';

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Template variables
export interface TemplateVariables {
  // Quote
  quote_number?: string;
  quote_title?: string;
  quote_total?: string;
  quote_valid_until?: string;
  quote_url?: string;

  // Customer
  customer_name?: string;
  customer_company?: string;
  customer_email?: string;

  // Company (Tesoro)
  company_name?: string;
  company_email?: string;
  company_phone?: string;

  // Signature
  signed_by?: string;
  signed_at?: string;

  // Custom
  [key: string]: string | undefined;
}

// Replace template variables
function replaceVariables(template: string, variables: TemplateVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] || `{{${key}}}`;
  });
}

// Default email templates
export const defaultTemplates = {
  quote_sent: {
    subject: 'Uw offerte van Tesoro CRM - {{quote_number}}',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #f97316; }
    .logo { font-size: 24px; font-weight: bold; color: #f97316; }
    .content { padding: 30px 0; }
    .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; }
    .quote-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Tesoro CRM</div>
    </div>
    <div class="content">
      <p>Beste {{customer_name}},</p>
      <p>Hierbij ontvangt u onze offerte voor de besproken werkzaamheden.</p>

      <div class="quote-box">
        <p><strong>Offerte:</strong> {{quote_number}}</p>
        <p><strong>Titel:</strong> {{quote_title}}</p>
        <p><strong>Totaal:</strong> {{quote_total}}</p>
        <p><strong>Geldig tot:</strong> {{quote_valid_until}}</p>
      </div>

      <p>U kunt de offerte online bekijken, opties aanpassen en direct accepteren via onderstaande link:</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{quote_url}}" class="button">Bekijk Offerte</a>
      </p>

      <p>Heeft u vragen? U kunt direct via de offerte een vraag stellen of contact met ons opnemen.</p>

      <p>Met vriendelijke groet,<br>Team Tesoro CRM</p>
    </div>
    <div class="footer">
      <p>Tesoro CRM<br>
      {{company_email}} | {{company_phone}}</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
Beste {{customer_name}},

Hierbij ontvangt u onze offerte voor de besproken werkzaamheden.

Offerte: {{quote_number}}
Titel: {{quote_title}}
Totaal: {{quote_total}}
Geldig tot: {{quote_valid_until}}

Bekijk de offerte online: {{quote_url}}

Met vriendelijke groet,
Team Tesoro CRM
    `,
  },

  quote_accepted: {
    subject: 'Offerte {{quote_number}} geaccepteerd!',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #22c55e; }
    .logo { font-size: 24px; font-weight: bold; color: #f97316; }
    .success { color: #22c55e; font-size: 48px; }
    .content { padding: 30px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; }
    .quote-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="success">✓</div>
      <h1>Offerte Geaccepteerd</h1>
    </div>
    <div class="content">
      <p>Geweldig nieuws!</p>
      <p>De offerte <strong>{{quote_number}}</strong> is zojuist geaccepteerd door {{customer_company}}.</p>

      <div class="quote-box">
        <p><strong>Ondertekend door:</strong> {{signed_by}}</p>
        <p><strong>Datum:</strong> {{signed_at}}</p>
        <p><strong>Totaal:</strong> {{quote_total}}</p>
      </div>

      <p>De klant ontvangt een bevestigingsmail. De ondertekende offerte is beschikbaar in het dashboard.</p>
    </div>
    <div class="footer">
      <p>Dit is een automatisch bericht van Tesoro CRM.</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
Geweldig nieuws!

De offerte {{quote_number}} is zojuist geaccepteerd door {{customer_company}}.

Ondertekend door: {{signed_by}}
Datum: {{signed_at}}
Totaal: {{quote_total}}

De klant ontvangt een bevestigingsmail.
    `,
  },

  quote_reminder: {
    subject: 'Herinnering: Uw offerte {{quote_number}} verloopt binnenkort',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #f97316; }
    .logo { font-size: 24px; font-weight: bold; color: #f97316; }
    .content { padding: 30px 0; }
    .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; }
    .warning { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin: 20px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Tesoro CRM</div>
    </div>
    <div class="content">
      <p>Beste {{customer_name}},</p>

      <div class="warning">
        <p>⏰ <strong>Uw offerte verloopt op {{quote_valid_until}}</strong></p>
      </div>

      <p>We wilden u er even aan herinneren dat de offerte <strong>{{quote_title}}</strong> binnenkort verloopt.</p>

      <p>Heeft u nog vragen of wilt u de offerte bespreken? Neem gerust contact met ons op.</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{quote_url}}" class="button">Bekijk Offerte</a>
      </p>

      <p>Met vriendelijke groet,<br>Team Tesoro CRM</p>
    </div>
    <div class="footer">
      <p>Tesoro CRM<br>{{company_email}}</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
Beste {{customer_name}},

Uw offerte verloopt op {{quote_valid_until}}.

We wilden u er even aan herinneren dat de offerte "{{quote_title}}" binnenkort verloopt.

Bekijk de offerte: {{quote_url}}

Met vriendelijke groet,
Team Tesoro CRM
    `,
  },
};

// Send email via Resend (or Cloudflare Email Workers)
export async function sendEmail(
  emailData: EmailData,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Tesoro CRM <noreply@tesorocrm.nl>',
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Send quote email
export async function sendQuoteEmail(
  type: 'quote_sent' | 'quote_accepted' | 'quote_reminder' | 'quote_declined',
  quote: Quote,
  customer: Customer,
  apiKey: string,
  appUrl: string
): Promise<{ success: boolean; error?: string }> {
  const template = defaultTemplates[type as keyof typeof defaultTemplates];
  if (!template) {
    return { success: false, error: 'Template not found' };
  }

  const variables: TemplateVariables = {
    quote_number: quote.quoteNumber,
    quote_title: quote.title,
    quote_total: formatCurrency(quote.total),
    quote_valid_until: quote.validUntil ? formatDate(quote.validUntil) : 'Niet opgegeven',
    quote_url: `${appUrl}/offerte/${quote.publicToken}`,
    customer_name: customer.contactName,
    customer_company: customer.companyName,
    customer_email: customer.email,
    company_name: 'Tesoro CRM',
    company_email: 'info@tesorocrm.nl',
    company_phone: '020-1234567',
    signed_by: quote.signedByName || '',
    signed_at: quote.signedAt ? formatDate(quote.signedAt) : '',
  };

  const subject = replaceVariables(template.subject, variables);
  const html = replaceVariables(template.bodyHtml, variables);
  const text = replaceVariables(template.bodyText, variables);

  return sendEmail({ to: customer.email, subject, html, text }, apiKey);
}

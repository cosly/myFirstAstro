import { emailTemplates, appSettings, type Quote, type Customer } from './db';
import { eq, and } from 'drizzle-orm';
import type { Database } from './db';
import { formatCurrencyLocale, formatDateLocale, type Locale } from '@/i18n';

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

// Get company settings from database
async function getCompanySettings(db: Database): Promise<Record<string, string>> {
  const settings: Record<string, string> = {};

  try {
    const rows = await db.select().from(appSettings);
    rows.forEach(row => {
      try {
        const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        settings[row.key] = String(value);
      } catch {
        settings[row.key] = String(row.value);
      }
    });
  } catch (error) {
    console.error('Failed to fetch company settings:', error);
  }

  return settings;
}

// Get email template from database or use default
async function getEmailTemplate(
  db: Database,
  type: string,
  locale: Locale = 'nl'
): Promise<{ subject: string; bodyHtml: string; bodyText: string } | null> {
  try {
    // First try to find template for specific locale
    const template = await db.query.emailTemplates.findFirst({
      where: and(
        eq(emailTemplates.type, type as typeof emailTemplates.type.enumValues[number]),
        eq(emailTemplates.locale, locale)
      ),
    });

    if (template) {
      return {
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        bodyText: template.bodyText,
      };
    }

    // If no template for this locale, fall back to Dutch template in database
    if (locale !== 'nl') {
      const dutchTemplate = await db.query.emailTemplates.findFirst({
        where: and(
          eq(emailTemplates.type, type as typeof emailTemplates.type.enumValues[number]),
          eq(emailTemplates.locale, 'nl')
        ),
      });

      if (dutchTemplate) {
        return {
          subject: dutchTemplate.subject,
          bodyHtml: dutchTemplate.bodyHtml,
          bodyText: dutchTemplate.bodyText,
        };
      }
    }
  } catch (error) {
    console.error('Failed to fetch email template:', error);
  }

  // Fall back to localized default template
  const localizedDefault = getLocalizedDefaultTemplate(type, locale);
  return localizedDefault || null;
}

// Localized default email templates
export const localizedTemplates: Record<Locale, typeof defaultTemplatesNl> = {
  nl: {} as typeof defaultTemplatesNl,
  en: {} as typeof defaultTemplatesNl,
  es: {} as typeof defaultTemplatesNl,
};

// Default email templates (Dutch - will be used as base)
const defaultTemplatesNl = {
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

  quote_declined: {
    subject: 'Offerte {{quote_number}} afgewezen',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #ef4444; }
    .logo { font-size: 24px; font-weight: bold; color: #f97316; }
    .declined { color: #ef4444; font-size: 48px; }
    .content { padding: 30px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; }
    .quote-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="declined">✕</div>
      <h1>Offerte Afgewezen</h1>
    </div>
    <div class="content">
      <p>De offerte <strong>{{quote_number}}</strong> is afgewezen door {{customer_company}}.</p>

      <div class="quote-box">
        <p><strong>Offerte:</strong> {{quote_number}}</p>
        <p><strong>Klant:</strong> {{customer_company}}</p>
        <p><strong>Totaal:</strong> {{quote_total}}</p>
      </div>

      <p>De klant heeft de offerte afgewezen. Neem eventueel contact op om de redenen te bespreken.</p>
    </div>
    <div class="footer">
      <p>Dit is een automatisch bericht van Tesoro CRM.</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
De offerte {{quote_number}} is afgewezen door {{customer_company}}.

Offerte: {{quote_number}}
Klant: {{customer_company}}
Totaal: {{quote_total}}

Dit is een automatisch bericht van Tesoro CRM.
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

  payment_received: {
    subject: 'Betaling ontvangen voor offerte {{quote_number}}',
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
      <h1>Betaling Ontvangen</h1>
    </div>
    <div class="content">
      <p>Beste {{customer_name}},</p>
      <p>Wij hebben uw betaling voor offerte <strong>{{quote_number}}</strong> in goede orde ontvangen.</p>

      <div class="quote-box">
        <p><strong>Offerte:</strong> {{quote_number}}</p>
        <p><strong>Bedrag:</strong> {{quote_total}}</p>
      </div>

      <p>Hartelijk dank voor uw betaling. We gaan aan de slag!</p>

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

Wij hebben uw betaling voor offerte {{quote_number}} in goede orde ontvangen.

Offerte: {{quote_number}}
Bedrag: {{quote_total}}

Hartelijk dank voor uw betaling. We gaan aan de slag!

Met vriendelijke groet,
Team Tesoro CRM
    `,
  },

  question_received: {
    subject: 'Nieuwe vraag over offerte {{quote_number}}',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #3b82f6; }
    .logo { font-size: 24px; font-weight: bold; color: #f97316; }
    .question { color: #3b82f6; font-size: 48px; }
    .content { padding: 30px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; }
    .quote-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="question">?</div>
      <h1>Nieuwe Vraag Ontvangen</h1>
    </div>
    <div class="content">
      <p>Er is een nieuwe vraag gesteld over offerte <strong>{{quote_number}}</strong>.</p>

      <div class="quote-box">
        <p><strong>Klant:</strong> {{customer_company}}</p>
        <p><strong>Contact:</strong> {{customer_name}}</p>
        <p><strong>Offerte:</strong> {{quote_number}}</p>
      </div>

      <p>Bekijk de vraag en reageer via het dashboard.</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{quote_url}}" class="button">Bekijk Offerte</a>
      </p>
    </div>
    <div class="footer">
      <p>Dit is een automatisch bericht van Tesoro CRM.</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
Nieuwe vraag over offerte {{quote_number}}

Klant: {{customer_company}}
Contact: {{customer_name}}
Offerte: {{quote_number}}

Bekijk de vraag en reageer via het dashboard.
    `,
  },

  question_answered: {
    subject: 'Uw vraag over offerte {{quote_number}} is beantwoord',
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
    .content { padding: 30px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; }
    .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Tesoro CRM</div>
    </div>
    <div class="content">
      <p>Beste {{customer_name}},</p>
      <p>Uw vraag over offerte <strong>{{quote_number}}</strong> is beantwoord.</p>

      <p>Bekijk het antwoord via onderstaande link:</p>

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

Uw vraag over offerte {{quote_number}} is beantwoord.

Bekijk het antwoord: {{quote_url}}

Met vriendelijke groet,
Team Tesoro CRM
    `,
  },
};

// English default templates
const defaultTemplatesEn = {
  quote_sent: {
    subject: 'Your quote from Tesoro CRM - {{quote_number}}',
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
      <p>Dear {{customer_name}},</p>
      <p>Please find attached our quote for the discussed services.</p>

      <div class="quote-box">
        <p><strong>Quote:</strong> {{quote_number}}</p>
        <p><strong>Title:</strong> {{quote_title}}</p>
        <p><strong>Total:</strong> {{quote_total}}</p>
        <p><strong>Valid until:</strong> {{quote_valid_until}}</p>
      </div>

      <p>You can view the quote online, adjust options, and accept directly via the link below:</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{quote_url}}" class="button">View Quote</a>
      </p>

      <p>Have questions? You can ask directly via the quote or contact us.</p>

      <p>Kind regards,<br>Team Tesoro CRM</p>
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
Dear {{customer_name}},

Please find attached our quote for the discussed services.

Quote: {{quote_number}}
Title: {{quote_title}}
Total: {{quote_total}}
Valid until: {{quote_valid_until}}

View the quote online: {{quote_url}}

Kind regards,
Team Tesoro CRM
    `,
  },

  quote_accepted: {
    subject: 'Quote {{quote_number}} accepted!',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #22c55e; }
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
      <h1>Quote Accepted</h1>
    </div>
    <div class="content">
      <p>Great news!</p>
      <p>Quote <strong>{{quote_number}}</strong> has been accepted by {{customer_company}}.</p>

      <div class="quote-box">
        <p><strong>Signed by:</strong> {{signed_by}}</p>
        <p><strong>Date:</strong> {{signed_at}}</p>
        <p><strong>Total:</strong> {{quote_total}}</p>
      </div>

      <p>The customer will receive a confirmation email. The signed quote is available in the dashboard.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from Tesoro CRM.</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
Great news!

Quote {{quote_number}} has been accepted by {{customer_company}}.

Signed by: {{signed_by}}
Date: {{signed_at}}
Total: {{quote_total}}

The customer will receive a confirmation email.
    `,
  },

  quote_declined: {
    subject: 'Quote {{quote_number}} declined',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #ef4444; }
    .declined { color: #ef4444; font-size: 48px; }
    .content { padding: 30px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; }
    .quote-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="declined">✕</div>
      <h1>Quote Declined</h1>
    </div>
    <div class="content">
      <p>Quote <strong>{{quote_number}}</strong> has been declined by {{customer_company}}.</p>

      <div class="quote-box">
        <p><strong>Quote:</strong> {{quote_number}}</p>
        <p><strong>Customer:</strong> {{customer_company}}</p>
        <p><strong>Total:</strong> {{quote_total}}</p>
      </div>

      <p>The customer has declined the quote. Consider following up to discuss their concerns.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from Tesoro CRM.</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
Quote {{quote_number}} has been declined by {{customer_company}}.

Quote: {{quote_number}}
Customer: {{customer_company}}
Total: {{quote_total}}

This is an automated message from Tesoro CRM.
    `,
  },

  quote_reminder: {
    subject: 'Reminder: Your quote {{quote_number}} expires soon',
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
      <p>Dear {{customer_name}},</p>

      <div class="warning">
        <p>⏰ <strong>Your quote expires on {{quote_valid_until}}</strong></p>
      </div>

      <p>We wanted to remind you that the quote <strong>{{quote_title}}</strong> expires soon.</p>

      <p>Have questions or want to discuss the quote? Please contact us.</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{quote_url}}" class="button">View Quote</a>
      </p>

      <p>Kind regards,<br>Team Tesoro CRM</p>
    </div>
    <div class="footer">
      <p>Tesoro CRM<br>{{company_email}}</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
Dear {{customer_name}},

Your quote expires on {{quote_valid_until}}.

We wanted to remind you that the quote "{{quote_title}}" expires soon.

View the quote: {{quote_url}}

Kind regards,
Team Tesoro CRM
    `,
  },

  payment_received: {
    subject: 'Payment received for quote {{quote_number}}',
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
      <h1>Payment Received</h1>
    </div>
    <div class="content">
      <p>Dear {{customer_name}},</p>
      <p>We have received your payment for quote <strong>{{quote_number}}</strong>.</p>

      <div class="quote-box">
        <p><strong>Quote:</strong> {{quote_number}}</p>
        <p><strong>Amount:</strong> {{quote_total}}</p>
      </div>

      <p>Thank you for your payment. We will get started right away!</p>

      <p>Kind regards,<br>Team Tesoro CRM</p>
    </div>
    <div class="footer">
      <p>Tesoro CRM<br>{{company_email}}</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
Dear {{customer_name}},

We have received your payment for quote {{quote_number}}.

Quote: {{quote_number}}
Amount: {{quote_total}}

Thank you for your payment. We will get started right away!

Kind regards,
Team Tesoro CRM
    `,
  },

  question_received: {
    subject: 'New question about quote {{quote_number}}',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #3b82f6; }
    .logo { font-size: 24px; font-weight: bold; color: #f97316; }
    .question { color: #3b82f6; font-size: 48px; }
    .content { padding: 30px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; }
    .quote-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="question">?</div>
      <h1>New Question Received</h1>
    </div>
    <div class="content">
      <p>A new question has been asked about quote <strong>{{quote_number}}</strong>.</p>

      <div class="quote-box">
        <p><strong>Customer:</strong> {{customer_company}}</p>
        <p><strong>Contact:</strong> {{customer_name}}</p>
        <p><strong>Quote:</strong> {{quote_number}}</p>
      </div>

      <p>View the question and respond via the dashboard.</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{quote_url}}" class="button">View Quote</a>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated message from Tesoro CRM.</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
New question about quote {{quote_number}}

Customer: {{customer_company}}
Contact: {{customer_name}}
Quote: {{quote_number}}

View the question and respond via the dashboard.
    `,
  },

  question_answered: {
    subject: 'Your question about quote {{quote_number}} has been answered',
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
    .content { padding: 30px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; }
    .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Tesoro CRM</div>
    </div>
    <div class="content">
      <p>Dear {{customer_name}},</p>
      <p>Your question about quote <strong>{{quote_number}}</strong> has been answered.</p>

      <p>View the answer via the link below:</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{quote_url}}" class="button">View Quote</a>
      </p>

      <p>Kind regards,<br>Team Tesoro CRM</p>
    </div>
    <div class="footer">
      <p>Tesoro CRM<br>{{company_email}}</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
Dear {{customer_name}},

Your question about quote {{quote_number}} has been answered.

View the answer: {{quote_url}}

Kind regards,
Team Tesoro CRM
    `,
  },
};

// Spanish default templates
const defaultTemplatesEs = {
  quote_sent: {
    subject: 'Su presupuesto de Tesoro CRM - {{quote_number}}',
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
      <p>Estimado/a {{customer_name}},</p>
      <p>Adjunto encontrará nuestro presupuesto para los servicios acordados.</p>

      <div class="quote-box">
        <p><strong>Presupuesto:</strong> {{quote_number}}</p>
        <p><strong>Título:</strong> {{quote_title}}</p>
        <p><strong>Total:</strong> {{quote_total}}</p>
        <p><strong>Válido hasta:</strong> {{quote_valid_until}}</p>
      </div>

      <p>Puede ver el presupuesto en línea, ajustar opciones y aceptar directamente a través del siguiente enlace:</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{quote_url}}" class="button">Ver Presupuesto</a>
      </p>

      <p>¿Tiene preguntas? Puede consultarnos directamente a través del presupuesto o contactarnos.</p>

      <p>Atentamente,<br>Equipo Tesoro CRM</p>
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
Estimado/a {{customer_name}},

Adjunto encontrará nuestro presupuesto para los servicios acordados.

Presupuesto: {{quote_number}}
Título: {{quote_title}}
Total: {{quote_total}}
Válido hasta: {{quote_valid_until}}

Ver el presupuesto en línea: {{quote_url}}

Atentamente,
Equipo Tesoro CRM
    `,
  },

  quote_accepted: {
    subject: '¡Presupuesto {{quote_number}} aceptado!',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #22c55e; }
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
      <h1>Presupuesto Aceptado</h1>
    </div>
    <div class="content">
      <p>¡Excelentes noticias!</p>
      <p>El presupuesto <strong>{{quote_number}}</strong> ha sido aceptado por {{customer_company}}.</p>

      <div class="quote-box">
        <p><strong>Firmado por:</strong> {{signed_by}}</p>
        <p><strong>Fecha:</strong> {{signed_at}}</p>
        <p><strong>Total:</strong> {{quote_total}}</p>
      </div>

      <p>El cliente recibirá un correo de confirmación. El presupuesto firmado está disponible en el panel.</p>
    </div>
    <div class="footer">
      <p>Este es un mensaje automático de Tesoro CRM.</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
¡Excelentes noticias!

El presupuesto {{quote_number}} ha sido aceptado por {{customer_company}}.

Firmado por: {{signed_by}}
Fecha: {{signed_at}}
Total: {{quote_total}}

El cliente recibirá un correo de confirmación.
    `,
  },

  quote_declined: {
    subject: 'Presupuesto {{quote_number}} rechazado',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #ef4444; }
    .declined { color: #ef4444; font-size: 48px; }
    .content { padding: 30px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; }
    .quote-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="declined">✕</div>
      <h1>Presupuesto Rechazado</h1>
    </div>
    <div class="content">
      <p>El presupuesto <strong>{{quote_number}}</strong> ha sido rechazado por {{customer_company}}.</p>

      <div class="quote-box">
        <p><strong>Presupuesto:</strong> {{quote_number}}</p>
        <p><strong>Cliente:</strong> {{customer_company}}</p>
        <p><strong>Total:</strong> {{quote_total}}</p>
      </div>

      <p>El cliente ha rechazado el presupuesto. Considere hacer un seguimiento para discutir sus inquietudes.</p>
    </div>
    <div class="footer">
      <p>Este es un mensaje automático de Tesoro CRM.</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
El presupuesto {{quote_number}} ha sido rechazado por {{customer_company}}.

Presupuesto: {{quote_number}}
Cliente: {{customer_company}}
Total: {{quote_total}}

Este es un mensaje automático de Tesoro CRM.
    `,
  },

  quote_reminder: {
    subject: 'Recordatorio: Su presupuesto {{quote_number}} expira pronto',
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
      <p>Estimado/a {{customer_name}},</p>

      <div class="warning">
        <p>⏰ <strong>Su presupuesto expira el {{quote_valid_until}}</strong></p>
      </div>

      <p>Queríamos recordarle que el presupuesto <strong>{{quote_title}}</strong> expira pronto.</p>

      <p>¿Tiene preguntas o desea discutir el presupuesto? Por favor contáctenos.</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{quote_url}}" class="button">Ver Presupuesto</a>
      </p>

      <p>Atentamente,<br>Equipo Tesoro CRM</p>
    </div>
    <div class="footer">
      <p>Tesoro CRM<br>{{company_email}}</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
Estimado/a {{customer_name}},

Su presupuesto expira el {{quote_valid_until}}.

Queríamos recordarle que el presupuesto "{{quote_title}}" expira pronto.

Ver el presupuesto: {{quote_url}}

Atentamente,
Equipo Tesoro CRM
    `,
  },

  payment_received: {
    subject: 'Pago recibido para presupuesto {{quote_number}}',
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
      <h1>Pago Recibido</h1>
    </div>
    <div class="content">
      <p>Estimado/a {{customer_name}},</p>
      <p>Hemos recibido su pago para el presupuesto <strong>{{quote_number}}</strong>.</p>

      <div class="quote-box">
        <p><strong>Presupuesto:</strong> {{quote_number}}</p>
        <p><strong>Importe:</strong> {{quote_total}}</p>
      </div>

      <p>¡Gracias por su pago! Comenzaremos de inmediato.</p>

      <p>Atentamente,<br>Equipo Tesoro CRM</p>
    </div>
    <div class="footer">
      <p>Tesoro CRM<br>{{company_email}}</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
Estimado/a {{customer_name}},

Hemos recibido su pago para el presupuesto {{quote_number}}.

Presupuesto: {{quote_number}}
Importe: {{quote_total}}

¡Gracias por su pago! Comenzaremos de inmediato.

Atentamente,
Equipo Tesoro CRM
    `,
  },

  question_received: {
    subject: 'Nueva pregunta sobre presupuesto {{quote_number}}',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #3b82f6; }
    .logo { font-size: 24px; font-weight: bold; color: #f97316; }
    .question { color: #3b82f6; font-size: 48px; }
    .content { padding: 30px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; }
    .quote-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="question">?</div>
      <h1>Nueva Pregunta Recibida</h1>
    </div>
    <div class="content">
      <p>Se ha recibido una nueva pregunta sobre el presupuesto <strong>{{quote_number}}</strong>.</p>

      <div class="quote-box">
        <p><strong>Cliente:</strong> {{customer_company}}</p>
        <p><strong>Contacto:</strong> {{customer_name}}</p>
        <p><strong>Presupuesto:</strong> {{quote_number}}</p>
      </div>

      <p>Vea la pregunta y responda a través del panel.</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{quote_url}}" class="button">Ver Presupuesto</a>
      </p>
    </div>
    <div class="footer">
      <p>Este es un mensaje automático de Tesoro CRM.</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
Nueva pregunta sobre presupuesto {{quote_number}}

Cliente: {{customer_company}}
Contacto: {{customer_name}}
Presupuesto: {{quote_number}}

Vea la pregunta y responda a través del panel.
    `,
  },

  question_answered: {
    subject: 'Su pregunta sobre el presupuesto {{quote_number}} ha sido respondida',
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
    .content { padding: 30px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; }
    .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Tesoro CRM</div>
    </div>
    <div class="content">
      <p>Estimado/a {{customer_name}},</p>
      <p>Su pregunta sobre el presupuesto <strong>{{quote_number}}</strong> ha sido respondida.</p>

      <p>Vea la respuesta a través del siguiente enlace:</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{quote_url}}" class="button">Ver Presupuesto</a>
      </p>

      <p>Atentamente,<br>Equipo Tesoro CRM</p>
    </div>
    <div class="footer">
      <p>Tesoro CRM<br>{{company_email}}</p>
    </div>
  </div>
</body>
</html>
    `,
    bodyText: `
Estimado/a {{customer_name}},

Su pregunta sobre el presupuesto {{quote_number}} ha sido respondida.

Ver la respuesta: {{quote_url}}

Atentamente,
Equipo Tesoro CRM
    `,
  },
};

// Assign localized templates
localizedTemplates.nl = defaultTemplatesNl;
localizedTemplates.en = defaultTemplatesEn;
localizedTemplates.es = defaultTemplatesEs;

// Keep defaultTemplates as alias for backwards compatibility
export const defaultTemplates = defaultTemplatesNl;

// Get localized default template
function getLocalizedDefaultTemplate(type: string, locale: Locale = 'nl') {
  const templates = localizedTemplates[locale] || localizedTemplates.nl;
  return templates[type as keyof typeof templates] || null;
}

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
        from: 'Tesoro CRM <noreply@quote.tesorohq.io>',
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

// Localized "not specified" texts
const notSpecifiedTexts: Record<Locale, string> = {
  nl: 'Niet opgegeven',
  en: 'Not specified',
  es: 'No especificado',
};

// Send quote email with database templates and company settings
export async function sendQuoteEmail(
  type: 'quote_sent' | 'quote_accepted' | 'quote_reminder' | 'quote_declined',
  quote: Quote,
  customer: Customer,
  apiKey: string,
  appUrl: string,
  db?: Database,
  locale?: Locale
): Promise<{ success: boolean; error?: string }> {
  // Determine locale from customer preference or default to 'nl'
  const customerLocale: Locale = (locale || customer.locale || 'nl') as Locale;

  // Get template from database (with locale) or use localized default
  let template;
  if (db) {
    template = await getEmailTemplate(db, type, customerLocale);
  }

  // If still no template, use localized default
  if (!template) {
    template = getLocalizedDefaultTemplate(type, customerLocale);
  }

  if (!template) {
    return { success: false, error: 'Template not found' };
  }

  // Get company settings from database
  let companySettings: Record<string, string> = {};
  if (db) {
    companySettings = await getCompanySettings(db);
  }

  // Use locale-aware formatting
  const variables: TemplateVariables = {
    quote_number: quote.quoteNumber,
    quote_title: quote.title,
    quote_total: formatCurrencyLocale(quote.total, customerLocale),
    quote_valid_until: quote.validUntil
      ? formatDateLocale(quote.validUntil, customerLocale, 'long')
      : notSpecifiedTexts[customerLocale],
    quote_url: `${appUrl}/offerte/${quote.publicToken}`,
    customer_name: customer.contactName,
    customer_company: customer.companyName,
    customer_email: customer.email,
    company_name: companySettings.company_name || 'Tesoro CRM',
    company_email: companySettings.company_email || 'info@quote.tesorohq.io',
    company_phone: companySettings.company_phone || '',
    signed_by: quote.signedByName || '',
    signed_at: quote.signedAt ? formatDateLocale(quote.signedAt, customerLocale, 'long') : '',
  };

  const subject = replaceVariables(template.subject, variables);
  const html = replaceVariables(template.bodyHtml, variables);
  const text = replaceVariables(template.bodyText, variables);

  return sendEmail({ to: customer.email, subject, html, text }, apiKey);
}

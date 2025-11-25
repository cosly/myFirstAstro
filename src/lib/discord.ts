import { appSettings, type Quote, type Customer, type QuoteRequest } from './db';
import { eq } from 'drizzle-orm';
import type { Database } from './db';
import { formatCurrencyLocale, formatDateLocale } from '@/i18n';

// Discord webhook embed colors
const COLORS = {
  success: 0x22c55e,  // Green
  error: 0xef4444,    // Red
  warning: 0xf59e0b,  // Amber
  info: 0x3b82f6,     // Blue
  primary: 0xf97316,  // Orange (Tesoro brand)
};

// Discord notification event types
export type DiscordEventType =
  | 'quote_request_received'
  | 'quote_viewed'
  | 'quote_accepted'
  | 'quote_declined'
  | 'question_received'
  | 'payment_received';

// Discord settings interface
export interface DiscordSettings {
  webhookUrl: string;
  enabled: boolean;
  events: Record<DiscordEventType, boolean>;
}

// Default Discord settings
export const defaultDiscordSettings: DiscordSettings = {
  webhookUrl: '',
  enabled: false,
  events: {
    quote_request_received: true,
    quote_viewed: true,
    quote_accepted: true,
    quote_declined: true,
    question_received: true,
    payment_received: true,
  },
};

// Discord embed field interface
interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

// Discord embed interface
interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: EmbedField[];
  footer?: { text: string };
  timestamp?: string;
  url?: string;
}

// Discord webhook payload interface
interface DiscordWebhookPayload {
  content?: string;
  embeds: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

// Get Discord settings from database
export async function getDiscordSettings(db: Database): Promise<DiscordSettings> {
  try {
    const setting = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, 'discord_settings'),
    });

    if (setting && setting.value) {
      const parsed = typeof setting.value === 'string'
        ? JSON.parse(setting.value)
        : setting.value;
      return { ...defaultDiscordSettings, ...parsed };
    }
  } catch (error) {
    console.error('Failed to fetch Discord settings:', error);
  }

  return defaultDiscordSettings;
}

// Save Discord settings to database
export async function saveDiscordSettings(
  db: Database,
  settings: DiscordSettings
): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      key: 'discord_settings',
      value: JSON.stringify(settings),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: JSON.stringify(settings),
        updatedAt: new Date(),
      },
    });
}

// Send Discord webhook message
async function sendDiscordWebhook(
  webhookUrl: string,
  payload: DiscordWebhookPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        username: 'Tesoro CRM',
        avatar_url: 'https://quote.tesorohq.io/favicon.svg',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Discord webhook failed:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Discord webhook error:', error);
    return { success: false, error: String(error) };
  }
}

// Check if event is enabled and send notification
async function sendDiscordNotification(
  db: Database,
  eventType: DiscordEventType,
  embed: DiscordEmbed
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const settings = await getDiscordSettings(db);

  // Check if Discord notifications are enabled
  if (!settings.enabled || !settings.webhookUrl) {
    return { success: true, skipped: true };
  }

  // Check if this specific event is enabled
  if (!settings.events[eventType]) {
    return { success: true, skipped: true };
  }

  return sendDiscordWebhook(settings.webhookUrl, {
    embeds: [{ ...embed, timestamp: new Date().toISOString() }],
  });
}

// ============================================
// NOTIFICATION FUNCTIONS
// ============================================

// New quote request received
export async function notifyQuoteRequestReceived(
  db: Database,
  request: QuoteRequest,
  appUrl: string
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const serviceTypeLabels: Record<string, string> = {
    website: 'Website',
    crm_setup: 'CRM Setup',
    marketing: 'Marketing',
    support: 'Support',
    other: 'Overig',
  };

  const embed: DiscordEmbed = {
    title: 'Nieuwe Offerte Aanvraag',
    description: request.description.substring(0, 200) + (request.description.length > 200 ? '...' : ''),
    color: COLORS.info,
    fields: [
      { name: 'Contactpersoon', value: request.contactName, inline: true },
      { name: 'E-mail', value: request.contactEmail, inline: true },
      { name: 'Bedrijf', value: request.companyName || 'Niet opgegeven', inline: true },
      { name: 'Type', value: serviceTypeLabels[request.serviceType] || request.serviceType, inline: true },
      { name: 'Budget', value: request.budgetIndication || 'Niet opgegeven', inline: true },
    ],
    footer: { text: 'Tesoro CRM Quotes' },
    url: `${appUrl}/aanvragen`,
  };

  return sendDiscordNotification(db, 'quote_request_received', embed);
}

// Quote viewed by customer
export async function notifyQuoteViewed(
  db: Database,
  quote: Quote,
  customer: Customer,
  appUrl: string
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const embed: DiscordEmbed = {
    title: 'Offerte Bekeken',
    description: `${customer.companyName} heeft de offerte geopend.`,
    color: COLORS.primary,
    fields: [
      { name: 'Offerte', value: quote.quoteNumber, inline: true },
      { name: 'Klant', value: customer.companyName, inline: true },
      { name: 'Bedrag', value: formatCurrencyLocale(quote.total, 'nl'), inline: true },
    ],
    footer: { text: 'Tesoro CRM Quotes' },
    url: `${appUrl}/offertes/${quote.id}`,
  };

  return sendDiscordNotification(db, 'quote_viewed', embed);
}

// Quote accepted
export async function notifyQuoteAccepted(
  db: Database,
  quote: Quote,
  customer: Customer,
  appUrl: string
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const embed: DiscordEmbed = {
    title: 'Offerte Geaccepteerd!',
    description: `${customer.companyName} heeft de offerte geaccepteerd en ondertekend.`,
    color: COLORS.success,
    fields: [
      { name: 'Offerte', value: quote.quoteNumber, inline: true },
      { name: 'Klant', value: customer.companyName, inline: true },
      { name: 'Bedrag', value: formatCurrencyLocale(quote.total, 'nl'), inline: true },
      { name: 'Getekend door', value: quote.signedByName || 'Onbekend', inline: true },
      { name: 'Functie', value: quote.signedByFunction || 'Niet opgegeven', inline: true },
      { name: 'Datum', value: quote.signedAt ? formatDateLocale(quote.signedAt, 'nl', 'long') : 'Nu', inline: true },
    ],
    footer: { text: 'Tesoro CRM Quotes' },
    url: `${appUrl}/offertes/${quote.id}`,
  };

  return sendDiscordNotification(db, 'quote_accepted', embed);
}

// Quote declined
export async function notifyQuoteDeclined(
  db: Database,
  quote: Quote,
  customer: Customer,
  appUrl: string
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const embed: DiscordEmbed = {
    title: 'Offerte Afgewezen',
    description: `${customer.companyName} heeft de offerte afgewezen.`,
    color: COLORS.error,
    fields: [
      { name: 'Offerte', value: quote.quoteNumber, inline: true },
      { name: 'Klant', value: customer.companyName, inline: true },
      { name: 'Bedrag', value: formatCurrencyLocale(quote.total, 'nl'), inline: true },
    ],
    footer: { text: 'Tesoro CRM Quotes' },
    url: `${appUrl}/offertes/${quote.id}`,
  };

  return sendDiscordNotification(db, 'quote_declined', embed);
}

// Question received from customer
export async function notifyQuestionReceived(
  db: Database,
  quote: Quote,
  customer: Customer,
  question: string,
  authorName: string,
  appUrl: string
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const embed: DiscordEmbed = {
    title: 'Nieuwe Vraag Ontvangen',
    description: question.substring(0, 500) + (question.length > 500 ? '...' : ''),
    color: COLORS.warning,
    fields: [
      { name: 'Offerte', value: quote.quoteNumber, inline: true },
      { name: 'Klant', value: customer.companyName, inline: true },
      { name: 'Gesteld door', value: authorName, inline: true },
    ],
    footer: { text: 'Tesoro CRM Quotes' },
    url: `${appUrl}/offertes/${quote.id}`,
  };

  return sendDiscordNotification(db, 'question_received', embed);
}

// Payment received
export async function notifyPaymentReceived(
  db: Database,
  quote: Quote,
  customer: Customer,
  appUrl: string
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const embed: DiscordEmbed = {
    title: 'Betaling Ontvangen!',
    description: `${customer.companyName} heeft de betaling voor offerte ${quote.quoteNumber} voltooid.`,
    color: COLORS.success,
    fields: [
      { name: 'Offerte', value: quote.quoteNumber, inline: true },
      { name: 'Klant', value: customer.companyName, inline: true },
      { name: 'Bedrag', value: formatCurrencyLocale(quote.total, 'nl'), inline: true },
    ],
    footer: { text: 'Tesoro CRM Quotes' },
    url: `${appUrl}/offertes/${quote.id}`,
  };

  return sendDiscordNotification(db, 'payment_received', embed);
}

// Test webhook connection
export async function testDiscordWebhook(
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  const embed: DiscordEmbed = {
    title: 'Test Notificatie',
    description: 'Discord integratie is succesvol geconfigureerd!',
    color: COLORS.success,
    fields: [
      { name: 'Status', value: 'Verbonden', inline: true },
    ],
    footer: { text: 'Tesoro CRM Quotes' },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook(webhookUrl, { embeds: [embed] });
}

import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================
// TEAM MEMBERS (Tesoro CRM medewerkers)
// ============================================
export const teamMembers = sqliteTable('team_members', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  avatarUrl: text('avatar_url'),
  locale: text('locale', { enum: ['nl', 'en', 'es'] }).default('nl'), // User's preferred dashboard language
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// CUSTOMERS (Klanten)
// ============================================
export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  companyName: text('company_name').notNull(),
  contactName: text('contact_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  postalCode: text('postal_code'),
  country: text('country').default('Nederland'),
  btwNumber: text('btw_number'),
  kvkNumber: text('kvk_number'),
  isTesororClient: integer('is_tesoro_client', { mode: 'boolean' }).default(false),
  notes: text('notes'),
  locale: text('locale', { enum: ['nl', 'en', 'es'] }).default('nl'), // Preferred language for emails
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// SERVICE CATALOG (Diensten catalogus)
// ============================================
export const serviceCategories = sqliteTable('service_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'), // Icon name from lucide
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const services = sqliteTable('services', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').references(() => serviceCategories.id),
  name: text('name').notNull(),
  description: text('description'),
  defaultPrice: real('default_price').notNull(),
  unit: text('unit', { enum: ['uur', 'stuk', 'maand', 'jaar', 'project'] }).notNull().default('uur'),
  btwRate: real('btw_rate').notNull().default(21),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// QUOTE REQUESTS (Aanvragen van klanten)
// ============================================
export const quoteRequests = sqliteTable('quote_requests', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').references(() => customers.id),

  // Contact info (als klant nog niet bestaat)
  contactEmail: text('contact_email').notNull(),
  contactName: text('contact_name').notNull(),
  companyName: text('company_name'),
  phone: text('phone'),

  // Request details
  serviceType: text('service_type').notNull(), // website, crm_setup, marketing, support, other
  description: text('description').notNull(),
  budgetIndication: text('budget_indication'), // <500, 500-1000, 1000-2500, 2500+, unknown
  locale: text('locale', { enum: ['nl', 'en', 'es'] }).default('nl'), // Preferred language for communication

  // Status
  status: text('status', {
    enum: ['new', 'in_progress', 'quoted', 'closed']
  }).notNull().default('new'),

  // Handling
  assignedTo: text('assigned_to').references(() => teamMembers.id),
  internalNotes: text('internal_notes'),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// QUOTES (Offertes)
// ============================================
export const quotes = sqliteTable('quotes', {
  id: text('id').primaryKey(),
  quoteNumber: text('quote_number').notNull().unique(), // e.g., "2024-042"

  // Relations
  customerId: text('customer_id').references(() => customers.id).notNull(),
  requestId: text('request_id').references(() => quoteRequests.id),
  createdBy: text('created_by').references(() => teamMembers.id).notNull(),

  // Content
  title: text('title').notNull(),
  introText: text('intro_text'),
  footerText: text('footer_text'),

  // Pricing
  subtotal: real('subtotal').notNull().default(0),
  discountType: text('discount_type', { enum: ['percentage', 'fixed'] }),
  discountValue: real('discount_value'),
  btwAmount: real('btw_amount').notNull().default(0),
  total: real('total').notNull().default(0),

  // Status
  status: text('status', {
    enum: ['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'paid']
  }).notNull().default('draft'),

  // Validity
  validUntil: integer('valid_until', { mode: 'timestamp' }),

  // Public access
  publicToken: text('public_token').unique(), // Voor klant link

  // Signature
  signedAt: integer('signed_at', { mode: 'timestamp' }),
  signatureUrl: text('signature_url'), // R2 URL
  signedByName: text('signed_by_name'),
  signedByFunction: text('signed_by_function'),

  // Payment
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  paidAt: integer('paid_at', { mode: 'timestamp' }),

  // PDF
  pdfUrl: text('pdf_url'), // R2 URL

  // Metadata
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  sentAt: integer('sent_at', { mode: 'timestamp' }),
  viewedAt: integer('viewed_at', { mode: 'timestamp' }),
});

// ============================================
// QUOTE BLOCKS (Secties in offerte)
// ============================================
export const quoteBlocks = sqliteTable('quote_blocks', {
  id: text('id').primaryKey(),
  quoteId: text('quote_id').references(() => quotes.id, { onDelete: 'cascade' }).notNull(),

  // Block type
  blockType: text('block_type', {
    enum: ['text', 'pricing_table', 'pricing_plans', 'image', 'signature']
  }).notNull(),

  // Content
  title: text('title'),
  description: text('description'),

  // For image blocks
  imageUrl: text('image_url'),

  // Options
  isOptional: integer('is_optional', { mode: 'boolean' }).notNull().default(false),
  isSelectedByCustomer: integer('is_selected_by_customer', { mode: 'boolean' }).notNull().default(true),

  // Ordering
  position: integer('position').notNull().default(0),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// QUOTE LINES (Regels in prijstabel)
// ============================================
export const quoteLines = sqliteTable('quote_lines', {
  id: text('id').primaryKey(),
  blockId: text('block_id').references(() => quoteBlocks.id, { onDelete: 'cascade' }).notNull(),

  // Reference to service (optional)
  serviceId: text('service_id').references(() => services.id),

  // Line content
  description: text('description').notNull(),
  quantity: real('quantity').notNull().default(1),
  unit: text('unit').notNull().default('stuk'),
  unitPrice: real('unit_price').notNull(),
  btwRate: real('btw_rate').notNull().default(21),

  // Discount per line
  discountType: text('discount_type', { enum: ['percentage', 'fixed'] }),
  discountValue: real('discount_value'),

  // Calculated
  lineTotal: real('line_total').notNull().default(0),

  // Options
  isOptional: integer('is_optional', { mode: 'boolean' }).notNull().default(false),
  isSelectedByCustomer: integer('is_selected_by_customer', { mode: 'boolean' }).notNull().default(true),

  // Ordering
  position: integer('position').notNull().default(0),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// QUOTE VERSIONS (Versiegeschiedenis)
// ============================================
export const quoteVersions = sqliteTable('quote_versions', {
  id: text('id').primaryKey(),
  quoteId: text('quote_id').references(() => quotes.id, { onDelete: 'cascade' }).notNull(),
  versionNumber: integer('version_number').notNull(),

  // Complete snapshot of the quote at this version
  snapshot: text('snapshot', { mode: 'json' }).notNull(), // JSON blob

  // Change info
  changeSummary: text('change_summary'),
  changedBy: text('changed_by'), // team_member_id or "customer:email"
  changeType: text('change_type', {
    enum: ['created', 'edited', 'options_changed', 'accepted', 'declined']
  }).notNull(),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// QUOTE COMMENTS (Vragen/opmerkingen)
// ============================================
export const quoteComments = sqliteTable('quote_comments', {
  id: text('id').primaryKey(),
  quoteId: text('quote_id').references(() => quotes.id, { onDelete: 'cascade' }).notNull(),

  // Optional: link to specific line for per-line questions
  lineId: text('line_id').references(() => quoteLines.id, { onDelete: 'cascade' }),

  // Who commented
  authorType: text('author_type', { enum: ['team', 'customer'] }).notNull(),
  authorId: text('author_id'), // team_member_id or null for customer
  authorEmail: text('author_email'), // For customer
  authorName: text('author_name'),

  // Comment
  message: text('message').notNull(),

  // Read status
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// AUDIT LOG (Alle wijzigingen bijhouden)
// ============================================
export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),

  // What was changed
  entityType: text('entity_type').notNull(), // quote, customer, service, etc.
  entityId: text('entity_id').notNull(),

  // Action
  action: text('action').notNull(), // created, updated, deleted, sent, accepted, etc.

  // Changes (JSON diff)
  changes: text('changes', { mode: 'json' }),

  // Who made the change
  userId: text('user_id'),
  userEmail: text('user_email'),
  userType: text('user_type', { enum: ['team', 'customer', 'system'] }).notNull(),

  // Context
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// EMAIL TEMPLATES
// ============================================
export const emailTemplates = sqliteTable('email_templates', {
  id: text('id').primaryKey(),

  // Template type
  type: text('type', {
    enum: [
      'quote_sent',
      'quote_reminder',
      'quote_accepted',
      'quote_declined',
      'payment_received',
      'question_received',
      'question_answered'
    ]
  }).notNull(),

  // Locale for multi-language support
  locale: text('locale', {
    enum: ['nl', 'en', 'es']
  }).notNull().default('nl'),

  // Content
  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull(),
  bodyText: text('body_text').notNull(),

  // Variables available in this template
  availableVariables: text('available_variables', { mode: 'json' }),

  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  typeLocaleIdx: uniqueIndex('email_templates_type_locale_idx').on(table.type, table.locale),
}));

// ============================================
// APP SETTINGS
// ============================================
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// TEXT TEMPLATES (Intro/Footer/Voorwaarden)
// ============================================
export const textTemplates = sqliteTable('text_templates', {
  id: text('id').primaryKey(),

  // Template type
  type: text('type', {
    enum: ['intro', 'footer', 'terms', 'custom']
  }).notNull(),

  // Template info
  name: text('name').notNull(),
  description: text('description'),

  // Content
  content: text('content').notNull(),

  // Is this the default template for its type?
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// RELATIONS
// ============================================
export const customersRelations = relations(customers, ({ many }) => ({
  quotes: many(quotes),
  quoteRequests: many(quoteRequests),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  customer: one(customers, {
    fields: [quotes.customerId],
    references: [customers.id],
  }),
  request: one(quoteRequests, {
    fields: [quotes.requestId],
    references: [quoteRequests.id],
  }),
  createdByMember: one(teamMembers, {
    fields: [quotes.createdBy],
    references: [teamMembers.id],
  }),
  blocks: many(quoteBlocks),
  versions: many(quoteVersions),
  comments: many(quoteComments),
}));

export const quoteBlocksRelations = relations(quoteBlocks, ({ one, many }) => ({
  quote: one(quotes, {
    fields: [quoteBlocks.quoteId],
    references: [quotes.id],
  }),
  lines: many(quoteLines),
}));

export const quoteLinesRelations = relations(quoteLines, ({ one }) => ({
  block: one(quoteBlocks, {
    fields: [quoteLines.blockId],
    references: [quoteBlocks.id],
  }),
  service: one(services, {
    fields: [quoteLines.serviceId],
    references: [services.id],
  }),
}));

export const servicesRelations = relations(services, ({ one }) => ({
  category: one(serviceCategories, {
    fields: [services.categoryId],
    references: [serviceCategories.id],
  }),
}));

export const serviceCategoriesRelations = relations(serviceCategories, ({ many }) => ({
  services: many(services),
}));

export const quoteRequestsRelations = relations(quoteRequests, ({ one }) => ({
  customer: one(customers, {
    fields: [quoteRequests.customerId],
    references: [customers.id],
  }),
  assignedMember: one(teamMembers, {
    fields: [quoteRequests.assignedTo],
    references: [teamMembers.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ many }) => ({
  quotes: many(quotes),
  assignedRequests: many(quoteRequests),
}));

// ============================================
// QUOTE ACTIVITIES (Real-time klant tracking)
// ============================================
export const quoteActivities = sqliteTable('quote_activities', {
  id: text('id').primaryKey(),
  quoteId: text('quote_id').references(() => quotes.id, { onDelete: 'cascade' }).notNull(),

  // Session tracking
  sessionId: text('session_id').notNull(), // Unique per visit session

  // Event details
  eventType: text('event_type', {
    enum: [
      'page_open',      // Klant opent de pagina
      'page_close',     // Klant sluit de pagina
      'section_view',   // Klant bekijkt specifieke sectie
      'scroll',         // Scroll positie update
      'option_toggle',  // Klant selecteert/deselecteert optie
      'idle_start',     // Klant is inactief geworden
      'idle_end',       // Klant is weer actief
      'tab_blur',       // Klant wisselt van tab
      'tab_focus',      // Klant komt terug naar tab
      'signature_start', // Klant begint met tekenen
      'copy_text',      // Klant kopieert tekst
    ]
  }).notNull(),

  // Event-specific data
  eventData: text('event_data', { mode: 'json' }), // { sectionId, scrollDepth, optionId, copiedText, etc. }

  // Device info
  deviceType: text('device_type', { enum: ['desktop', 'tablet', 'mobile'] }),
  browserName: text('browser_name'),
  osName: text('os_name'),

  // Network info
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  country: text('country'),
  city: text('city'),

  // Timing
  pageLoadTime: integer('page_load_time'), // ms since page opened
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const quoteActivitiesRelations = relations(quoteActivities, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteActivities.quoteId],
    references: [quotes.id],
  }),
}));

// ============================================
// QUOTE SESSIONS (Bezoek sessies)
// ============================================
export const quoteSessions = sqliteTable('quote_sessions', {
  id: text('id').primaryKey(),
  quoteId: text('quote_id').references(() => quotes.id, { onDelete: 'cascade' }).notNull(),

  // Session info
  sessionId: text('session_id').notNull().unique(),

  // Visitor info
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  deviceType: text('device_type', { enum: ['desktop', 'tablet', 'mobile'] }),
  browserName: text('browser_name'),
  osName: text('os_name'),
  country: text('country'),
  city: text('city'),

  // Session stats
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  lastActiveAt: integer('last_active_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  endedAt: integer('ended_at', { mode: 'timestamp' }),

  // Engagement metrics
  totalTimeSeconds: integer('total_time_seconds').default(0),
  maxScrollDepth: integer('max_scroll_depth').default(0), // percentage 0-100
  sectionsViewed: text('sections_viewed', { mode: 'json' }), // array of section ids
  optionsToggled: integer('options_toggled').default(0),

  // Status
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});

export const quoteSessionsRelations = relations(quoteSessions, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteSessions.quoteId],
    references: [quotes.id],
  }),
}));

// ============================================
// TYPE EXPORTS
// ============================================
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type Service = typeof services.$inferSelect;

export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type NewQuoteRequest = typeof quoteRequests.$inferInsert;

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;

export type QuoteBlock = typeof quoteBlocks.$inferSelect;
export type NewQuoteBlock = typeof quoteBlocks.$inferInsert;

export type QuoteLine = typeof quoteLines.$inferSelect;
export type NewQuoteLine = typeof quoteLines.$inferInsert;

export type QuoteVersion = typeof quoteVersions.$inferSelect;
export type QuoteComment = typeof quoteComments.$inferSelect;

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type TextTemplate = typeof textTemplates.$inferSelect;
export type NewTextTemplate = typeof textTemplates.$inferInsert;

export type QuoteActivity = typeof quoteActivities.$inferSelect;
export type NewQuoteActivity = typeof quoteActivities.$inferInsert;
export type QuoteSession = typeof quoteSessions.$inferSelect;
export type NewQuoteSession = typeof quoteSessions.$inferInsert;

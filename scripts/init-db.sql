-- Tesoro CRM Quotes - Initial Schema
-- Run with: wrangler d1 execute tesoro-quotes-db --remote --file=./scripts/init-db.sql

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  avatar_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Nederland',
  btw_number TEXT,
  kvk_number TEXT,
  is_tesoro_client INTEGER DEFAULT 0,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Service Categories
CREATE TABLE IF NOT EXISTS service_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- Services
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES service_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  default_price REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'uur',
  btw_rate REAL NOT NULL DEFAULT 21,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Quote Requests
CREATE TABLE IF NOT EXISTS quote_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),
  contact_email TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  service_type TEXT NOT NULL,
  description TEXT NOT NULL,
  budget_indication TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to TEXT REFERENCES team_members(id),
  internal_notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  request_id TEXT REFERENCES quote_requests(id),
  created_by TEXT NOT NULL REFERENCES team_members(id),
  title TEXT NOT NULL,
  intro_text TEXT,
  footer_text TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  discount_type TEXT,
  discount_value REAL,
  btw_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  valid_until INTEGER,
  public_token TEXT UNIQUE,
  signed_at INTEGER,
  signature_url TEXT,
  signed_by_name TEXT,
  signed_by_function TEXT,
  stripe_payment_intent_id TEXT,
  paid_at INTEGER,
  pdf_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  sent_at INTEGER,
  viewed_at INTEGER
);

-- Quote Blocks
CREATE TABLE IF NOT EXISTS quote_blocks (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  image_url TEXT,
  is_optional INTEGER NOT NULL DEFAULT 0,
  is_selected_by_customer INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Quote Lines
CREATE TABLE IF NOT EXISTS quote_lines (
  id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL REFERENCES quote_blocks(id) ON DELETE CASCADE,
  service_id TEXT REFERENCES services(id),
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'stuk',
  unit_price REAL NOT NULL,
  btw_rate REAL NOT NULL DEFAULT 21,
  discount_type TEXT,
  discount_value REAL,
  line_total REAL NOT NULL DEFAULT 0,
  is_optional INTEGER NOT NULL DEFAULT 0,
  is_selected_by_customer INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Quote Versions
CREATE TABLE IF NOT EXISTS quote_versions (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  change_summary TEXT,
  changed_by TEXT,
  change_type TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Quote Comments
CREATE TABLE IF NOT EXISTS quote_comments (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL,
  author_id TEXT,
  author_email TEXT,
  author_name TEXT,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  changes TEXT,
  user_id TEXT,
  user_email TEXT,
  user_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);

-- Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  available_variables TEXT,
  updated_at INTEGER NOT NULL
);

-- App Settings
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_public_token ON quotes(public_token);
CREATE INDEX IF NOT EXISTS idx_quote_blocks_quote ON quote_blocks(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_lines_block ON quote_lines(block_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);

-- Insert admin user (John)
INSERT OR IGNORE INTO team_members (id, email, name, password_hash, role, is_active, created_at, updated_at)
VALUES (
  'admin-001',
  'john@tesorohq.io',
  'John Stevens',
  '71c0e22a22c53f40f8aef3d8234d16a5c8901cc5d98a6ee624bc1d980e16f710',
  'admin',
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- Insert default service categories
INSERT OR IGNORE INTO service_categories (id, name, icon, sort_order, is_active) VALUES
  ('cat-website', 'Website', '🌐', 1, 1),
  ('cat-crm', 'Tesoro CRM', '⚙️', 2, 1),
  ('cat-marketing', 'Marketing', '🎨', 3, 1),
  ('cat-support', 'Support', '🔧', 4, 1);

-- Insert default services
INSERT OR IGNORE INTO services (id, category_id, name, default_price, unit, btw_rate, sort_order, created_at) VALUES
  ('svc-001', 'cat-website', 'Homepage design', 850, 'stuk', 21, 1, strftime('%s', 'now') * 1000),
  ('svc-002', 'cat-website', 'Subpagina design', 150, 'stuk', 21, 2, strftime('%s', 'now') * 1000),
  ('svc-003', 'cat-website', 'Website ontwikkeling', 95, 'uur', 21, 3, strftime('%s', 'now') * 1000),
  ('svc-004', 'cat-crm', 'CRM configuratie', 95, 'uur', 21, 1, strftime('%s', 'now') * 1000),
  ('svc-005', 'cat-crm', 'Data migratie', 95, 'uur', 21, 2, strftime('%s', 'now') * 1000),
  ('svc-006', 'cat-crm', 'Training', 125, 'uur', 21, 3, strftime('%s', 'now') * 1000),
  ('svc-007', 'cat-marketing', 'Window card design', 150, 'stuk', 21, 1, strftime('%s', 'now') * 1000),
  ('svc-008', 'cat-marketing', 'Flyer design', 95, 'stuk', 21, 2, strftime('%s', 'now') * 1000),
  ('svc-009', 'cat-support', 'Support uurtarief', 85, 'uur', 21, 1, strftime('%s', 'now') * 1000),
  ('svc-010', 'cat-support', 'Onderhoudspakket', 75, 'maand', 21, 2, strftime('%s', 'now') * 1000);

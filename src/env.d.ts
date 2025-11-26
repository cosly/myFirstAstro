/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type D1Database = import('@cloudflare/workers-types').D1Database;
type R2Bucket = import('@cloudflare/workers-types').R2Bucket;
type KVNamespace = import('@cloudflare/workers-types').KVNamespace;
type Queue = import('@cloudflare/workers-types').Queue;
type DurableObjectNamespace = import('@cloudflare/workers-types').DurableObjectNamespace;

interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  KV: KVNamespace;
  QUEUE: Queue;
  QUOTE_PRESENCE?: DurableObjectNamespace; // Optional: requires separate Worker deployment for Pages
  ENVIRONMENT: string;
  APP_NAME: string;
  APP_URL: string;
  SESSION_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  ANTHROPIC_API_KEY?: string;
  RESEND_API_KEY?: string;
  // Turnstile spam protection
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

declare namespace App {
  interface Locals extends Runtime {
    user?: User;
  }
}

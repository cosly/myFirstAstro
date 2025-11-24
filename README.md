# Tesoro CRM Quotes

Online offerte applicatie voor Tesoro CRM, gebouwd met Astro en Cloudflare.

## Features

- **Quote Builder** - Drag & drop offerte builder met blokken en regels
- **Klant Aanvraag Formulier** - Klanten kunnen zelf een offerte aanvragen
- **Interactieve Offertes** - Klanten kunnen opties aan/uit zetten
- **Digitale Handtekening** - Onderteken en accepteer offertes online
- **Versiegeschiedenis** - Alle wijzigingen worden bijgehouden
- **AI Assistentie** - Tekst verbeteren en vertalen met Claude
- **Stripe Integratie** - Direct betalen via offerte

## Tech Stack

- **Framework**: Astro 5 + React
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Cloudflare D1 (SQLite) + Drizzle ORM
- **Storage**: Cloudflare R2
- **Hosting**: Cloudflare Pages
- **AI**: Claude API (Anthropic)
- **Payments**: Stripe

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Generate database migrations
npm run db:generate

# Apply migrations locally
npm run db:migrate
```

## Cloudflare Setup

1. Create a D1 database: `wrangler d1 create tesoro-quotes-db`
2. Create an R2 bucket: `wrangler r2 bucket create tesoro-quotes-storage`
3. Create a KV namespace: `wrangler kv namespace create tesoro-quotes-kv`
4. Update `wrangler.toml` with your database/bucket IDs
5. Set environment variables in Cloudflare dashboard

## Environment Variables

```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
```

## License

Proprietary - Tesoro CRM

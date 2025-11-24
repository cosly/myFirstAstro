#!/bin/bash
set -e

echo "🧡 Tesoro CRM Quotes - Cloudflare Setup"
echo "========================================"
echo ""

# Check if wrangler is available
if ! command -v wrangler &> /dev/null; then
    echo "⚠️  Wrangler niet gevonden. Installeren via npm..."
    npm install -g wrangler
fi

# Check login status
echo "📋 Stap 1: Cloudflare Login"
echo "----------------------------"
if ! wrangler whoami &> /dev/null; then
    echo "Je bent niet ingelogd. Start login..."
    wrangler login
else
    echo "✅ Al ingelogd bij Cloudflare"
fi

echo ""
echo "📋 Stap 2: D1 Database Aanmaken"
echo "--------------------------------"
read -p "Database aanmaken? (j/n): " create_db
if [ "$create_db" = "j" ]; then
    DB_OUTPUT=$(wrangler d1 create tesoro-quotes-db 2>&1) || true
    echo "$DB_OUTPUT"
    DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id = "\K[^"]+' || echo "")
    if [ -n "$DB_ID" ]; then
        echo "✅ Database ID: $DB_ID"
        echo ""
        echo "⚠️  Voeg dit toe aan wrangler.toml:"
        echo "   database_id = \"$DB_ID\""
    fi
fi

echo ""
echo "📋 Stap 3: R2 Bucket Aanmaken"
echo "------------------------------"
read -p "R2 bucket aanmaken? (j/n): " create_r2
if [ "$create_r2" = "j" ]; then
    wrangler r2 bucket create tesoro-quotes-storage || echo "Bucket bestaat mogelijk al"
    echo "✅ R2 bucket aangemaakt/bestaat"
fi

echo ""
echo "📋 Stap 4: KV Namespace Aanmaken"
echo "---------------------------------"
read -p "KV namespace aanmaken? (j/n): " create_kv
if [ "$create_kv" = "j" ]; then
    KV_OUTPUT=$(wrangler kv namespace create tesoro-quotes-kv 2>&1) || true
    echo "$KV_OUTPUT"
    KV_ID=$(echo "$KV_OUTPUT" | grep -oP 'id = "\K[^"]+' || echo "")
    if [ -n "$KV_ID" ]; then
        echo "✅ KV Namespace ID: $KV_ID"
        echo ""
        echo "⚠️  Voeg dit toe aan wrangler.toml:"
        echo "   id = \"$KV_ID\""
    fi
fi

echo ""
echo "📋 Stap 5: Database Migraties"
echo "------------------------------"
read -p "Database schema toepassen? (j/n): " run_migrations
if [ "$run_migrations" = "j" ]; then
    npm run db:generate || true
    wrangler d1 migrations apply tesoro-quotes-db --remote || echo "Migraties handmatig uitvoeren"
fi

echo ""
echo "📋 Stap 6: Build & Deploy"
echo "--------------------------"
read -p "Nu deployen naar Cloudflare Pages? (j/n): " deploy_now
if [ "$deploy_now" = "j" ]; then
    echo "Building..."
    npm run build
    echo "Deploying..."
    wrangler pages deploy dist --project-name=tesoro-quotes
    echo "✅ Deployed!"
fi

echo ""
echo "========================================"
echo "🎉 Setup compleet!"
echo ""
echo "Vergeet niet deze environment variables"
echo "toe te voegen in Cloudflare Dashboard:"
echo ""
echo "  SESSION_SECRET=<random-32-chars>"
echo "  ANTHROPIC_API_KEY=sk-ant-..."
echo "  RESEND_API_KEY=re_..."
echo ""
echo "Dashboard: https://dash.cloudflare.com"
echo "========================================"

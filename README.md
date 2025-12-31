# BreederHQ API Starter

Fastify + Prisma + TypeScript, ready for Neon on Render.

## Quick Start

1. Copy environment template:
   ```bash
   cp .env.example .env.dev
   ```

2. Generate required secrets:
   ```bash
   # Generate COOKIE_SECRET (required)
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

3. Add to `.env.dev`:
   ```
   COOKIE_SECRET=<your-generated-secret>
   DATABASE_URL=<your-neon-pooler-url>
   ```

4. Start dev server:
   ```bash
   npm run dev
   ```

See [COOKIE_SECRET_SETUP.md](docs/runbooks/COOKIE_SECRET_SETUP.md) for detailed security setup.

## Documentation

- Party migration: [docs/migrations/party/README.md](docs/migrations/party/README.md)
- Cookie/session setup: [docs/runbooks/COOKIE_SECRET_SETUP.md](docs/runbooks/COOKIE_SECRET_SETUP.md)
- All runbooks: [docs/runbooks/](docs/runbooks/)

## Features
- Routes: `GET /health`, `GET /contacts`, `POST /contacts`
- Signed session cookies with HMAC verification
- Surface-based access control (PLATFORM, PORTAL, MARKETPLACE)
- Prisma models: Contact, Organization, Deposit
- Port defaults to 6001

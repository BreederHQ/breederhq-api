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

## Production Deployment Requirements

### Session Cookies

For SSO across subdomains (app.breederhq.com, portal.breederhq.com, marketplace.breederhq.com):

**Required environment variables:**
```bash
COOKIE_DOMAIN=.breederhq.com  # Enables SSO across all *.breederhq.com subdomains
COOKIE_SECRET=<32-byte-base64-secret>  # Required for signed cookies
```

**Cookie security settings (automatically applied in production):**
- `httpOnly: true` - Prevents JavaScript access to cookies
- `secure: true` - HTTPS-only cookies
- `sameSite: "lax"` - CSRF protection while allowing cross-subdomain navigation
- `signed: true` - HMAC signature verification using COOKIE_SECRET
- `domain: ".breederhq.com"` - Shared across all subdomains

**Testing cookie scope locally:**
Set `COOKIE_DOMAIN=.breederhq.test` and use `/etc/hosts` entries:
```
127.0.0.1 app.breederhq.test
127.0.0.1 portal.breederhq.test
127.0.0.1 marketplace.breederhq.test
```

### Rate Limiting

**Development:** Uses in-memory store (suitable for single instance)

**Production:** Requires shared store for multiple API instances

The current implementation uses `@fastify/rate-limit` with default in-memory store. For production deployments with multiple API instances (horizontal scaling), you must configure a shared rate limit store (Redis recommended).

**Rate-limited endpoints:**
- `POST /auth/login` - 5 req/min
- `POST /auth/reset-password` - 5 req/min
- `GET /portal/invites/:token` - 20 req/min

**Testing rate limits:**
```bash
# Bash
./scripts/smoke-test-rate-limits.sh

# PowerShell
./scripts/smoke-test-rate-limits.ps1
```

**Production configuration example (Redis):**
```typescript
// In src/server.ts, modify rateLimit registration:
import redis from '@fastify/redis'

await app.register(redis, {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
})

await app.register(rateLimit, {
  global: false,
  ban: 2,
  redis: app.redis, // Use Redis instead of in-memory
  errorResponseBuilder: (_req, _context) => ({ error: "RATE_LIMITED" }),
})
```

See [@fastify/rate-limit docs](https://github.com/fastify/fastify-rate-limit#custom-store) for store configuration.

# BreederHQ API Starter

Fastify + Prisma + TypeScript, ready for Neon on Render.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure AWS CLI dev profile (one-time setup):
   ```bash
   aws configure --profile dev
   # Access Key ID: (get from team lead)
   # Secret Access Key: (get from team lead)
   # Region: us-east-2
   ```

3. Copy environment template:
   ```bash
   cp .env.example .env.dev
   ```
   The default `.env.dev` has `USE_SECRETS_MANAGER=true` — all secrets (DB, Stripe, Resend, JWT, etc.) are fetched from AWS Secrets Manager at startup. Fallback values in `.env.dev` are used by test scripts.

4. Start dev server:
   ```bash
   npm run dev
   ```
   If your SSO token has expired, the browser will open automatically for re-authentication.

See [AWS Secrets Manager](docs/operations/AWS-SECRETS-MANAGER.md) for full details.

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

### Redis (Horizontal Scaling)

**Optional.** When `REDIS_URL` is set, the API enables shared state across multiple instances:

- **Rate limiting** - Enforced across all API instances
- **WebSocket pub/sub** - Real-time messages reach users on any instance
- **Geocoding cache** - Shared cache avoids duplicate external API calls

**Environment variable:**
```bash
REDIS_URL=redis://localhost:6379
# Or with auth: redis://user:password@host:6379
```

**Behavior:**
| Feature | Without Redis | With Redis |
|---------|---------------|------------|
| Rate Limiting | Per-instance only | Shared across instances |
| WebSocket Messages | Local connections only | Broadcast to all instances via pub/sub |
| Geocoding Cache | In-memory (lost on restart) | Shared with 24h TTL |

### Rate Limiting

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

See [@fastify/rate-limit docs](https://github.com/fastify/fastify-rate-limit#custom-store) for advanced store configuration.

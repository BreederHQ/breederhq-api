# COOKIE_SECRET Setup and Troubleshooting

Session cookies are HMAC-signed for security. This requires a `COOKIE_SECRET` environment variable in **all environments** (including local dev).

## Quick Setup

### Local Development

1. Generate a secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. Add to `.env.dev`:
   ```
   COOKIE_SECRET=<your-generated-secret>
   ```

3. Verify with preflight:
   ```bash
   npm run preflight
   # or with env loaded:
   npx dotenv -e .env.dev -- npm run preflight
   ```

### Production (Render)

1. In Render dashboard, add environment variable:
   - Key: `COOKIE_SECRET`
   - Value: Generate using the command above (min 32 characters)
   - Ensure "Sync" is enabled if using environment groups

2. Redeploy the service after adding the variable.

## Requirements

| Variable | Min Length | Required In |
|----------|------------|-------------|
| `COOKIE_SECRET` | 32 chars | All environments |
| `DATABASE_URL` | 1 char | All environments |

## Common Errors

### Boot Failure: "FATAL: COOKIE_SECRET environment variable is required"

**Cause**: Server cannot start without a valid `COOKIE_SECRET`.

**Fix**:
- Local: Add `COOKIE_SECRET` to `.env.dev`
- Production: Add to Render/hosting environment variables

### Preflight Check Failed

```
❌ Preflight check FAILED

Missing or invalid required environment variables:

  COOKIE_SECRET: missing
    → Session cookie signing secret
    💡 Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Fix**: Generate and add `COOKIE_SECRET` as shown above.

### Cookie Secret Too Short

```
COOKIE_SECRET: too short (need ≥32 chars, got 16)
```

**Fix**: Generate a new secret with the full command (produces 44 chars).

### Session Cookies Not Working

**Symptoms**:
- 401 errors on authenticated routes
- Session parsing returns null

**Causes**:
1. `COOKIE_SECRET` changed between requests (cookie signed with old secret)
2. `COOKIE_SECRET` differs between API servers (if load balanced)
3. Cookie not being sent (check browser dev tools, Network tab)

**Diagnosis**:
```bash
# Hit the diagnostics endpoint
curl -b cookies.txt https://api.example.com/__diag
```

Response shows session info if cookie is valid:
```json
{
  "ok": true,
  "hostname": "api.example.com",
  "surface": "PLATFORM",
  "session": {
    "userId": "abc123",
    "tenantId": 1,
    "iat": 1735600000000,
    "exp": 1735686400000
  },
  "actorContext": "STAFF",
  "resolvedTenantId": 1
}
```

If session is null, the cookie is missing, expired, or signature verification failed.

## Secret Rotation

**Warning**: Changing `COOKIE_SECRET` invalidates ALL existing sessions.

If you must rotate:
1. Deploy new secret
2. Users will be logged out and need to re-authenticate
3. There is no graceful rotation (single secret model)

## Security Notes

- Never commit `COOKIE_SECRET` to git
- `.env.dev` is gitignored (safe for local secrets)
- `.env.example` has placeholder only (safe to commit)
- Use different secrets for dev vs production
- Secrets should be cryptographically random (use the generation command)

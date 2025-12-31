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
# Hit the diagnostics endpoint (dev only, or requires superadmin in production)
curl https://localhost:6001/__diag
```

Response shows surface derivation:
```json
{
  "ok": true,
  "hostname": "localhost",
  "surface": "PLATFORM",
  "resolvedTenantId": null,
  "env": { "NODE_ENV": "development", "IS_DEV": true }
}
```

Note: `/__diag` returns 404 in production for non-superadmin users.

## Secret Rotation

**Warning**: Changing `COOKIE_SECRET` invalidates ALL existing sessions.

If you must rotate:
1. Deploy new secret
2. Users will be logged out and need to re-authenticate
3. There is no graceful rotation (single secret model)

## Security Notes

**Never commit `.env*` files except `.env.example`**

- All `.env*` files are gitignored except explicit templates
- `.env.dev` contains real secrets - never commit
- `.env.example` has placeholders only - safe to commit
- Use different secrets for dev vs production
- Secrets should be cryptographically random (use the generation command)

For Render/Vercel:
- Set `COOKIE_SECRET` in dashboard environment variables
- Never put secrets in build args or Dockerfile

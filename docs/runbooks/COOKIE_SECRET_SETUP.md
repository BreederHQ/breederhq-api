# COOKIE_SECRET Setup and Troubleshooting

Session cookies are HMAC-signed for security. This requires a `COOKIE_SECRET` environment variable in **all environments** (including local dev).

## Quick Setup

### Local Development

`COOKIE_SECRET` is fetched from AWS Secrets Manager at startup (via `boot-dev.js`). No manual setup needed — just ensure your AWS CLI dev profile is configured:

```bash
aws configure --profile dev
```

A fallback value exists in `.env.dev` for scripts that don't use SM (tests, etc.).

### Production / Deployed Environments

`COOKIE_SECRET` is stored in AWS Secrets Manager alongside all other secrets. See [AWS Secrets Manager](../operations/AWS-SECRETS-MANAGER.md) for managing secrets across environments.

## Requirements

| Variable | Min Length | Required In |
|----------|------------|-------------|
| `COOKIE_SECRET` | 32 chars | All environments |
| `DATABASE_URL` | 1 char | All environments |

## Common Errors

### Boot Failure: "FATAL: COOKIE_SECRET environment variable is required"

**Cause**: Server cannot start without a valid `COOKIE_SECRET`.

**Fix**:
- Local: Ensure AWS CLI dev profile is configured (`aws configure --profile dev`). SM provides the secret at startup.
- Production: Managed via AWS Secrets Manager (see [operations guide](../operations/AWS-SECRETS-MANAGER.md))

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

For deployed environments:
- All secrets are managed via AWS Secrets Manager
- Never put secrets in build args or Dockerfile
- See [AWS Secrets Manager](../operations/AWS-SECRETS-MANAGER.md) for operations guide

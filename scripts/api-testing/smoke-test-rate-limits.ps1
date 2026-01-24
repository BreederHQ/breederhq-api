# Smoke test for rate limiting on public portal auth endpoints
# Tests that rate limits prevent brute force attacks

param(
    [string]$ApiBase = "http://localhost:6001"
)

$ErrorActionPreference = "Stop"

Write-Host "`nPortal Auth Rate Limit Smoke Test" -ForegroundColor Cyan
Write-Host "API Base: $ApiBase`n"

# Test 1: Login endpoint (5 req/min limit)
Write-Host "Test 1: POST /auth/login rate limit (5 req/min)" -ForegroundColor Cyan
Write-Host "Sending 6 login attempts within 1 minute...`n"

$successCount = 0
$rateLimited = 0

for ($i = 1; $i -le 6; $i++) {
    try {
        $response = Invoke-WebRequest `
            -Uri "$ApiBase/api/v1/auth/login" `
            -Method POST `
            -ContentType "application/json" `
            -Body '{"email":"test@example.com","password":"invalid"}' `
            -UseBasicParsing `
            -ErrorAction SilentlyContinue

        $successCount++
        Write-Host "  Request $i: $($response.StatusCode) (processed)"
    }
    catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 429) {
            $rateLimited++
            Write-Host "  Request $i: 429 RATE_LIMITED" -ForegroundColor Yellow
        }
        else {
            $successCount++
            Write-Host "  Request $i: $($_.Exception.Response.StatusCode.value__) (processed)"
        }
    }

    Start-Sleep -Milliseconds 200
}

if ($rateLimited -gt 0) {
    Write-Host "`n✓ Login rate limiting active" -ForegroundColor Green -NoNewline
    Write-Host " ($rateLimited requests blocked)"
}
else {
    Write-Host "`n✗ Login rate limiting NOT working (expected 429 after 5 requests)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Invite validate endpoint (20 req/min limit)
Write-Host "Test 2: GET /portal/invites/:token rate limit (20 req/min)" -ForegroundColor Cyan
Write-Host "Sending 21 invite validation requests within 1 minute...`n"

$successCount = 0
$rateLimited = 0

for ($i = 1; $i -le 21; $i++) {
    try {
        $response = Invoke-WebRequest `
            -Uri "$ApiBase/api/v1/portal/invites/fake-token-for-test" `
            -Method GET `
            -UseBasicParsing `
            -ErrorAction SilentlyContinue

        $successCount++
        Write-Host "  Request $i: $($response.StatusCode) (processed)"
    }
    catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 429) {
            $rateLimited++
            Write-Host "  Request $i: 429 RATE_LIMITED" -ForegroundColor Yellow
        }
        else {
            $successCount++
            Write-Host "  Request $i: $($_.Exception.Response.StatusCode.value__) (processed)"
        }
    }

    Start-Sleep -Milliseconds 100
}

if ($rateLimited -gt 0) {
    Write-Host "`n✓ Invite validation rate limiting active" -ForegroundColor Green -NoNewline
    Write-Host " ($rateLimited requests blocked)"
}
else {
    Write-Host "`n✗ Invite validation rate limiting NOT working (expected 429 after 20 requests)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 3: Password reset endpoint (5 req/min limit)
Write-Host "Test 3: POST /auth/reset-password rate limit (5 req/min)" -ForegroundColor Cyan
Write-Host "Sending 6 reset password attempts within 1 minute...`n"

$successCount = 0
$rateLimited = 0

for ($i = 1; $i -le 6; $i++) {
    try {
        $response = Invoke-WebRequest `
            -Uri "$ApiBase/api/v1/auth/reset-password" `
            -Method POST `
            -ContentType "application/json" `
            -Body '{"token":"fake","password":"newpassword123"}' `
            -UseBasicParsing `
            -ErrorAction SilentlyContinue

        $successCount++
        Write-Host "  Request $i: $($response.StatusCode) (processed)"
    }
    catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 429) {
            $rateLimited++
            Write-Host "  Request $i: 429 RATE_LIMITED" -ForegroundColor Yellow
        }
        else {
            $successCount++
            Write-Host "  Request $i: $($_.Exception.Response.StatusCode.value__) (processed)"
        }
    }

    Start-Sleep -Milliseconds 200
}

if ($rateLimited -gt 0) {
    Write-Host "`n✓ Reset password rate limiting active" -ForegroundColor Green -NoNewline
    Write-Host " ($rateLimited requests blocked)"
}
else {
    Write-Host "`n✗ Reset password rate limiting NOT working (expected 429 after 5 requests)" -ForegroundColor Red
    exit 1
}

Write-Host "`nAll rate limit tests passed!" -ForegroundColor Green
Write-Host "`nNote: Rate limits are currently in-memory and will reset when the API restarts."
Write-Host "For production with multiple API instances, configure a shared rate limit store (Redis).`n"

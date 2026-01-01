# Verification script for public marketplace route prefixes
# Tests that both /api/v1/public/marketplace/* and /api/v1/marketplace/* work

$API_BASE_URL = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { "http://localhost:6001" }

Write-Host "Verifying Public Marketplace Routes" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "API Base URL: $API_BASE_URL" -ForegroundColor Gray
Write-Host ""

$exitCode = 0

# Test 1: Authoritative prefix /api/v1/public/marketplace/programs
Write-Host "Test 1: GET /api/v1/public/marketplace/programs" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$API_BASE_URL/api/v1/public/marketplace/programs" -Method GET -UseBasicParsing 2>&1
    $statusCode = if ($response.StatusCode) { $response.StatusCode } else { $response.Exception.Response.StatusCode.value__ }

    if ($statusCode -eq 404) {
        Write-Host "Status: 404 NOT FOUND" -ForegroundColor Red
        Write-Host "FAIL: Route not registered or feature flag not enabled" -ForegroundColor Red
        $exitCode = 1
    } elseif ($statusCode -eq 200) {
        Write-Host "Status: 200 OK" -ForegroundColor Green
        $json = $response.Content | ConvertFrom-Json
        Write-Host "Response contains $(if ($json.items) { $json.items.Count } else { 0 }) programs" -ForegroundColor Gray
    } else {
        Write-Host "Status: $statusCode" -ForegroundColor Yellow
        Write-Host "PASS: Route is registered (non-404 response)" -ForegroundColor Green
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    $exitCode = 1
}
Write-Host ""

# Test 2: Legacy prefix /api/v1/marketplace/programs
Write-Host "Test 2: GET /api/v1/marketplace/programs (legacy)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$API_BASE_URL/api/v1/marketplace/programs" -Method GET -UseBasicParsing 2>&1
    $statusCode = if ($response.StatusCode) { $response.StatusCode } else { $response.Exception.Response.StatusCode.value__ }

    if ($statusCode -eq 404) {
        Write-Host "Status: 404 NOT FOUND" -ForegroundColor Red
        Write-Host "FAIL: Legacy route not registered" -ForegroundColor Red
        $exitCode = 1
    } elseif ($statusCode -eq 200) {
        Write-Host "Status: 200 OK" -ForegroundColor Green
        $json = $response.Content | ConvertFrom-Json
        Write-Host "Response contains $(if ($json.items) { $json.items.Count } else { 0 }) programs" -ForegroundColor Gray
    } else {
        Write-Host "Status: $statusCode" -ForegroundColor Yellow
        Write-Host "PASS: Legacy route is registered (non-404 response)" -ForegroundColor Green
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    $exitCode = 1
}
Write-Host ""

Write-Host "====================================" -ForegroundColor Cyan
if ($exitCode -eq 0) {
    Write-Host "Verification complete - all routes registered" -ForegroundColor Green
} else {
    Write-Host "Verification failed - check feature flag: MARKETPLACE_PUBLIC_ENABLED=true" -ForegroundColor Red
}
exit $exitCode

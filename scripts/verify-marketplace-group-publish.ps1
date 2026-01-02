# Verification script for marketplace offspring group publish/unpublish functionality
# Tests the authenticated endpoints for listing control

param(
    [string]$ApiBaseUrl = "http://localhost:6001",
    [int]$GroupId = 0,
    [int]$DefaultPriceCents = 500000
)

Write-Host "Marketplace Group Publish Verification" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "API Base URL: $ApiBaseUrl" -ForegroundColor Gray
Write-Host "Group ID: $GroupId" -ForegroundColor Gray
Write-Host "Default Price: $DefaultPriceCents cents" -ForegroundColor Gray
Write-Host ""

if ($GroupId -eq 0) {
    Write-Host "ERROR: GroupId is required" -ForegroundColor Red
    Write-Host "Usage: .\verify-marketplace-group-publish.ps1 -GroupId <id> [-DefaultPriceCents <cents>]" -ForegroundColor Yellow
    exit 1
}

$exitCode = 0

# Test 1: Publish group with default price
Write-Host "Test 1: POST /api/v1/offspring/groups/$GroupId/marketplace/publish" -ForegroundColor Yellow
try {
    $body = @{
        marketplaceDefaultPriceCents = $DefaultPriceCents
    } | ConvertTo-Json

    $response = Invoke-WebRequest `
        -Uri "$ApiBaseUrl/api/v1/offspring/groups/$GroupId/marketplace/publish" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -UseBasicParsing 2>&1

    $statusCode = if ($response.StatusCode) { $response.StatusCode } else { $response.Exception.Response.StatusCode.value__ }

    if ($statusCode -eq 200) {
        Write-Host "Status: 200 OK" -ForegroundColor Green
        $json = $response.Content | ConvertFrom-Json
        Write-Host "Published group $($json.groupId) with default price $($json.defaultPriceCents) cents" -ForegroundColor Gray
        Write-Host "Listed $($json.listedCount) offspring" -ForegroundColor Gray
    } elseif ($statusCode -eq 401 -or $statusCode -eq 403) {
        Write-Host "Status: $statusCode" -ForegroundColor Yellow
        Write-Host "WARN: Authentication required for this endpoint" -ForegroundColor Yellow
        Write-Host "This is expected - endpoint requires valid session" -ForegroundColor Gray
    } elseif ($statusCode -eq 404) {
        Write-Host "Status: 404 NOT FOUND" -ForegroundColor Red
        Write-Host "FAIL: Group not found or invalid ID" -ForegroundColor Red
        $exitCode = 1
    } else {
        Write-Host "Status: $statusCode" -ForegroundColor Red
        Write-Host "FAIL: Unexpected status code" -ForegroundColor Red
        $exitCode = 1
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    $exitCode = 1
}
Write-Host ""

# Test 2: Unpublish group
Write-Host "Test 2: POST /api/v1/offspring/groups/$GroupId/marketplace/unpublish" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest `
        -Uri "$ApiBaseUrl/api/v1/offspring/groups/$GroupId/marketplace/unpublish" `
        -Method POST `
        -ContentType "application/json" `
        -UseBasicParsing 2>&1

    $statusCode = if ($response.StatusCode) { $response.StatusCode } else { $response.Exception.Response.StatusCode.value__ }

    if ($statusCode -eq 200) {
        Write-Host "Status: 200 OK" -ForegroundColor Green
        $json = $response.Content | ConvertFrom-Json
        Write-Host "Unpublished group $($json.groupId)" -ForegroundColor Gray
    } elseif ($statusCode -eq 401 -or $statusCode -eq 403) {
        Write-Host "Status: $statusCode" -ForegroundColor Yellow
        Write-Host "WARN: Authentication required for this endpoint" -ForegroundColor Yellow
    } elseif ($statusCode -eq 404) {
        Write-Host "Status: 404 NOT FOUND" -ForegroundColor Red
        Write-Host "FAIL: Group not found" -ForegroundColor Red
        $exitCode = 1
    } else {
        Write-Host "Status: $statusCode" -ForegroundColor Red
        Write-Host "FAIL: Unexpected status code" -ForegroundColor Red
        $exitCode = 1
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    $exitCode = 1
}
Write-Host ""

Write-Host "======================================" -ForegroundColor Cyan
if ($exitCode -eq 0) {
    Write-Host "Verification complete - endpoints registered" -ForegroundColor Green
    Write-Host "Note: Auth required for actual testing - use authenticated session" -ForegroundColor Yellow
} else {
    Write-Host "Verification failed - check endpoints and group ID" -ForegroundColor Red
}
exit $exitCode

# Verification script for public programs index endpoint

$API_URL = if ($env:API_URL) { $env:API_URL } else { "https://breederhq-api.onrender.com/api/v1/public/marketplace" }

Write-Host "Testing Public Programs Index Endpoint" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "API URL: $API_URL" -ForegroundColor Gray
Write-Host ""

# Test 1: GET /programs (no filters)
Write-Host "Test 1: GET /programs (no filters)" -ForegroundColor Yellow
$exitCode = 0
try {
    $response = Invoke-WebRequest -Uri "$API_URL/programs" -Method GET -SkipHttpErrorCheck
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor $(if ($response.StatusCode -eq 200) { "Green" } else { "Red" })

    if ($response.StatusCode -ne 200) {
        $exitCode = 1
    }

    $json = $response.Content | ConvertFrom-Json
    Write-Host "Total programs: $($json.total)"
    Write-Host "Items returned: $($json.items.Count)"

    if ($json.total -eq 0) {
        Write-Host "WARNING: No public programs found" -ForegroundColor Yellow
        Write-Host "Run: npm run script:enable-public-program to enable at least one" -ForegroundColor Yellow
        $exitCode = 1
    }

    if ($json.items.Count -gt 0) {
        Write-Host "First program:" -ForegroundColor Gray
        Write-Host "  Slug: $($json.items[0].slug)" -ForegroundColor Gray
        Write-Host "  Name: $($json.items[0].name)" -ForegroundColor Gray
        Write-Host "  Location: $($json.items[0].location)" -ForegroundColor Gray
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    $exitCode = 1
}
Write-Host ""

# Test 2: GET /programs?search=test
Write-Host "Test 2: GET /programs?search=test" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$API_URL/programs?search=test" -Method GET -SkipHttpErrorCheck
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor $(if ($response.StatusCode -eq 200) { "Green" } else { "Red" })
    $json = $response.Content | ConvertFrom-Json
    Write-Host "Total programs: $($json.total)"
    Write-Host "Items returned: $($json.items.Count)"
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: GET /programs?limit=5
Write-Host "Test 3: GET /programs?limit=5" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$API_URL/programs?limit=5" -Method GET -SkipHttpErrorCheck
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor $(if ($response.StatusCode -eq 200) { "Green" } else { "Red" })
    $json = $response.Content | ConvertFrom-Json
    Write-Host "Items returned: $($json.items.Count)" -ForegroundColor $(if ($json.items.Count -le 5) { "Green" } else { "Red" })
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: GET /programs?location=California
Write-Host "Test 4: GET /programs?location=California" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$API_URL/programs?location=California" -Method GET -SkipHttpErrorCheck
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor $(if ($response.StatusCode -eq 200) { "Green" } else { "Red" })
    $json = $response.Content | ConvertFrom-Json
    Write-Host "Total programs: $($json.total)"
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
if ($exitCode -eq 0) {
    Write-Host "Verification complete - all tests passed" -ForegroundColor Green
} else {
    Write-Host "Verification complete - some tests failed" -ForegroundColor Red
}
exit $exitCode

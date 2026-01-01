# Verification script for Marketplace registration endpoint changes
# Tests that firstName and lastName are now required fields

$API_URL = if ($env:API_URL) { $env:API_URL } else { "http://localhost:3000/api/v1/auth" }

Write-Host "Testing Marketplace Registration Validation" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Missing firstName
Write-Host "Test 1: Missing firstName (should return 400)" -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "$API_URL/register" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"test1@example.com","password":"password123","lastName":"Doe"}' `
    -SkipHttpErrorCheck
Write-Host "Response: $($response.Content)"
Write-Host "Status: $($response.StatusCode)" -ForegroundColor $(if ($response.StatusCode -eq 400) { "Green" } else { "Red" })
Write-Host ""

# Test 2: Missing lastName
Write-Host "Test 2: Missing lastName (should return 400)" -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "$API_URL/register" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"test2@example.com","password":"password123","firstName":"John"}' `
    -SkipHttpErrorCheck
Write-Host "Response: $($response.Content)"
Write-Host "Status: $($response.StatusCode)" -ForegroundColor $(if ($response.StatusCode -eq 400) { "Green" } else { "Red" })
Write-Host ""

# Test 3: Missing email
Write-Host "Test 3: Missing email (should return 400)" -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "$API_URL/register" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"password":"password123","firstName":"John","lastName":"Doe"}' `
    -SkipHttpErrorCheck
Write-Host "Response: $($response.Content)"
Write-Host "Status: $($response.StatusCode)" -ForegroundColor $(if ($response.StatusCode -eq 400) { "Green" } else { "Red" })
Write-Host ""

# Test 4: Valid payload
Write-Host "Test 4: Valid payload (should return 201)" -ForegroundColor Yellow
$randomEmail = "test-$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
$response = Invoke-WebRequest -Uri "$API_URL/register" `
    -Method POST `
    -ContentType "application/json" `
    -Headers @{"X-Surface" = "MARKETPLACE"} `
    -Body "{`"email`":`"$randomEmail`",`"password`":`"password123`",`"firstName`":`"John`",`"lastName`":`"Doe`"}" `
    -SkipHttpErrorCheck
Write-Host "Response: $($response.Content)"
Write-Host "Status: $($response.StatusCode)" -ForegroundColor $(if ($response.StatusCode -eq 201) { "Green" } else { "Red" })
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Verification complete" -ForegroundColor Cyan

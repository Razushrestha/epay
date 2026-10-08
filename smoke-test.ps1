# ===================================================================
# NEXLO MARKETPLACE - COMPREHENSIVE SMOKE TEST
# Tests: Backend Health, Rate Limiting, Database, API Endpoints
# ===================================================================

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "  NEXLO SMOKE TEST SUITE" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:4000"
$testsPassed = 0
$testsFailed = 0

# Helper function to test endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [object]$Body,
        [int]$ExpectedStatus,
        [string]$Description
    )
    
    Write-Host "`n[$Name] $Description..." -NoNewline
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            UseBasicParsing = $true
            ErrorAction = 'SilentlyContinue'
        }
        
        if ($Body) {
            $params.Body = $Body | ConvertTo-Json
            $params.ContentType = 'application/json'
        }
        
        $response = Invoke-WebRequest @params
        $actualStatus = $response.StatusCode
    }
    catch {
        $actualStatus = $_.Exception.Response.StatusCode.value__
    }
    
    if ($actualStatus -eq $ExpectedStatus) {
        Write-Host " PASS" -ForegroundColor Green
        $script:testsPassed++
        return $true
    }
    else {
        Write-Host " FAIL (Expected $ExpectedStatus, got $actualStatus)" -ForegroundColor Red
        $script:testsFailed++
        return $false
    }
}

# ===================================================================
# TEST 1: BACKEND HEALTH CHECK
# ===================================================================

Write-Host "`n`n--- TEST 1: Backend Health ---" -ForegroundColor Yellow

$result = Test-Endpoint `
    -Name "HEALTH" `
    -Method "GET" `
    -Url "$baseUrl/health" `
    -ExpectedStatus 200 `
    -Description "Backend server is running"

if ($result) {
    $health = Invoke-WebRequest -Uri "$baseUrl/health" -UseBasicParsing | ConvertFrom-Json
    Write-Host "  Service: $($health.service)"
    Write-Host "  Runtime: $($health.runtime)"
    Write-Host "  Database: $($health.database)"
}

# ===================================================================
# TEST 2: RATE LIMITING (BOT TEST)
# ===================================================================

Write-Host "`n`n--- TEST 2: Rate Limiting (Bot Protection) ---" -ForegroundColor Yellow

$loginData = @{
    identifier = "bottest_" + (Get-Random -Maximum 999999) + "@example.com"
    password = "wrongpassword123"
}

Write-Host "`nTesting brute force protection (6 rapid attempts)..."

$attempts = @()
for ($i = 1; $i -le 6; $i++) {
    try {
        $response = Invoke-WebRequest `
            -Uri "$baseUrl/api/v1/auth/login" `
            -Method POST `
            -ContentType "application/json" `
            -Body ($loginData | ConvertTo-Json) `
            -UseBasicParsing `
            -ErrorAction SilentlyContinue
        $status = $response.StatusCode
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
    }
    
    $attempts += $status
    Start-Sleep -Milliseconds 100
}

$attempt5Correct = $attempts[4] -eq 401
$attempt6Blocked = $attempts[5] -eq 429

if ($attempt5Correct -and $attempt6Blocked) {
    Write-Host "  5th attempt: 401 (Correct)" -ForegroundColor Green
    Write-Host "  6th attempt: 429 (BLOCKED - Correct)" -ForegroundColor Green
    $script:testsPassed++
}
else {
    Write-Host "  Rate limiting FAILED" -ForegroundColor Red
    Write-Host "  Attempts: $($attempts -join ', ')"
    $script:testsFailed++
}

# ===================================================================
# TEST 3: CATALOG API
# ===================================================================

Write-Host "`n`n--- TEST 3: Catalog API ---" -ForegroundColor Yellow

Test-Endpoint `
    -Name "CATALOG" `
    -Method "GET" `
    -Url "$baseUrl/api/v1/catalog/categories" `
    -ExpectedStatus 200 `
    -Description "Get categories list"

Test-Endpoint `
    -Name "CONDITIONS" `
    -Method "GET" `
    -Url "$baseUrl/api/v1/catalog/conditions" `
    -ExpectedStatus 200 `
    -Description "Get conditions list"

Test-Endpoint `
    -Name "BRANDS" `
    -Method "GET" `
    -Url "$baseUrl/api/v1/catalog/brands?limit=10" `
    -ExpectedStatus 200 `
    -Description "Get brands list"

# ===================================================================
# TEST 4: AUTHENTICATION API
# ===================================================================

Write-Host "`n`n--- TEST 4: Authentication API ---" -ForegroundColor Yellow

Test-Endpoint `
    -Name "LOGIN" `
    -Method "POST" `
    -Url "$baseUrl/api/v1/auth/login" `
    -Body @{ identifier = "test@test.com"; password = "wrong" } `
    -ExpectedStatus 401 `
    -Description "Invalid login (should fail)"

Test-Endpoint `
    -Name "REGISTER_VALIDATION" `
    -Method "POST" `
    -Url "$baseUrl/api/v1/auth/register" `
    -Body @{ email = "invalid"; password = "short" } `
    -ExpectedStatus 400 `
    -Description "Invalid registration data"

# ===================================================================
# TEST 5: LISTINGS API
# ===================================================================

Write-Host "`n`n--- TEST 5: Listings API ---" -ForegroundColor Yellow

Test-Endpoint `
    -Name "BROWSE" `
    -Method "GET" `
    -Url "$baseUrl/api/v1/listings?limit=10" `
    -ExpectedStatus 200 `
    -Description "Browse listings"

Test-Endpoint `
    -Name "SEARCH" `
    -Method "GET" `
    -Url "$baseUrl/api/v1/listings/search?q=test&limit=5" `
    -ExpectedStatus 200 `
    -Description "Search listings"

Test-Endpoint `
    -Name "FEATURED" `
    -Method "GET" `
    -Url "$baseUrl/api/v1/listings/featured" `
    -ExpectedStatus 200 `
    -Description "Get featured listings"

# ===================================================================
# TEST 6: CART API
# ===================================================================

Write-Host "`n`n--- TEST 6: Cart API ---" -ForegroundColor Yellow

Test-Endpoint `
    -Name "CART_UNAUTH" `
    -Method "GET" `
    -Url "$baseUrl/api/v1/cart" `
    -ExpectedStatus 401 `
    -Description "Cart requires authentication"

# ===================================================================
# TEST 7: STATIC FILE SERVING
# ===================================================================

Write-Host "`n`n--- TEST 7: Static File Serving ---" -ForegroundColor Yellow

Test-Endpoint `
    -Name "UPLOADS_404" `
    -Method "GET" `
    -Url "$baseUrl/uploads/nonexistent.jpg" `
    -ExpectedStatus 404 `
    -Description "Non-existent upload returns 404"

# ===================================================================
# TEST 8: ERROR HANDLING
# ===================================================================

Write-Host "`n`n--- TEST 8: Error Handling ---" -ForegroundColor Yellow

Test-Endpoint `
    -Name "NOT_FOUND" `
    -Method "GET" `
    -Url "$baseUrl/api/v1/nonexistent" `
    -ExpectedStatus 404 `
    -Description "404 for non-existent endpoints"

Test-Endpoint `
    -Name "METHOD_NOT_ALLOWED" `
    -Method "DELETE" `
    -Url "$baseUrl/api/v1/listings" `
    -ExpectedStatus 404 `
    -Description "Invalid HTTP method"

# ===================================================================
# FINAL RESULTS
# ===================================================================

Write-Host "`n`n==========================================" -ForegroundColor Cyan
Write-Host "  TEST RESULTS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$totalTests = $testsPassed + $testsFailed
$passRate = [math]::Round(($testsPassed / $totalTests) * 100, 1)

Write-Host "`nTests Passed: $testsPassed" -ForegroundColor Green
Write-Host "Tests Failed: $testsFailed" -ForegroundColor $(if ($testsFailed -gt 0) { "Red" } else { "Green" })
Write-Host "Pass Rate: $passRate%" -ForegroundColor $(if ($passRate -ge 90) { "Green" } elseif ($passRate -ge 70) { "Yellow" } else { "Red" })

if ($testsFailed -eq 0) {
    Write-Host "`n[SUCCESS] All smoke tests passed!" -ForegroundColor Green
    Write-Host "System is ready for production." -ForegroundColor Green
}
else {
    Write-Host "`n[WARNING] Some tests failed." -ForegroundColor Yellow
    Write-Host "Please review the failed tests above." -ForegroundColor Yellow
}

Write-Host "`n==========================================`n" -ForegroundColor Cyan

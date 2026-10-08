# Fresh Rate Limiting Bot Test
# Uses unique random identifier to avoid previous rate limits

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$random = Get-Random -Maximum 999999
$apiUrl = "http://localhost:4000/api/v1/auth/login"

# Use unique identifier for this test run
$testData = @{
    identifier = "bottest_${timestamp}_${random}@example.com"
    password = "wrongpassword123"
} | ConvertTo-Json

Write-Host "`n=========================================="
Write-Host "  FRESH RATE LIMITING TEST"
Write-Host "  Test ID: ${timestamp}_${random}"
Write-Host "==========================================`n"

Write-Host "Testing brute force protection..."
Write-Host "Expected: 5x 401 (Unauthorized), then 429 (Rate Limited)`n"

$results = @()

for ($i = 1; $i -le 7; $i++) {
    Write-Host "Attempt $i..." -NoNewline
    
    try {
        $response = Invoke-WebRequest -Uri $apiUrl `
            -Method POST `
            -ContentType "application/json" `
            -Body $testData `
            -UseBasicParsing `
            -ErrorAction SilentlyContinue
        
        $status = $response.StatusCode
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
    }
    
    $results += @{
        Attempt = $i
        Status = $status
    }
    
    if ($status -eq 401) {
        Write-Host " 401 (Unauthorized)" -ForegroundColor Gray
    }
    elseif ($status -eq 429) {
        Write-Host " 429 (RATE LIMITED)" -ForegroundColor Red
    }
    else {
        Write-Host " $status (Unexpected)" -ForegroundColor Yellow
    }
    
    Start-Sleep -Milliseconds 150
}

Write-Host "`n=========================================="
Write-Host "  RESULTS"
Write-Host "==========================================`n"

$passed = $true

for ($i = 0; $i -lt $results.Count; $i++) {
    $attempt = $results[$i].Attempt
    $status = $results[$i].Status
    
    if ($attempt -le 5) {
        if ($status -eq 401) {
            Write-Host "[PASS] Attempt $attempt : 401 (Correct)" -ForegroundColor Green
        }
        else {
            Write-Host "[FAIL] Attempt $attempt : Expected 401, got $status" -ForegroundColor Red
            $passed = $false
        }
    }
    else {
        if ($status -eq 429) {
            Write-Host "[PASS] Attempt $attempt : 429 (Rate Limited - Correct)" -ForegroundColor Green
        }
        else {
            Write-Host "[FAIL] Attempt $attempt : Expected 429, got $status" -ForegroundColor Red
            $passed = $false
        }
    }
}

Write-Host "`n=========================================="

if ($passed) {
    Write-Host "[SUCCESS] RATE LIMITING WORKING CORRECTLY" -ForegroundColor Green
    Write-Host "  - First 5 attempts: Unauthorized (401)"
    Write-Host "  - 6th+ attempts: Rate Limited (429)"
    Write-Host "  - Block persists across requests"
} else {
    Write-Host "[FAILED] Rate limiting not working as expected" -ForegroundColor Red
}

Write-Host "==========================================`n"

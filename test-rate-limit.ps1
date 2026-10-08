# Rate Limiting Bot Test Script
# Tests brute force protection on login endpoint

$apiUrl = "http://localhost:4000/api/v1/auth/login"
$testData = @{
    identifier = "bottest@example.com"
    password = "wrongpassword123"
} | ConvertTo-Json

Write-Host ""
Write-Host "=== RATE LIMITING BOT TEST ==="
Write-Host "Testing: $apiUrl"
Write-Host "Expected: First 5 attempts = 401, 6th attempt = 429"
Write-Host ""

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
        Write-Host " Status: $status"
        
        $results += @{
            Attempt = $i
            Status = $status
        }
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        
        if ($status -eq 429) {
            Write-Host " Status: $status (RATE LIMITED)"
        }
        elseif ($status -eq 401) {
            Write-Host " Status: $status (Unauthorized)"
        }
        else {
            Write-Host " Status: $status"
        }
        
        $results += @{
            Attempt = $i
            Status = $status
        }
    }
    
    Start-Sleep -Milliseconds 100
}

Write-Host ""
Write-Host "=== TEST RESULTS ==="

$passed = $true
for ($i = 0; $i -lt $results.Count; $i++) {
    $attempt = $results[$i].Attempt
    $status = $results[$i].Status
    
    if ($attempt -le 5) {
        if ($status -eq 401) {
            Write-Host "[PASS] Attempt $attempt : Correct (401 Unauthorized)"
        }
        else {
            Write-Host "[FAIL] Attempt $attempt : Expected 401, got $status"
            $passed = $false
        }
    }
    else {
        if ($status -eq 429) {
            Write-Host "[PASS] Attempt $attempt : Correct (429 Rate Limited)"
        }
        else {
            Write-Host "[FAIL] Attempt $attempt : Expected 429, got $status"
            $passed = $false
        }
    }
}

Write-Host ""
Write-Host "=== FINAL RESULT ==="
if ($passed) {
    Write-Host "[SUCCESS] RATE LIMITING TEST PASSED"
    Write-Host "All attempts behaved as expected!"
}
else {
    Write-Host "[FAILED] RATE LIMITING TEST FAILED"
    Write-Host "Some attempts did not behave as expected"
}

Write-Host ""

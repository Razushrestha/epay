# Quick Rate Limit Test
$apiUrl = "http://localhost:4000/api/v1/auth/login"
$testData = @{
    identifier = "test@test.com"
    password = "wrong"
} | ConvertTo-Json

Write-Host "Sending 3 quick test requests..."

for ($i = 1; $i -le 3; $i++) {
    Write-Host "Request $i..."
    try {
        Invoke-WebRequest -Uri $apiUrl -Method POST -ContentType "application/json" -Body $testData -UseBasicParsing -ErrorAction SilentlyContinue | Out-Null
    }
    catch {
        Write-Host "  Status: $($_.Exception.Response.StatusCode.value__)"
    }
    Start-Sleep -Milliseconds 200
}

Write-Host "Check the backend console for [Rate Limit] logs"

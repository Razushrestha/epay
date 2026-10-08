# NEXLO PHASE 1 & 2 OPTIMIZATION REVIEW
# Simple version with ASCII-safe characters only

Write-Host "`n=========================================="
Write-Host "  NEXLO OPTIMIZATION REVIEW"
Write-Host "==========================================`n"

$issues = @()
$optimizations = @()

# 1. Syntax Validation
Write-Host "[1/8] Syntax Validation..." -ForegroundColor Yellow

$serverFiles = @(
    "server/index.mjs",
    "server/router.mjs",
    "server/db.mjs",
    "server/identity.mjs",
    "server/catalog.mjs",
    "server/listings.mjs",
    "server/cart.mjs",
    "server/payments.mjs",
    "server/upload.mjs",
    "server/security/rate-limit.mjs"
)

$valid = 0
foreach ($file in $serverFiles) {
    if (Test-Path $file) {
        $null = node -c $file 2>&1
        if ($LASTEXITCODE -eq 0) {
            $valid++
            Write-Host "  [OK] $file" -ForegroundColor Green
        } else {
            $issues += "Syntax error in $file"
            Write-Host "  [ERROR] $file" -ForegroundColor Red
        }
    }
}
Write-Host "  Result: $valid/$($serverFiles.Count) files valid`n"

# 2. Database Migrations
Write-Host "[2/8] Database Migrations..." -ForegroundColor Yellow
$migrations = Get-ChildItem "database/migrations/*.sql" -ErrorAction SilentlyContinue
Write-Host "  Found: $($migrations.Count) migration files"
foreach ($m in $migrations) {
    Write-Host "    - $($m.Name)"
}
Write-Host ""

# 3. Dependencies
Write-Host "[3/8] Critical Dependencies..." -ForegroundColor Yellow
$pkg = Get-Content "package.json" | ConvertFrom-Json
$deps = @("sharp", "pg", "next", "react")
foreach ($d in $deps) {
    if ($pkg.dependencies.$d) {
        Write-Host "  [OK] $d" -ForegroundColor Green
    } else {
        $issues += "Missing: $d"
        Write-Host "  [MISSING] $d" -ForegroundColor Red
    }
}
Write-Host ""

# 4. Directory Structure
Write-Host "[4/8] Directory Structure..." -ForegroundColor Yellow
$dirs = @(".data/uploads", "server/security", "database/migrations")
foreach ($d in $dirs) {
    if (Test-Path $d) {
        Write-Host "  [OK] $d" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $d" -ForegroundColor Yellow
    }
}
Write-Host ""

# 5. Security Features
Write-Host "[5/8] Security Features..." -ForegroundColor Yellow

if (Test-Path "server/security/rate-limit.mjs") {
    Write-Host "  [OK] Rate limiting module" -ForegroundColor Green
} else {
    $issues += "Rate limiting missing"
    Write-Host "  [MISSING] Rate limiting" -ForegroundColor Red
}

if (Test-Path "server/upload.mjs") {
    $content = Get-Content "server/upload.mjs" -Raw
    if ($content -match "exif") {
        Write-Host "  [OK] EXIF stripping configured" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] EXIF stripping unclear" -ForegroundColor Yellow
    }
} else {
    $issues += "Upload module missing"
    Write-Host "  [MISSING] Upload module" -ForegroundColor Red
}
Write-Host ""

# 6. Documentation
Write-Host "[6/8] Documentation..." -ForegroundColor Yellow
$docs = @("README.md", "PROGRESS.md", "CRITICAL-FIXES.md")
$found = 0
foreach ($doc in $docs) {
    if (Test-Path $doc) {
        $found++
        Write-Host "  [OK] $doc" -ForegroundColor Green
    }
}
Write-Host "  Found: $found/$($docs.Count) documentation files`n"

# 7. Performance Config
Write-Host "[7/8] Performance Config..." -ForegroundColor Yellow

if (Test-Path "server/db.mjs") {
    $dbContent = Get-Content "server/db.mjs" -Raw
    if ($dbContent -match "max:") {
        Write-Host "  [OK] Database pooling configured" -ForegroundColor Green
    } else {
        $optimizations += "Configure DB connection pooling"
        Write-Host "  [INFO] DB pooling unclear" -ForegroundColor Yellow
    }
}

if (Test-Path "server/router.mjs") {
    $routerContent = Get-Content "server/router.mjs" -Raw
    if ($routerContent -match "Cache-Control") {
        Write-Host "  [OK] Static file caching configured" -ForegroundColor Green
    } else {
        $optimizations += "Add cache headers"
        Write-Host "  [INFO] Cache headers could be improved" -ForegroundColor Yellow
    }
}
Write-Host ""

# 8. Code Quality
Write-Host "[8/8] Code Quality..." -ForegroundColor Yellow

$todoCount = 0
foreach ($file in $serverFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $todoCount += ([regex]::Matches($content, "TODO|FIXME")).Count
    }
}

if ($todoCount -gt 0) {
    Write-Host "  [INFO] $todoCount TODO/FIXME comments" -ForegroundColor Yellow
} else {
    Write-Host "  [OK] No pending TODOs" -ForegroundColor Green
}
Write-Host ""

# Summary
Write-Host "=========================================="
Write-Host "  SUMMARY"
Write-Host "==========================================`n"

Write-Host "ISSUES: $($issues.Count)" -ForegroundColor $(if ($issues.Count -eq 0) { "Green" } else { "Red" })
foreach ($i in $issues) {
    Write-Host "  - $i" -ForegroundColor Red
}

Write-Host "`nOPTIMIZATIONS: $($optimizations.Count)" -ForegroundColor Cyan
foreach ($o in $optimizations) {
    Write-Host "  - $o" -ForegroundColor Cyan
}

Write-Host ""
if ($issues.Count -eq 0) {
    Write-Host "[SUCCESS] System ready for testing!" -ForegroundColor Green
} else {
    Write-Host "[ACTION NEEDED] Resolve issues above" -ForegroundColor Red
}

Write-Host "`n==========================================`n"

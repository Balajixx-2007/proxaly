# Proxaly - Cloud Launcher (Vercel + Railway)
# Usage: & "E:\ai leads\start.ps1"

Write-Host "Opening Proxaly cloud deployment..." -ForegroundColor Cyan

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$envLocalPath = Join-Path $repoRoot ".env.local"
$vercelProjectPath = Join-Path $repoRoot ".vercel\project.json"

# Set these once in your user environment for best experience:
# [System.Environment]::SetEnvironmentVariable("PROXALY_FRONTEND_URL", "https://<your-vercel-domain>", "User")
# [System.Environment]::SetEnvironmentVariable("PROXALY_BACKEND_URL", "https://<your-railway-domain>", "User")

$frontendUrl = $env:PROXALY_FRONTEND_URL
$backendUrl = $env:PROXALY_BACKEND_URL

if ((-not $frontendUrl) -and (Test-Path $vercelProjectPath)) {
    try {
        $projectJson = Get-Content $vercelProjectPath -Raw | ConvertFrom-Json
        if ($projectJson.projectName) {
            $frontendUrl = "https://$($projectJson.projectName).vercel.app"
        }
    } catch {
        # ignore parse errors
    }
}

if ((-not $backendUrl) -and (Test-Path $envLocalPath)) {
    $apiLine = Get-Content $envLocalPath | Where-Object { $_ -match '^VITE_API_URL=' } | Select-Object -First 1
    if ($apiLine) {
        $apiUrl = ($apiLine -replace '^VITE_API_URL=', '').Trim('"')
        if ($apiUrl -match '/api/?$') {
            $backendUrl = ($apiUrl -replace '/api/?$', '')
        } else {
            $backendUrl = $apiUrl
        }
    }
}

if ($backendUrl) {
    # Normalize legacy/stale backend host variants to current Railway production host.
    $backendUrl = $backendUrl -replace 'https://proxaly\.production\.up\.railway\.app', 'https://proxaly-production.up.railway.app'
    $backendUrl = $backendUrl -replace 'https://proxaly-backend\.railway\.app', 'https://proxaly-production.up.railway.app'
}

Write-Host "" 
if ($frontendUrl) {
    Write-Host "Frontend: $frontendUrl" -ForegroundColor Green
} else {
    Write-Host "Frontend URL not set. Set PROXALY_FRONTEND_URL in user environment." -ForegroundColor Yellow
}

if ($backendUrl) {
    Write-Host "Backend:  $backendUrl" -ForegroundColor Green
} else {
    Write-Host "Backend URL not set. Set PROXALY_BACKEND_URL in user environment." -ForegroundColor Yellow
}
Write-Host ""

if ($backendUrl) {
    $healthCandidates = @(
        "$backendUrl/api/health",
        "$backendUrl/health"
    )

    $healthOk = $false
    foreach ($healthUrl in $healthCandidates) {
        try {
            $resp = Invoke-WebRequest -Uri $healthUrl -Method GET -TimeoutSec 10
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                Write-Host "Backend health check reachable: $healthUrl (HTTP $($resp.StatusCode))" -ForegroundColor Cyan
                $healthOk = $true
                break
            }
        } catch {
            # Try next health endpoint
        }
    }

    if (-not $healthOk) {
        Write-Host "Backend health endpoint not reachable right now." -ForegroundColor Yellow
    }
}

if ($frontendUrl) {
    Start-Process $frontendUrl
    Write-Host "Opened Proxaly cloud URL." -ForegroundColor Green
} else {
    Start-Process "https://vercel.com/dashboard"
    Write-Host "Opened Vercel dashboard. Set PROXALY_FRONTEND_URL for one-click app opening." -ForegroundColor Yellow
}

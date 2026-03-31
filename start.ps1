# Proxaly - Start All Servers
# Usage: & "E:\ai leads\start.ps1"

Write-Host "Starting Proxaly servers..." -ForegroundColor Cyan

# Kill any existing process on port 3001
$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue
if ($port3001) {
    Stop-Process -Id $port3001 -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped existing backend process." -ForegroundColor Gray
}

Start-Sleep -Seconds 1

# Start backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'E:\ai leads\backend'; node index.js"

Start-Sleep -Seconds 2

# Start frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'E:\ai leads\frontend'; npm run dev"

Write-Host ""
Write-Host "Both servers are starting in new windows!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Yellow
Write-Host ""

Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"

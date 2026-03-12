# Business Simulation Platform - Multi-Port Startup Script
# PowerShell version

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Business Simulation Platform - Multi-Port Startup" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check Node.js
Write-Host "[1/3] Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "Node.js: OK ($nodeVersion)`n" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    pause
    exit 1
}

# Check dependencies
Write-Host "[2/3] Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies!" -ForegroundColor Red
        pause
        exit 1
    }
}
Write-Host "Dependencies: OK`n" -ForegroundColor Green

# Start servers
Write-Host "[3/3] Starting all servers...`n" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Admin Server on port 5000..." -ForegroundColor White
Write-Host "Starting Team Servers on ports 3000-3007..." -ForegroundColor White
Write-Host "========================================`n" -ForegroundColor Cyan

# Start admin server
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node server-admin.js" -WindowStyle Normal
Start-Sleep -Seconds 2

# Start team servers
for ($i = 1; $i -le 4; $i++) {
    $port = 2999 + $i
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "node server-team.js $i" -WindowStyle Normal
    Start-Sleep -Seconds 1
}

Start-Sleep -Seconds 2

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "All servers started successfully!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "Portal URLs:" -ForegroundColor Cyan
Write-Host "  Admin Portal:    " -NoNewline; Write-Host "http://localhost:5000" -ForegroundColor Yellow
Write-Host "  Team 1 Portal:   " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Yellow
Write-Host "  Team 2 Portal:   " -NoNewline; Write-Host "http://localhost:3001" -ForegroundColor Yellow
Write-Host "  Team 3 Portal:   " -NoNewline; Write-Host "http://localhost:3002" -ForegroundColor Yellow
Write-Host "  Team 4 Portal:   " -NoNewline; Write-Host "http://localhost:3003" -ForegroundColor Yellow
Write-Host "  Team 5 Portal:   " -NoNewline; Write-Host "http://localhost:3004" -ForegroundColor Yellow
Write-Host "  Team 6 Portal:   " -NoNewline; Write-Host "http://localhost:3005" -ForegroundColor Yellow
Write-Host "  Team 7 Portal:   " -NoNewline; Write-Host "http://localhost:3006" -ForegroundColor Yellow
Write-Host "  Team 8 Portal:   " -NoNewline; Write-Host "http://localhost:3007" -ForegroundColor Yellow

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Default Credentials:" -ForegroundColor White
Write-Host "  Admin: admin / admin123" -ForegroundColor White
Write-Host "  Teams: team1-8 / password" -ForegroundColor White
Write-Host "`nTo stop servers, close each PowerShell window." -ForegroundColor Gray
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Press any key to close this launcher..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Business Simulation Platform - Stop All Servers
# PowerShell script to stop all running simulation servers

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Stopping All Simulation Servers" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Find and stop all node processes running the servers
$adminProcess = Get-Process | Where-Object { $_.ProcessName -eq 'node' -or $_.ProcessName -eq 'powershell' } | Where-Object { $_.MainWindowTitle -like "*Admin Server*" }
$teamProcesses = Get-Process | Where-Object { $_.ProcessName -eq 'node' -or $_.ProcessName -eq 'powershell' } | Where-Object { $_.MainWindowTitle -like "*Team * Server*" }

# Stop processes by port
Write-Host "Stopping servers on ports 5000 and 3000-3007...`n" -ForegroundColor Yellow

# Admin server (port 5000)
$adminPort = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
if ($adminPort) {
    $adminPID = $adminPort.OwningProcess | Select-Object -Unique
    foreach ($pid in $adminPID) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped admin server (Port 5000, PID: $pid)" -ForegroundColor Green
    }
}

# Team servers (ports 3000-3007)
for ($port = 3000; $port -le 3007; $port++) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        $pids = $connection.OwningProcess | Select-Object -Unique
        foreach ($pid in $pids) {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            $teamNum = $port - 2999
            Write-Host "Stopped Team $teamNum server (Port $port, PID: $pid)" -ForegroundColor Green
        }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "All servers stopped successfully!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Start-Sleep -Seconds 2

@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Business Simulation Platform - Multi-Port Startup
echo ========================================
echo.

echo [1/3] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js: OK
echo.

echo [2/3] Checking dependencies...
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
)
echo Dependencies: OK
echo.

echo [3/3] Starting all servers...
echo.
echo ========================================
echo Starting Admin Server on port 5000...
echo Starting Team Servers on ports 3000-3007...
echo ========================================
echo.

REM Start admin server
start "Admin Server (Port 5000)" cmd /k "node server-admin.js"
timeout /t 2 /nobreak >nul

REM Start team servers
for /L %%i in (1,1,8) do (
    start "Team %%i Server (Port 300%%i)" cmd /k "node server-team.js %%i"
    timeout /t 1 /nobreak >nul
)

echo.
echo ========================================
echo All servers started successfully!
echo ========================================
echo.
echo Admin Portal:    http://localhost:5000
echo Team 1 Portal:   http://localhost:3000
echo Team 2 Portal:   http://localhost:3001
echo Team 3 Portal:   http://localhost:3002
echo Team 4 Portal:   http://localhost:3003
echo Team 5 Portal:   http://localhost:3004
echo Team 6 Portal:   http://localhost:3005
echo Team 7 Portal:   http://localhost:3006
echo Team 8 Portal:   http://localhost:3007
echo.
echo ========================================
echo Default Credentials:
echo   Admin: admin / admin123
echo   Teams: team1-8 / password
echo.
echo Press any key to close this window...
echo To stop servers, close each server window.
echo ========================================
pause >nul

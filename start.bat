@echo off
title WiFi Network System - Update 5
cd /d "%~dp0"

echo ================================================
echo  WiFi Network System - Update 5 (SSH Mode)
echo ================================================
echo.

REM [1/4] Install backend dependencies (first run only)
if not exist "backend\node_modules" (
    echo [1/4] Installing backend dependencies, please wait...
    pushd backend
    call npm install
    popd
) else (
    echo [1/4] Backend dependencies OK
)

REM [1b/4] Install SSH support for MikroTik SSH mode (one time)
if not exist "backend\node_modules\ssh2" (
    echo [1b/4] Installing SSH support, please wait...
    pushd backend
    call npm install
    popd
) else (
    echo [1b/4] SSH support OK
)

REM [2/4] Update database schema (safe to run every time)
echo [2/4] Updating database...
pushd backend
call npm run migrate
popd

REM [3/4] Start backend server (port 3000) in its own window
echo [3/4] Starting server...
start "WiFi Backend Server" "%~dp0run-backend.bat"

REM [4/4] Build web UI once if not built yet, then open browser
if not exist "web\dist\index.html" (
    echo [4/4] Building web UI, first time only, a few minutes...
    pushd web
    call npm install
    call npm run build
    popd
) else (
    echo [4/4] Web UI OK
)

echo.
echo Waiting for the server to start...
timeout /t 6 /nobreak >nul
start http://localhost:3000

echo.
echo Done! If the page did not open, browse to: http://localhost:3000
echo Login with your usual admin account.
echo To stop the system: close the "WiFi Backend Server" window.
echo.
pause

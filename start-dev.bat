@echo off
title WiFi Network System - Dev Mode
cd /d "%~dp0"

echo ================================================
echo  WiFi Network System - Dev Mode (Vite 5173)
echo ================================================
echo.

if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    pushd backend
    call npm install
    popd
)

echo Updating database...
pushd backend
call npm run migrate
popd

start "WiFi Backend Server" "%~dp0run-backend.bat"
start "WiFi Web Dev Server" "%~dp0run-frontend-dev.bat"

echo Waiting for servers...
timeout /t 6 /nobreak >nul
start http://localhost:5173

echo.
echo Frontend: http://localhost:5173   (Backend API: http://localhost:3000)
echo To stop: close both server windows.
echo.
pause

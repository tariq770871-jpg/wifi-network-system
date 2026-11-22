@echo off
title WiFi Web Dev Server
cd /d "%~dp0web"
if not exist "node_modules" (
    echo Installing web dependencies, please wait...
    call npm install
)
echo Starting web dev server on port 5173 ...
echo.
call npm run dev
echo.
echo The dev server stopped. Press any key to close this window.
pause >nul

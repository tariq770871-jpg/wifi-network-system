@echo off
title WiFi Backend Server
cd /d "%~dp0backend"
echo Starting backend on port 3000 ...
echo Keep this window open while using the system.
echo.
call npm start
echo.
echo The server stopped. Press any key to close this window.
pause >nul

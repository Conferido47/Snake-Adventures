@echo off
setlocal
title Snake Adventures - Live Player Database

cd /d "%~dp0DiscordActivity"
if errorlevel 1 goto :project_missing

where node >nul 2>&1
if errorlevel 1 goto :node_missing

if not exist "node_modules\wrangler\bin\wrangler.js" (
  echo Installing the dashboard requirements...
  where npm >nul 2>&1
  if errorlevel 1 goto :node_missing
  call npm install
  if errorlevel 1 goto :install_failed
)

node "scripts\live-player-dashboard.mjs"
if errorlevel 1 goto :dashboard_failed
exit /b 0

:project_missing
echo Could not find the DiscordActivity folder next to this file.
goto :failed

:node_missing
echo Node.js is required. Install Node.js 22.12 or newer, then open this file again.
goto :failed

:install_failed
echo The dashboard requirements could not be installed.
goto :failed

:dashboard_failed
echo The live player database stopped because of an error.

:failed
echo.
pause
exit /b 1

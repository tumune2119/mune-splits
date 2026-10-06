@echo off
setlocal
title MUNE Splits
cd /d "%~dp0"

set "PORT=5174"
set "URL=http://127.0.0.1:%PORT%"

where node >nul 2>nul
if errorlevel 1 (
  echo [MUNE Splits] Node.js was not found. Install the LTS version from https://nodejs.org and try again.
  pause
  exit /b 1
)

rem Double-click this file, or use the desktop shortcut (launch-mune-splits.vbs) to run without a console.

rem Already running? Just open another window.
node scripts\launcher-check.mjs running "%URL%"
if not errorlevel 1 (
  echo [MUNE Splits] Already running - opening the app.
  call :open
  exit /b 0
)

rem First run (or package-lock.json changed): install dependencies.
node scripts\launcher-check.mjs install
if not errorlevel 1 (
  echo [MUNE Splits] Installing dependencies, this takes a minute the first time...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :fail
  node scripts\launcher-check.mjs mark-installed
)

rem No build yet, or the source changed since the last one: build.
node scripts\launcher-check.mjs build
if not errorlevel 1 (
  echo [MUNE Splits] Building...
  call npm run build
  if errorlevel 1 goto :fail
)

call :open
echo.
echo [MUNE Splits] Running at %URL%
echo [MUNE Splits] It stops by itself when you close the MUNE Splits window (or click Quit).
echo.
rem The server watches its app windows and exits when the last one closes (src/lib/app-lifetime.ts).
set "MUNE_SPLITS_AUTO_EXIT=1"
call npx next start -p %PORT% -H 127.0.0.1
exit /b %errorlevel%

:open
if "%MUNE_SPLITS_NO_BROWSER%"=="1" exit /b 0
start "" powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\open-app.ps1" -Url "%URL%"
exit /b 0

:fail
echo.
echo [MUNE Splits] Something went wrong - see the messages above.
pause
exit /b 1

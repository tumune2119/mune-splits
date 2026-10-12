@echo off
title Install MUNE Splits
rem Installs MUNE Splits for this Windows user (no admin needed). See install.ps1 for what it does.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed - see the message above.
  pause
)

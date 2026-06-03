@echo off
setlocal

cd /d "%~dp0"

set "ROOT=%CD%\dist"
if not exist "%ROOT%\index.html" set "ROOT=%CD%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\local-preview.ps1" -Root "%ROOT%" -Port 4173


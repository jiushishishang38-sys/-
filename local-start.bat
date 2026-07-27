@echo off
setlocal

cd /d "%~dp0"

set "ROOT=%CD%\project\dist"
if not exist "%ROOT%\index.html" set "ROOT=%CD%\project"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0project\scripts\dev\local-preview.ps1" -Root "%ROOT%" -Port 4173

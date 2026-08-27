@echo off
setlocal
cd /d "%~dp0.."

:restart
D:\node.exe scripts\railway-ai-bridge.mjs >> "%LOCALAPPDATA%\chengzi-handout-company-bridge.log" 2>&1
timeout /t 10 /nobreak >nul
goto restart

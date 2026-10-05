@echo off
cd /d "%~dp0"
if not exist logs mkdir logs
node render_all.mjs %*

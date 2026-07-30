@echo off
chcp 65001 >nul
echo ========================================
echo   王者曝光台 - 单文件 SPA 打包工具
echo ========================================
echo.
echo 正在启动打包程序...
powershell -ExecutionPolicy Bypass -File "%~dp0build.ps1"
echo.
pause

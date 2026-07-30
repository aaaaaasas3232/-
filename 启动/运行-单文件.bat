@echo off
chcp 65001 >nul

echo.
echo ============================================================
echo   打开 小听启动 (单文件版)
echo ============================================================
echo.

cd /d "%~dp0\.."

if not exist "dist-single\index.html" (
    echo [提示] 还没打包过,先帮你自动打包一次 ...
    echo.
    call "%~dp0打包-单文件.bat"
    if errorlevel 1 exit /b 1
)

echo.
echo 正在用默认浏览器打开 dist-single\index.html ...
start "" "dist-single\index.html"
echo.
echo 已启动,关闭这个窗口不影响页面运行
echo.
timeout /t 3 >nul
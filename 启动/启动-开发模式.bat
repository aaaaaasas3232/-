@echo off
chcp 65001 >nul

echo.
echo ============================================================
echo   小听启动  启动开发模式 (带热更新)
echo ============================================================
echo.
echo 启动后浏览器会自动打开 http://localhost:5173
echo 改代码会自动刷新,适合开发阶段使用
echo 关掉这个窗口 = 停止服务
echo.

cd /d "%~dp0\.."

if not exist "node_modules" (
    echo [提示] 还没装依赖,先安装一下 ...
    call npm install
    if errorlevel 1 (
        echo [错误] npm install 失败
        pause
        exit /b 1
    )
)

echo.
echo 正在启动 vite dev server ...
echo.
call npx vite --host
pause
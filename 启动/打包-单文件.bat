@echo off
chcp 65001 >nul
setlocal

echo.
echo ============================================================
echo   小听启动  单文件打包 (Vite)
echo   把整个项目打包成一个 dist-single\index.html
echo ============================================================
echo.

cd /d "%~dp0\.."

echo [1/3] 检查 node_modules ...
if not exist "node_modules" (
    echo     第一次打包,需要先安装依赖,可能需要几分钟
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [错误] npm install 失败,请检查网络或 node 版本
        pause
        exit /b 1
    )
)

echo.
echo [2/3] 清理旧的 dist-single ...
if exist "dist-single" rmdir /s /q "dist-single"

echo.
echo [3/3] 开始打包,请稍等 ...
echo.
call npx vite build --config vite.config.single.js
if errorlevel 1 (
    echo.
    echo [错误] 打包失败,请把上面红色错误信息截图给开发者
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   打包完成！
echo   输出文件: dist-single\index.html
echo   双击它就能在浏览器里直接打开运行
echo ============================================================
echo.
pause
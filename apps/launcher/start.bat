@echo off
chcp 65001 >nul
title 探理实验室 · 本地启动器
cd /d "%~dp0"

echo.
echo   探理实验室
echo   ----------------------------------------
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   x 找不到 Node.js
  echo.
  echo     这个启动器需要 Node.js 18 以上。装一下：
  echo       https://nodejs.org  （下载 LTS 版本，一路下一步就行）
  echo.
  echo     装完关掉这个窗口，再双击一次。
  echo.
  pause
  exit /b 1
)

if not exist "..\web\dist\index.html" (
  echo   ! 还没构建网页，正在构建（第一次会慢一点）...
  echo.
  pushd ..\web
  call npm install --silent
  call npm run build
  popd
)

node src\server.mjs

echo.
pause

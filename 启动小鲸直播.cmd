@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo 请先安装 Node.js 22 或更新版本，然后重新打开此文件。
 pause
 exit /b 1
)
if not exist "node_modules\playwright\package.json" (
 echo 正在安装首次运行所需依赖...
 call npm ci --registry=https://registry.npmjs.org
 if errorlevel 1 (
  echo 安装失败，请检查网络后重试。
  pause
  exit /b 1
 )
)
node server.js --open
pause

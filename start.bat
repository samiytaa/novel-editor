@echo off
pushd %~dp0
set NODE_ENV=development
set DISABLE_HMR=false

call npm install --no-save --no-audit --no-fund --loglevel=error --no-progress
if errorlevel 1 goto error

call npm run dev -- --port 48327 --open %*
if errorlevel 1 goto error

goto end

:error
echo.
echo Startup failed. Please check the logs above.

:end
pause
popd

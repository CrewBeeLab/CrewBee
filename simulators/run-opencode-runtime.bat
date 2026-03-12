@echo off
setlocal

set SCRIPT_DIR=%~dp0
pushd "%SCRIPT_DIR%.."

if "%~1"=="" (
  call npm.cmd run simulate:opencode
) else (
  call npm.cmd run simulate:opencode -- %*
)
set EXIT_CODE=%ERRORLEVEL%

popd
exit /b %EXIT_CODE%

@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%.."

if "%~1"=="" (
  call node .\scripts\release-registry.mjs --dryRun
) else (
  call node .\scripts\release-registry.mjs %*
)
set EXIT_CODE=%ERRORLEVEL%

popd
exit /b %EXIT_CODE%

@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "REPO_ROOT=%%~fI"

echo.
echo === CrewBee local build ^& user-level install ===
echo Repo root: %REPO_ROOT%
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found in PATH.
  echo Please install Node.js and npm first, then rerun this script.
  exit /b 1
)

pushd "%REPO_ROOT%" >nul
if errorlevel 1 (
  echo [ERROR] Failed to enter repository root: %REPO_ROOT%
  exit /b 1
)

echo [1/3] Installing dependencies...
call npm install
if errorlevel 1 goto :fail

echo.
echo [2/3] Building and installing CrewBee into the OpenCode user-level workspace...
call npm run install:local:user
if errorlevel 1 goto :fail

echo.
echo [3/3] Running installation doctor check...
call npm run doctor
if errorlevel 1 goto :fail

echo.
echo [SUCCESS] CrewBee local user-level installation completed.
echo You can now open OpenCode and select a CrewBee agent such as [CodingTeam]leader.
popd >nul
exit /b 0

:fail
echo.
echo [ERROR] Installation failed. See logs above.
popd >nul
exit /b 1

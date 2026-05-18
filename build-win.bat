@echo off
:: ============================================================================
:: Lectura — Build Windows Installer
:: Usage: build-win.bat
:: Output: dist\Lectura-*-win-*-installer.exe
:: ============================================================================
setlocal enabledelayedexpansion

set CYAN=[92m
set GREEN=[32m
set RED=[31m
set NC=[0m

echo [*] Checking dependencies...

where python3 >nul 2>&1 || where python >nul 2>&1 || (
    echo [-] Python 3 is required.
    exit /b 1
)

where npm >nul 2>&1 || (
    echo [-] npm is required.
    exit /b 1
)

:: Bundle Python venv
echo [*] Bundling Python venv...
if not exist "venv\Scripts\activate.bat" (
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -q -r requirements.txt
    call deactivate
)
if exist "bundled-venv" rmdir /s /q "bundled-venv"
xcopy /e /i /q venv bundled-venv\ >nul
echo [+] Python venv bundled

:: npm install
echo [*] Installing dependencies...
call npm install --no-audit --no-fund --loglevel=error

:: Build
echo [*] Building Windows installer...
call npm run build-win

echo [+] Build complete:
dir /b dist\Lectura-*.exe 2>nul

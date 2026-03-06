@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Lectura Installer for Windows
:: Installs as a standalone Electron desktop app with isolated Python venv
:: ============================================================================

set "APP_NAME=Lectura"
set "APP_VERSION=2.0.0"
set "INSTALL_DIR=%LOCALAPPDATA%\Lectura"
set "SHORTCUT_NAME=Lectura"

echo.
echo ================================================
echo        Lectura Installer for Windows v%APP_VERSION%
echo ================================================
echo.

:: ── Check for Admin (optional, not required) ────────────────────────────────
:: Running as user is fine — installs to %LOCALAPPDATA%

:: ── Check Python ────────────────────────────────────────────────────────────
echo [*] Checking dependencies...

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [-] Python 3 is required but not found in PATH.
    echo     Download from: https://python.org/downloads/
    echo     IMPORTANT: Check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"') do set PYTHON_VER=%%i
echo [+] Python %PYTHON_VER% found

:: ── Check Node.js ───────────────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [-] Node.js is required for the desktop app.
    echo     Download from: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [+] Node.js %NODE_VER% found

:: ── Check npm ───────────────────────────────────────────────────────────────
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [-] npm is required but not found.
    echo     It should come with Node.js. Try reinstalling Node.js.
    pause
    exit /b 1
)

echo [+] npm found

:: ── Install files ───────────────────────────────────────────────────────────
echo.
echo [*] Installing to: %INSTALL_DIR%

if exist "%INSTALL_DIR%" (
    echo [!] Existing installation found, updating...
    rmdir /s /q "%INSTALL_DIR%"
)

mkdir "%INSTALL_DIR%"

set "SOURCE_DIR=%~dp0"

echo [*] Copying files...

:: Core app files
copy "%SOURCE_DIR%main.py" "%INSTALL_DIR%\" >nul
copy "%SOURCE_DIR%electron-main.js" "%INSTALL_DIR%\" >nul
copy "%SOURCE_DIR%preload.js" "%INSTALL_DIR%\" >nul
copy "%SOURCE_DIR%package.json" "%INSTALL_DIR%\" >nul
copy "%SOURCE_DIR%requirements.txt" "%INSTALL_DIR%\" >nul

:: Static assets
xcopy "%SOURCE_DIR%static" "%INSTALL_DIR%\static\" /e /i /q >nul
xcopy "%SOURCE_DIR%build" "%INSTALL_DIR%\build\" /e /i /q >nul

:: Config and secrets (if they exist)
if exist "%SOURCE_DIR%config.json" copy "%SOURCE_DIR%config.json" "%INSTALL_DIR%\" >nul
if exist "%SOURCE_DIR%github_secrets.json" copy "%SOURCE_DIR%github_secrets.json" "%INSTALL_DIR%\" >nul
if exist "%SOURCE_DIR%dropbox_secrets.json" copy "%SOURCE_DIR%dropbox_secrets.json" "%INSTALL_DIR%\" >nul
if exist "%SOURCE_DIR%gdrive_secrets.json" copy "%SOURCE_DIR%gdrive_secrets.json" "%INSTALL_DIR%\" >nul

:: Create notes directory
mkdir "%INSTALL_DIR%\notes" 2>nul

echo [+] Files copied

:: ── Setup Python venv ───────────────────────────────────────────────────────
echo [*] Setting up Python virtual environment...
cd /d "%INSTALL_DIR%"
python -m venv venv
call venv\Scripts\activate.bat
pip install -q --upgrade pip
pip install -q -r requirements.txt
call deactivate
echo [+] Python dependencies installed

:: ── Install Node dependencies ───────────────────────────────────────────────
echo [*] Installing Electron dependencies...
cd /d "%INSTALL_DIR%"
call npm install --silent 2>nul
echo [+] Electron installed

:: ── Create launcher script ──────────────────────────────────────────────────
echo [*] Creating launcher...

:: Create a proper executable launcher
(
echo @echo off
echo cd /d "%INSTALL_DIR%"
echo call venv\Scripts\activate.bat
echo start "" /min npm start
echo exit
) > "%INSTALL_DIR%\Lectura.bat"

:: Create a VBS script to run without console window
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.Run chr^(34^) ^& "%INSTALL_DIR%\Lectura.bat" ^& Chr^(34^), 0
echo Set WshShell = Nothing
) > "%INSTALL_DIR%\Lectura.vbs"

echo [+] Launcher created

:: ── Create Desktop shortcut ─────────────────────────────────────────────────
echo [*] Creating shortcuts...

set "DESKTOP=%USERPROFILE%\Desktop"
set "STARTMENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"

:: Use PowerShell to create .lnk shortcuts pointing to VBS (no console window)
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $s = $ws.CreateShortcut('%DESKTOP%\%SHORTCUT_NAME%.lnk'); ^
   $s.TargetPath = 'wscript.exe'; ^
   $s.Arguments = '\"%INSTALL_DIR%\Lectura.vbs\"'; ^
   $s.WorkingDirectory = '%INSTALL_DIR%'; ^
   $s.IconLocation = '%INSTALL_DIR%\build\icon.ico'; ^
   $s.Description = 'Lectura - Markdown Note-Taking App'; ^
   $s.Save()"

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $s = $ws.CreateShortcut('%STARTMENU%\%SHORTCUT_NAME%.lnk'); ^
   $s.TargetPath = 'wscript.exe'; ^
   $s.Arguments = '\"%INSTALL_DIR%\Lectura.vbs\"'; ^
   $s.WorkingDirectory = '%INSTALL_DIR%'; ^
   $s.IconLocation = '%INSTALL_DIR%\build\icon.ico'; ^
   $s.Description = 'Lectura - Markdown Note-Taking App'; ^
   $s.Save()"

echo [+] Desktop and Start Menu shortcuts created

:: ── Summary ─────────────────────────────────────────────────────────────────
echo.
echo ================================================
echo          Installation complete!
echo ================================================
echo.
echo   Launch:    Double-click "Lectura" on your Desktop
echo              Or find "Lectura" in Start Menu
echo.
echo   Uninstall:
echo     1. Delete: %INSTALL_DIR%
echo     2. Delete: Desktop shortcut
echo     3. Delete: Start Menu shortcut
echo.

pause

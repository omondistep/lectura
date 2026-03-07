@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Lectura Standalone Installer for Windows
:: Installs as a browser-based app with Python backend
:: ============================================================================

set "APP_NAME=Lectura"
set "APP_VERSION=1.0.0"
set "INSTALL_DIR=%LOCALAPPDATA%\Lectura"
set "SHORTCUT_NAME=Lectura"

echo.
echo ================================================
echo    Lectura Standalone Installer for Windows v%APP_VERSION%
echo ================================================
echo.

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
copy "%SOURCE_DIR%requirements.txt" "%INSTALL_DIR%\" >nul

:: Static assets
xcopy "%SOURCE_DIR%static" "%INSTALL_DIR%\static\" /e /i /q >nul

:: Config and secrets (if they exist)
if exist "%SOURCE_DIR%config.json" copy "%SOURCE_DIR%config.json" "%INSTALL_DIR%\" >nul
if exist "%SOURCE_DIR%github_secrets.json" copy "%SOURCE_DIR%github_secrets.json" "%INSTALL_DIR%\" >nul
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

:: ── Create launcher scripts ─────────────────────────────────────────────────
echo [*] Creating launcher...

:: Create batch launcher — uses pythonw to avoid console window
(
echo @echo off
echo cd /d "%INSTALL_DIR%"
echo call venv\Scripts\activate.bat
echo start "" "http://127.0.0.1:8000"
echo pythonw main.py
) > "%INSTALL_DIR%\Lectura.bat"

echo [+] Launcher created

:: ── Create Desktop shortcut ─────────────────────────────────────────────────
echo [*] Creating shortcuts...

set "DESKTOP=%USERPROFILE%\Desktop"
set "STARTMENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"

:: Copy icon if build directory exists
if exist "%SOURCE_DIR%build\icon.ico" (
    copy "%SOURCE_DIR%build\icon.ico" "%INSTALL_DIR%\" >nul
    set "ICON_PATH=%INSTALL_DIR%\icon.ico"
) else (
    set "ICON_PATH="
)

:: Use PowerShell to create .lnk shortcuts pointing directly to bat file
:: WindowStyle 7 = minimized (hides the brief cmd window)
if defined ICON_PATH (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$ws = New-Object -ComObject WScript.Shell;" ^
      "$s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\%SHORTCUT_NAME%.lnk');" ^
      "$s.TargetPath = 'cmd.exe';" ^
      "$s.Arguments = '/c \"%INSTALL_DIR%\Lectura.bat\"';" ^
      "$s.WorkingDirectory = '%INSTALL_DIR%';" ^
      "$s.IconLocation = '%ICON_PATH%';" ^
      "$s.WindowStyle = 7;" ^
      "$s.Description = 'Lectura - Markdown Note-Taking App';" ^
      "$s.Save()"

    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$ws = New-Object -ComObject WScript.Shell;" ^
      "$s = $ws.CreateShortcut([Environment]::GetFolderPath('Programs') + '\%SHORTCUT_NAME%.lnk');" ^
      "$s.TargetPath = 'cmd.exe';" ^
      "$s.Arguments = '/c \"%INSTALL_DIR%\Lectura.bat\"';" ^
      "$s.WorkingDirectory = '%INSTALL_DIR%';" ^
      "$s.IconLocation = '%ICON_PATH%';" ^
      "$s.WindowStyle = 7;" ^
      "$s.Description = 'Lectura - Markdown Note-Taking App';" ^
      "$s.Save()"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$ws = New-Object -ComObject WScript.Shell;" ^
      "$s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\%SHORTCUT_NAME%.lnk');" ^
      "$s.TargetPath = 'cmd.exe';" ^
      "$s.Arguments = '/c \"%INSTALL_DIR%\Lectura.bat\"';" ^
      "$s.WorkingDirectory = '%INSTALL_DIR%';" ^
      "$s.WindowStyle = 7;" ^
      "$s.Description = 'Lectura - Markdown Note-Taking App';" ^
      "$s.Save()"

    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$ws = New-Object -ComObject WScript.Shell;" ^
      "$s = $ws.CreateShortcut([Environment]::GetFolderPath('Programs') + '\%SHORTCUT_NAME%.lnk');" ^
      "$s.TargetPath = 'cmd.exe';" ^
      "$s.Arguments = '/c \"%INSTALL_DIR%\Lectura.bat\"';" ^
      "$s.WorkingDirectory = '%INSTALL_DIR%';" ^
      "$s.WindowStyle = 7;" ^
      "$s.Description = 'Lectura - Markdown Note-Taking App';" ^
      "$s.Save()"
)

echo [+] Desktop and Start Menu shortcuts created

:: ── Summary ─────────────────────────────────────────────────────────────────
echo.
echo ================================================
echo          Installation complete!
echo ================================================
echo.
echo   Launch:    Double-click "Lectura" on your Desktop
echo              Or find "Lectura" in Start Menu
echo              Or visit: http://127.0.0.1:8000
echo.
echo   Uninstall:
echo     1. Delete: %INSTALL_DIR%
echo     2. Delete: Desktop shortcut
echo     3. Delete: Start Menu shortcut
echo.

pause

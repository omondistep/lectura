@echo off
:: Lectura Electron Uninstaller for Windows

set "INSTALL_DIR=%LOCALAPPDATA%\Lectura"
set "DESKTOP=%USERPROFILE%\Desktop"
set "STARTMENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"

echo Uninstalling Lectura Electron...
echo.

:: Stop running instances
taskkill /F /IM electron.exe /FI "WINDOWTITLE eq Lectura*" >nul 2>&1

:: Remove installation
if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%"
    echo [+] Removed %INSTALL_DIR%
)

:: Remove shortcuts
if exist "%DESKTOP%\Lectura.lnk" (
    del /q "%DESKTOP%\Lectura.lnk"
    echo [+] Removed Desktop shortcut
)

if exist "%STARTMENU%\Lectura.lnk" (
    del /q "%STARTMENU%\Lectura.lnk"
    echo [+] Removed Start Menu shortcut
)

:: Clear caches
if exist "%LOCALAPPDATA%\lectura" (
    rmdir /s /q "%LOCALAPPDATA%\lectura"
    echo [+] Cleared cache
)

if exist "%APPDATA%\lectura" (
    rmdir /s /q "%APPDATA%\lectura"
    echo [+] Cleared app data
)

echo.
echo Lectura has been completely uninstalled.
echo.
pause

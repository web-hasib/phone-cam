@echo off
echo ============================================
echo   PhoneCam Virtual Camera - Driver Uninstall
echo ============================================
echo.
echo Removing PhoneCam Virtual Camera driver...

regsvr32 /u /s "%~dp0softcam.dll"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] PhoneCam Virtual Camera driver has been removed.
) else (
    echo.
    echo [ERROR] Uninstall failed. Make sure you are running as Administrator.
)

echo.
pause

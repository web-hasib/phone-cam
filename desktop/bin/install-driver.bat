@echo off
echo ============================================
echo   PhoneCam Virtual Camera - Driver Install
echo ============================================
echo.
echo Registering PhoneCam Virtual Camera driver...
echo This requires Administrator privileges.
echo.

regsvr32 /s "%~dp0softcam.dll"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] PhoneCam Virtual Camera is now registered!
    echo It will appear as "Softcam" in camera device lists.
    echo.
    echo You can now use it in:
    echo   - Windows Camera App
    echo   - Google Meet
    echo   - Zoom
    echo   - Discord
    echo   - Any app that uses webcam
) else (
    echo.
    echo [ERROR] Registration failed (Code: %ERRORLEVEL%).
    echo.
    echo Make sure you are running this as Administrator.
    echo Right-click this file and select "Run as administrator".
)

echo.
pause

@echo off
echo ========================================================
echo   PhoneCam - Fix Windows Camera App (Disable Ghost iVCam)
echo ========================================================
echo.
echo Windows Camera App is currently trying to connect to the 
echo old e2eSoft iVCam driver, causing error 0xA00F4243.
echo.
echo Disabling ghost iVCam device...
echo.

powershell -Command "Get-PnpDevice -FriendlyName '*iVCam*' -ErrorAction SilentlyContinue | Disable-PnpDevice -Confirm:$false -ErrorAction SilentlyContinue"

echo.
echo [SUCCESS] Ghost iVCam driver disabled.
echo Windows Camera App will now connect directly to Softcam!
echo.
pause

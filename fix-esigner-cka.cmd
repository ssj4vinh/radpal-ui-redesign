@echo off
echo Fixing eSigner CKA for code signing...
echo.

REM Stop eSigner CKA service
echo Stopping eSigner CKA service...
net stop "eSigner CKA" 2>nul

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start eSigner CKA service
echo Starting eSigner CKA service...
net start "eSigner CKA"

REM Wait for service to fully start
timeout /t 5 /nobreak >nul

REM Check certificate
echo.
echo Checking certificate in store...
certutil -user -store My "RADPAL LLC"

echo.
echo Testing signing with a dummy file...
echo test > test.txt
signtool sign /n "RADPAL LLC" /tr http://ts.ssl.com /td sha256 /fd sha256 /v test.txt

if %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS! Signing works. You can now run: npm run build
    del test.txt
) else (
    echo.
    echo FAILED! Please try:
    echo 1. Open eSigner CKA from system tray
    echo 2. Log out and log back in
    echo 3. Make sure 2FA is completed
    echo 4. Try this script again
)

pause
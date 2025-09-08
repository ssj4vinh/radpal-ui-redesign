@echo off
echo Building RadPal without code signing...
echo.

REM Set environment variable to skip signing
set CSC_IDENTITY_AUTO_DISCOVERY=false

REM Build without signing
npm run build

echo.
echo Build complete! Now sign manually...
echo.

REM Sign the exe manually
echo Signing RadPal.exe...
signtool sign /n "RADPAL LLC" /tr http://ts.ssl.com /td sha256 /fd sha256 /v "dist\win-unpacked\RadPal.exe"

echo.
echo Building installer...
cd dist\win-unpacked
"..\..\node_modules\electron-builder\out\cli\cli.js" --win nsis --prepackaged .

echo.
echo Signing installer...
signtool sign /n "RADPAL LLC" /tr http://ts.ssl.com /td sha256 /fd sha256 /v "..\RadPal Setup *.exe"

echo.
echo Done! Check dist folder for signed installer.
pause
@echo off
echo Removing old incompatible binary...

:: Delete the old Linux/WSL binary that won't run on Windows
if exist "llama.cpp\build\bin\llama-server.exe" (
    echo Deleting old binary: llama.cpp\build\bin\llama-server.exe
    del /f "llama.cpp\build\bin\llama-server.exe"
    echo Done! Old binary removed.
) else (
    echo No old binary found.
)

:: Also delete any DLLs in that folder
if exist "llama.cpp\build\bin\*.dll" (
    echo Cleaning up old DLLs...
    del /f "llama.cpp\build\bin\*.dll"
)

echo.
echo Cleanup complete! Now run "npm run electron" again.
echo The app will use the bundled Windows binary.
pause
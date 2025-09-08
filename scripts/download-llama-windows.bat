@echo off
echo Downloading pre-built llama.cpp for Windows...

:: Create directories
if not exist llama.cpp mkdir llama.cpp
if not exist llama.cpp\build mkdir llama.cpp\build
if not exist llama.cpp\build\bin mkdir llama.cpp\build\bin
if not exist models mkdir models

:: Download pre-built llama.cpp release
echo.
echo Downloading llama.cpp server...
curl -L https://github.com/ggerganov/llama.cpp/releases/latest/download/llama-server.exe -o llama.cpp\build\bin\llama-server.exe

if %ERRORLEVEL% NEQ 0 (
    echo Failed to download llama.cpp server
    pause
    exit /b 1
)

echo.
echo ✓ llama.cpp server downloaded successfully!
echo.
echo The server will start automatically when you launch RadPal.
echo.
pause
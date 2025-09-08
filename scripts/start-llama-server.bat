@echo off
echo ==========================================
echo RadPal Local AI Server
echo ==========================================
echo.

REM Get the script directory and RadPal root
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%.."
set RADPAL_ROOT=%CD%

REM Set paths
set SERVER_EXE=%RADPAL_ROOT%\llama.cpp\build\bin\Release\server.exe
set MODEL_FILE=%RADPAL_ROOT%\models\mistral-7b-instruct-q4_k_m.gguf

REM Check if server exists
if not exist "%SERVER_EXE%" (
    echo ERROR: Server not found at %SERVER_EXE%
    echo.
    echo Please run setup-llama-local.bat first
    pause
    exit /b 1
)

REM Check if model exists
if not exist "%MODEL_FILE%" (
    echo ERROR: Model not found at %MODEL_FILE%
    echo.
    echo Please download the model:
    echo 1. Go to: https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF
    echo 2. Download: mistral-7b-instruct-v0.2.Q4_K_M.gguf
    echo 3. Save to: %RADPAL_ROOT%\models\
    echo 4. Rename to: mistral-7b-instruct-q4_k_m.gguf
    pause
    exit /b 1
)

REM Check if port is already in use
netstat -an | findstr :8080 | findstr LISTENING >nul
if %errorLevel% EQU 0 (
    echo WARNING: Port 8080 is already in use!
    echo.
    echo Another server might be running.
    echo Press Ctrl+C to cancel, or any key to continue anyway...
    pause >nul
)

echo Starting server...
echo Model: %MODEL_FILE%
echo Endpoint: http://127.0.0.1:8080
echo.
echo Server is starting... (this may take a moment)
echo Once you see "HTTP server listening", the server is ready.
echo.
echo To stop the server, close this window or press Ctrl+C
echo ==========================================
echo.

REM Start the server
"%SERVER_EXE%" ^
    -m "%MODEL_FILE%" ^
    -c 4096 ^
    --host 127.0.0.1 ^
    --port 8080 ^
    --api-key-disable ^
    --threads 8 ^
    --n-gpu-layers 0

REM If server exits with error, pause to show error message
if %errorLevel% NEQ 0 (
    echo.
    echo Server exited with error code: %errorLevel%
    pause
)
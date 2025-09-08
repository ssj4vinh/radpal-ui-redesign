@echo off
echo ==========================================
echo RadPal Local AI Setup (llama.cpp)
echo ==========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo This script needs to run as Administrator for firewall rules.
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%.."
set RADPAL_ROOT=%CD%

echo Working directory: %RADPAL_ROOT%
echo.

REM Step 1: Check if llama.cpp exists
if not exist "%RADPAL_ROOT%\llama.cpp\CMakeLists.txt" (
    echo llama.cpp not found. Downloading...
    git clone https://github.com/ggerganov/llama.cpp
    if %errorLevel% NEQ 0 (
        echo Failed to download llama.cpp
        pause
        exit /b 1
    )
)

REM Step 2: Build llama.cpp
echo Building llama.cpp server...
cd "%RADPAL_ROOT%\llama.cpp"

if not exist "build" mkdir build
cd build

cmake .. -DLLAMA_BUILD_SERVER=ON
if %errorLevel% NEQ 0 (
    echo CMake configuration failed. Please install CMake and a C++ compiler.
    pause
    exit /b 1
)

cmake --build . --config Release
if %errorLevel% NEQ 0 (
    echo Build failed. Please check compiler installation.
    pause
    exit /b 1
)

echo Build completed successfully!
echo.

REM Step 3: Create models directory
cd "%RADPAL_ROOT%"
if not exist "models" mkdir models

REM Step 4: Check for model file
set MODEL_FILE=%RADPAL_ROOT%\models\mistral-7b-instruct-q4_k_m.gguf
if not exist "%MODEL_FILE%" (
    echo.
    echo ==========================================
    echo IMPORTANT: Model file not found!
    echo ==========================================
    echo.
    echo Please download the Mistral model:
    echo.
    echo 1. Go to: https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF
    echo 2. Download: mistral-7b-instruct-v0.2.Q4_K_M.gguf (4.4GB)
    echo 3. Save to: %RADPAL_ROOT%\models\
    echo 4. Rename to: mistral-7b-instruct-q4_k_m.gguf
    echo.
    echo After downloading, run start-llama-server.bat
    echo.
) else (
    echo Model found: %MODEL_FILE%
)

REM Step 5: Create start script
echo Creating start script...
(
echo @echo off
echo echo Starting RadPal Local AI Server...
echo cd /d "%RADPAL_ROOT%"
echo "%RADPAL_ROOT%\llama.cpp\build\bin\Release\server.exe" -m "%MODEL_FILE%" -c 4096 --host 127.0.0.1 --port 8080 --api-key-disable --threads 8
echo if %%errorLevel%% NEQ 0 pause
) > "%RADPAL_ROOT%\start-llama-server.bat"

REM Step 6: Add firewall rule for localhost only
echo Adding firewall rule for local AI server...
netsh advfirewall firewall delete rule name="RadPal Local AI" >nul 2>&1
netsh advfirewall firewall add rule name="RadPal Local AI" dir=in action=allow protocol=TCP localport=8080 remoteip=127.0.0.1 >nul 2>&1

echo.
echo ==========================================
echo Setup Complete!
echo ==========================================
echo.
echo Next steps:
echo 1. Ensure model is in: %RADPAL_ROOT%\models\
echo 2. Run: start-llama-server.bat
echo 3. In RadPal, select "Mistral (Local)" model
echo.
echo The server runs completely offline - no internet needed!
echo.
pause
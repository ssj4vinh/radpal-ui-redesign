@echo off
echo ========================================
echo    RadPal GPU Acceleration Setup
echo ========================================
echo.

:: Check for NVIDIA GPU
nvidia-smi >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ No NVIDIA GPU detected or nvidia-smi not installed.
    echo    GPU acceleration requires an NVIDIA GPU with CUDA support.
    echo.
    pause
    exit /b 1
)

echo ✅ NVIDIA GPU detected!
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
echo.

echo This script will download the CUDA-enabled llama.cpp binary
echo for faster local AI generation (5-10x speedup).
echo.
echo Choose an option:
echo 1. Download pre-built CUDA binary (Recommended - requires CUDA 12.2)
echo 2. Build from source with CUDA support (Advanced)
echo 3. Exit
echo.

set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" goto download_cuda
if "%choice%"=="2" goto build_cuda
exit /b 0

:download_cuda
echo.
echo Downloading CUDA-enabled llama.cpp...
cd /d "%~dp0.."

:: Create directories
if not exist "llama.cpp\build\bin" mkdir "llama.cpp\build\bin"

:: Download CUDA 12.2 version
echo Downloading from GitHub releases...
curl -L -o llama-cuda.zip https://github.com/ggml-org/llama.cpp/releases/download/b6153/llama-b6153-bin-win-cuda-cu12.2-x64.zip

if %errorlevel% neq 0 (
    echo ❌ Download failed!
    pause
    exit /b 1
)

echo Extracting...
tar -xf llama-cuda.zip -C llama.cpp\build\bin

:: Clean up
del llama-cuda.zip

echo.
echo ✅ CUDA binary installed successfully!
echo.
echo The app will now use GPU acceleration automatically.
echo Expected speedup: 5-10x faster than CPU
echo.
pause
exit /b 0

:build_cuda
echo.
echo Building from source with CUDA support...
echo.
echo Prerequisites:
echo - Visual Studio 2022 with C++ compiler
echo - CMake (https://cmake.org/download/)
echo - CUDA Toolkit (https://developer.nvidia.com/cuda-downloads)
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause >nul

cd /d "%~dp0.."

:: Clone if needed
if not exist "llama.cpp\.git" (
    echo Cloning llama.cpp...
    git clone https://github.com/ggerganov/llama.cpp
)

cd llama.cpp

:: Clean previous build
if exist "build" rmdir /s /q build
mkdir build
cd build

echo.
echo Configuring with CUDA support...
cmake .. -DLLAMA_CUDA=ON -DLLAMA_BUILD_SERVER=ON

if %errorlevel% neq 0 (
    echo ❌ CMake configuration failed!
    echo    Make sure CUDA Toolkit is installed.
    pause
    exit /b 1
)

echo.
echo Building (this may take 5-10 minutes)...
cmake --build . --config Release --target llama-server -j %NUMBER_OF_PROCESSORS%

if %errorlevel% neq 0 (
    echo ❌ Build failed!
    pause
    exit /b 1
)

echo.
echo ✅ Build completed successfully!
echo.
echo GPU-accelerated binary located at:
echo %cd%\bin\Release\llama-server.exe
echo.
pause
exit /b 0
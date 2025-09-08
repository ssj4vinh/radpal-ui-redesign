@echo off
echo ========================================
echo Checking llama.cpp GPU Support
echo ========================================
echo.

REM Check if nvidia-smi is available
echo Checking for NVIDIA GPU...
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv
if %errorlevel% neq 0 (
    echo ERROR: nvidia-smi not found. Make sure NVIDIA drivers are installed.
    pause
    exit /b 1
)

echo.
echo Checking CUDA installation...
where nvcc >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: CUDA toolkit not found. GPU acceleration may not work.
    echo Download CUDA from: https://developer.nvidia.com/cuda-downloads
) else (
    nvcc --version
)

echo.
echo ========================================
echo Checking llama-server.exe binary...
echo ========================================

REM Check if the binary exists
if exist "electron\llama-server.exe" (
    echo Found: electron\llama-server.exe
    echo.
    echo Checking for CUDA support in binary...
    
    REM Look for CUDA-related strings in the binary
    findstr /i "cuda cublas" electron\llama-server.exe >nul
    if %errorlevel% equ 0 (
        echo ✓ Binary appears to have CUDA support
    ) else (
        echo ✗ Binary may not have CUDA support
        echo You may need to download a CUDA-enabled build
    )
) else (
    echo ERROR: llama-server.exe not found in electron folder
)

echo.
echo ========================================
echo Testing llama.cpp server...
echo ========================================
echo.
echo To test GPU acceleration:
echo 1. Start the app: npm run electron
echo 2. Check the console output for "GPU offload: XXX layers"
echo 3. Look for "llm_load_tensors: using CUDA" in the logs
echo.
echo If GPU is not being used, you need a CUDA-enabled build.
echo.
pause
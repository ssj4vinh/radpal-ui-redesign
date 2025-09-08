@echo off
echo ========================================
echo Manual llama.cpp Server Test
echo ========================================
echo.
echo This will test the llama-server with GPU acceleration
echo.

set MODEL_PATH=models\mistral-7b-instruct-q4_k_m.gguf

if not exist "%MODEL_PATH%" (
    echo ERROR: Model not found at %MODEL_PATH%
    echo Please download the model first by running the app
    pause
    exit /b 1
)

if not exist "electron\llama-server.exe" (
    echo ERROR: llama-server.exe not found
    pause
    exit /b 1
)

echo Starting server with GPU acceleration...
echo.
echo === Configuration ===
echo Model: %MODEL_PATH%
echo GPU Layers: 999 (all layers on GPU)
echo Context: 4096 tokens
echo Threads: 8 (optimized for i9-12900K)
echo Batch Size: 512
echo =====================
echo.

electron\llama-server.exe ^
    -m %MODEL_PATH% ^
    -c 4096 ^
    --host 127.0.0.1 ^
    --port 8080 ^
    -t 8 ^
    -b 512 ^
    --n-gpu-layers 999 ^
    --mlock ^
    --verbose

echo.
echo Server stopped.
pause
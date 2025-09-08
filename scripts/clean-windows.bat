@echo off
echo Cleaning up for fresh install test...

:: Delete the server binary
if exist "llama.cpp\build\bin\llama-server.exe" (
    echo Deleting llama-server.exe...
    del /f "llama.cpp\build\bin\llama-server.exe"
)

:: Delete partial model downloads
if exist "models\mistral-7b-instruct-q4_k_m.gguf" (
    echo Deleting model file...
    del /f "models\mistral-7b-instruct-q4_k_m.gguf"
)

echo.
echo ✓ Cleanup complete! You can now run RadPal for a fresh install.
echo.
pause
# Windows Setup for Mistral Local

## Automatic Setup (New!)

**No manual steps required!** RadPal now automatically:
1. Downloads the llama.cpp server binary on first run (~10MB)
2. Downloads the Mistral model on first run (~4GB)
3. Starts everything automatically

Just launch RadPal and select "Mistral (Local)" - everything else is automatic!

## Manual Build Setup

If you prefer to build from source:

### Prerequisites
1. **CMake**: https://cmake.org/download/
   - Download Windows x64 Installer
   - During install: "Add CMake to system PATH for all users"

2. **Visual Studio Build Tools 2022**: 
   - https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
   - Install workload: "Desktop development with C++"

3. **Git**: https://git-scm.com/download/win

### Build Steps
```batch
# Clone llama.cpp
git clone https://github.com/ggerganov/llama.cpp

# Build with CMake
cd llama.cpp
mkdir build
cd build
cmake .. -DLLAMA_CURL=OFF
cmake --build . --config Release --target llama-server
```

The server binary will be at: `llama.cpp\build\bin\Release\llama-server.exe`

## Troubleshooting

### Red indicator next to Mistral (Local)
This means the server isn't running. Check:
1. Server binary exists: `llama.cpp\build\bin\llama-server.exe`
2. Model downloaded: `models\mistral-7b-instruct-q4_k_m.gguf` (4GB)
3. Port 8080 is free (not used by other apps)

### Build fails with CMake error
- Ensure CMake is in PATH: Open cmd and type `cmake --version`
- Restart your terminal/IDE after installing CMake

### Model download stuck
- Check internet connection
- Delete partial download: `models\mistral-7b-instruct-q4_k_m.gguf`
- Restart app to retry download

## Performance Tips
- The model uses ~4GB RAM
- First response may be slow as model loads
- Subsequent responses will be faster
- CPU-only mode is normal (no GPU required)
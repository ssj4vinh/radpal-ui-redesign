# Manual Windows Setup for Mistral Local

Since automatic download is having issues with Windows binaries, here's the manual setup:

## Option 1: Download Pre-built Binary (Easiest)

1. Go to: https://github.com/ggerganov/llama.cpp/releases
2. Download the latest Windows release (look for `llama-bXXXX-bin-win-avx2-x64.zip`)
3. Extract the ZIP file
4. Copy `llama-server.exe` from the extracted folder to:
   ```
   C:\Users\[YourUsername]\Desktop\radpal\llama.cpp\build\bin\
   ```
5. Start RadPal - it will find the server and download the model

## Option 2: Build from Source

### Prerequisites
1. Install Git: https://git-scm.com/download/win
2. Install one of these:
   - **Visual Studio 2022** with "Desktop development with C++" workload
   - OR **MSYS2/MinGW**: https://www.msys2.org/

### Build Steps (Visual Studio)
```cmd
cd C:\Users\[YourUsername]\Desktop\radpal
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
mkdir build
cd build
cmake ..
cmake --build . --config Release --target llama-server
```

### Build Steps (MinGW)
```bash
cd /c/Users/[YourUsername]/Desktop/radpal
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make server
```

The server will be built at:
- Visual Studio: `llama.cpp\build\bin\Release\llama-server.exe`
- MinGW: `llama.cpp\server.exe`

## Verification

After setup, you should have:
```
radpal\
  llama.cpp\
    build\
      bin\
        llama-server.exe  ← The server binary should be here
```

When you start RadPal:
1. Green indicator should appear next to "Mistral (Local)"
2. The 4GB model will download automatically on first use
3. Everything will work offline after that

## Troubleshooting

### "This app cannot run on your PC"
- You downloaded a Linux binary or wrong architecture
- Use the correct Windows x64 binary from releases

### Red indicator stays red
- Check if `llama-server.exe` exists in the correct path
- Check if port 8080 is free (not used by other apps)
- Try running the server manually to see errors:
  ```cmd
  cd llama.cpp\build\bin
  llama-server.exe --help
  ```
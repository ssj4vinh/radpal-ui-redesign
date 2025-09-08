# Mistral Local Setup - llama.cpp Only

This guide sets up Mistral AI to run completely offline on locked-down PCs using only llama.cpp.

## Prerequisites

- Windows 10/11 or Linux
- 8GB RAM minimum (16GB recommended)
- ~5GB disk space for model
- CMake and C++ compiler (for building)

## Quick Setup

### Step 1: Download Pre-built Package (Recommended)

For locked-down PCs, download the pre-built package:
1. Download `radpal-llama-mistral.zip` from releases
2. Extract to RadPal installation directory
3. Model included: `mistral-7b-instruct-q4_k_m.gguf`
4. Skip to Step 3

### Step 2: Manual Build (If needed)

If you need to build from source:

```bash
# Clone llama.cpp if not present
git clone https://github.com/ggerganov/llama.cpp

# Build the server
npm run llama:build
```

### Step 3: Download Model

Download the Mistral model (if not included):
- Recommended: [mistral-7b-instruct-v0.2.Q4_K_M.gguf](https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/blob/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf) (~4.4GB)
- Place in `./models/` directory

### Step 4: Start the Server

```bash
# Windows
npm run llama:serve

# Or directly:
./llama.cpp/build/bin/server.exe -m ./models/mistral-7b-instruct-q4_k_m.gguf -c 4096 --host 127.0.0.1 --port 8080
```

### Step 5: Use in RadPal

1. Open RadPal
2. Select "Mistral (Local)" from model dropdown
3. Start dictating - all processing is local

## Configuration

Edit `.env` if needed:
```env
LLAMACPP_OPENAI_BASE=http://127.0.0.1:8080/v1
LLAMACPP_MODEL=mistral-7b-instruct-q4_k_m.gguf
```

## Deployment on Locked-Down PCs

### Pre-Installation Package

Create a deployment package with:
```
radpal-local-ai/
├── llama.cpp/
│   └── build/
│       └── bin/
│           └── server.exe
├── models/
│   └── mistral-7b-instruct-q4_k_m.gguf
├── start-local-ai.bat
└── README.txt
```

### start-local-ai.bat
```batch
@echo off
echo Starting Local AI Server...
cd /d "%~dp0"
llama.cpp\build\bin\server.exe -m models\mistral-7b-instruct-q4_k_m.gguf -c 4096 --host 127.0.0.1 --port 8080 --api-key-disable
```

### Auto-Start with RadPal

Add to RadPal's electron/main.js to auto-start server:
```javascript
const { spawn } = require('child_process');
let llamaServer = null;

// Start llama.cpp server on app start
function startLlamaServer() {
  const serverPath = path.join(__dirname, '../llama.cpp/build/bin/server.exe');
  const modelPath = path.join(__dirname, '../models/mistral-7b-instruct-q4_k_m.gguf');
  
  if (fs.existsSync(serverPath) && fs.existsSync(modelPath)) {
    llamaServer = spawn(serverPath, [
      '-m', modelPath,
      '-c', '4096',
      '--host', '127.0.0.1',
      '--port', '8080',
      '--api-key-disable'
    ]);
    
    console.log('Local AI server started');
  }
}

app.whenReady().then(() => {
  startLlamaServer();
  createWindow();
});

app.on('before-quit', () => {
  if (llamaServer) {
    llamaServer.kill();
  }
});
```

## Performance Optimization

### CPU Optimization
```bash
# Use more threads (adjust to CPU cores)
./server -m model.gguf -t 8

# Use less context for faster response
./server -m model.gguf -c 2048
```

### Memory Usage
- Q4_K_M model: ~4.4GB RAM
- Q3_K_S model: ~3.3GB RAM (lower quality)
- Q5_K_M model: ~5.5GB RAM (higher quality)

## Troubleshooting

### Server won't start
- Check port 8080 is not in use: `netstat -an | findstr 8080`
- Ensure model file exists in `./models/`
- Check Windows Defender/antivirus isn't blocking

### Slow generation
- Reduce context: Use `-c 2048` instead of `-c 4096`
- Use smaller model: Q3_K_S instead of Q4_K_M
- Close other applications to free RAM

### "Model not found"
- Verify model path in start script
- Ensure `.gguf` extension is correct
- Check file isn't corrupted (should be ~4.4GB)

## Security for Locked-Down Environments

### Network Isolation
- Server only binds to 127.0.0.1 (localhost)
- No external network access required
- Firewall can block all external AI endpoints

### No Cloud Dependencies
- All processing happens locally
- No API keys needed
- No data leaves the machine
- HIPAA compliant setup

### Verification
Test that it's truly local:
1. Disconnect from network
2. RadPal with Mistral (Local) should still work
3. Check Task Manager: `server.exe` using CPU during generation

## Model Selection Guide

For radiology reports on locked-down PCs:

| Model | Size | RAM | Quality | Speed |
|-------|------|-----|---------|-------|
| Q3_K_S | 3.3GB | 4GB | Good | Fast |
| Q4_K_M | 4.4GB | 6GB | Better | Medium |
| Q5_K_M | 5.5GB | 8GB | Best | Slower |

Recommended: **Q4_K_M** - Best balance for medical reports

## Support

For locked-down PC deployment issues:
1. Check `./logs/llama-server.log`
2. Verify with: `curl http://127.0.0.1:8080/v1/models`
3. Test generation: Use the test script in `./scripts/test-local-ai.js`
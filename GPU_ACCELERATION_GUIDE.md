# GPU Acceleration Guide for Local Mistral

## Issues Fixed

1. **Wrong GPU parameter**: Changed `-ngl` to `--n-gpu-layers` (correct parameter)
2. **Suboptimal settings**: Optimized for your RTX 3080 (10GB) and i9-12900K
3. **All layers on GPU**: Set to 999 layers to load entire model in VRAM

## Your Optimized Configuration

For your system (RTX 3080 10GB, i9-12900K, 128GB RAM):

```
--n-gpu-layers 999    # All layers on GPU (RTX 3080 has enough VRAM)
-c 4096              # Larger context window
-t 8                 # 8 threads for P-cores
-b 512               # Larger batch size for GPU
--mlock              # Lock model in RAM (you have 128GB)
```

## Testing GPU Acceleration

### 1. Quick Check
Run `CHECK_GPU_SUPPORT.bat` to verify:
- NVIDIA GPU is detected
- CUDA support in binary
- Driver status

### 2. Manual Test
Run `TEST_LLAMA_SERVER.bat` to:
- Start server manually with GPU settings
- Watch console for "using CUDA" messages
- Test generation speed

### 3. In-App Verification
When running the app, look for:
```
🎮 NVIDIA GPU detected with 10.0GB VRAM
🚀 GPU offload: 999 layers (10.0GB VRAM available)
```

## Getting CUDA-Enabled Binary

If the current binary doesn't support CUDA:

### Option 1: Download Pre-built (Recommended)
1. Go to: https://github.com/ggerganov/llama.cpp/releases
2. Download: `llama-b####-bin-win-cublas-cu12.#.#-x64.zip`
3. Extract `llama-server.exe` to `electron/` folder

### Option 2: Build from Source
```bash
# Install CUDA Toolkit first
# Download from: https://developer.nvidia.com/cuda-downloads

# Build with CUDA
cd llama.cpp
mkdir build && cd build
cmake .. -DGGML_CUDA=ON
cmake --build . --config Release --target llama-server
```

## Performance Expectations

With GPU acceleration properly working:

### Before (CPU only)
- Token generation: ~2-5 tokens/second
- Report generation: 30-60 seconds

### After (RTX 3080 GPU)
- Token generation: ~30-50 tokens/second
- Report generation: 3-8 seconds

## Troubleshooting

### GPU Not Detected
- Check NVIDIA drivers: `nvidia-smi`
- Update drivers if needed

### Still Slow After Fix
1. Check Task Manager > Performance > GPU
2. Should see GPU usage spike during generation
3. If not, binary needs CUDA support

### Out of Memory Errors
- Reduce layers: `--n-gpu-layers 24` instead of 999
- Close other GPU applications

## Quick Commands

Test generation speed:
```bash
curl -X POST http://127.0.0.1:8080/v1/completions \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"Test\", \"max_tokens\": 100}"
```

Check server health:
```bash
curl http://127.0.0.1:8080/v1/models
```

## Next Steps

1. Restart the app to apply changes
2. Generate a test report
3. Check console for GPU usage confirmation
4. If still slow, download CUDA-enabled binary
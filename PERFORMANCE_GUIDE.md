# RadPal Local AI Performance Guide

## Performance Expectations

### CPU-Only Mode
- **Speed**: 5-10 tokens/second
- **Time for impression**: 15-30 seconds
- **Best for**: Privacy-critical data, no GPU available

### GPU-Accelerated Mode (NVIDIA)
- **Speed**: 30-70 tokens/second (5-10x faster)
- **Time for impression**: 2-5 seconds
- **Requirements**: NVIDIA GPU with 4GB+ VRAM

## Quick Setup for GPU Acceleration

If you have an NVIDIA GPU, run:
```cmd
scripts\setup-gpu.bat
```

This will download the CUDA-enabled binary for massive speedup.

## Speed Optimization Settings

The app automatically optimizes based on your hardware:

### Auto-Detected Settings
- **CPU Cores**: Uses physical cores only (no hyperthreading)
- **GPU Layers**: Automatically set based on VRAM:
  - 8GB+ VRAM: Full model on GPU (35 layers) - Fastest
  - 6-8GB VRAM: Partial offload (20 layers) - Good balance
  - 4-6GB VRAM: Minimal offload (12 layers) - Some acceleration
  - <4GB VRAM: CPU only

### Manual Optimization Tips

1. **Reduce Context Size** (already optimized to 2048)
   - Smaller context = faster processing
   - Good for impressions, may limit long reports

2. **Use Smaller Model** for maximum speed:
   - Phi-3 Mini (3.8B): 2x faster than Mistral
   - TinyLlama (1.1B): 5x faster, lower quality

3. **Close Other Apps**
   - Free up RAM and VRAM
   - Disable background apps

## Performance Comparison

| Configuration | Tokens/sec | Impression Time | Quality |
|--------------|------------|-----------------|---------|
| CPU (i7/Ryzen 7) | 5-10 | 15-30s | Full |
| GTX 1660 (6GB) | 25-35 | 3-7s | Full |
| RTX 3060 (12GB) | 40-60 | 2-4s | Full |
| RTX 4070 (12GB) | 60-80 | 1-3s | Full |
| Cloud APIs | 50-100+ | 1-2s | Full |

## Troubleshooting Slow Performance

### If GPU is not being used:
1. Check console for "🎮 NVIDIA GPU detected"
2. If not detected, run `nvidia-smi` in terminal
3. Run `scripts\setup-gpu.bat` to get CUDA binary

### If still slow with GPU:
1. Check VRAM usage with `nvidia-smi`
2. Close other GPU apps (browsers, games)
3. Reduce GPU layers if out of VRAM

### Error: "CUDA out of memory"
- Reduce GPU layers in settings
- Close other applications
- Restart the app

## Advanced Users

### Build with Custom Optimizations
```bash
# Clone llama.cpp
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Build with your GPU architecture
cmake -B build -DLLAMA_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=86
cmake --build build --config Release -j

# Copy to RadPal
copy build\bin\Release\llama-server.exe ..\electron\
```

### Custom Launch Flags
Edit `electron/main.js` to modify the `args` array:
```javascript
const args = [
  '-ngl', '35',        // More GPU layers
  '-c', '4096',        // Larger context
  '--flash-attn',      // Flash attention (GPU only)
  '--cont-batching',   // Continuous batching
  // Add your flags here
];
```

## Recommended Setup by Use Case

### Maximum Speed (Gaming PC with GPU)
- Run `scripts\setup-gpu.bat`
- Uses CUDA acceleration
- 2-5 second impressions

### Balanced (Laptop with discrete GPU)
- Automatic GPU detection
- Partial GPU offload
- 5-10 second impressions

### Privacy-First (Air-gapped workstation)
- CPU-only mode
- No internet required
- 15-30 second impressions

### Development/Testing
- Use smaller models (Phi-3, TinyLlama)
- Faster iteration
- Lower quality acceptable
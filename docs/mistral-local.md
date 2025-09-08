# Mistral Local Setup Guide

This guide will help you set up Mistral AI models to run locally with RadPal, completely offline without any cloud dependencies.

## Overview

RadPal supports running Mistral models locally through two backends:
- **llama.cpp** (preferred): High-performance C++ implementation with OpenAI-compatible API
- **Ollama**: User-friendly local model runner

Both options run entirely on your machine with no cloud API calls.

## Option 1: llama.cpp (Recommended)

### Prerequisites
- CMake 3.14 or higher
- C++ compiler (GCC, Clang, or MSVC)
- At least 8GB RAM (16GB recommended)

### Setup Steps

1. **Clone llama.cpp repository** (if not already present):
   ```bash
   git clone https://github.com/ggerganov/llama.cpp
   ```

2. **Build the server**:
   ```bash
   npm run llama:build
   ```

3. **Download a Mistral GGUF model**:
   - Visit [Hugging Face](https://huggingface.co/models?search=mistral+gguf)
   - Recommended models:
     - `mistral-7b-instruct-v0.2.Q4_K_M.gguf` (4-bit quantized, ~4GB)
     - `mistral-7b-instruct-v0.2.Q8_0.gguf` (8-bit quantized, ~7GB)
   - Place the model file in `./models/` directory

4. **Start the server**:
   ```bash
   MODEL_PATH=./models/mistral-7b-instruct-v0.2.Q4_K_M.gguf npm run llama:serve
   ```

5. **Select "Mistral (Local)" in RadPal**:
   - Open RadPal
   - Click on the model selector
   - Choose "Mistral (Local)"

### Configuration

Edit `.env` file to customize:
```env
LLAMACPP_OPENAI_BASE=http://127.0.0.1:8080/v1
LLAMACPP_MODEL=mistral-7b-instruct-v0.2.Q4_K_M.gguf
```

## Option 2: Ollama

### Installation

1. **Install Ollama**:
   - macOS/Linux: `curl -fsSL https://ollama.ai/install.sh | sh`
   - Windows: Download from [ollama.ai](https://ollama.ai)

2. **Pull Mistral model**:
   ```bash
   ollama pull mistral:7b-instruct
   ```

3. **Start Ollama** (usually starts automatically):
   ```bash
   ollama serve
   ```

4. **Select "Mistral (Local)" in RadPal**

### Configuration

Edit `.env` file:
```env
OLLAMA_BASE=http://127.0.0.1:11434
OLLAMA_MODEL=mistral:7b-instruct
```

## Switching Between Backends

RadPal automatically detects which backend is available. To force a specific backend:

```env
# Auto-detect (default)
RADPAL_MISTRAL_LOCAL_MODE=auto

# Force llama.cpp
RADPAL_MISTRAL_LOCAL_MODE=llamacpp

# Force Ollama
RADPAL_MISTRAL_LOCAL_MODE=ollama
```

## Performance Tips

### For llama.cpp:
- Use GPU acceleration if available (add `-ngl 99` to server command)
- Adjust context size with `-c 4096` (default) or higher
- Use more threads with `--threads 8` (adjust to your CPU)

### For Ollama:
- Models are cached after first load
- Use `ollama list` to see available models
- Remove unused models with `ollama rm <model>`

## Troubleshooting

### "No local backends reachable"
- Ensure llama.cpp server or Ollama is running
- Check the ports are not blocked by firewall
- Verify model files exist in the correct location

### Slow generation
- Use quantized models (Q4_K_M or Q5_K_M)
- Enable GPU acceleration if available
- Reduce context size if memory limited

### Connection refused
- llama.cpp: Ensure server is started with `npm run llama:serve`
- Ollama: Check if service is running with `ollama list`

## Model Recommendations

For radiology reports, we recommend:
- **Mistral 7B Instruct**: Best balance of quality and performance
- **Quantization**: Q4_K_M for speed, Q8_0 for quality
- **Context**: 4096 tokens minimum

## Privacy & Security

- All processing happens locally on your machine
- No data is sent to external servers
- Models are stored locally in your filesystem
- Perfect for HIPAA-compliant environments
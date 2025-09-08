#!/bin/bash
set -e
cd "$(dirname "$0")/.."

# Set default model path if not provided
MODEL_PATH="${MODEL_PATH:-./models/${LLAMACPP_MODEL:-mistral-7b-instruct-q4_k_m.gguf}}"

# Check if model file exists
if [ ! -f "$MODEL_PATH" ]; then
  echo "Model file not found: $MODEL_PATH"
  echo "Please download a Mistral GGUF model and place it in the ./models/ directory"
  echo "You can download models from: https://huggingface.co/models?search=mistral+gguf"
  exit 1
fi

# Check if server binary exists
if [ ! -f "./llama.cpp/build/bin/llama-server" ] && [ ! -f "./llama.cpp/build/bin/server" ]; then
  echo "llama.cpp server binary not found."
  echo "Please run: npm run llama:build"
  exit 1
fi

# Determine the correct binary name
SERVER_BIN="./llama.cpp/build/bin/llama-server"
if [ ! -f "$SERVER_BIN" ]; then
  SERVER_BIN="./llama.cpp/build/bin/server"
fi

echo "Starting llama.cpp server with model: $MODEL_PATH"
echo "Server will be available at: http://127.0.0.1:8080"
echo "OpenAI-compatible endpoint: http://127.0.0.1:8080/v1"

# Run the server
"$SERVER_BIN" \
  -m "$MODEL_PATH" \
  -c 4096 \
  --host 127.0.0.1 \
  --port 8080 \
  --api-key-disable \
  --parallel 4 \
  --threads 8
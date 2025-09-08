#!/bin/bash
set -e
cd "$(dirname "$0")/.."

if [ -d llama.cpp ]; then
  cd llama.cpp
  
  # Check if the folder has content
  if [ ! -f "CMakeLists.txt" ]; then
    echo "llama.cpp folder exists but appears empty."
    echo "Please clone llama.cpp from: https://github.com/ggerganov/llama.cpp"
    exit 1
  fi
  
  # Build with server support
  cmake -B build -DLLAMA_BUILD_SERVER=ON
  cmake --build build -j
  
  echo "llama.cpp server built successfully!"
else
  echo "llama.cpp folder not found at repo root."
  echo "To use llama.cpp backend:"
  echo "  git clone https://github.com/ggerganov/llama.cpp"
  echo "  npm run llama:build"
  exit 1
fi
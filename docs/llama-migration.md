# LLaMA/llama.cpp Migration Documentation

## Summary of Legacy Code

The codebase contained several references to llama.cpp and LLaMA models, primarily in:

1. **electron/cleanup.js** (Lines 8-172)
   - Used llama.cpp CLI for text cleanup/processing
   - Path: `llama.cpp/build/bin/llama-cli`
   - Model: `mistral-7b-instruct-v0.1.Q4_K_M.gguf`
   - Purpose: Text cleanup and formatting for radiology reports

2. **.gitmodules** (Lines 4-6)
   - Submodule configuration for llama.cpp repository
   - URL: https://github.com/ggerganov/llama.cpp

3. **.gitignore** (Lines 147-148)
   - Ignored Ollama binaries directory

## Migration Status

### What Changed

1. **New Provider Architecture**
   - Created `src/providers/` directory with clean provider interfaces
   - Implemented `MistralLocalLlamaCppProvider` for llama.cpp OpenAI server (not CLI)
   - Implemented `MistralLocalOllamaProvider` as alternative backend
   - Added `MistralLocalResolver` for automatic backend selection

2. **Configuration**
   - Moved from hardcoded paths to environment variables
   - Added `.env` configuration for both backends
   - Supports runtime backend switching

3. **Integration Points**
   - Updated `agent/callModel.ts` to support `mistral-local` model
   - Added `mistral-local` to model mapping in `agent/modelMapping.ts`
   - Integrated into UI model selector in `src/App.tsx`

### What Was Preserved

1. **llama.cpp folder structure**
   - Empty `llama.cpp/` directory remains for optional use
   - Build scripts check for existence before running

2. **Cleanup functionality**
   - `electron/cleanup.js` remains unchanged
   - Can still use llama CLI for text processing if needed
   - Independent of new Mistral Local provider

### What Was Added

1. **Scripts**
   - `scripts/build-llamacpp-server.sh`: Builds OpenAI-compatible server
   - `scripts/run-llamacpp-server.sh`: Runs the server with model
   - Package.json scripts: `llama:build` and `llama:serve`

2. **Documentation**
   - `docs/mistral-local.md`: Complete setup guide for both backends
   - This migration document

## Recommended Actions

### For Existing Users

1. **If using llama.cpp CLI for cleanup**:
   - No action needed - cleanup.js continues to work
   - Consider migrating to API-based approach in future

2. **If wanting to use Mistral Local**:
   - Follow setup in `docs/mistral-local.md`
   - Choose between llama.cpp server or Ollama

### For New Users

1. **Start with Ollama** for simplicity:
   ```bash
   ollama pull mistral:7b-instruct
   ```

2. **Or use llama.cpp** for performance:
   ```bash
   npm run llama:build
   npm run llama:serve
   ```

## Breaking Changes

None - all existing functionality preserved.

## Future Considerations

1. **Cleanup.js Migration**
   - Consider migrating from CLI to API approach
   - Would unify all LLM calls through provider interface
   - Better error handling and streaming support

2. **Additional Local Models**
   - Provider architecture supports easy addition of other models
   - Could add Llama, Phi, Mixtral with minimal changes

3. **GPU Acceleration**
   - Both backends support GPU acceleration
   - Could add auto-detection and configuration

## File References

### Modified Files
- `agent/callModel.ts`: Added callMistralLocal function
- `agent/modelMapping.ts`: Added mistral-local mapping
- `src/App.tsx`: Added UI buttons for Mistral (Local)
- `package.json`: Added llama:build and llama:serve scripts
- `.env`: Added configuration for both backends

### New Files
- `src/providers/ModelProvider.ts`
- `src/providers/MistralLocalLlamaCppProvider.ts`
- `src/providers/MistralLocalOllamaProvider.ts`
- `src/providers/MistralLocalResolver.ts`
- `src/config/models.ts`
- `scripts/build-llamacpp-server.sh`
- `scripts/run-llamacpp-server.sh`
- `docs/mistral-local.md`
- `docs/llama-migration.md` (this file)

### Unchanged Legacy Files
- `electron/cleanup.js`: Still uses llama CLI
- `.gitmodules`: llama.cpp submodule reference
- `llama.cpp/`: Empty directory structure
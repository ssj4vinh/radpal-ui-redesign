const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class CleanupManager {
  constructor() {
    this.llamaPath = path.join(__dirname, '..', 'llama.cpp', 'build', 'bin', 'llama-cli');
    this.modelPath = path.join(__dirname, '..', 'llama.cpp', 'models', 'mistral-7b-instruct-v0.1.Q4_K_M.gguf');
    this.isProcessing = false;
    this.onTextCallback = null;
    this.onErrorCallback = null;
  }

  // Set callbacks for text and error events
  setCallbacks(onText, onError) {
    this.onTextCallback = onText;
    this.onErrorCallback = onError;
  }

  // Check if required files exist
  validatePaths() {
    if (!fs.existsSync(this.llamaPath)) {
      throw new Error(`Llama binary not found at ${this.llamaPath}`);
    }

    if (!fs.existsSync(this.modelPath)) {
      throw new Error(`Mistral model not found at ${this.modelPath}`);
    }

    return true;
  }

  // Clean up dictated text using Mistral 7B
  async cleanupText(inputText) {
    if (this.isProcessing) {
      throw new Error('Cleanup is already in progress');
    }

    if (!inputText || inputText.trim().length === 0) {
      throw new Error('No text provided for cleanup');
    }

    try {
      this.validatePaths();
      this.isProcessing = true;

      console.log('🧠 Starting text cleanup with Mistral 7B...');
      
      // Build the cleanup prompt
      const prompt = this.buildCleanupPrompt(inputText);
      console.log(`🧠 Prompt: ${prompt.substring(0, 200)}...`);

      const result = await this.runLlamaProcess(prompt);
      
      console.log(`🧠 Cleanup complete. Original: ${inputText.length} chars, Cleaned: ${result.length} chars`);
      
      if (this.onTextCallback) {
        this.onTextCallback(result);
      }
      
      return result;
      
    } catch (error) {
      console.error('🧠 Cleanup failed:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error.message);
      }
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  // Build the cleanup prompt for Mistral
  buildCleanupPrompt(inputText) {
    // If input contains actual punctuation already, just return it as-is
    if (inputText.includes(',') || inputText.includes('.') || inputText.includes('!') || inputText.includes('?')) {
      return `<s>[INST] Return the following text exactly as is: ${inputText} [/INST]`;
    }
    
    return `<s>[INST] Task: Replace ONLY these exact words with punctuation marks:
"comma" → ","  
"period" → "."
"colon" → ":"
"semicolon" → ";"
"next paragraph" → new line

Rules:
- If these words are NOT present, output the text EXACTLY as given
- Do NOT add punctuation where there are no punctuation words
- Do NOT capitalize or change any other words

Text: ${inputText}
[/INST]`;
  }

  // Run llama-cli process and capture output
  async runLlamaProcess(prompt) {
    return new Promise((resolve, reject) => {
      const args = [
        '-m', this.modelPath,
        '-p', prompt,
        '--temp', '0.1',           // Low temperature for consistent cleanup
        '--top-k', '10',           // Limit token choices
        '--top-p', '0.8',          // Nucleus sampling
        '--repeat-penalty', '1.1', // Reduce repetition
        '-n', '100',              // Lower max tokens to prevent hallucination
        '--no-warmup',            // Skip model warmup for faster processing
        '--log-disable'           // Disable verbose logging
      ];

      console.log(`🧠 Llama command: ${this.llamaPath} ${args.join(' ')}`);

      const llamaProcess = spawn(this.llamaPath, args);
      let output = '';
      let errorOutput = '';

      llamaProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        // Only log final output, not chunks
      });

      llamaProcess.stderr.on('data', (data) => {
        const errorText = data.toString();
        // Only log actual errors, not verbose output
        if (errorText.includes('error') || errorText.includes('Error') || errorText.includes('failed')) {
          console.log(`🧠 Llama stderr: ${errorText}`);
        }
        errorOutput += errorText;
      });

      llamaProcess.on('error', (error) => {
        console.error(`🧠 Llama process error: ${error.message}`);
        reject(new Error(`Llama process error: ${error.message}`));
      });

      llamaProcess.on('close', (code) => {
        console.log(`🧠 Llama process closed with code: ${code}`);
        console.log(`🧠 Raw output: "${output}"`);
        console.log(`🧠 Error output: "${errorOutput}"`);

        if (code === 0) {
          const cleanedText = this.extractCleanedText(output);
          if (cleanedText && cleanedText.trim().length > 0) {
            resolve(cleanedText);
          } else {
            reject(new Error('No valid output received from Mistral model'));
          }
        } else {
          reject(new Error(`Llama process failed with code ${code}: ${errorOutput}`));
        }
      });
    });
  }

  // Extract and clean the model output
  extractCleanedText(rawOutput) {
    if (!rawOutput) return '';

    // Find the text after [/INST]
    let cleaned = rawOutput;
    const instIndex = cleaned.lastIndexOf('[/INST]');
    if (instIndex !== -1) {
      cleaned = cleaned.substring(instIndex + 7); // 7 is length of '[/INST]'
    }

    // Remove system messages and markers
    cleaned = cleaned
      .replace(/\[INST\].*?\[\/INST\]/gs, '') // Remove any instruction blocks
      .replace(/^llama_print_timings:.*$/gm, '') // Remove timing info
      .replace(/^.*tokens per second.*$/gm, '') // Remove performance info
      .replace(/\[end of text\]/g, '') // Remove end markers
      .replace(/^\s*\n/gm, '') // Remove empty lines
      .trim();

    // If the output starts with quotes, remove them
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }
    
    // Clean up any extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  // Check if cleanup is currently running
  isRunning() {
    return this.isProcessing;
  }

  // Auto-cleanup function for use after dictation sessions
  async autoCleanupText(inputText) {
    if (!inputText || inputText.trim().length === 0) {
      console.log('🧠 Auto-cleanup skipped: no text to process');
      return inputText; // Return original text unchanged
    }

    try {
      console.log('🧠 Starting auto-cleanup after dictation session...');
      const result = await this.cleanupText(inputText);
      console.log('🧠 Auto-cleanup completed successfully');
      return result;
    } catch (error) {
      console.error('🧠 Auto-cleanup failed, returning original text:', error);
      // Return original text if cleanup fails
      return inputText;
    }
  }
}

module.exports = CleanupManager;
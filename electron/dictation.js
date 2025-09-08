const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class DictationManager {
  constructor() {
    this.isRecording = false;
    this.micProcess = null;
    this.whisperProcesses = new Set(); // Track all active whisper processes
    this.tempAudioFile = null;
    this.audioChunks = [];
    this.chunkCounter = 0;
    this.onTextCallback = null;
    this.onErrorCallback = null;
    this.onSessionCompleteCallback = null; // Callback for when dictation session ends
    this.sessionEnded = false; // Track if session has ended
    this.whisperPath = path.join(__dirname, '..', 'whisper.cpp', 'build', 'bin', 'whisper-cli');
    this.modelPath = path.join(__dirname, '..', 'whisper.cpp', 'models', 'ggml-base.en.bin');
    this.tempDir = path.join(os.tmpdir(), 'radpal-dictation');
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // Set callbacks for text and error events
  setCallbacks(onText, onError, onSessionComplete = null, onChunkComplete = null) {
    this.onTextCallback = onText;
    this.onErrorCallback = onError;
    this.onSessionCompleteCallback = onSessionComplete;
    this.onChunkCompleteCallback = onChunkComplete; // New callback for individual chunk completion
  }

  // Start recording and transcription
  async startDictation() {
    if (this.isRecording) {
      throw new Error('Dictation is already running');
    }

    try {
      // Check if whisper binary exists
      if (!fs.existsSync(this.whisperPath)) {
        throw new Error(`Whisper binary not found at ${this.whisperPath}`);
      }

      // Check if model exists
      if (!fs.existsSync(this.modelPath)) {
        throw new Error(`Whisper model not found at ${this.modelPath}`);
      }

      this.isRecording = true;
      this.chunkCounter = 0;
      this.sessionEnded = false; // Reset session state
      console.log('🎙️ Starting dictation...');

      // Start microphone recording
      await this.startMicrophoneRecording();
      
    } catch (error) {
      this.isRecording = false;
      console.error('Failed to start dictation:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error.message);
      }
      throw error;
    }
  }

  // Stop recording and cleanup
  async stopDictation() {
    if (!this.isRecording) {
      return;
    }

    console.log('🛑 Stopping dictation...');
    this.isRecording = false;
    this.sessionEnded = true; // Mark session as ended

    // Stop microphone recording
    if (this.micProcess) {
      this.micProcess.kill('SIGTERM');
      this.micProcess = null;
    }

    // Don't stop whisper processes - let them finish transcribing
    // The whisper processes will clean up their own files when done
    const activeCount = this.whisperProcesses.size;
    if (activeCount > 0) {
      console.log(`⏳ Allowing ${activeCount} running whisper processes to finish...`);
    }

    // Only clean up temp files after a delay to allow whisper processes to complete
    setTimeout(() => {
      if (this.whisperProcesses.size === 0) {
        console.log('✅ All transcriptions complete, cleaning up temp files');
        this.cleanupTempFiles();
      } else {
        console.log(`⏳ Still waiting for ${this.whisperProcesses.size} transcriptions to complete`);
        // Try again in another 5 seconds
        setTimeout(() => {
          this.cleanupTempFiles();
        }, 5000);
      }
    }, 10000); // 10 second delay
  }

  // Start microphone recording using node-record-lpcm16
  async startMicrophoneRecording() {
    try {
      const recorder = require('node-record-lpcm16');
      
      const recordProgram = this.getRecordProgram();
      const recordingOptions = {
        sampleRate: 16000,
        channels: 1,
        audioType: 'raw', // Use raw PCM instead of wav
        silence: '2.0', // Stop recording after 2 seconds of silence
        verbose: false
      };
      
      // Only specify recordProgram if it's not null (for platforms that need it)
      if (recordProgram) {
        recordingOptions.recordProgram = recordProgram;
      }

      // Start continuous recording with chunking
      this.startChunkedRecording(recordingOptions);
      
    } catch (error) {
      console.error('Failed to start microphone recording:', error);
      throw new Error(`Microphone recording failed: ${error.message}`);
    }
  }

  // Get the appropriate recording program for the platform
  getRecordProgram() {
    switch (process.platform) {
      case 'darwin':
        return null; // macOS - use default system recording
      case 'win32':
        // On Windows, check if SoX is available
        const { WindowsAudioRecorderAlternative } = require('./windows-audio-recorder');
        const soxPath = WindowsAudioRecorderAlternative.getSoxPath();
        if (soxPath) {
          console.log('✅ Found SoX at:', soxPath);
          return soxPath === 'sox' ? null : soxPath; // null lets node-record-lpcm16 find it in PATH
        } else {
          console.log('⚠️ SoX not found on Windows. Will try native Windows recording...');
          return null; // Signal to use native Windows recording
        }
      case 'linux':
        // Check if we're in WSL
        if (process.env.WSL_DISTRO_NAME) {
          return 'arecord'; // Use arecord in WSL
        }
        return 'arecord'; // Linux
      default:
        return null;
    }
  }

  // Start chunked recording for continuous transcription
  startChunkedRecording(options) {
    const chunkDuration = 3000; // 3 seconds per chunk
    
    const recordChunk = () => {
      if (!this.isRecording) return;

      this.chunkCounter++;
      const rawFile = path.join(this.tempDir, `chunk_${this.chunkCounter}.raw`);
      const wavFile = path.join(this.tempDir, `chunk_${this.chunkCounter}.wav`);
      
      console.log(`🎵 Recording chunk ${this.chunkCounter}...`);
      
      try {
        const recorder = require('node-record-lpcm16');
        const recording = recorder.record({
          ...options,
          silence: '1.0', // Shorter silence for chunks
        });

        const fileStream = fs.createWriteStream(rawFile);
        recording.stream().pipe(fileStream);

        // Stop recording after chunk duration
        setTimeout(() => {
          recording.stop();
          fileStream.end();
          
          // Wait a bit for file to be written, then convert to WAV
          setTimeout(() => {
            if (fs.existsSync(rawFile)) {
              const stats = fs.statSync(rawFile);
              console.log(`🎵 Created raw audio file: ${rawFile} (${stats.size} bytes)`);
              
              // Convert raw PCM to WAV
              this.convertRawToWav(rawFile, wavFile, () => {
                // Process this chunk with whisper
                this.transcribeAudioChunk(wavFile);
                
                // Clean up raw file
                try {
                  fs.unlinkSync(rawFile);
                } catch (err) {
                  console.error('Failed to delete raw file:', err);
                }
              });
            } else {
              console.error(`❌ Raw audio file not created: ${rawFile}`);
            }
          }, 100);
          
          // Schedule next chunk if still recording
          if (this.isRecording) {
            setTimeout(recordChunk, 500); // Small gap between chunks
          }
        }, chunkDuration);

      } catch (error) {
        console.error(`Failed to record chunk ${this.chunkCounter}:`, error);
        if (this.onErrorCallback) {
          this.onErrorCallback(`Recording failed: ${error.message}`);
        }
      }
    };

    // Start the first chunk
    recordChunk();
  }

  // Transcribe audio chunk using whisper
  async transcribeAudioChunk(audioFile) {
    if (!fs.existsSync(audioFile)) {
      console.error('Audio file does not exist:', audioFile);
      return;
    }

    try {
      console.log(`🤖 Transcribing ${path.basename(audioFile)}...`);
      
      // Use output file instead of stdout for more reliable text extraction
      const outputFile = audioFile.replace('.wav', '');
      const whisperArgs = [
        '-m', this.modelPath,
        '-f', audioFile,
        '--output-txt',
        '--output-file', outputFile,
        '--no-timestamps',
        '--language', 'en',
        '--threads', '4',
        '--no-prints',  // Reduce verbosity
        '--suppress-regex', '[\\.,;:!?]',  // Suppress punctuation tokens
        '--word-thold', '0.5',  // Higher threshold for word detection
        '--entropy-thold', '3.0',  // Higher entropy threshold
        '--logprob-thold', '-0.5'  // Stricter log probability threshold
      ];
      
      console.log(`🤖 Whisper command: ${this.whisperPath} ${whisperArgs.join(' ')}`);

      const whisperProcess = spawn(this.whisperPath, whisperArgs);
      this.whisperProcesses.add(whisperProcess); // Track this process
      
      let transcriptionOutput = '';
      let errorOutput = '';

      whisperProcess.stdout.on('data', (data) => {
        transcriptionOutput += data.toString();
      });

      whisperProcess.stderr.on('data', (data) => {
        const errorText = data.toString();
        // Only log actual errors, not verbose output
        if (errorText.includes('error') || errorText.includes('Error') || errorText.includes('failed')) {
          console.log(`🤖 Whisper stderr: ${errorText}`);
        }
        errorOutput += errorText;
      });

      whisperProcess.on('error', (error) => {
        console.error(`🤖 Whisper process error: ${error.message}`);
        this.whisperProcesses.delete(whisperProcess); // Remove from tracking
        if (this.onErrorCallback) {
          this.onErrorCallback(`Whisper process error: ${error.message}`);
        }
      });

      whisperProcess.on('close', (code) => {
        this.whisperProcesses.delete(whisperProcess); // Remove from tracking
        console.log(`🤖 Whisper process closed with code: ${code} (${this.whisperProcesses.size} processes remaining)`);
        console.log(`🤖 Raw transcription output: "${transcriptionOutput}"`);
        console.log(`🤖 Error output: "${errorOutput}"`);
        
        if (code === 0) {
          // Read the output file that whisper created
          const textFile = outputFile + '.txt';
          console.log(`🤖 Looking for text file: ${textFile}`);
          
          try {
            if (fs.existsSync(textFile)) {
              const fileContent = fs.readFileSync(textFile, 'utf8');
              console.log(`🤖 File content: "${fileContent}"`);
              
              const text = this.extractTextFromOutput(fileContent);
              console.log(`🤖 Extracted text: "${text}"`);
              
              if (text && text.trim().length > 0) {
                console.log(`📝 Transcribed: "${text}"`);
                if (this.onTextCallback) {
                  this.onTextCallback(text.trim());
                }
                // Trigger chunk complete callback for real-time processing
                if (this.onChunkCompleteCallback) {
                  this.onChunkCompleteCallback(text.trim());
                }
              } else {
                console.log('🤖 No text extracted from whisper output file');
              }
              
              // Clean up the text file
              fs.unlinkSync(textFile);
            } else {
              console.log(`🤖 Text file not found: ${textFile}`);
              // Fallback to stdout if file doesn't exist
              const text = this.extractTextFromOutput(transcriptionOutput);
              if (text && text.trim().length > 0) {
                console.log(`📝 Transcribed from stdout: "${text}"`);
                if (this.onTextCallback) {
                  this.onTextCallback(text.trim());
                }
                // Trigger chunk complete callback for real-time processing
                if (this.onChunkCompleteCallback) {
                  this.onChunkCompleteCallback(text.trim());
                }
              }
            }
          } catch (err) {
            console.error('Failed to read transcription file:', err);
          }
        } else {
          console.error('Whisper transcription failed:', errorOutput);
          if (this.onErrorCallback) {
            this.onErrorCallback(`Transcription failed: ${errorOutput}`);
          }
        }

        // Clean up the processed audio file
        try {
          if (fs.existsSync(audioFile)) {
            fs.unlinkSync(audioFile);
          }
        } catch (err) {
          console.error('Failed to delete audio file:', err);
        }

        // Check if session is complete after this whisper process finishes
        this.checkSessionComplete();
      });

    } catch (error) {
      console.error('Failed to start whisper transcription:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(`Transcription error: ${error.message}`);
      }
    }
  }

  // Check if dictation session is complete and trigger callback
  checkSessionComplete() {
    // Session is complete when:
    // 1. Session has ended (user stopped dictation)
    // 2. No whisper processes are still running
    if (this.sessionEnded && this.whisperProcesses.size === 0) {
      console.log('🎯 Dictation session complete - all transcriptions finished');
      if (this.onSessionCompleteCallback) {
        this.onSessionCompleteCallback();
      }
    }
  }

  // Convert raw PCM to WAV format
  convertRawToWav(rawFile, wavFile, callback) {
    try {
      const rawData = fs.readFileSync(rawFile);
      const sampleRate = 16000;
      const channels = 1;
      const bitsPerSample = 16;
      const byteRate = sampleRate * channels * bitsPerSample / 8;
      const blockAlign = channels * bitsPerSample / 8;
      
      // WAV header
      const header = Buffer.alloc(44);
      
      // RIFF chunk descriptor
      header.write('RIFF', 0);
      header.writeUInt32LE(36 + rawData.length, 4);
      header.write('WAVE', 8);
      
      // fmt sub-chunk
      header.write('fmt ', 12);
      header.writeUInt32LE(16, 16); // Sub-chunk size
      header.writeUInt16LE(1, 20);  // Audio format (PCM)
      header.writeUInt16LE(channels, 22);
      header.writeUInt32LE(sampleRate, 24);
      header.writeUInt32LE(byteRate, 28);
      header.writeUInt16LE(blockAlign, 32);
      header.writeUInt16LE(bitsPerSample, 34);
      
      // data sub-chunk
      header.write('data', 36);
      header.writeUInt32LE(rawData.length, 40);
      
      // Write WAV file
      const wavData = Buffer.concat([header, rawData]);
      fs.writeFileSync(wavFile, wavData);
      
      const stats = fs.statSync(wavFile);
      console.log(`🎵 Converted to WAV: ${wavFile} (${stats.size} bytes)`);
      
      if (callback) callback();
      
    } catch (error) {
      console.error('Failed to convert raw to WAV:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(`WAV conversion failed: ${error.message}`);
      }
    }
  }

  // Extract clean text from whisper output
  extractTextFromOutput(output) {
    if (!output) return '';
    
    // Whisper outputs text directly to stdout when using --output-txt
    // Clean up the text by removing extra whitespace and newlines
    return output
      .replace(/\[.*?\]/g, '') // Remove timestamp markers if any
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }

  // Clean up temporary files
  cleanupTempFiles() {
    try {
      if (!fs.existsSync(this.tempDir)) {
        return;
      }
      
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        if (file.startsWith('chunk_') && (file.endsWith('.wav') || file.endsWith('.raw') || file.endsWith('.txt'))) {
          const filePath = path.join(this.tempDir, file);
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (err) {
            // File might already be deleted by transcription process, ignore
            console.log(`📄 File ${file} already cleaned up`);
          }
        }
      }
      console.log('🧹 Cleaned up temporary audio files');
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }

  // Check if dictation is currently active
  isActive() {
    return this.isRecording;
  }

  // Check if there are any whisper processes still running
  hasActiveTranscriptions() {
    return this.whisperProcesses.size > 0;
  }

  // Get count of active whisper processes
  getActiveTranscriptionCount() {
    return this.whisperProcesses.size;
  }
}

module.exports = DictationManager;
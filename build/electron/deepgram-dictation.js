const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const RadiologyTextProcessor = require('./radiology-text-processor');

class DeepgramDictationManager {
  constructor() {
    this.isRecording = false;
    this.micProcess = null;
    this.deepgramSocket = null;
    this.audioBuffer = Buffer.alloc(0);
    this.onTextCallback = null;
    this.onErrorCallback = null;
    this.onSessionCompleteCallback = null;
    this.onChunkCompleteCallback = null;
    this.tempDir = path.join(os.tmpdir(), 'radpal-dictation');
    this.apiKey = '';
    this.textProcessor = new RadiologyTextProcessor();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.connectionQuality = 'good';
    this.audioDataListenerBound = false;
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // Set API key
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  // Set callbacks for text and error events
  setCallbacks(onText, onError, onSessionComplete = null, onChunkComplete = null) {
    this.onTextCallback = onText;
    this.onErrorCallback = onError;
    this.onSessionCompleteCallback = onSessionComplete;
    this.onChunkCompleteCallback = onChunkComplete;
  }

  // Start recording and transcription
  async startDictation() {
    if (this.isRecording) {
      throw new Error('Dictation is already running');
    }

    try {
      this.isRecording = true;
      console.log('🎙️ Starting Deepgram dictation...');

      // Initialize Deepgram WebSocket connection
      console.log('🔑 Initializing Deepgram connection...');
      await this.initializeDeepgram();
      console.log('✅ Deepgram connection initialized');
      
      // Start microphone recording
      console.log('🎤 Starting microphone recording...');
      await this.startMicrophoneRecording();
      console.log('✅ Microphone recording started');
      
    } catch (error) {
      this.isRecording = false;
      console.error('❌ Failed to start Deepgram dictation:', error);
      console.error('❌ Deepgram error stack:', error.stack);
      console.error('❌ Deepgram error code:', error.code);
      if (this.onErrorCallback) {
        this.onErrorCallback(error.message);
      }
      throw error;
    }
  }

  // Initialize Deepgram WebSocket connection
  async initializeDeepgram() {
    try {
      console.log('🔑 Deepgram API Key:', this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'NOT SET');
      
      // Deepgram API endpoint for real-time transcription with Nova-3 Medical model
      // Disable automatic punctuation since we want explicit punctuation commands
      const deepgramUrl = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&language=en-US&model=nova-3-medical&punctuate=false&smart_format=false&diarize=false&multichannel=false&endpointing=300`;

      this.deepgramSocket = new WebSocket(deepgramUrl, {
        headers: {
          'Authorization': `Token ${this.apiKey}`
        }
      });

      this.deepgramSocket.on('open', () => {
        console.log('✅ Connected to Deepgram');
      });

      this.deepgramSocket.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          
          if (response.type === 'Results') {
            const transcript = response.channel?.alternatives?.[0]?.transcript;
            
            if (transcript && transcript.trim().length > 0) {
              // Check if this is a final transcript
              const isFinal = response.channel?.alternatives?.[0]?.is_final || response.is_final;
              
              if (isFinal) {
                console.log(`📝 Deepgram transcribed: "${transcript}"`);
                
                // Clean up the transcript
                let cleanedTranscript = transcript.trim();
                
                // Skip completely empty transcripts
                if (!cleanedTranscript) {
                  return;
                }
                
                // IMPORTANT: Remove periods that Deepgram adds from pauses
                // These are NOT explicitly dictated periods (which come as the word "period")
                // Deepgram adds actual period characters during pauses even with punctuate=false
                cleanedTranscript = cleanedTranscript.replace(/\./g, '');
                
                // Process the text for radiology-specific formatting
                const processedText = this.textProcessor.processText(cleanedTranscript);
                console.log(`🔧 Processed text: "${processedText}"`);
                
                if (this.onTextCallback) {
                  this.onTextCallback(processedText);
                }
                
                // Trigger chunk complete callback for real-time processing
                if (this.onChunkCompleteCallback) {
                  this.onChunkCompleteCallback(processedText);
                }
              }
            }
          } else if (response.type === 'Metadata') {
            console.log('🔧 Deepgram metadata:', response);
          }
        } catch (error) {
          console.error('Error parsing Deepgram response:', error);
        }
      });

      this.deepgramSocket.on('error', (error) => {
        console.error('❌ Deepgram WebSocket error:', error);
        if (this.onErrorCallback) {
          this.onErrorCallback(`Deepgram error: ${error.message}`);
        }
      });

      this.deepgramSocket.on('close', (code, reason) => {
        console.log(`🔚 Deepgram connection closed: ${code} - ${reason}`);
        this.connectionQuality = 'closed';
        
        if (this.isRecording && this.reconnectAttempts < this.maxReconnectAttempts) {
          // Attempt to reconnect if still recording
          this.reconnectAttempts++;
          const backoffDelay = Math.min(1000 * this.reconnectAttempts, 5000);
          console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${backoffDelay}ms`);
          
          setTimeout(() => {
            if (this.isRecording) {
              this.initializeDeepgram().catch(error => {
                console.error('Reconnection failed:', error);
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                  console.error('Max reconnection attempts reached, stopping dictation');
                  this.stopDictation();
                  if (this.onErrorCallback) {
                    this.onErrorCallback('Connection lost. Please restart dictation.');
                  }
                }
              });
            }
          }, backoffDelay);
        }
      });

      // Wait for the connection to be established
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Deepgram connection timeout'));
        }, 5000);

        this.deepgramSocket.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.deepgramSocket.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      console.error('Failed to initialize Deepgram:', error);
      throw error;
    }
  }

  // Start microphone recording using Web Audio API via renderer process
  async startMicrophoneRecording() {
    try {
      console.log('🎤 Starting Web Audio API based recording...');
      
      // Set up IPC listener for audio data from renderer process
      this.setupAudioDataListener();
      
      // Signal the renderer process to start recording
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('start-audio-capture');
        }
      });
      
      console.log('✅ Audio capture request sent to renderer process');
      
    } catch (error) {
      console.error('Failed to start microphone recording:', error);
      throw new Error(`Microphone recording failed: ${error.message}`);
    }
  }

  // Set up listener for audio data from renderer process
  setupAudioDataListener() {
    const { ipcMain } = require('electron');
    
    // Only set up listeners once to prevent duplicates
    if (this.audioDataListenerBound) {
      return;
    }
    
    // Remove any existing listeners completely
    ipcMain.removeAllListeners('audio-data');
    ipcMain.removeAllListeners('audio-error');
    
    // Track consecutive send failures for stream health
    let consecutiveSendFailures = 0;
    const MAX_SEND_FAILURES = 3;
    
    ipcMain.on('audio-data', (event, audioBuffer) => {
      // Only process if we're actively recording
      if (!this.isRecording) {
        return;
      }
      
      // Forward audio data to Deepgram with connection quality check
      if (this.deepgramSocket && this.deepgramSocket.readyState === WebSocket.OPEN) {
        try {
          this.deepgramSocket.send(Buffer.from(audioBuffer));
          // Reset failure counter on successful send
          consecutiveSendFailures = 0;
          this.reconnectAttempts = 0;
          this.connectionQuality = 'good';
        } catch (error) {
          console.error('Failed to send audio data to Deepgram:', error);
          consecutiveSendFailures++;
          this.connectionQuality = 'poor';
          
          // If too many consecutive failures, force a reset
          if (consecutiveSendFailures >= MAX_SEND_FAILURES) {
            console.error('❌ Too many consecutive send failures, forcing reset');
            this.handleCriticalError('Stream corruption detected');
          } else {
            this.handleConnectionDegradation();
          }
        }
      } else if (this.isRecording) {
        // Connection is not open but we're supposed to be recording
        console.warn('⚠️ WebSocket not open while recording, attempting to reconnect');
        this.handleConnectionDegradation();
      }
    });

    ipcMain.on('audio-error', (event, error) => {
      console.error('Audio capture error from renderer:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(`Audio capture error: ${error}`);
      }
      // Force reset on critical audio errors
      if (error.includes('stream') || error.includes('corrupt')) {
        this.handleCriticalError(error);
      }
    });
    
    this.audioDataListenerBound = true;
  }



  // Stop recording and cleanup
  async stopDictation() {
    if (!this.isRecording) {
      return;
    }

    console.log('🛑 Stopping Deepgram dictation...');
    this.isRecording = false;

    // Signal renderer process to stop recording
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('stop-audio-capture');
      }
    });

    // Close Deepgram WebSocket connection
    if (this.deepgramSocket) {
      if (this.deepgramSocket.readyState === WebSocket.OPEN) {
        this.deepgramSocket.close();
      }
      this.deepgramSocket = null;
    }

    // Trigger session complete callback
    if (this.onSessionCompleteCallback) {
      this.onSessionCompleteCallback();
    }

    console.log('✅ Deepgram dictation stopped');
  }

  // Check if dictation is currently active
  isActive() {
    return this.isRecording;
  }
  
  // Get connection quality status
  getConnectionQuality() {
    return this.connectionQuality;
  }
  
  // Force reset the entire dictation system (for Reset Mic button)
  async forceReset() {
    console.log('🔄 Force resetting Deepgram dictation system...');
    
    // First, hard stop the WebSocket connection
    if (this.deepgramSocket) {
      try {
        // Remove all event listeners first to prevent reconnection attempts
        this.deepgramSocket.removeAllListeners();
        
        // Force close the WebSocket regardless of state
        if (this.deepgramSocket.readyState !== WebSocket.CLOSED) {
          this.deepgramSocket.terminate ? this.deepgramSocket.terminate() : this.deepgramSocket.close();
        }
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
      this.deepgramSocket = null;
    }
    
    // Stop recording flag immediately
    this.isRecording = false;
    
    // Signal all renderer processes to stop and reset audio
    const { BrowserWindow, ipcMain } = require('electron');
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        // Send stop signal
        win.webContents.send('stop-audio-capture');
        // Send reset signal for deeper cleanup
        win.webContents.send('reset-audio-system');
      }
    });
    
    // Force cleanup all IPC listeners
    ipcMain.removeAllListeners('audio-data');
    ipcMain.removeAllListeners('audio-error');
    
    // Clear all state and buffers
    this.reconnectAttempts = 0;
    this.connectionQuality = 'good';
    this.audioBuffer = Buffer.alloc(0);
    this.audioDataListenerBound = false;
    this.textProcessor = new RadiologyTextProcessor(); // Reset text processor state
    
    // Wait for cleanup to propagate
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Trigger session complete callback if set
    if (this.onSessionCompleteCallback) {
      this.onSessionCompleteCallback();
    }
    
    console.log('✅ Force reset complete - system fully cleaned');
  }
  
  // Handle connection degradation
  handleConnectionDegradation() {
    if (this.connectionQuality === 'poor' && this.isRecording) {
      console.log('⚠️ Connection quality degraded, attempting refresh...');
      // Force refresh the connection
      this.refreshConnection();
    }
  }
  
  // Refresh connection to improve accuracy
  async refreshConnection() {
    if (!this.isRecording) return;
    
    console.log('🔄 Refreshing Deepgram connection...');
    
    // Close existing connection
    if (this.deepgramSocket) {
      this.deepgramSocket.removeAllListeners();
      if (this.deepgramSocket.readyState === WebSocket.OPEN) {
        this.deepgramSocket.close();
      }
      this.deepgramSocket = null;
    }
    
    // Reinitialize after a brief delay
    setTimeout(async () => {
      if (this.isRecording) {
        try {
          await this.initializeDeepgram();
          console.log('✅ Connection refreshed successfully');
        } catch (error) {
          console.error('❌ Failed to refresh connection:', error);
        }
      }
    }, 500);
  }
  
  // Handle critical errors that require full system reset
  handleCriticalError(errorMessage) {
    console.error('🚨 Critical error detected:', errorMessage);
    
    // Notify the UI of the critical error
    if (this.onErrorCallback) {
      this.onErrorCallback(`Critical error: ${errorMessage}. Please use Reset Microphone button.`);
    }
    
    // Stop dictation immediately without triggering callbacks
    this.isRecording = false;
    
    // Force close the WebSocket
    if (this.deepgramSocket) {
      try {
        this.deepgramSocket.removeAllListeners();
        if (this.deepgramSocket.readyState !== WebSocket.CLOSED) {
          this.deepgramSocket.terminate ? this.deepgramSocket.terminate() : this.deepgramSocket.close();
        }
      } catch (error) {
        console.error('Error during critical error handling:', error);
      }
      this.deepgramSocket = null;
    }
    
    // Signal renderer to stop audio
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('stop-audio-capture');
        win.webContents.send('critical-audio-error', errorMessage);
      }
    });
  }

  // Clean up temporary files
  cleanupTempFiles() {
    try {
      if (!fs.existsSync(this.tempDir)) {
        return;
      }
      
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        if (file.startsWith('deepgram_') && (file.endsWith('.wav') || file.endsWith('.raw'))) {
          const filePath = path.join(this.tempDir, file);
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (err) {
            console.log(`📄 File ${file} already cleaned up`);
          }
        }
      }
      console.log('🧹 Cleaned up temporary audio files');
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }
}

module.exports = DeepgramDictationManager;
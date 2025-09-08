// AudioWorklet processor for microphone capture
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const inputChannel = input[0];
      
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex] = inputChannel[i];
        this.bufferIndex++;
        
        // When buffer is full, send to main thread
        if (this.bufferIndex >= this.bufferSize) {
          // Convert Float32 to Int16 for Deepgram
          const int16Array = new Int16Array(this.bufferSize);
          for (let j = 0; j < this.bufferSize; j++) {
            int16Array[j] = Math.max(-32768, Math.min(32767, this.buffer[j] * 32767));
          }
          
          // Send to main thread
          this.port.postMessage({
            type: 'audioData',
            buffer: int16Array.buffer
          });
          
          this.bufferIndex = 0;
        }
      }
    }
    
    // Keep the processor alive
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
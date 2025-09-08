// Windows Audio Recorder using PowerShell
const { spawn } = require('child_process');
const EventEmitter = require('events');

class WindowsAudioRecorder extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sampleRate = options.sampleRate || 16000;
    this.channels = options.channels || 1;
    this.recording = null;
    this.isRecording = false;
  }

  start() {
    if (this.isRecording) {
      return this;
    }

    console.log('🎤 Starting Windows audio recording with PowerShell...');
    
    // PowerShell script to record audio using Windows APIs
    const psScript = `
Add-Type @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class AudioRecorder {
    [DllImport("winmm.dll", SetLastError = true)]
    static extern int waveInOpen(out IntPtr hWaveIn, int deviceId, ref WAVEFORMATEX wfx, IntPtr callback, IntPtr instance, uint flags);
    
    [DllImport("winmm.dll")]
    static extern int waveInPrepareHeader(IntPtr hWaveIn, ref WAVEHDR pwh, int cbwh);
    
    [DllImport("winmm.dll")]
    static extern int waveInAddBuffer(IntPtr hWaveIn, ref WAVEHDR pwh, int cbwh);
    
    [DllImport("winmm.dll")]
    static extern int waveInStart(IntPtr hWaveIn);
    
    [DllImport("winmm.dll")]
    static extern int waveInStop(IntPtr hWaveIn);
    
    [DllImport("winmm.dll")]
    static extern int waveInClose(IntPtr hWaveIn);
    
    [StructLayout(LayoutKind.Sequential)]
    public struct WAVEFORMATEX {
        public ushort wFormatTag;
        public ushort nChannels;
        public uint nSamplesPerSec;
        public uint nAvgBytesPerSec;
        public ushort nBlockAlign;
        public ushort wBitsPerSample;
        public ushort cbSize;
    }
    
    [StructLayout(LayoutKind.Sequential)]
    public struct WAVEHDR {
        public IntPtr lpData;
        public uint dwBufferLength;
        public uint dwBytesRecorded;
        public IntPtr dwUser;
        public uint dwFlags;
        public uint dwLoops;
        public IntPtr lpNext;
        public IntPtr reserved;
    }
}
"@

# Simple audio capture using .NET
[System.Reflection.Assembly]::LoadWithPartialName("System.Speech") | Out-Null
$audioFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(${this.sampleRate}, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)

# Output raw PCM data to stdout
$memStream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter([Console]::OpenStandardOutput())

# Recording loop
try {
    # Use NAudio if available, otherwise fall back to simpler method
    Add-Type -AssemblyName System.Speech
    $source = New-Object System.Speech.Recognition.SpeechRecognitionEngine
    $source.SetInputToDefaultAudioDevice()
    
    # Simple byte reading loop - this is a fallback
    while ($true) {
        # Read from default audio device and write to stdout
        # This is simplified - in production you'd use proper Windows audio APIs
        Start-Sleep -Milliseconds 100
        # For now, we'll need to use a proper audio library
    }
} catch {
    Write-Error $_.Exception.Message
}
`;

    // Alternative: Use Windows' built-in SoundRecorder or Voice Recorder
    // For now, let's try using PowerShell with .NET audio capabilities
    try {
      // Try to use PowerShell's audio recording capabilities
      this.recording = spawn('powershell', ['-Command', psScript], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.recording.stdout.on('data', (data) => {
        this.emit('data', data);
      });

      this.recording.stderr.on('data', (data) => {
        console.error('Recording error:', data.toString());
      });

      this.recording.on('close', (code) => {
        console.log(`Recording process exited with code ${code}`);
        this.isRecording = false;
        this.emit('close', code);
      });

      this.recording.on('error', (error) => {
        console.error('Failed to start recording:', error);
        this.emit('error', error);
      });

      this.isRecording = true;
    } catch (error) {
      console.error('Failed to start Windows audio recording:', error);
      // Fall back to requiring SoX installation
      throw new Error('Audio recording failed. Please install SoX for Windows from http://sox.sourceforge.net/');
    }

    return this;
  }

  stop() {
    if (this.recording) {
      this.recording.kill();
      this.recording = null;
    }
    this.isRecording = false;
  }
}

// Alternative approach using Windows multimedia APIs via edge-js or similar
class WindowsAudioRecorderAlternative {
  constructor(options = {}) {
    this.options = options;
  }

  static checkSoxInstalled() {
    const { execSync } = require('child_process');
    try {
      execSync('sox --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  static getSoxPath() {
    // Common SoX installation paths on Windows
    const possiblePaths = [
      'C:\\Program Files (x86)\\sox-14-4-2\\sox.exe',
      'C:\\Program Files\\sox-14-4-2\\sox.exe',
      'C:\\sox\\sox.exe',
      'sox' // If in PATH
    ];

    const { existsSync } = require('fs');
    for (const soxPath of possiblePaths) {
      if (soxPath === 'sox' || existsSync(soxPath)) {
        return soxPath;
      }
    }
    return null;
  }
}

module.exports = { WindowsAudioRecorder, WindowsAudioRecorderAlternative };
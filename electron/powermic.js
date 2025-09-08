// Power Mic III and Speech Mike USB HID Integration
const { BrowserWindow } = require('electron');

class PowerMicManager {
  constructor() {
    this.HID = null;
    this.device = null;
    this.isConnected = false;
    this.recordButtonPressed = false;
    
    // Known USB IDs for various dictation microphones
    this.SUPPORTED_DEVICES = [
      { vendorId: 0x0554, productId: 0x1700, name: 'Power Mic III' },
      { vendorId: 0x0554, productId: 0x1001, name: 'PowerMicII-NS' }, // Your device!
      { vendorId: 0x0911, productId: 0x1613, name: 'Philips SpeechMike Premium' },
      { vendorId: 0x0911, productId: 0x1610, name: 'Philips SpeechMike III' },
      { vendorId: 0x0911, productId: 0x161A, name: 'Philips SpeechMike Air' },
      { vendorId: 0x0554, productId: 0x0040, name: 'Dictaphone PowerMic II' },
      { vendorId: 0x0554, productId: 0x0050, name: 'Nuance PowerMic' }
    ];
    
    // HID report mapping - may vary by device
    // We'll try multiple common button positions
    this.RECORD_BUTTON_MASKS = [
      { byte: 0, mask: 0x04 }, // Bit 2 in byte 0
      { byte: 1, mask: 0x01 }, // Bit 0 in byte 1  
      { byte: 1, mask: 0x02 }, // Bit 1 in byte 1
      { byte: 1, mask: 0x04 }, // Bit 2 in byte 1 - YOUR POWERMIC!
      { byte: 2, mask: 0x01 }, // Bit 0 in byte 2
      { byte: 3, mask: 0x01 }  // Bit 0 in byte 3
    ];
    
    this.lastReportData = null;
    this.debugMode = true; // Enable debug logging
  }
  
  async initialize() {
    try {
      // Check if we're in WSL - PowerMic won't work there
      if (process.env.WSL_DISTRO_NAME) {
        console.log('🪟 WSL detected - PowerMic functionality disabled (no USB access in WSL)');
        console.log('💡 To use PowerMic, run the app natively on Windows');
        console.log('🔧 Manual microphone button will still work in the app');
        return false;
      }
      
      // Try to dynamically import node-hid
      this.HID = require('node-hid');
      console.log('🎤 Power Mic III: HID module loaded');
      
      // Find and connect to Power Mic III
      this.connect();
      
      // Set up device monitoring
      this.startMonitoring();
      
      return true;
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.log('⚠️ Power Mic III: node-hid module not found. PowerMic functionality will be disabled.');
        console.log('💡 To enable PowerMic support, install node-hid with: npm install node-hid');
        console.log('🔧 Manual microphone button and keyboard shortcuts will still work.');
      } else if (error.code === 'ERR_DLOPEN_FAILED' && error.message.includes('libusb')) {
        console.log('🪟 PowerMic disabled: USB libraries not available in this environment');
        console.log('💡 This is normal in WSL - run natively on Windows to use PowerMic');
        console.log('🔧 Manual microphone button will still work');
      } else {
        console.error('❌ Power Mic III: Failed to initialize:', error);
      }
      return false;
    }
  }
  
  connect() {
    if (!this.HID) return;
    
    try {
      // List all HID devices for debugging
      const devices = this.HID.devices();
      
      if (this.debugMode && this.mappingMode) {
        console.log('🔍 All HID devices found:');
        devices.forEach(d => {
          if (d.product || d.manufacturer) {
            console.log(`  VID: 0x${d.vendorId.toString(16).padStart(4, '0')}, PID: 0x${d.productId.toString(16).padStart(4, '0')}, Product: ${d.product || 'Unknown'}, Manufacturer: ${d.manufacturer || 'Unknown'}`);
          }
        });
      }
      
      // Find any supported dictation microphone
      let micDevice = null;
      let deviceInfo = null;
      
      for (const supportedDevice of this.SUPPORTED_DEVICES) {
        micDevice = devices.find(d => 
          d.vendorId === supportedDevice.vendorId && 
          d.productId === supportedDevice.productId
        );
        
        if (micDevice) {
          deviceInfo = supportedDevice;
          break;
        }
      }
      
      if (micDevice) {
        // Open the device
        this.device = new this.HID.HID(micDevice.path);
        this.isConnected = true;
        console.log(`✅ ${deviceInfo.name} connected:`, micDevice);
        console.log(`  Path: ${micDevice.path}`);
        console.log(`  Manufacturer: ${micDevice.manufacturer || 'Unknown'}`);
        console.log(`  Product: ${micDevice.product || 'Unknown'}`);
        
        // Set up data listener
        this.device.on('data', (data) => this.handleHIDData(data));
        
        this.device.on('error', (error) => {
          console.error(`❌ ${deviceInfo.name} error:`, error);
          this.disconnect();
        });
        
        return true;
      } else {
        // Only log this occasionally, not every 5 seconds
        if (!this.lastNoDeviceWarning || (Date.now() - this.lastNoDeviceWarning) > 30000) {
          console.log('⚠️ No supported dictation microphone found');
          console.log('🔍 Looking for devices with VIDs:', this.SUPPORTED_DEVICES.map(d => `0x${d.vendorId.toString(16)}`).join(', '));
          this.lastNoDeviceWarning = Date.now();
        }
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to connect to dictation microphone:', error);
      return false;
    }
  }
  
  disconnect() {
    if (this.device) {
      try {
        this.device.close();
      } catch (error) {
        console.error('Error closing Power Mic III:', error);
      }
      this.device = null;
    }
    this.isConnected = false;
    console.log('🔌 Power Mic III disconnected');
  }
  
  handleHIDData(data) {
    // Debug: Log raw HID data when it changes
    if (this.debugMode && (!this.lastReportData || !data.equals(this.lastReportData))) {
      console.log('📊 HID Report:', Array.from(data).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
      
      // Show which bits changed
      if (this.lastReportData) {
        for (let i = 0; i < Math.min(data.length, 8); i++) {
          const changed = data[i] ^ this.lastReportData[i];
          if (changed) {
            console.log(`  Byte ${i} changed: 0x${this.lastReportData[i].toString(16).padStart(2, '0')} → 0x${data[i].toString(16).padStart(2, '0')} (bits: ${changed.toString(2).padStart(8, '0')})`);
          }
        }
      }
      this.lastReportData = Buffer.from(data);
    }
    
    // Try to detect record button using multiple possible positions
    let recordButtonState = false;
    
    for (const buttonMap of this.RECORD_BUTTON_MASKS) {
      if (data.length > buttonMap.byte) {
        const isPressed = (data[buttonMap.byte] & buttonMap.mask) !== 0;
        if (isPressed) {
          recordButtonState = true;
          if (this.debugMode && !this.recordButtonPressed) {
            console.log(`🎯 Button detected at byte ${buttonMap.byte}, mask 0x${buttonMap.mask.toString(16)}`);
          }
          break;
        }
      }
    }
    
    // Detect button press (transition from not pressed to pressed)
    if (recordButtonState && !this.recordButtonPressed) {
      console.log('🔴 Dictation Mic: Record button pressed');
      this.onRecordButtonPressed();
    }
    // Detect button release (transition from pressed to not pressed)
    else if (!recordButtonState && this.recordButtonPressed) {
      console.log('⭕ Dictation Mic: Record button released');
      this.onRecordButtonReleased();
    }
    
    this.recordButtonPressed = recordButtonState;
  }
  
  onRecordButtonPressed() {
    // Send event to all windows to start dictation
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('powermic-record-pressed');
        // Don't send trigger-dictation-toggle to avoid race condition
        // The App.tsx will handle the powermic-record-pressed event
      }
    });
  }
  
  onRecordButtonReleased() {
    // Send event to all windows to stop dictation
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('powermic-record-released');
        // Could also stop dictation here if using push-to-talk mode
        // win.webContents.send('trigger-dictation-stop');
      }
    });
  }
  
  startMonitoring() {
    // Only monitor if HID module is available
    if (!this.HID) {
      console.log('⚠️ PowerMic monitoring disabled - node-hid not available');
      return;
    }
    
    // Periodically check for device connection
    this.monitorInterval = setInterval(() => {
      if (!this.isConnected) {
        console.log('🔍 Dictation Mic: Checking for device...');
        this.connect();
      }
    }, 5000); // Check every 5 seconds
  }
  
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      console.log('🛑 PowerMic monitoring stopped');
    }
  }
  
  // Utility method to help identify button mappings
  enableButtonMapping() {
    console.log('🎮 Button mapping mode enabled - press buttons to see their HID codes');
    this.debugMode = true;
    this.mappingMode = true;
  }
  
  cleanup() {
    this.disconnect();
  }
}

module.exports = PowerMicManager;
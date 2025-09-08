// PATCHED main.js with custom dictation support
// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv not available in production, which is fine
  }
}

// Load config with fallback
let config;
try {
  config = require('./config');
} catch (e) {
  console.log('Config file not found, using environment variables');
  config = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY || '',
    DEEP_GRAM_API: process.env.DEEP_GRAM_API || ''
  };
}

// Bypass certificate verification for corporate environments
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron')
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { execFile, spawn, spawnSync } = require('child_process');
const isDev = !app.isPackaged;

// Try to load auto-updater, but make it optional and disable in dev
let autoUpdater = null;
if (!isDev) {
  try {
    const updater = require('electron-updater');
    autoUpdater = updater.autoUpdater;
  } catch (error) {
    console.log('Auto-updater not available:', error.message);
  }
} else {
  console.log('Auto-updater disabled in development mode');
}

// Ignore certificate errors
app.commandLine.appendSwitch('ignore-certificate-errors')
const { registerSupabaseHandlers } = require('./supabasebridge');
const { screen } = require('electron');
const DeepgramDictationManager = require('./deepgram-dictation');
const { createClient } = require('@supabase/supabase-js');
const { initSupabase: initAgentLogicSupabase, registerHandlers: registerAgentLogicHandlers } = require('./agentLogicIPCSeparateTable');
const { registerAgentLogicV2Handlers } = require('./agentLogicIPCV2');
const macrosIPC = require('./macrosIPC');
const { registerUserProfileHandlers } = require('./userProfileIPC');
const { registerMedicalTermsHandlers } = require('./medicalTermsIPC');
const { setupReportIPC } = require('./reportIPC');

// Track original window dimensions for reset
let originalBounds = null;
let isResettingWindow = false;
let windowMonitorInterval = null;
let allowContractResize = false;
let currentMode = 'login'; // Track current window mode: 'login' or 'main'

// llama.cpp server management
let llamaServerProcess = null;
let llamaServerReady = false;
let llamaServerStartAttempts = 0;
const MAX_LLAMA_START_ATTEMPTS = 3;
let isDownloadingModel = false;
let modelDownloadProgress = 0;

// Window bounds persistence - separate files for each mode
const loginBoundsFile = path.join(app.getPath('userData'), 'window-bounds-login.json');
const mainBoundsFile = path.join(app.getPath('userData'), 'window-bounds-main.json');

function saveLoginBounds(bounds) {
  try {
    fs.writeFileSync(loginBoundsFile, JSON.stringify(bounds, null, 2));
  } catch (error) {
    console.error('Failed to save login bounds:', error);
  }
}

function saveMainBounds(bounds) {
  try {
    // PROTECTION: Prevent saving login-sized bounds during main UI mode
    if (currentMode === 'main' && bounds.width <= 700) {
      return;
    }
    fs.writeFileSync(mainBoundsFile, JSON.stringify(bounds, null, 2));
  } catch (error) {
    console.error('Failed to save main bounds:', error);
  }
}

function loadLoginBounds() {
  try {
    if (fs.existsSync(loginBoundsFile)) {
      const data = fs.readFileSync(loginBoundsFile, 'utf8');
      const bounds = JSON.parse(data);
      // Validate bounds are reasonable
      if (bounds.width > 200 && bounds.height > 100 && bounds.width < 3000 && bounds.height < 2000) {
        return bounds;
      }
    }
  } catch (error) {
    console.error('Failed to load login bounds:', error);
  }
  return null;
}

function loadMainBounds() {
  try {
    if (fs.existsSync(mainBoundsFile)) {
      const data = fs.readFileSync(mainBoundsFile, 'utf8');
      const bounds = JSON.parse(data);
      // Validate bounds are reasonable
      if (bounds.width > 200 && bounds.height > 100 && bounds.width < 3000 && bounds.height < 2000) {
        return bounds;
      }
    }
  } catch (error) {
    console.error('Failed to load main bounds:', error);
  }
  return null;
}

// Legacy function for backwards compatibility - loads login bounds first, then main bounds
function loadWindowBounds() {
  return loadLoginBounds() || loadMainBounds();
}

// Save bounds based on current mode to maintain independence
function saveCurrentWindowBounds(bounds) {
  if (currentMode === 'login') {
    saveLoginBounds(bounds);
  } else if (currentMode === 'main') {
    saveMainBounds(bounds);
  }
}

// Initialize dictation manager
let deepgramDictationManager = null;

// Function to check if llama.cpp server is running
async function checkLlamaServerHealth() {
  try {
    const response = await fetch('http://127.0.0.1:8080/v1/models', {
      timeout: 2000
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Function to download model with progress tracking
async function downloadModel() {
  const modelPath = path.join(__dirname, '..', 'models', 'mistral-7b-instruct-q4_k_m.gguf');
  const modelDir = path.dirname(modelPath);
  
  // Create models directory if it doesn't exist
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }
  
  // Check if model already exists and is valid
  if (fs.existsSync(modelPath)) {
    const stats = fs.statSync(modelPath);
    // Check if file size is reasonable (should be around 4.4GB)
    if (stats.size > 4 * 1024 * 1024 * 1024) {
      console.log('Model already exists and appears valid');
      return true;
    } else {
      console.log('Model file exists but appears incomplete, re-downloading...');
      fs.unlinkSync(modelPath);
    }
  }
  
  console.log('Starting model download...');
  isDownloadingModel = true;
  
  // Notify renderer about download start
  if (mainWindow) {
    console.log('📨 Sending model-download-status to renderer: downloading=true, progress=0');
    mainWindow.webContents.send('model-download-status', { 
      downloading: true, 
      progress: 0,
      status: 'Starting download...'
    });
  }
  
  // Model URL - using TheBloke's Mistral 7B Instruct GGUF
  const modelUrl = 'https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf';
  
  try {
    const https = require('https');
    const fileStream = fs.createWriteStream(modelPath);
    let downloadedBytes = 0;
    let totalBytes = 0;
    
    return new Promise((resolve, reject) => {
      https.get(modelUrl, (response) => {
        // Handle redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          https.get(redirectUrl, handleResponse).on('error', reject);
          return;
        }
        
        handleResponse(response);
        
        function handleResponse(res) {
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to download: HTTP ${res.statusCode}`));
            return;
          }
          
          totalBytes = parseInt(res.headers['content-length'], 10);
          console.log(`Downloading model: ${(totalBytes / 1024 / 1024 / 1024).toFixed(2)} GB`);
          
          res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            fileStream.write(chunk);
            
            // Calculate progress
            const progress = Math.round((downloadedBytes / totalBytes) * 100);
            
            // Update progress every 1%
            if (progress !== modelDownloadProgress) {
              modelDownloadProgress = progress;
              const mbDownloaded = (downloadedBytes / 1024 / 1024).toFixed(0);
              const mbTotal = (totalBytes / 1024 / 1024).toFixed(0);
              
              console.log(`Download progress: ${progress}% (${mbDownloaded}/${mbTotal} MB)`);
              
              // Send progress to renderer
              if (mainWindow) {
                mainWindow.webContents.send('model-download-status', {
                  downloading: true,
                  progress: progress,
                  bytesDownloaded: downloadedBytes,
                  bytesTotal: totalBytes,
                  status: `Downloading: ${mbDownloaded} MB / ${mbTotal} MB`
                });
              }
            }
          });
          
          res.on('end', () => {
            fileStream.end();
            isDownloadingModel = false;
            modelDownloadProgress = 0;
            
            // Verify file size
            const stats = fs.statSync(modelPath);
            if (stats.size === totalBytes) {
              console.log('Model downloaded successfully!');
              
              if (mainWindow) {
                mainWindow.webContents.send('model-download-status', {
                  downloading: false,
                  complete: true,
                  status: 'Model downloaded successfully!'
                });
              }
              
              resolve(true);
            } else {
              console.error('Downloaded file size mismatch');
              fs.unlinkSync(modelPath);
              reject(new Error('Downloaded file is corrupted'));
            }
          });
          
          res.on('error', (error) => {
            fileStream.end();
            fs.unlinkSync(modelPath);
            isDownloadingModel = false;
            reject(error);
          });
        }
      }).on('error', (error) => {
        fileStream.end();
        if (fs.existsSync(modelPath)) {
          fs.unlinkSync(modelPath);
        }
        isDownloadingModel = false;
        
        if (mainWindow) {
          mainWindow.webContents.send('model-download-status', {
            downloading: false,
            error: error.message,
            status: `Download failed: ${error.message}`
          });
        }
        
        reject(error);
      });
    });
  } catch (error) {
    console.error('Error downloading model:', error);
    isDownloadingModel = false;
    
    if (mainWindow) {
      mainWindow.webContents.send('model-download-status', {
        downloading: false,
        error: error.message,
        status: `Download failed: ${error.message}`
      });
    }
    
    return false;
  }
}

// Current llama.cpp version we want to use
const CURRENT_LLAMA_VERSION = 'b6191';
const CURRENT_LLAMA_URL = 'https://github.com/ggml-org/llama.cpp/releases/download/b6191/llama-b6191-bin-win-cuda-12.4-x64.zip';

// Function to check if llama.cpp needs updating
function needsLlamaUpdate() {
  try {
    const versionFile = path.join(__dirname, 'llama-version.txt');
    if (fs.existsSync(versionFile)) {
      const installedVersion = fs.readFileSync(versionFile, 'utf8').trim();
      return installedVersion !== CURRENT_LLAMA_VERSION;
    }
    return true; // No version file means we need to update
  } catch (err) {
    console.error('Error checking llama version:', err);
    return false; // Don't force update on error
  }
}

// Function to save current llama version
function saveLlamaVersion(version) {
  try {
    const versionFile = path.join(__dirname, 'llama-version.txt');
    fs.writeFileSync(versionFile, version);
  } catch (err) {
    console.error('Error saving llama version:', err);
  }
}

// Function to start llama.cpp server
async function startLlamaServer(checkForUpdates = false) {
  console.log('🚀 startLlamaServer called');
  
  // Don't start if already running
  if (llamaServerProcess || llamaServerReady) {
    console.log('llama.cpp server already running or starting');
    return;
  }
  
  // Only check for updates if explicitly requested (when user selects Mistral)
  if (checkForUpdates && needsLlamaUpdate()) {
    console.log('🔄 Newer llama.cpp version available (b6191)');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('llama-update-available', {
        currentVersion: CURRENT_LLAMA_VERSION,
        downloadUrl: CURRENT_LLAMA_URL
      });
    }
  }

  // Check if server is already running (maybe from previous session)
  const isRunning = await checkLlamaServerHealth();
  if (isRunning) {
    console.log('llama.cpp server already running (external process)');
    llamaServerReady = true;
    if (mainWindow) {
      mainWindow.webContents.send('llama-server-status', { running: true, external: true });
    }
    return;
  }

  console.log('📦 Checking for llama.cpp server binary and model...');
  
  // Determine paths based on platform
  const platform = process.platform;
  const serverName = platform === 'win32' ? 'llama-server.exe' : 'llama-server';
  
  // Try multiple possible server locations
  const possiblePaths = [
    path.join(__dirname, '..', 'llama.cpp', 'build', 'bin', 'Release', serverName),
    path.join(__dirname, '..', 'llama.cpp', 'build', 'bin', serverName),
    path.join(__dirname, '..', 'llama.cpp', 'bin', serverName),
    // Also try old name for backward compatibility
    path.join(__dirname, '..', 'llama.cpp', 'build', 'bin', 'Release', 'server.exe'),
    path.join(__dirname, '..', 'llama.cpp', 'build', 'bin', 'server'),
  ];
  
  let serverPath = null;
  console.log('🔍 Searching for llama-server binary...');
  console.log('🔍 __dirname:', __dirname);
  for (const p of possiblePaths) {
    console.log(`🔍 Checking: ${p} - Exists: ${fs.existsSync(p)}`);
    if (fs.existsSync(p)) {
      serverPath = p;
      console.log('✅ Found server at:', serverPath);
      break;
    }
  }
  
  if (!serverPath) {
    console.error('❌ llama.cpp server binary not found');
    console.error('Searched paths:', possiblePaths);
    
    const llamaCppPath = path.join(__dirname, '..', 'llama.cpp');
    const targetBinaryPath = path.join(llamaCppPath, 'build', 'bin', serverName);
    
    // On Windows, use bundled binary
    if (process.platform === 'win32') {
      console.log('🔨 Windows detected - checking for bundled binary');
      
      // Check if bundled binary exists in electron folder
      const bundledServerPath = path.join(__dirname, 'llama-server.exe');
      console.log('📍 Looking for bundled server at:', bundledServerPath);
      
      // Try multiple ways to check if file exists
      let bundledExists = false;
      try {
        const stats = fs.statSync(bundledServerPath);
        bundledExists = stats.isFile();
        console.log('📍 Bundled server stats:', stats.size, 'bytes');
      } catch (e) {
        console.log('📍 Could not stat bundled server:', e.message);
        // Try listing directory contents to debug
        try {
          const files = fs.readdirSync(__dirname);
          console.log('📍 Files in electron folder:', files.filter(f => f.includes('llama') || f.endsWith('.exe')).join(', '));
        } catch (err) {
          console.log('📍 Could not list directory:', err.message);
        }
      }
      console.log('📍 Bundled server exists?', bundledExists);
      
      // Check if target binary already exists and is valid
      if (fs.existsSync(targetBinaryPath)) {
        const stats = fs.statSync(targetBinaryPath);
        console.log(`✅ Found existing binary at ${targetBinaryPath}, size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        // If it's less than 1MB, it's probably corrupt
        if (stats.size < 1024 * 1024) {
          console.log('❌ Existing binary appears corrupt, replacing...');
          fs.unlinkSync(targetBinaryPath);
        } else {
          console.log('✅ Using existing binary');
          // Binary exists and seems valid, restart the server
          setTimeout(() => startLlamaServer(), 1000);
          return;
        }
      }
      
      // Copy bundled binary if available
      if (bundledExists) {
        console.log('📦 Copying bundled server from:', bundledServerPath);
        
        // Create directories if they don't exist
        const dirs = [
          path.join(__dirname, '..', 'llama.cpp'),
          path.join(__dirname, '..', 'llama.cpp', 'build'),
          path.join(__dirname, '..', 'llama.cpp', 'build', 'bin')
        ];
        
        for (const dir of dirs) {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        }
        
        // Copy server binary
        fs.copyFileSync(bundledServerPath, targetBinaryPath);
        console.log('✅ Server copied to:', targetBinaryPath);
        
        // Copy required DLLs
        const dllFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.dll'));
        const targetDir = path.dirname(targetBinaryPath);
        
        for (const dll of dllFiles) {
          const dllSource = path.join(__dirname, dll);
          const dllTarget = path.join(targetDir, dll);
          if (!fs.existsSync(dllTarget)) {
            fs.copyFileSync(dllSource, dllTarget);
            console.log('📦 Copied DLL:', dll);
          }
        }
        
        console.log('✅ Server and dependencies ready');
        
        // Retry starting the server
        setTimeout(() => startLlamaServer(), 1000);
        return;
      }
      
      // Fallback to download if bundled binary not found
      console.log('⚠️ Bundled binary not found, attempting download...');
      
      if (mainWindow) {
        mainWindow.webContents.send('llama-server-status', { 
          running: false, 
          error: 'Downloading llama.cpp server...' 
        });
        mainWindow.webContents.send('model-download-status', {
          downloading: true,
          progress: 0,
          status: 'Downloading llama.cpp server binary...'
        });
      }
      
      try {
        const https = require('https');
        const { execSync } = require('child_process');
        const AdmZip = require('adm-zip');
        
        // Create directories if they don't exist
        const dirs = [
          path.join(__dirname, '..', 'llama.cpp'),
          path.join(__dirname, '..', 'llama.cpp', 'build'),
          path.join(__dirname, '..', 'llama.cpp', 'build', 'bin')
        ];
        
        for (const dir of dirs) {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        }
        
        console.log('🔨 Downloading pre-built llama.cpp for Windows...');
        
        // Download the Windows ZIP package
        // Using a recent release with Windows binaries
        const downloadUrl = 'https://github.com/ggml-org/llama.cpp/releases/download/b6191/llama-b6191-bin-win-cuda-12.4-x64.zip';
        const zipPath = path.join(__dirname, '..', 'llama-temp.zip');
        
        console.log('📥 Downloading from:', downloadUrl);
        
        // Download the ZIP file
        const downloadZip = () => {
          return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(zipPath);
            
            https.get(downloadUrl, (response) => {
              if (response.statusCode === 302 || response.statusCode === 301) {
                // Handle redirect
                https.get(response.headers.location, (redirectResponse) => {
                  const totalBytes = parseInt(redirectResponse.headers['content-length'], 10);
                  let downloadedBytes = 0;
                  
                  console.log(`📦 Download size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
                  
                  redirectResponse.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    const progress = Math.round((downloadedBytes / totalBytes) * 100);
                    
                    if (progress % 10 === 0) {
                      console.log(`📥 Download progress: ${progress}%`);
                    }
                    
                    if (mainWindow) {
                      mainWindow.webContents.send('model-download-status', {
                        downloading: true,
                        progress: progress,
                        status: `Downloading llama.cpp: ${progress}%`
                      });
                    }
                  });
                  
                  redirectResponse.pipe(file);
                  
                  file.on('finish', () => {
                    file.close();
                    console.log('✅ ZIP downloaded successfully');
                    resolve();
                  });
                }).on('error', reject);
              } else {
                response.pipe(file);
                file.on('finish', () => {
                  file.close();
                  resolve();
                });
              }
            }).on('error', reject);
          });
        };
        
        // Download the ZIP
        await downloadZip();
        
        console.log('📦 Extracting ZIP file...');
        
        // Extract the ZIP
        try {
          const zip = new AdmZip(zipPath);
          const zipEntries = zip.getEntries();
          
          // Find llama-server.exe in the ZIP
          let serverFound = false;
          zipEntries.forEach((entry) => {
            if (entry.entryName.endsWith('llama-server.exe') || entry.entryName.endsWith('server.exe')) {
              console.log('📄 Found server in ZIP:', entry.entryName);
              
              // Extract directly to target location
              const content = entry.getData();
              fs.writeFileSync(targetBinaryPath, content);
              serverFound = true;
              console.log('✅ Extracted server to:', targetBinaryPath);
            }
          });
          
          if (!serverFound) {
            // If llama-server.exe not found, extract everything and look for it
            const extractPath = path.join(__dirname, '..', 'llama-temp-extract');
            zip.extractAllTo(extractPath, true);
            
            // Search for the server executable
            const findExecutable = (dir) => {
              const files = fs.readdirSync(dir);
              for (const file of files) {
                const fullPath = path.join(dir, file);
                if (fs.statSync(fullPath).isDirectory()) {
                  const found = findExecutable(fullPath);
                  if (found) return found;
                } else if (file === 'llama-server.exe' || file === 'server.exe') {
                  return fullPath;
                }
              }
              return null;
            };
            
            const foundServer = findExecutable(extractPath);
            if (foundServer) {
              fs.copyFileSync(foundServer, targetBinaryPath);
              console.log('✅ Found and copied server from:', foundServer);
              serverFound = true;
            }
            
            // Clean up extracted files
            const rimraf = (dir) => {
              if (fs.existsSync(dir)) {
                fs.readdirSync(dir).forEach(file => {
                  const curPath = path.join(dir, file);
                  if (fs.lstatSync(curPath).isDirectory()) {
                    rimraf(curPath);
                  } else {
                    fs.unlinkSync(curPath);
                  }
                });
                fs.rmdirSync(dir);
              }
            };
            rimraf(extractPath);
          }
          
          if (!serverFound) {
            throw new Error('Could not find llama-server.exe in the downloaded package');
          }
          
        } catch (extractError) {
          console.error('❌ Failed to extract ZIP:', extractError);
          throw extractError;
        } finally {
          // Clean up ZIP file
          if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
            console.log('🗑️ Cleaned up temporary ZIP file');
          }
        }
        
        // Save the version we just installed
        saveLlamaVersion(CURRENT_LLAMA_VERSION);
        console.log(`✅ Saved llama.cpp version: ${CURRENT_LLAMA_VERSION}`);
        
        // Unblock the executable on Windows and set permissions
        try {
          // First check if file exists and log its size
          const stats = fs.statSync(targetBinaryPath);
          console.log(`📊 Server file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
          
          // Unblock the file (remove Zone.Identifier)
          execSync(`powershell -Command "Unblock-File -Path '${targetBinaryPath}'"`, { stdio: 'ignore' });
          console.log('✅ Unblocked executable');
          
          // Make sure it's executable (though Windows doesn't use chmod)
          fs.chmodSync(targetBinaryPath, 0o755);
          console.log('✅ Set executable permissions');
        } catch (e) {
          console.log('⚠️ Could not set file permissions:', e.message);
        }
        
        if (mainWindow) {
          mainWindow.webContents.send('model-download-status', {
            downloading: false
          });
        }
        
        console.log('🎉 llama.cpp server ready!');
        
        // Retry starting the server
        setTimeout(() => startLlamaServer(), 1000);
        return;
        
      } catch (error) {
        console.error('❌ Failed to download llama.cpp:', error.message);
        
        if (mainWindow) {
          mainWindow.webContents.send('llama-server-status', { 
            running: false, 
            error: 'Failed to download server. Please try again.' 
          });
          mainWindow.webContents.send('model-download-status', {
            downloading: false,
            error: 'Failed to download server'
          });
        }
        return;
      }
      
    } else {
      // Linux/Mac - build from source
      console.log('🔨 Attempting to build llama.cpp server automatically...');
      
      if (mainWindow) {
        mainWindow.webContents.send('llama-server-status', { 
          running: false, 
          error: 'Building llama.cpp server...' 
        });
        mainWindow.webContents.send('model-download-status', {
          downloading: true,
          progress: 0,
          status: 'Building llama.cpp server (this may take a few minutes on first run)...'
        });
      }
      
      try {
        const { execSync } = require('child_process');
        
        // Clone llama.cpp if needed
        if (!fs.existsSync(llamaCppPath) || fs.readdirSync(llamaCppPath).length === 0) {
          console.log('Cloning llama.cpp repository...');
          execSync('git clone https://github.com/ggerganov/llama.cpp llama.cpp', {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit'
          });
        }
        
        // Build llama.cpp
        console.log('Building llama.cpp...');
        execSync('mkdir -p build && cd build && cmake .. -DLLAMA_CURL=OFF && cmake --build . --target llama-server -j4', {
          cwd: llamaCppPath,
          stdio: 'inherit',
          shell: true
        });
        
        console.log('✅ llama.cpp built successfully');
        
        // Hide the download modal since we're done building
        if (mainWindow) {
          mainWindow.webContents.send('model-download-status', {
            downloading: false
          });
        }
        
        // Retry starting the server
        setTimeout(() => startLlamaServer(), 1000);
        return;
        
      } catch (buildError) {
        console.error('❌ Failed to build llama.cpp:', buildError.message);
        
        if (mainWindow) {
          mainWindow.webContents.send('llama-server-status', { 
            running: false, 
            error: 'Failed to build llama.cpp. Please install build tools.' 
          });
          mainWindow.webContents.send('model-download-status', {
            downloading: false,
            error: 'Failed to build llama.cpp server'
          });
        }
        return;
      }
    }
  }
  
  console.log('✅ Found server binary at:', serverPath);
  
  // Check for model file and download if needed
  const modelPath = path.join(__dirname, '..', 'models', 'mistral-7b-instruct-q4_k_m.gguf');
  console.log('🔍 Checking for model at:', modelPath);
  
  if (!fs.existsSync(modelPath)) {
    console.log('📥 Model file not found - user must download manually');
    
    // DON'T auto-download - just notify UI that model is missing
    if (mainWindow) {
      console.log('📨 Notifying UI that model is missing');
      mainWindow.webContents.send('llama-server-status', { 
        running: true,  // Server is running
        modelMissing: true,  // But model is missing
        modelPath: modelPath,
        error: 'Model not downloaded. Click "Download Model" button to enable local AI (4GB download).' 
      });
    }
    
    // Continue starting server without model - it can still run
    console.log('⚠️ Continuing without model - generation will fail until model is downloaded');
  } else {
    // Verify existing model size
    const stats = fs.statSync(modelPath);
    if (stats.size < 4 * 1024 * 1024 * 1024) {
      console.log('Model file appears incomplete, re-downloading...');
      fs.unlinkSync(modelPath);
      
      try {
        const downloadSuccess = await downloadModel();
        if (!downloadSuccess) {
          console.error('Failed to re-download model');
          return;
        }
      } catch (error) {
        console.error('Error re-downloading model:', error);
        return;
      }
    }
  }
  
  // Start the server with optimized settings
  try {
    const os = require('os');
    const { execSync } = require('child_process');
    
    // Get CPU info
    const cpuCount = os.cpus().length;
    const physicalCores = Math.floor(cpuCount / 2); // Estimate physical cores (hyperthreading)
    const optimalThreads = Math.max(1, physicalCores);
    
    // Check for NVIDIA GPU on Windows
    let hasNvidiaGPU = false;
    let gpuMemoryGB = 0;
    
    if (process.platform === 'win32') {
      try {
        // Try to detect NVIDIA GPU using nvidia-smi
        const gpuInfo = execSync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits', 
          { encoding: 'utf8', timeout: 3000 });
        
        if (gpuInfo && gpuInfo.includes('NVIDIA')) {
          hasNvidiaGPU = true;
          // Extract memory in MB and convert to GB
          const memMatch = gpuInfo.match(/,\s*(\d+)/);
          if (memMatch) {
            gpuMemoryGB = parseInt(memMatch[1]) / 1024;
            console.log(`🎮 NVIDIA GPU detected with ${gpuMemoryGB.toFixed(1)}GB VRAM`);
          }
        }
      } catch (e) {
        console.log('📊 No NVIDIA GPU detected, using CPU mode');
      }
    }
    
    // Calculate optimal GPU layers based on VRAM
    let gpuLayers = 0;
    if (hasNvidiaGPU) {
      // RTX 3080 has 10GB, Mistral 7B Q4 needs about 4-5GB
      // We can fit the entire model in VRAM
      if (gpuMemoryGB >= 10) {
        gpuLayers = 999;  // All layers on GPU (use 999 to offload everything)
      } else if (gpuMemoryGB >= 8) {
        gpuLayers = 35;  // Full model on GPU
      } else if (gpuMemoryGB >= 6) {
        gpuLayers = 24;  // Most layers on GPU
      } else if (gpuMemoryGB >= 4) {
        gpuLayers = 16;  // Partial offload
      }
      console.log(`🚀 GPU offload: ${gpuLayers} layers (${gpuMemoryGB.toFixed(1)}GB VRAM available)`);
    }
    
    const args = [
      '-m', modelPath,
      '-c', '4096',                    // Increased context for better quality
      '--host', '127.0.0.1',
      '--port', '8080',
      '-t', '8',                       // Use 8 threads for i9-12900K (P-cores)
      '-b', '512',                     // Larger batch for GPU
      '--n-gpu-layers', gpuLayers.toString(), // Correct parameter for GPU layers
      '--parallel', '2',               // Handle 2 concurrent requests
      '--mlock'                        // Lock model in RAM (you have 128GB)
    ];
    
    // Note: Flash attention (--flash-attn) can be added if your build supports it
    // Uncomment if you built with flash attention support:
    // if (hasNvidiaGPU && gpuLayers > 0) {
    //   args.push('--flash-attn');
    // }
    
    console.log(`⚡ Optimized settings: ${optimalThreads} threads, ${gpuLayers} GPU layers`);
    
    console.log('Starting server:', serverPath);
    console.log('With args:', args);
    
    // Windows needs special handling for spawning executables
    const spawnOptions = {
      cwd: path.dirname(serverPath),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    };
    
    if (process.platform === 'win32') {
      // On Windows, use shell: true to properly execute the binary
      spawnOptions.shell = true;
      // Also quote the path in case it has spaces
      llamaServerProcess = spawn(`"${serverPath}"`, args, spawnOptions);
    } else {
      llamaServerProcess = spawn(serverPath, args, spawnOptions);
    }
    
    llamaServerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('llama.cpp:', output);
      
      // Check if server is ready
      if (output.includes('HTTP server listening') || output.includes('server listening')) {
        console.log('llama.cpp server is ready!');
        llamaServerReady = true;
        llamaServerStartAttempts = 0;
        
        if (mainWindow) {
          mainWindow.webContents.send('llama-server-status', { running: true });
        }
      }
    });
    
    llamaServerProcess.stderr.on('data', (data) => {
      console.error('llama.cpp error:', data.toString());
    });
    
    llamaServerProcess.on('error', (error) => {
      console.error('Failed to start llama.cpp server:', error);
      llamaServerProcess = null;
      llamaServerReady = false;
      
      if (mainWindow) {
        mainWindow.webContents.send('llama-server-status', { 
          running: false, 
          error: error.message 
        });
      }
      
      // Retry if we haven't exceeded max attempts
      if (llamaServerStartAttempts < MAX_LLAMA_START_ATTEMPTS) {
        llamaServerStartAttempts++;
        console.log(`Retrying llama.cpp server start (attempt ${llamaServerStartAttempts}/${MAX_LLAMA_START_ATTEMPTS})...`);
        setTimeout(() => startLlamaServer(), 5000);
      }
    });
    
    llamaServerProcess.on('close', (code) => {
      console.log(`llama.cpp server exited with code ${code}`);
      llamaServerProcess = null;
      llamaServerReady = false;
      
      if (mainWindow && code !== 0) {
        mainWindow.webContents.send('llama-server-status', { 
          running: false, 
          error: `Server exited with code ${code}` 
        });
      }
    });
    
    // Wait a bit and check if server started successfully
    setTimeout(async () => {
      const isHealthy = await checkLlamaServerHealth();
      if (isHealthy) {
        console.log('llama.cpp server confirmed running via health check');
        llamaServerReady = true;
        if (mainWindow) {
          mainWindow.webContents.send('llama-server-status', { running: true });
        }
      } else if (llamaServerProcess) {
        console.log('llama.cpp server started but not responding to health check yet...');
      }
    }, 5000);
    
  } catch (error) {
    console.error('Error starting llama.cpp server:', error);
    llamaServerProcess = null;
    llamaServerReady = false;
    
    if (mainWindow) {
      mainWindow.webContents.send('llama-server-status', { 
        running: false, 
        error: error.message 
      });
    }
  }
}

// Function to stop llama.cpp server
function stopLlamaServer() {
  if (llamaServerProcess) {
    console.log('Stopping llama.cpp server...');
    
    try {
      // Force kill immediately since we need to ensure it stops
      if (process.platform === 'win32') {
        // Windows: use taskkill with tree flag to kill child processes too
        spawnSync('taskkill', ['/pid', llamaServerProcess.pid, '/f', '/t']);
      } else {
        llamaServerProcess.kill('SIGKILL');
      }
      
    } catch (error) {
      console.error('Error stopping llama.cpp server:', error);
    }
    
    llamaServerProcess = null;
    llamaServerReady = false;
  }
  
  // Also kill any orphaned llama-server processes
  if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/F', '/IM', 'llama-server.exe'], { timeout: 2000 });
    } catch (e) {
      // Ignore errors
    }
  }
}

// Track RadPalHotkeys process
let radpalHotkeysProcess = null;
// Track RadPalDictationImport process
let dictationImportProcess = null;
// Track window shortcut processes
const windowShortcutProcesses = new Map();

// Initialize Power Mic III manager
const PowerMicManager = require('./powermic');
let powerMicManager = null;


// Cross-platform helper function to compile AHK
function compileAhkCrossPlatform(ahkCompiler, inputPath, outputPath, binPath) {
  return new Promise((resolve, reject) => {
    const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME;
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      // Native Windows - use direct execution
      execFile(ahkCompiler, ['/in', inputPath, '/out', outputPath, '/bin', binPath], (error) => {
        if (error) {
          reject(new Error(`AHK compilation failed: ${error.message}`));
        } else {
          resolve();
        }
      });
    } else if (isWSL) {
      // WSL environment - use simple approach with Wine or disable AHK features
      console.log('⚠️ AutoHotkey compilation not supported in WSL environment');
      console.log('💡 AHK features will be disabled. For full functionality, run on Windows.');
      
      // Create a dummy executable file to prevent errors
      try {
        fs.writeFileSync(outputPath, '# Dummy AHK executable - WSL environment');
        resolve();
      } catch (error) {
        reject(new Error(`Cannot create dummy AHK file: ${error.message}`));
      }
    } else {
      // macOS and Linux - AHK not supported
      console.log(`⚠️ AutoHotkey compilation not supported on ${process.platform}`);
      console.log('💡 AHK features will be disabled. For full functionality, run on Windows.');
      
      // Create a dummy executable file to prevent errors
      try {
        fs.writeFileSync(outputPath, `# Dummy AHK executable - ${process.platform} environment`);
        resolve();
      } catch (error) {
        reject(new Error(`Cannot create dummy AHK file: ${error.message}`));
      }
    }
  });
}

function getWritablePromptPath() {
  const userDataPath = app.getPath('userData');
  const promptDir = path.join(userDataPath, 'prompts');
  if (!fs.existsSync(promptDir)) fs.mkdirSync(promptDir, { recursive: true });

  const classifyPath = path.join(promptDir, 'classify.txt');
  const defaultClassifyPath = getPromptPath('classify.txt');

  if (!fs.existsSync(classifyPath)) {
    try {
      fs.copyFileSync(defaultClassifyPath, classifyPath);
      console.log('📁 Copied default classify.txt to userData folder.');
    } catch (err) {
      console.error('❌ Failed to copy classify.txt:', err);
    }
  }

  return classifyPath;
}

let clipboardy;
import('clipboardy').then(module => {
  clipboardy = module.default;
});

const logPath = path.join(app.getPath('userData'), 'gpt-log.txt');
const logStream = fs.createWriteStream(logPath, { flags: 'a' });
function log(msg) {
  const timestamp = new Date().toISOString();
  const full = `[${timestamp}] ${msg}\n`;
  logStream.write(full);
  console.log(full);
}

function getPromptPath(filename) {
  const basePath = isDev
    ? path.join(__dirname, '../prompts')
    : path.join(process.resourcesPath, 'prompts');
  return path.join(basePath, filename);
}

const templateAhkPath = path.join(__dirname, '../dictation_templates/custom_clip_template.ahk');
const compiledAhkOutput = path.join(__dirname, '../custom_clip.exe');
const ahkCompiler = path.join(__dirname, 'Ahk2Exe.exe');
const ahkBase = path.join(__dirname, 'Unicode 64-bit.bin');

let currentDictationTarget = 'PowerScribe';
let customWindowName = '';

const exeMap = {
  PowerScribe: 'powerscribe_clip.exe',
  Fluency: 'fluency_clip.exe',
  Dragon: 'dragon_clip.exe',
  Other: 'custom_clip.exe'
};




ipcMain.handle('set-dictation-target', async (_event, value) => {
  currentDictationTarget = value;
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('update-dictation-target', value);
  });
});

ipcMain.handle('set-custom-window-name', async (_event, name) => {
  customWindowName = name;
  try {
    const base = fs.readFileSync(templateAhkPath, 'utf-8');
    const filled = base.replace('<<<WINDOW_TITLE>>>', customWindowName);
    const filledPath = path.join(__dirname, '../custom_clip.ahk');
    fs.writeFileSync(filledPath, filled);

    await compileAhkCrossPlatform(ahkCompiler, filledPath, compiledAhkOutput, ahkBase)
      .then(() => {
        log('✅ AHK compiled custom_clip.exe successfully');
      })
      .catch((error) => {
        log('❌ AHK compile failed: ' + error);
        throw error;
      });
  } catch (err) {
    log('❌ Error preparing custom AHK: ' + err);
  }
});






// REPORT BUTTON LOGIC

let reportWindowBounds = null;

// Persistent window settings storage
const settingsPath = path.join(app.getPath('userData'), 'window-settings.json');

function loadWindowSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      reportWindowBounds = settings.reportWindowBounds || null;
      impressionWindowBounds = settings.impressionWindowBounds || null;
      templateManagerBounds = settings.templateManagerBounds || null;
      logicManagerBounds = settings.logicManagerBounds || null;
      templateViewerBounds = settings.templateViewerBounds || null;
      global.textboxSizes = settings.textboxSizes || {};
      global.tokenUsage = settings.tokenUsage || {};
      // Default to 'openai' (GPT-4o) if no preference is saved
      apiProvider = settings.apiProvider || 'openai';
      console.log('📁 Loaded window settings from disk');
    }
  } catch (err) {
    console.warn('⚠️ Failed to load window settings:', err);
  }
}

function saveWindowSettings() {
  try {
    const settings = {
      reportWindowBounds,
      impressionWindowBounds,
      templateManagerBounds,
      logicManagerBounds,
      templateViewerBounds,
      textboxSizes: global.textboxSizes || {},
      apiProvider: apiProvider,
      tokenUsage: global.tokenUsage || {}
    };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.warn('⚠️ Failed to save window settings:', err);
  }
}

// Token usage tracking
const DEFAULT_DAILY_TOKEN_LIMIT = 10000; // Tier 1 default

// Cache for user token limit from Supabase
let cachedTokenLimit = null;
let tokenLimitCacheTime = null;
const TOKEN_LIMIT_CACHE_DURATION = 2 * 60 * 1000; // Cache for 2 minutes (reduced from 5)

// Function to get token limit for current user (tier-based)
async function getUserTokenLimit() {
  if (!global.currentUser) {
    return DEFAULT_DAILY_TOKEN_LIMIT;
  }
  
  // Check cache first
  if (cachedTokenLimit && tokenLimitCacheTime && 
      (Date.now() - tokenLimitCacheTime) < TOKEN_LIMIT_CACHE_DURATION) {
    console.log(`📦 Returning cached token limit: ${cachedTokenLimit} for user: ${global.currentUser?.email}`);
    console.log(`📦 Cache age: ${Date.now() - tokenLimitCacheTime}ms, Max age: ${TOKEN_LIMIT_CACHE_DURATION}ms`);
    // TEMPORARILY DISABLE CACHE TO DEBUG
    // return cachedTokenLimit;
    console.log('⚠️ CACHE DISABLED FOR DEBUGGING - fetching fresh value');
  }
  
  console.log('🔄 Cache miss or expired, fetching fresh token limit from database');
  
  try {
    // Fetch directly from Supabase
    const session = global.supabaseSession;
    
    if (!session) {
      console.log('⚠️ No session available, using default token limit');
      return DEFAULT_DAILY_TOKEN_LIMIT;
    }

    const supabase = createClient(
      config.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      config.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      }
    );

    console.log('🔍 Querying user_subscriptions for user_id:', global.currentUser.id);
    
    // Query the user_subscriptions table for tier
    const { data: subData, error: subError } = await supabase
      .from('user_subscriptions')
      .select('tier')
      .eq('user_id', global.currentUser.id)
      .maybeSingle();

    console.log('🔍 User subscription query result:', { subData, subError });

    if (subError) {
      console.error('⚠️ Error fetching user subscription:', subError);
      return DEFAULT_DAILY_TOKEN_LIMIT;
    }
    
    // Get tier (default to 1 if no subscription found)
    // Convert to number in case it comes as a string from database
    const rawTier = subData?.tier;
    console.log(`📊 Database returned - Full subData object: ${JSON.stringify(subData)}`);
    console.log(`📊 Raw tier value: ${rawTier}, type: ${typeof rawTier}`);
    let tier = rawTier ? parseInt(rawTier) : 1;
    
    // Validate tier is a valid number
    if (isNaN(tier) || tier < 1 || tier > 5) {
      console.log(`⚠️ Invalid tier value: ${rawTier}, defaulting to tier 1`);
      tier = 1;
    }
    
    // Force tier to be a number for the switch statement
    tier = Number(tier);
    console.log(`🔢 Final tier for switch: ${tier}, is strictly equal to 1? ${tier === 1}, to 2? ${tier === 2}, to 3? ${tier === 3}`)
    
    console.log(`🔍 Raw tier from DB: ${rawTier}, Parsed tier: ${tier}`);
    
    // Calculate token limit based on tier
    let tokenLimit;
    console.log(`🎯 Entering switch statement with tier: ${tier} (type: ${typeof tier})`);
    switch(tier) {
      case 1:
        console.log('📌 Matched tier 1 - Setting limit to 10,000');
        tokenLimit = 10000;   // Free: 10k tokens/day
        break;
      case 2:
        console.log('📌 Matched tier 2 - Setting limit to 100,000');
        tokenLimit = 100000;  // Pro: 100k tokens/day
        break;
      case 3:
        console.log('📌 Matched tier 3 - Setting limit to 200,000');
        tokenLimit = 200000;  // Premium: 200k tokens/day
        break;
      case 4:
        console.log('📌 Matched tier 4 - Setting limit to 200,000');
        tokenLimit = 200000;  // Tester: 200k tokens/day
        break;
      case 5:
        console.log('📌 Matched tier 5 - Setting limit to UNLIMITED');
        tokenLimit = 999999999;  // Developer: Unlimited (using very large number)
        break;
      default:
        console.log(`⚠️ Unexpected tier value: ${tier}, defaulting to tier 1`);
        tokenLimit = DEFAULT_DAILY_TOKEN_LIMIT; // Default to tier 1
    }

    console.log(`💰 Final result - User: ${global.currentUser.email}, Tier: ${tier}, Token limit: ${tokenLimit}`);
    
    if (tokenLimit && tokenLimit > 0) {
      // Cache the result
      cachedTokenLimit = tokenLimit;
      tokenLimitCacheTime = Date.now();
      return tokenLimit;
    }
  } catch (error) {
    console.error('❌ Failed to fetch token limit from Supabase:', error);
  }
  
  // Return default if fetch fails or no custom limit set
  return DEFAULT_DAILY_TOKEN_LIMIT;
}

// Clear cache when user changes
function clearTokenLimitCache() {
  console.log('🧹 Clearing token limit cache');
  cachedTokenLimit = null;
  tokenLimitCacheTime = null;
}

// Helper function to get Pacific Time date for daily reset at 9pm
function getPacificResetDate() {
  const now = new Date();
  // Convert to Pacific Time
  const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  
  // If it's before 9pm, use today's date; if after 9pm, use tomorrow's date
  if (pacificTime.getHours() < 21) {
    // Before 9pm, reset date is today
    return pacificTime.toDateString();
  } else {
    // After 9pm, reset date is tomorrow
    const tomorrow = new Date(pacificTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toDateString();
  }
}

function initTokenUsage() {
  if (!global.tokenUsage) {
    global.tokenUsage = {};
  }
  
  const currentResetDate = getPacificResetDate();
  
  // If it's a new day (past the reset time), reset the count
  if (global.tokenUsage.resetDate !== currentResetDate) {
    global.tokenUsage = {
      resetDate: currentResetDate,
      totalTokens: 0
    };
    saveWindowSettings();
    console.log(`🔄 Token usage reset for ${currentResetDate}`);
  }
}

async function addTokenUsage(tokens) {
  initTokenUsage();
  global.tokenUsage.totalTokens += tokens;
  saveWindowSettings();
  const tokenLimit = await getUserTokenLimit();
  console.log(`📊 Token usage: ${global.tokenUsage.totalTokens}/${tokenLimit} (User: ${global.currentUser?.email || 'anonymous'})`);
  
  // Broadcast updated usage to all windows
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('token-usage-updated', {
      used: global.tokenUsage.totalTokens,
      limit: tokenLimit,
      percentage: (global.tokenUsage.totalTokens / tokenLimit) * 100
    });
  });
}

async function getCurrentTokenUsage() {
  initTokenUsage();
  const tokenLimit = await getUserTokenLimit();
  return {
    used: global.tokenUsage.totalTokens,
    limit: tokenLimit,
    percentage: (global.tokenUsage.totalTokens / tokenLimit) * 100
  };
}

async function isTokenLimitExceeded() {
  initTokenUsage();
  const tokenLimit = await getUserTokenLimit();
  // Developer tier (limit of 999999999) never gets blocked
  if (tokenLimit >= 999999999) {
    return false;
  }
  return global.tokenUsage.totalTokens >= tokenLimit;
}

// Helper function to get main window position for popup positioning
function getMainWindowPosition() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const mainBounds = mainWindow.getBounds();
    return {
      x: mainBounds.x + 50, // Offset slightly to the right
      y: mainBounds.y + 50, // Offset slightly down
      width: 900,
      height: 1200
    };
  }
  return { x: 100, y: 100, width: 900, height: 1200 }; // Fallback if main window not available
}

ipcMain.on('open-popup', (event, content) => {
  // Use saved bounds if available, otherwise position relative to main window
  const bounds = reportWindowBounds || getMainWindowPosition();

  // Match display that previously held the popup
  const display = screen.getDisplayMatching(bounds);

  // Clamp width/height to stay within display work area
  const maxWidth = display.workArea.width;
  const maxHeight = display.workArea.height;

  const width = Math.min(bounds.width, maxWidth);
  const height = Math.min(bounds.height, maxHeight);

  popupWindow = new BrowserWindow({
    frame: false,
    width,
    height,
    x: bounds.x,
    y: bounds.y,
    resizable: true,
    maximizable: false,
    thickFrame: false,
    hasShadow: false,
    roundedCorners: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'popupPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:radpal', // Add persistent partition for session storage
    }
  });

  const popupPath = path.join(__dirname, '../dist/popup.html');
  popupWindow.loadFile(popupPath);

  popupWindow.webContents.once('did-finish-load', () => {
    // Optional: reinforce bounds to prevent system resizing
    popupWindow.setBounds({
      x: bounds.x,
      y: bounds.y,
      width,
      height
    });

    popupWindow.focus();
    popupWindow.webContents.send('popup-content', content);
  });

  const saveBounds = () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      reportWindowBounds = popupWindow.getBounds();
      saveWindowSettings();
    }
  };

  popupWindow.on('resize', saveBounds);
  popupWindow.on('move', saveBounds);

  popupWindow.on('closed', () => {
    popupWindow = null;
  });
});





// IMPRESSION BUTTON LOGIC

let impressionWindowBounds = null;
let templateManagerBounds = null;
let logicManagerBounds = null;
let templateViewerBounds = null;

ipcMain.on('open-popup-impression', (event, content) => {
  // Use saved bounds if available, otherwise position relative to main window
  const defaultBounds = getMainWindowPosition();
  defaultBounds.width = 800;
  defaultBounds.height = 850;
  const bounds = impressionWindowBounds || defaultBounds;

  // Match display that previously held the popup
  const display = screen.getDisplayMatching(bounds);

  // Clamp width/height to stay within display work area
  const maxWidth = display.workArea.width;
  const maxHeight = display.workArea.height;

  const width = Math.min(bounds.width, maxWidth);
  const height = Math.min(bounds.height, maxHeight);

  popupWindow = new BrowserWindow({
    frame: false,
    width,
    height,
    x: bounds.x,
    y: bounds.y,
    resizable: true,
    maximizable: false,
    thickFrame: false,
    hasShadow: false,
    roundedCorners: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'popupPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:radpal', // Add persistent partition for session storage
    }
  });

  const popupPath = path.join(__dirname, '../dist/popup.html');
  popupWindow.loadFile(popupPath);

  // Optional: Reinforce bounds after load (some platforms shrink at init)
  popupWindow.webContents.once('did-finish-load', () => {
    popupWindow.setBounds({
      x: bounds.x,
      y: bounds.y,
      width,
      height
    });

    popupWindow.webContents.send('popup-content', content);
  });

  const saveImpressionBounds = () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      impressionWindowBounds = popupWindow.getBounds();
      saveWindowSettings();
    }
  };

  popupWindow.on('resize', saveImpressionBounds);
  popupWindow.on('move', saveImpressionBounds);

  popupWindow.on('closed', () => {
    popupWindow = null;
  });
});


// ✅ IPC handler for UI contracted state

let lastExpandedBounds = null;


ipcMain.on('contract-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;


  // Store the current bounds before contracting
  if (!lastExpandedBounds) {
    lastExpandedBounds = win.getBounds();
  }

  // Allow the resize for contract operation
  allowContractResize = true;
  
  // Contract the window vertically only (keep width unchanged)
  const contractedHeight = 80;
  const currentBounds = win.getBounds();
  
  win.setBounds({
    x: currentBounds.x,
    y: currentBounds.y,
    width: currentBounds.width, // Keep current width
    height: contractedHeight
  });
  
  // Reset the flag after a short delay
  setTimeout(() => {
    allowContractResize = false;
  }, 100);
  
});

ipcMain.on('expand-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;


  // Determine what size to expand to
  const targetBounds = lastExpandedBounds || originalBounds;
  
  if (targetBounds) {
    // Allow the resize for expand operation
    allowContractResize = true;
    
    const currentBounds = win.getBounds();
    
    win.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width: targetBounds.width,
      height: targetBounds.height
    });
    
    // Reset the flag after a short delay
    setTimeout(() => {
      allowContractResize = false;
    }, 100);
    
  }
});








// ✅ IPC handlers for Supabase user sharing
ipcMain.handle('get-current-user', () => {
  return global.currentUser || null;
});

ipcMain.handle('set-supabase-session', async (_event, session) => {
  console.log('🧠 Supabase session received in main process')
  
  // Only update if session actually changed to prevent redundant operations
  if (global.supabaseSession?.access_token === session?.access_token) {
    console.log('🔍 Session unchanged, skipping redundant operations')
    return;
  }
  
  global.supabaseSession = session
  
  // Initialize macros IPC with the session
  macrosIPC.initSupabase(session);
  
  // Update medical terms IPC with the session
  const { updateSession: updateMedicalTermsSession } = require('./medicalTermsIPC');
  updateMedicalTermsSession(session);
  
  // Clear cache and fetch new token limit now that we have a session
  if (session && global.currentUser) {
    clearTokenLimitCache();
    const tokenLimit = await getUserTokenLimit();
    console.log(`💰 Updated token limit after session: ${tokenLimit.toLocaleString()} tokens for ${global.currentUser.email}`);
    
    // Send updated token usage to reflect new limit
    const usage = await getCurrentTokenUsage();
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('token-usage-updated', usage);
    });
  }
})

ipcMain.handle('get-supabase-session', () => {
  console.log('📤 Sending Supabase session to popup')
  return global.supabaseSession || null
})

// Macro IPC handlers
ipcMain.handle('list-macros', async (_event, userId, scope) => {
  // Ensure macrosIPC has the latest session
  if (global.supabaseSession) {
    macrosIPC.initSupabase(global.supabaseSession);
  }
  return await macrosIPC.listMacros(userId, scope);
});

ipcMain.handle('get-macro', async (_event, userId, name) => {
  // Ensure macrosIPC has the latest session
  if (global.supabaseSession) {
    macrosIPC.initSupabase(global.supabaseSession);
  }
  return await macrosIPC.getMacro(userId, name);
});

ipcMain.handle('save-macro', async (_event, macro) => {
  // Ensure macrosIPC has the latest session
  if (global.supabaseSession) {
    macrosIPC.initSupabase(global.supabaseSession);
  }
  return await macrosIPC.saveMacro(macro);
});

ipcMain.handle('delete-macro', async (_event, userId, macroId) => {
  // Ensure macrosIPC has the latest session
  if (global.supabaseSession) {
    macrosIPC.initSupabase(global.supabaseSession);
  }
  return await macrosIPC.deleteMacro(userId, macroId);
});

ipcMain.handle('set-current-user', async (_event, user) => {
  console.log('🔐 set-current-user received:', user?.id)
  
  // Check for session consistency - if there's a user but no session, it's probably stale
  if (user && !global.supabaseSession) {
    console.log('⚠️ User set without session - this may be stale cached data')
    console.log('🔍 Consider signing out to clear stale state')
  }
  
  // Only update if user actually changed to prevent redundant operations
  if (global.currentUser?.id === user?.id) {
    console.log('🔍 User unchanged, skipping redundant operations')
    return;
  }
  
  global.currentUser = user;
  
  // Clear cache when user changes
  clearTokenLimitCache();
  
  // Fetch and log the token limit for this user
  const tokenLimit = await getUserTokenLimit();
  console.log(`💰 Token limit for ${user?.email || 'anonymous'}: ${tokenLimit.toLocaleString()} tokens`);
  
  // Send updated token usage to reflect new limit
  const usage = await getCurrentTokenUsage();
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('token-usage-updated', usage);
  });
});

ipcMain.on('open-popup-templates', (event, data) => {
  // Use saved bounds if available, otherwise position relative to main window
  const defaultBounds = getMainWindowPosition();
  defaultBounds.width = 1000;
  defaultBounds.height = 950;
  const bounds = templateManagerBounds || defaultBounds;
  
  // Match display that previously held the popup
  const display = screen.getDisplayMatching(bounds);
  
  // Clamp width/height to stay within display work area
  const maxWidth = display.workArea.width;
  const maxHeight = display.workArea.height;
  
  const width = Math.min(bounds.width, maxWidth);
  const height = Math.min(bounds.height, maxHeight);
  
  const popupWindow = new BrowserWindow({
    frame: false,
    x: bounds.x,
    y: bounds.y,
    width,
    height,
    resizable: true,
    maximizable: false,
    thickFrame: false,
    hasShadow: false,
    roundedCorners: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'popupPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:radpal', // Add persistent partition for session storage
    },
  });

  const popupPath = path.join(__dirname, '../dist/popup.html');
  popupWindow.loadFile(popupPath);

  popupWindow.webContents.once('did-finish-load', () => {
    // Optional: reinforce bounds to prevent system resizing
    popupWindow.setBounds({
      x: bounds.x,
      y: bounds.y,
      width,
      height
    });

    popupWindow.focus();
    popupWindow.webContents.send('popup-content', {
      type: 'template-manager',
      isOfflineMode: data?.isOfflineMode || false
    });
  });

  const saveTemplateBounds = () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      templateManagerBounds = popupWindow.getBounds();
      saveWindowSettings();
    }
  };

  popupWindow.on('resize', saveTemplateBounds);
  popupWindow.on('move', saveTemplateBounds);

  popupWindow.on('closed', () => {
    // Window is automatically garbage collected when closed
    // No need to set to null since it's a local const variable
  });
});

ipcMain.on('open-popup-logic', () => {
  // Use saved bounds if available, otherwise position relative to main window
  const defaultBounds = getMainWindowPosition();
  defaultBounds.width = 1000;
  defaultBounds.height = 850;
  const bounds = logicManagerBounds || defaultBounds;
  
  // Match display that previously held the popup
  const display = screen.getDisplayMatching(bounds);
  
  // Clamp width/height to stay within display work area
  const maxWidth = display.workArea.width;
  const maxHeight = display.workArea.height;
  
  const width = Math.min(bounds.width, maxWidth);
  const height = Math.min(bounds.height, maxHeight);
  
  const popupWindow = new BrowserWindow({
    frame: false,
    x: bounds.x,
    y: bounds.y,
    width,
    height,
    resizable: true,
    maximizable: false,
    thickFrame: false,
    hasShadow: false,
    roundedCorners: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'popupPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:radpal', // Add persistent partition for session storage
    },
  });

  const popupPath = path.join(__dirname, '../dist/popup.html');
  popupWindow.loadFile(popupPath);

  popupWindow.webContents.once('did-finish-load', () => {
    // Optional: reinforce bounds to prevent system resizing
    popupWindow.setBounds({
      x: bounds.x,
      y: bounds.y,
      width,
      height
    });

    popupWindow.focus();
    popupWindow.webContents.send('popup-content', {
      type: 'logic-manager'
    });
  });

  const saveLogicBounds = () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      logicManagerBounds = popupWindow.getBounds();
      saveWindowSettings();
    }
  };

  popupWindow.on('resize', saveLogicBounds);
  popupWindow.on('move', saveLogicBounds);

  popupWindow.on('closed', () => {
    // Window is automatically garbage collected when closed
    // No need to set to null since it's a local const variable
  });
});

function createTray() {
  // Create tray icon - use 16x16 icon for better tray display
  const iconPath = isDev 
    ? path.join(__dirname, '..', 'build', 'icons', 'icon_16x16.png')
    : path.join(process.resourcesPath, 'app', 'build', 'icons', 'icon_16x16.png');
  
  // Fallback to main icon if 16x16 doesn't exist
  const fallbackIconPath = isDev
    ? path.join(__dirname, '..', 'build', 'icons', 'icon.png')
    : path.join(process.resourcesPath, 'app', 'build', 'icons', 'icon.png');
  
  let trayIcon;
  try {
    if (fs.existsSync(iconPath)) {
      console.log('Loading tray icon from:', iconPath);
      trayIcon = nativeImage.createFromPath(iconPath);
    } else if (fs.existsSync(fallbackIconPath)) {
      console.log('Loading fallback tray icon from:', fallbackIconPath);
      trayIcon = nativeImage.createFromPath(fallbackIconPath);
      // Resize for tray (16x16 on Windows, 22x22 on macOS)
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    } else {
      console.log('No tray icon found, creating fallback');
      // Create a simple icon as fallback - won't be blank
      const size = process.platform === 'darwin' ? 22 : 16;
      trayIcon = nativeImage.createEmpty();
      // This creates an empty image which shows as blank - we need a better fallback
      // For now, log the error so we can debug
      console.error('Warning: Tray icon files not found at:', iconPath, 'or', fallbackIconPath);
    }
  } catch (error) {
    console.error('Error loading tray icon:', error);
    // Create fallback icon
    const size = process.platform === 'darwin' ? 22 : 16;
    trayIcon = nativeImage.createEmpty();
  }
  
  tray = new Tray(trayIcon);
  tray.setToolTip('RadPal - AI Radiology Assistant');
  
  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show RadPal',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Hide RadPal',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'About',
      click: () => {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'About RadPal',
          message: 'RadPal',
          detail: 'AI-Powered Radiology Reporting Assistant\nVersion: ' + app.getVersion(),
          buttons: ['OK']
        });
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // Handle tray icon click
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  
  return tray;
}

function createWindow() {
  console.log('Creating main window...');
  
  // Always start with login bounds since app starts in login mode
  const savedLoginBounds = loadLoginBounds();
  const defaultLoginWidth = 600;  // Default login width
  const defaultLoginHeight = 900; // Default height
  
  const width = savedLoginBounds ? savedLoginBounds.width : defaultLoginWidth;
  const height = savedLoginBounds ? savedLoginBounds.height : defaultLoginHeight;
  
  const win = new BrowserWindow({
    frame: false,
    width: width,
    height: height,
    resizable: true,
    maximizable: false,
    thickFrame: false,
    hasShadow: true,
    roundedCorners: true,
    transparent: false,
    backgroundColor: '#1a1d23', // Dark background
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      partition: 'persist:radpal', // Add persistent partition for session storage
    }
  });

  // Store default bounds for reset functionality (not current bounds)
  originalBounds = { width: defaultLoginWidth, height: defaultLoginHeight };

  // No resize prevention - allow normal resizing

  const indexPath = path.resolve(__dirname, '../dist/index.html');
  console.log('Loading URL:', `file://${indexPath.replace(/\\/g, '/')}`);
  win.loadURL(`file://${indexPath.replace(/\\/g, '/')}`);
  
  // Comment out dev tools for now
  // win.webContents.openDevTools();
  
  win.webContents.on('did-finish-load', () => {
    console.log('Window finished loading');
    win.show();
  });
  
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  win.on('focus', () => {
    win.webContents.send('window-focus', true);
  });

  win.on('blur', () => {
    win.webContents.send('window-focus', false);
  });

  // Save window bounds on resize and move
  let saveBoundsTimeout;
  let ignoreBoundsChange = false;
  
  const debouncedSaveBounds = () => {
    if (ignoreBoundsChange) {
      return;
    }
    
    clearTimeout(saveBoundsTimeout);
    saveBoundsTimeout = setTimeout(() => {
      if (!win.isDestroyed() && !isResettingWindow) {
        const bounds = win.getBounds();
        // Only save if not in contracted state
        if (bounds.height > 110) {
          saveCurrentWindowBounds(bounds);
        }
      }
    }, 500); // Debounce for 500ms
  };

  win.on('resize', debouncedSaveBounds);
  win.on('move', debouncedSaveBounds);
  
  // Handle window close event
  win.on('close', (event) => {
    // When user clicks the close button, quit the app completely
    // Don't minimize to tray - this is more standard behavior
    isQuitting = true;
    // Let the window close normally which will trigger app quit
  });

  return win;
}

ipcMain.handle('read-prompt', async (event, name) => {
  try {
    const promptPath = getPromptPath(`${name}.txt`);
    return await fs.promises.readFile(promptPath, 'utf-8');
  } catch (err) {
    log('❌ Failed to read prompt: ' + err);
    return '';
  }
});

// Open template viewer window
ipcMain.handle('open-template-viewer', async (event, data) => {
  const { studyType, template } = data;
  
  // Get current window position for default offset
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  const mainBounds = mainWindow.getBounds();
  
  // Use saved bounds if available, otherwise use defaults
  const defaultBounds = {
    width: 800,
    height: 600,
    x: mainBounds.x + 50,
    y: mainBounds.y + 50
  };
  
  const bounds = templateViewerBounds || defaultBounds;
  
  // Ensure window appears on screen
  const display = screen.getDisplayMatching(bounds);
  const maxWidth = display.workArea.width;
  const maxHeight = display.workArea.height;
  
  const width = Math.min(bounds.width, maxWidth);
  const height = Math.min(bounds.height, maxHeight);
  
  // Create template viewer window
  const templateWindow = new BrowserWindow({
    width,
    height,
    x: bounds.x,
    y: bounds.y,
    parent: mainWindow,
    modal: false,
    frame: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    title: `Template: ${studyType}`,
    backgroundColor: '#1e1f25',
    webPreferences: {
      preload: path.join(__dirname, 'popupPreload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  
  // Save bounds when window is resized or moved
  const saveTemplateBounds = () => {
    if (templateWindow && !templateWindow.isDestroyed()) {
      templateViewerBounds = templateWindow.getBounds();
      saveWindowSettings();
    }
  };
  
  templateWindow.on('resize', saveTemplateBounds);
  templateWindow.on('move', saveTemplateBounds);
  templateWindow.on('close', saveTemplateBounds);
  
  // Load the popup HTML
  const popupPath = path.join(__dirname, '../dist/popup.html');
  templateWindow.loadFile(popupPath);
  
  // Send the template data once loaded
  templateWindow.webContents.once('did-finish-load', () => {
    templateWindow.webContents.send('popup-content', {
      mode: 'template-viewer',
      studyType: studyType,
      template: template,
      readOnly: true
    });
  });
  
  return true;
});

ipcMain.handle('get-findings', async (_event, target) => {
  return new Promise((resolve) => {
    const exeName = exeMap[target] || 'powerscribe_clip.exe'
    const exePath = isDev
      ? path.join(__dirname, `../${exeName}`)
      : path.join(process.resourcesPath, exeName)

    execFile(exePath, (error) => {
      if (error) {
        log(`❌ Failed to run ${exeName}: ` + error)
        resolve('')
        return
      }
      setTimeout(() => {
        try {
          const contents = clipboardy ? clipboardy.readSync() : ''
          resolve(contents)
        } catch (err) {
          log('❌ Clipboard read failed: ' + err)
          resolve('')
        }
      }, 500)
    })
  })
})


// Store API preference
let apiProvider = 'openai'; // default to GPT-4o

ipcMain.handle('set-api-provider', async (event, provider) => {
  apiProvider = provider;
  
  // If user selects Mistral (Local), check and start llama server
  if (provider === 'mistral-local') {
    console.log('🎯 Mistral (Local) selected - checking llama.cpp server...');
    
    // Check if llama-server.exe exists
    const serverPath = path.join(__dirname, 'llama-server.exe');
    if (!fs.existsSync(serverPath)) {
      console.log('📥 llama-server.exe not found - prompting for download');
      // Send event to renderer to show download prompt
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('llama-not-installed', {
          message: 'Mistral (Local) requires llama.cpp to be installed. Would you like to download it now? (500MB)',
          downloadUrl: CURRENT_LLAMA_URL
        });
      }
      return provider;
    }
    
    // Check for updates when Mistral is selected
    if (needsLlamaUpdate()) {
      console.log('🔄 Newer llama.cpp version available');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('llama-update-available', {
          currentVersion: CURRENT_LLAMA_VERSION,
          downloadUrl: CURRENT_LLAMA_URL,
          message: 'A newer version of llama.cpp is available. Update for better performance?'
        });
      }
    }
    
    // Start llama server if not already running
    await startLlamaServer(false); // false = don't check for updates again
  }
  
  // Store preference persistently
  if (global.windowSettings) {
    global.windowSettings.apiProvider = provider;
    saveWindowSettings();
  }
  return provider;
});

ipcMain.handle('get-api-provider', async () => {
  return apiProvider;
});

// Helper function to call AI proxy
async function callAIProxy(service, body) {
  const PROXY_URL = 'https://ynzikfmpzhtohwsfniqv.supabase.co/functions/v1/ai-proxy';
  const session = global.supabaseSession;
  
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${config.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY}`,
      'apikey': config.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      service,
      ...body
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    
    // Parse specific error types and provide user-friendly messages
    if (error.includes('overloaded_error') || error.includes('Overloaded')) {
      throw new Error('❌ Claude API servers are currently overloaded. Please try again in a few moments.');
    } else if (error.includes('Invalid header value')) {
      throw new Error('❌ API configuration error: Invalid API key format. Please check your API key configuration.');
    } else if (error.includes('unauthorized') || error.includes('Unauthorized')) {
      throw new Error('❌ API authentication failed. Please check your API key.');
    } else if (error.includes('rate_limit')) {
      throw new Error('❌ API rate limit exceeded. Please wait a moment before trying again.');
    } else if (error.includes('Invalid service')) {
      throw new Error('❌ Invalid AI service selected.');
    }
    
    // Generic error fallback
    throw new Error(`❌ API error: ${error}`);
  }
  
  return await response.json();
}

ipcMain.handle('generate-report', async (event, prompt) => {
  try {
    // Check token limit before making API call
    if (await isTokenLimitExceeded()) {
      const tokenLimit = await getUserTokenLimit();
      return {
        text: `❌ Daily token limit exceeded (${tokenLimit.toLocaleString()} tokens). Limit resets daily at 9pm Pacific.`,
        tokens: { input: 0, output: 0, total: 0 }
      };
    }
    // Check for Mistral Local first
    if (apiProvider === 'local-ai' || apiProvider === 'mistral-local') {
      // Use local llama.cpp server
      console.log('🏠 Using local Mistral model via llama.cpp');
      console.log('Prompt length:', prompt.length, 'characters');
      console.log('Prompt preview:', prompt.substring(0, 200) + '...');
      
      try {
        const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'mistral-7b-instruct',
            messages: [
              { role: 'user', content: prompt }
            ],
            temperature: 0.3,  // Lower = faster, more deterministic
            max_tokens: 500,   // Limit output length for speed
            top_p: 0.9,        // Reduce sampling complexity
            repeat_penalty: 1.1 // Prevent repetition
          })
        });
        
        if (!response.ok) {
          throw new Error(`Local AI server error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📥 Response from local Mistral:', JSON.stringify(data));
        
        const text = data.choices[0]?.message?.content || '❌ Local AI output missing';
        const totalTokens = data.usage?.total_tokens || 0;
        const inputTokens = data.usage?.prompt_tokens || 0;
        const outputTokens = data.usage?.completion_tokens || 0;
        
        // Track token usage (local models don't count against quota)
        console.log(`🔢 Local model tokens: ${totalTokens} (not counted against quota)`);
        
        return {
          text: text,
          tokens: {
            input: inputTokens,
            output: outputTokens,
            total: totalTokens
          }
        };
      } catch (error) {
        console.error('❌ Local AI error:', error);
        return {
          text: `❌ Local AI server error: ${error.message}. Make sure the llama.cpp server is running.`,
          tokens: { input: 0, output: 0, total: 0 }
        };
      }
    } else if (apiProvider === 'claude-sonnet' || apiProvider === 'claude-opus' || apiProvider === 'claude-opus-4.1') {
      // Use the correct Claude 4 model names
      let model;
      let maxTokens;
      if (apiProvider === 'claude-opus-4.1') {
        // Claude Opus 4.1
        model = 'claude-opus-4-1-20250805';
        maxTokens = 8192; // Higher token limit for Opus 4.1
      } else if (apiProvider === 'claude-opus') {
        // Claude 4 Opus
        model = 'claude-opus-4-20250514';
        maxTokens = 8192; // Higher token limit for Opus
      } else {
        // Claude 4 Sonnet
        model = 'claude-sonnet-4-20250514';
        maxTokens = 4096; // Standard token limit
      }
      
      console.log(`📤 Sending prompt to Claude API (${apiProvider}) using model: ${model}`);
      console.log('API Provider check:', apiProvider, 'Model selected:', model);
      console.log('Prompt length:', prompt.length, 'characters');
      console.log('Prompt preview:', prompt.substring(0, 200) + '...');
      
      // Use proxy for Anthropic
      const data = await callAIProxy('anthropic', {
        model: model,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      console.log('📥 Response from Claude:', JSON.stringify(data, null, 2));
      
      // Extract token usage from Claude response
      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;
      const totalTokens = inputTokens + outputTokens;
      
      let text = '';
      // Claude returns content as an array with objects containing 'text'
      if (data.content && Array.isArray(data.content) && data.content.length > 0) {
        text = data.content[0].text || '❌ Claude output missing';
      } else {
        // Fallback for different response structures
        text = data.content || data.text || '❌ Claude output missing';
      }
      
      // Track token usage
      await addTokenUsage(totalTokens);
      
      return {
        text: text,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens
        }
      };
    } else if (apiProvider === 'gemini') {
      // Use Google Gemini 2.5 Flash via proxy
      console.log('📤 Sending prompt to Gemini 2.5 Flash via proxy');
      console.log('Prompt length:', prompt.length, 'characters');
      console.log('Prompt preview:', prompt.substring(0, 200) + '...');
      
      // Use proxy for Gemini
      const data = await callAIProxy('gemini', {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        }
      });
      
      console.log('📥 Response from Gemini:', JSON.stringify(data));
      
      // Extract token usage from Gemini response
      const inputTokens = data.usageMetadata?.promptTokenCount || 0;
      const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
      const totalTokens = data.usageMetadata?.totalTokenCount || inputTokens + outputTokens;
      
      // Extract text from Gemini response structure
      let text = '';
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        text = data.candidates[0].content.parts[0]?.text || '❌ Gemini output missing';
      } else {
        text = '❌ Gemini output missing';
      }
      
      // Track token usage
      await addTokenUsage(totalTokens);
      
      return {
        text: text,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens
        }
      };
    } else if (apiProvider === 'kimi') {
      // Use Kimi v2 (Moonshot API) via proxy
      console.log('📤 Sending prompt to Kimi v2 (Moonshot API) via proxy');
      console.log('Prompt length:', prompt.length, 'characters');
      console.log('Prompt preview:', prompt.substring(0, 200) + '...');
      
      // Use proxy for Kimi/Moonshot
      const data = await callAIProxy('kimi', {
        model: 'kimi-k2-0711-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful radiology assistant.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        stream: false
      });
      
      console.log('📥 Response from Kimi:', JSON.stringify(data));
      
      // Extract token usage from Kimi response
      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      const totalTokens = data.usage?.total_tokens || inputTokens + outputTokens;
      
      const text = data.choices[0]?.message?.content || '❌ Kimi output missing';
      
      // Track token usage
      await addTokenUsage(totalTokens);
      
      return {
        text: text,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens
        }
      };
    } else {
      // OpenAI API handling - GPT-4o or GPT-5
      const isGPT5 = apiProvider === 'gpt-5';
      const modelName = isGPT5 ? 'gpt-5' : 'gpt-4o';
      const maxTokens = isGPT5 ? 8192 : 4096; // GPT-5 gets higher token limit
      
      console.log(`📤 Sending prompt to OpenAI ${modelName} via proxy`);
      console.log('Prompt length:', prompt.length, 'characters');
      console.log('Prompt preview:', prompt.substring(0, 200) + '...');
      
      // Build request body based on model
      const requestBody = {
        model: modelName,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful radiology assistant.'
          },
          {
            role: 'user', 
            content: prompt
          }
        ]
      };
      
      // GPT-5 uses max_completion_tokens, older models use max_tokens
      if (isGPT5) {
        requestBody.max_completion_tokens = maxTokens;
      } else {
        requestBody.max_tokens = maxTokens;
      }
      
      // Use proxy for OpenAI
      const data = await callAIProxy('openai', requestBody);
      console.log(`📥 Response from OpenAI ${modelName}:`, JSON.stringify(data));
      
      // Extract token usage from OpenAI response
      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      const totalTokens = data.usage?.total_tokens || inputTokens + outputTokens;
      
      const text = data.choices[0]?.message?.content || '❌ GPT output missing';
      
      // Track token usage
      await addTokenUsage(totalTokens);
      
      return {
        text: text,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens
        }
      };
    }
  } catch (err) {
    console.error('❌ API error:', err);
    // Return the error message directly (it already has the ❌ emoji and clear description)
    return {
      text: err.message || '❌ API failed: ' + err.toString(),
      tokens: { input: 0, output: 0, total: 0 }
    };
  }
});

// IPC handler for generate-report with specific provider (for LogicEditorChat)
ipcMain.handle('generate-report-with-provider', async (event, prompt, forceProvider) => {
  // Store current provider
  const originalProvider = apiProvider;
  
  try {
    // Temporarily set the provider for this call
    const targetProvider = forceProvider || originalProvider;
    
    // Check token limit before making API call
    if (await isTokenLimitExceeded()) {
      const tokenLimit = await getUserTokenLimit();
      return {
        text: `❌ Daily token limit exceeded (${tokenLimit.toLocaleString()} tokens). Limit resets daily at 9pm Pacific.`,
        tokens: { input: 0, output: 0, total: 0 }
      };
    }
    
    if (targetProvider === 'claude-sonnet' || targetProvider === 'claude-opus' || targetProvider === 'claude-opus-4.1') {
      // Use the correct Claude 4 model names
      let model;
      let maxTokens;
      if (targetProvider === 'claude-opus-4.1') {
        // Claude Opus 4.1
        model = 'claude-opus-4-1-20250805';
        maxTokens = 8192; // Higher token limit for Opus 4.1
      } else if (targetProvider === 'claude-opus') {
        // Claude 4 Opus
        model = 'claude-opus-4-20250514';
        maxTokens = 8192; // Higher token limit for Opus
      } else {
        // Claude 4 Sonnet
        model = 'claude-sonnet-4-20250514';
        maxTokens = 4096; // Standard token limit
      }
      
      console.log(`📤 Logic Editor: Sending prompt to Claude API (${targetProvider}) using model: ${model}`);
      
      // Use proxy for Anthropic
      const data = await callAIProxy('anthropic', {
        model: model,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      // Extract token usage from Claude response
      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;
      const totalTokens = inputTokens + outputTokens;
      
      let text = '';
      // Claude returns content as an array with objects containing 'text'
      if (data.content && Array.isArray(data.content) && data.content.length > 0) {
        text = data.content[0].text || '❌ Claude output missing';
      } else {
        // Fallback for different response structures
        text = data.content || data.text || '❌ Claude output missing';
      }
      
      // Track token usage
      await addTokenUsage(totalTokens);
      
      return {
        text: text,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens
        }
      };
    } else if (targetProvider === 'gemini') {
      // Use Google Gemini 2.5 Flash via proxy
      console.log('📤 Logic Editor: Sending prompt to Gemini 2.5 Flash via proxy');
      
      // Use proxy for Gemini
      const data = await callAIProxy('gemini', {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        }
      });
      
      // Extract token usage from Gemini response
      const inputTokens = data.usageMetadata?.promptTokenCount || 0;
      const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
      const totalTokens = data.usageMetadata?.totalTokenCount || inputTokens + outputTokens;
      
      // Extract text from Gemini response structure
      let text = '';
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        text = data.candidates[0].content.parts[0]?.text || '❌ Gemini output missing';
      } else {
        text = '❌ Gemini output missing';
      }
      
      // Track token usage
      await addTokenUsage(totalTokens);
      
      return {
        text: text,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens
        }
      };
    } else if (targetProvider === 'kimi') {
      // Use Kimi v2 (Moonshot API) via proxy
      console.log('📤 Logic Editor: Sending prompt to Kimi v2 via proxy');
      
      // Use proxy for Kimi/Moonshot
      const data = await callAIProxy('kimi', {
        model: 'kimi-k2-0711-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful radiology assistant.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        stream: false
      });
      
      // Extract token usage from Kimi response
      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      const totalTokens = data.usage?.total_tokens || inputTokens + outputTokens;
      
      const text = data.choices[0]?.message?.content || '❌ Kimi output missing';
      
      // Track token usage
      await addTokenUsage(totalTokens);
      
      return {
        text: text,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens
        }
      };
    } else {
      // Handle OpenAI providers (openai, gpt-5) via proxy
      const isGPT5 = targetProvider === 'gpt-5';
      const modelName = isGPT5 ? 'gpt-5' : 'gpt-4o';
      const maxTokens = isGPT5 ? 8192 : 4096;
      
      console.log(`📤 Logic Editor: Sending prompt to OpenAI ${modelName} via proxy`);
      
      // Build request body based on model
      const requestBody = {
        model: modelName,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful radiology assistant.'
          },
          {
            role: 'user', 
            content: prompt
          }
        ]
      };
      
      // GPT-5 uses max_completion_tokens, older models use max_tokens
      if (isGPT5) {
        requestBody.max_completion_tokens = maxTokens;
      } else {
        requestBody.max_tokens = maxTokens;
      }
      
      // Use proxy for OpenAI
      const data = await callAIProxy('openai', requestBody);
      
      // Extract token usage from OpenAI response
      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      const totalTokens = data.usage?.total_tokens || inputTokens + outputTokens;
      
      const text = data.choices[0]?.message?.content || '❌ GPT output missing';
      
      // Track token usage
      await addTokenUsage(totalTokens);
      
      return {
        text: text,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens
        }
      };
    }
  } catch (err) {
    console.error('❌ API error:', err);
    // Return the error message directly (it already has the ❌ emoji and clear description)
    return {
      text: err.message || '❌ API failed: ' + err.toString(),
      tokens: { input: 0, output: 0, total: 0 }
    };
  }
  // Note: We don't restore originalProvider because this is a one-off call
});

// IPC handlers for textbox sizes
ipcMain.handle('save-textbox-size', async (event, { key, size }) => {
  if (!global.textboxSizes) {
    global.textboxSizes = {};
  }
  global.textboxSizes[key] = size;
  saveWindowSettings();
});

ipcMain.handle('get-textbox-size', async (event, key) => {
  return global.textboxSizes?.[key] || null;
});

// Token usage IPC handlers
ipcMain.handle('get-token-usage', async () => {
  return getCurrentTokenUsage();
});

ipcMain.handle('check-token-limit', async () => {
  return isTokenLimitExceeded();
});

// Handler for checking if Mistral model is downloaded
ipcMain.handle('check-mistral-model', async () => {
  const modelPath = path.join(__dirname, '..', 'models', 'mistral-7b-instruct-q4_k_m.gguf');
  const exists = fs.existsSync(modelPath);
  
  if (exists) {
    const stats = fs.statSync(modelPath);
    return {
      exists: true,
      size: stats.size,
      sizeGB: (stats.size / 1024 / 1024 / 1024).toFixed(2)
    };
  }
  
  return {
    exists: false,
    size: 0,
    sizeGB: '0',
    requiredSize: '4.07 GB'
  };
});

// Handler for manually downloading Mistral model
ipcMain.handle('download-mistral-model', async () => {
  console.log('📥 User triggered manual model download');
  
  try {
    // Send download starting status
    if (mainWindow) {
      mainWindow.webContents.send('model-download-status', {
        downloading: true,
        progress: 0,
        status: 'Starting download...'
      });
    }
    
    const success = await downloadModel();
    
    if (success) {
      console.log('✅ Model downloaded successfully via manual trigger');
      // Restart the server with the model
      if (llamaServerProcess) {
        console.log('🔄 Restarting server with downloaded model...');
        stopLlamaServer();
        setTimeout(() => startLlamaServer(), 2000);
      }
    }
    
    return success;
  } catch (error) {
    console.error('❌ Manual model download failed:', error);
    if (mainWindow) {
      mainWindow.webContents.send('model-download-status', {
        downloading: false,
        error: error.message
      });
    }
    return false;
  }
});



ipcMain.on('minimize-popup', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) win.minimize()
})

ipcMain.on('close-popup', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) win.close()
})

// Handle gentle close from login panel - just hide to tray if available
ipcMain.on('close-app-gentle', () => {
  console.log('🔵 Gentle close requested from login panel');
  
  if (tray && mainWindow) {
    // If we have a tray, just hide the window
    mainWindow.hide();
  } else {
    // Otherwise, quit normally
    isQuitting = true;
    app.quit();
  }
})

ipcMain.on('quit-app', () => {
  console.log('🛑 Quit app requested from renderer - forcing immediate exit');
  
  // Remove all event listeners to prevent any cleanup handlers from running
  app.removeAllListeners('before-quit');
  app.removeAllListeners('will-quit');
  app.removeAllListeners('window-all-closed');
  
  // Mark as quitting and cleaning up to skip other handlers
  isQuitting = true;
  isCleaningUp = true;
  
  // Destroy all windows immediately without any checks
  try {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(w => {
      w.removeAllListeners();
      w.destroy();
    });
  } catch (e) {
    // Ignore errors
  }
  
  // Kill child processes on Windows without waiting
  if (process.platform === 'win32') {
    const { spawn } = require('child_process');
    
    // Fire and forget process kills
    try {
      if (llamaServerProcess && llamaServerProcess.pid) {
        process.kill(llamaServerProcess.pid, 'SIGKILL');
      }
    } catch (e) {}
    
    try {
      if (radpalHotkeysProcess && radpalHotkeysProcess.pid) {
        process.kill(radpalHotkeysProcess.pid, 'SIGKILL');
      }
    } catch (e) {}
    
    // Kill all window shortcut processes
    for (const [name, proc] of windowShortcutProcesses) {
      try {
        if (proc && proc.pid) {
          process.kill(proc.pid, 'SIGKILL');
        }
      } catch (e) {}
    }
    
    // Build list of all processes to kill
    const processesToKill = ['RadPalHotkeys.exe', 'llama-server.exe', 'RadPalDictationImport.exe'];
    
    // Add all window shortcut executables
    for (const [name] of windowShortcutProcesses) {
      processesToKill.push(`${name}.exe`);
    }
    
    // Spawn detached killers for any remaining processes
    processesToKill.forEach(proc => {
      try {
        spawn('taskkill', ['/F', '/IM', proc], { 
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        }).unref();
      } catch (e) {}
    });
  }
  
  // Use the most aggressive exit method available
  console.log('🛑 Forcing immediate process termination...');
  
  // On Windows, kill our own process directly
  if (process.platform === 'win32') {
    const { spawnSync } = require('child_process');
    
    // Get our own process ID and kill it forcefully
    try {
      // Kill using Windows taskkill with /T to kill process tree
      spawnSync('taskkill', ['/F', '/PID', process.pid.toString(), '/T'], { 
        windowsHide: true,
        timeout: 500 
      });
    } catch (e) {
      console.error('Failed to kill via taskkill:', e);
    }
  }
  
  // Force exit with code 0 to indicate success
  // Use setImmediate to ensure this runs after current stack
  setImmediate(() => {
    process.exit(0);
  });
  
  // Also try immediate exit
  process.exit(0);
})


// Handle custom window resizing
ipcMain.on('resize-window', (event, { width, height }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !isResettingWindow) {
    const currentBounds = win.getBounds();
    const newBounds = {
      x: currentBounds.x,
      y: currentBounds.y,
      width: Math.max(400, Math.min(1600, width)),
      height: Math.max(300, Math.min(1200, height))
    };
    win.setBounds(newBounds);
    // Save the new bounds
    if (newBounds.height > 110) {
      saveCurrentWindowBounds(newBounds);
    }
  }
});

// Handle popup window resizing
ipcMain.on('resize-popup', (event, { width, height }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const currentBounds = win.getBounds();
    win.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width: Math.max(400, Math.min(1600, width)),
      height: Math.max(300, Math.min(1200, height))
    });
  }
});

// Start monitoring window size to enforce original dimensions (only during reset)
function startWindowMonitoring(win) {
  if (windowMonitorInterval) {
    clearInterval(windowMonitorInterval);
  }
  
  // Only monitor if we're actually resetting
  if (!isResettingWindow) {
    return;
  }
  
  windowMonitorInterval = setInterval(() => {
    if (win && originalBounds && !win.isDestroyed() && isResettingWindow) {
      const currentBounds = win.getBounds();
      
      // Check if window size is different from original
      if (currentBounds.width !== originalBounds.width || currentBounds.height !== originalBounds.height) {
        win.setBounds({
          x: currentBounds.x,
          y: currentBounds.y,
          width: originalBounds.width,
          height: originalBounds.height
        });
        
        // Reset contract window tracking
        lastExpandedBounds = null;
      }
    }
  }, 100); // Check every 100ms
}

// Stop monitoring window size
function stopWindowMonitoring() {
  if (windowMonitorInterval) {
    clearInterval(windowMonitorInterval);
    windowMonitorInterval = null;
  }
}

// Reset window size to original dimensions (useful for logout)
ipcMain.on('reset-window-size', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  

  if (win && originalBounds) {
    const currentBounds = win.getBounds();
    
    // Set flag to prevent contract operations during reset
    isResettingWindow = true;
    
    // Start aggressive monitoring to prevent any resize
    startWindowMonitoring(win);
    
    // Force reset to original dimensions
    win.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width: originalBounds.width,
      height: originalBounds.height
    });
    
    // Reset the expanded bounds tracking used by contract-window
    lastExpandedBounds = null;
    
    // Additional reset with a small delay to ensure it takes effect
    setTimeout(() => {
      win.setBounds({
        x: currentBounds.x,
        y: currentBounds.y,
        width: originalBounds.width,
        height: originalBounds.height
      });
    }, 50);
    
    // Clear the reset flag after a longer delay but keep monitoring
    setTimeout(() => {
      isResettingWindow = false;
    }, 2000);
    
    // Stop monitoring after 5 seconds to allow normal operation
    setTimeout(() => {
      stopWindowMonitoring();
    }, 5000);
  }
});

// Handle login mode window resize
ipcMain.on('resize-for-login-mode', (event) => {
  currentMode = 'login'; // Set current mode
  ignoreBoundsChange = true; // Prevent auto-save from corrupting bounds
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const currentBounds = win.getBounds();
    
    // Try to load saved login bounds, fallback to defaults
    const savedLoginBounds = loadLoginBounds();
    const loginWidth = savedLoginBounds ? savedLoginBounds.width : 600;  // Default wider for login form
    const loginHeight = savedLoginBounds ? savedLoginBounds.height : 900; // Default height
    
    win.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width: loginWidth,
      height: loginHeight
    });
    
    // Save current login bounds
    saveLoginBounds({ 
      x: currentBounds.x, 
      y: currentBounds.y, 
      width: loginWidth, 
      height: loginHeight 
    });
    
    // Reset bounds change flag after a delay
    setTimeout(() => {
      ignoreBoundsChange = false;
    }, 1000);
  }
});

// Test IPC handler
ipcMain.on('test-ipc-connection', (event) => {
  // IPC connection test
});

// Test handler for login channel called from main mode
ipcMain.on('resize-for-login-mode-from-main', (event) => {
  // Test handler
});

// Handle main UI mode window resize  
ipcMain.on('resize-for-main-mode', (event) => {
  currentMode = 'main'; // Set current mode
  ignoreBoundsChange = true; // Prevent auto-save from corrupting bounds
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const currentBounds = win.getBounds();
    
    // Try to load saved main bounds, fallback to defaults
    const savedMainBounds = loadMainBounds();
    
    // Ensure main UI is never smaller than 800px
    let mainWidth = savedMainBounds ? savedMainBounds.width : 1200;  // Much wider default
    let mainHeight = savedMainBounds ? savedMainBounds.height : 900;
    
    if (mainWidth <= 700) {
      mainWidth = 1200;  // Force wide width
    }
    
    win.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width: mainWidth,
      height: mainHeight
    });
    
    // Save main UI bounds with the correct width (always use mainWidth, not current)
    saveMainBounds({ 
      x: currentBounds.x, 
      y: currentBounds.y, 
      width: mainWidth,  // Always save the intended main UI width
      height: mainHeight 
    });
    
    // Reset bounds change flag after a delay
    setTimeout(() => {
      ignoreBoundsChange = false;
    }, 1000);
  }
});

// Handle saving login bounds manually
ipcMain.on('save-login-bounds', (event, bounds) => {
  saveLoginBounds(bounds);
});

// Handle saving main bounds manually  
ipcMain.on('save-main-bounds', (event, bounds) => {
  saveMainBounds(bounds);
});

ipcMain.handle('register-global-hotkeys', (_event, shortcuts) => {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return

  globalShortcut.unregisterAll()

  shortcuts.forEach(({ hotkey, action }) => {
    const success = globalShortcut.register(hotkey, () => {
      console.log(`🔥 Hotkey triggered: ${hotkey} → ${action}`)

      if (action === 'generate-report') {
  win.webContents.send('trigger-generate-report');
} else if (action === 'generate-impression') {
  win.webContents.send('trigger-generate-impression');
} else if (action === 'autofill-1' || action === 'autofill-2') {
  win.webContents.send('trigger-auto-text-fill', action);
}

    })

    if (!success) {
      console.warn(`❌ Failed to register hotkey: ${hotkey}`)
    } else {
      console.log(`✅ Registered hotkey: ${hotkey} → ${action}`)
    }
  })
})


const { globalShortcut } = require('electron')

let mainWindow = null;
let popupWindow = null;
let tray = null;

// Configure auto-updater if available
if (autoUpdater) {
  autoUpdater.autoDownload = false; // Don't auto-download - user must click to download
  autoUpdater.autoInstallOnAppQuit = false; // Don't install on quit, we'll handle it manually
  autoUpdater.autoRunAppAfterInstall = true; // Ensure app runs after install
  autoUpdater.forceAllowUpdate = true; // Force allow updates even if app is packaged differently

  // Auto-updater event handlers
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    
    // Show a system notification
    const { Notification } = require('electron');
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'RadPal Update Required',
        body: `Version ${info.version} is available. Please update to continue using RadPal.`,
        icon: path.join(__dirname, '..', 'build', 'icons', 'icon.png')
      });
      notification.show();
    }
    
    // Send event to renderer process
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available');
    // Send event to renderer process to proceed with login
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available');
    }
  });

  autoUpdater.on('error', (err) => {
    console.log('Error in auto-updater:', err);
    // Send error to renderer but still allow app to continue
    if (mainWindow) {
      mainWindow.webContents.send('update-error', err.message);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);
    
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    
    // Show a dialog to the user
    const { dialog } = require('electron');
    
    const dialogOpts = {
      type: 'info',
      buttons: ['Restart Now', 'Later'],
      title: 'Application Update',
      message: `RadPal ${info.version} has been downloaded`,
      detail: 'A new version has been downloaded. Restart the application to apply the updates.\n\nThe app will restart automatically to complete the installation.',
      defaultId: 0,
      cancelId: 1
    };

    dialog.showMessageBox(mainWindow, dialogOpts).then((returnValue) => {
      if (returnValue.response === 0) {
        // User chose to restart now
        console.log('User chose to restart and install update');
        
        // Set flag to prevent quit prevention
        isUpdating = true;
        
        // Force quit and install with restart
        setImmediate(() => {
          autoUpdater.quitAndInstall(false, true);
        });
      } else {
        // User chose later - send notification to renderer
        if (mainWindow) {
          mainWindow.webContents.send('update-downloaded', info);
        }
      }
    });
  });
}

// IPC handlers for update actions
ipcMain.handle('download-update', async () => {
  if (!autoUpdater) {
    return { success: false, error: 'Auto-updater not available' };
  }
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    console.error('Download update error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-update', () => {
  if (autoUpdater) {
    console.log('🔄 Installing update and restarting app...');
    isUpdating = true;
    
    // Kill all child processes first
    if (process.platform === 'win32') {
      try {
        // Kill llama server
        if (llamaServerProcess) {
          try {
            spawnSync('taskkill', ['/pid', llamaServerProcess.pid, '/f', '/t']);
          } catch (e) {}
          llamaServerProcess = null;
        }
        
        // Kill RadPalHotkeys
        if (radpalHotkeysProcess) {
          try {
            spawnSync('taskkill', ['/pid', radpalHotkeysProcess.pid, '/f', '/t']);
          } catch (e) {}
          radpalHotkeysProcess = null;
        }
        
        // Kill any other RadPal processes
        spawnSync('taskkill', ['/F', '/IM', 'llama-server.exe'], { timeout: 500 });
        spawnSync('taskkill', ['/F', '/IM', 'RadPalHotkeys.exe'], { timeout: 500 });
      } catch (e) {
        console.error('Error killing processes before update:', e);
      }
    }
    
    // Clear intervals
    if (windowMonitorInterval) {
      clearInterval(windowMonitorInterval);
      windowMonitorInterval = null;
    }
    
    // Cleanup hardware
    if (powerMicManager) {
      try {
        powerMicManager.cleanup();
      } catch (e) {}
    }
    
    if (deepgramDictationManager) {
      try {
        deepgramDictationManager.stopDictation();
      } catch (e) {}
    }
    
    // Force close all windows
    BrowserWindow.getAllWindows().forEach(window => {
      try {
        window.destroy();
      } catch (e) {}
    });
    
    // Unregister all shortcuts
    try {
      globalShortcut.unregisterAll();
    } catch (e) {}
    
    // Force quit and install
    setTimeout(() => {
      console.log('🔄 Calling quitAndInstall...');
      
      // Set auto-install flags
      autoUpdater.autoInstallOnAppQuit = true;
      
      // Call quitAndInstall with parameters to force restart
      const options = {
        isSilent: false,  // Show install progress (not silent)
        isForceRunAfter: true,  // Force run after install
        // For newer versions of electron-updater
        execDetached: true  // Run app detached from installer
      };
      
      // Try both methods for compatibility
      try {
        autoUpdater.quitAndInstall(options);
      } catch (e) {
        // Fallback to boolean parameters (false for not silent, true for force run)
        autoUpdater.quitAndInstall(false, true);
      }
      
      // Force the app to actually quit after a delay
      setTimeout(() => {
        console.log('⚠️ Force quitting app for update...');
        app.exit(0);
      }, 1000);
    }, 500);
  }
});

ipcMain.handle('check-for-updates', async () => {
  if (!autoUpdater) {
    // In dev mode or when updater not available, immediately signal completion
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-not-available');
      mainWindow.webContents.send('update-check-complete');
    }
    return null;
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    // Only return serializable data from the update check result
    if (result && result.updateInfo) {
      return {
        version: result.updateInfo.version,
        releaseDate: result.updateInfo.releaseDate,
        releaseName: result.updateInfo.releaseName,
        releaseNotes: result.updateInfo.releaseNotes
      };
    }
    return null;
  } catch (error) {
    console.error('Check for updates error:', error);
    // Send completion signal even on error
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-check-complete');
    }
    return null;
  }
});

// GPU memory optimization flags - macOS specific tile memory warnings (non-critical for Windows deployment)
if (process.platform === 'darwin') {
  // macOS-specific tile memory management
  app.commandLine.appendSwitch('disable-gpu-memory-buffer-compositor-resources')
  app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames')
  app.commandLine.appendSwitch('max-tiles-for-interest-area', '256')
  app.commandLine.appendSwitch('max-unused-resource-memory-usage-percentage', '15')
  app.commandLine.appendSwitch('default-tile-width', '128')
  app.commandLine.appendSwitch('default-tile-height', '128')
  
  // Disable hardware acceleration on macOS to reduce tile memory issues
  app.disableHardwareAcceleration()
} else {
  // Windows/other platforms - keep hardware acceleration for better performance
  // No special tile memory flags needed
}

// Handle certificate errors for corporate environments
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  console.log('⚠️ Certificate error for URL:', url)
  console.log('⚠️ Certificate error details:', error)
  // Prevent having error
  event.preventDefault()
  // and continue with insecure certificate
  callback(true)
})

app.whenReady().then(async () => {
  loadWindowSettings()
  registerSupabaseHandlers()
  
  // Register handler to check if running in production
  ipcMain.handle('is-production', () => !isDev)
  
  // Register handler to clear auto-text values
  ipcMain.handle('clear-auto-text-values', () => {
    console.log('🔒 Clearing auto-text values for security')
    return true
  })
  
  // Initialize and register agent logic IPC handlers
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ynzikfmpzhtohwsfniqv.supabase.co'
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluemlrZm1wemh0b2h3c2ZuaXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNjc5NzYsImV4cCI6MjA2NTY0Mzk3Nn0.uHIXkVvI03vjZ0XdLPkkznME1K0ivDJ6FVU2VeoJdHc'
  initAgentLogicSupabase(supabaseUrl, supabaseKey)
  registerAgentLogicHandlers()
  registerAgentLogicV2Handlers() // Register new v2 handlers
  registerUserProfileHandlers() // Register user profile handlers
  registerMedicalTermsHandlers(supabaseUrl, supabaseKey) // Register medical terms handlers
  setupReportIPC() // Register report IPC handlers
  
  // Initialize medical terms with session if available
  if (global.supabaseSession) {
    const { updateSession: updateMedicalTermsSession } = require('./medicalTermsIPC');
    updateMedicalTermsSession(global.supabaseSession);
  }
  
  mainWindow = createWindow()
  
  // Create system tray icon
  createTray()
  
  // Don't automatically start llama.cpp server - wait for user to select Mistral model
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('🪟 Window loaded');
    // llama.cpp server will only start when user selects Mistral (Local) model
    
    // Check for updates after window loads (if auto-updater is available and not in dev)
    if (autoUpdater && !isDev) {
      console.log('Checking for application updates...');
      
      // Send notification that we're checking for updates
      mainWindow.webContents.send('checking-for-update');
      
      autoUpdater.checkForUpdates().catch(err => {
        console.error('Error checking for updates:', err);
        // Still allow app to continue if update check fails
        mainWindow.webContents.send('update-check-complete');
      });
    } else {
      console.log('Auto-updater skipped (dev mode or not available)');
      // Send complete signal so app continues
      mainWindow.webContents.send('update-check-complete');
    }
  });
  
  // IPC handler for llama server status
  ipcMain.handle('get-llama-server-status', async () => {
    const isHealthy = await checkLlamaServerHealth()
    return {
      running: isHealthy,
      process: !!llamaServerProcess,
      ready: llamaServerReady
    }
  })
  
  // IPC handler to restart llama server
  ipcMain.handle('restart-llama-server', async () => {
    stopLlamaServer()
    await new Promise(resolve => setTimeout(resolve, 1000))
    await startLlamaServer()
    return true
  })
  
  // IPC handlers for CUDA binary installation
  ipcMain.handle('check-cuda-support', async () => {
    const { checkCudaSupport } = require('./installCudaBinary')
    return checkCudaSupport()
  })
  
  ipcMain.handle('install-cuda-binary', async (event) => {
    const { installCudaBinary } = require('./installCudaBinary')
    
    // Use the latest CUDA-enabled build
    const CUDA_URL = 'https://github.com/ggml-org/llama.cpp/releases/download/b6191/llama-b6191-bin-win-cuda-12.4-x64.zip'
    
    // Stop llama server before installing
    stopLlamaServer()
    
    const success = await installCudaBinary(CUDA_URL, (progress) => {
      event.sender.send('cuda-install-progress', progress)
    })
    
    if (success) {
      // Save the version we just installed
      saveLlamaVersion(CURRENT_LLAMA_VERSION);
      // Restart llama server with new binary
      await new Promise(resolve => setTimeout(resolve, 1000))
      await startLlamaServer()
    }
    
    return success
  })
  
  // Initialize Power Mic III support
  powerMicManager = new PowerMicManager()
  powerMicManager.initialize().then(success => {
    if (success) {
      console.log('🎤 Power Mic III support initialized')
      // Enable debug mode to see button mappings
      powerMicManager.enableButtonMapping()
    } else {
      console.log('⚠️ Power Mic III support not available')
      console.log('💡 If you have a dictation microphone connected, please check:')
      console.log('   1. The device is properly connected via USB')
      console.log('   2. You may need to install drivers for your specific device')
      console.log('   3. Check console output above for detected HID devices')
    }
  })

  //keyboard shortcuts
    globalShortcut.register('Control+Alt+R', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.webContents.send('trigger-auto-text-fill', 'autofill-2')
    }
  })

  globalShortcut.register('Control+Alt+T', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.webContents.send('trigger-auto-text-fill', 'autofill-3')
    }
  })

  globalShortcut.register('Control+Alt+D', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.webContents.send('trigger-auto-text-fill', 'autofill-1')
    }
  })

  globalShortcut.register('Control+Alt+F', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.webContents.send('trigger-report-generation')
    }
  })

  globalShortcut.register('Control+Alt+G', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.webContents.send('trigger-impression-generation')
    }
  })




ipcMain.handle('launch-autofill-hotkeys', () => {
  try {
    // Check if we already have a tracked process
    if (radpalHotkeysProcess && !radpalHotkeysProcess.killed) {
      console.log('⚙️ RadPalHotkeys.exe already running (tracked process)');
      return;
    }

    // In production, unpacked files are in app.asar.unpacked
    const exePath = isDev 
      ? path.join(__dirname, 'RadPalHotkeys.exe')
      : path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'RadPalHotkeys.exe');
    
    console.log('📍 Looking for RadPalHotkeys.exe at:', exePath);
    
    // Double-check with tasklist as fallback
    try {
      const result = spawnSync('tasklist', [], { timeout: 2000 });
      const alreadyRunning = result.stdout && result.stdout.toString().includes('RadPalHotkeys.exe');
      
      if (alreadyRunning) {
        console.log('⚙️ RadPalHotkeys.exe already running (found in tasklist)');
        return;
      }
    } catch (tasklistErr) {
      console.warn('⚠️ Could not check tasklist, proceeding with launch');
    }

    // Launch the process and track it (attached to parent)
    radpalHotkeysProcess = spawn(exePath, [], { stdio: 'ignore' });
    
    // Handle process exit
    radpalHotkeysProcess.on('exit', (code) => {
      console.log(`📤 RadPalHotkeys.exe exited with code ${code}`);
      radpalHotkeysProcess = null;
    });
    
    radpalHotkeysProcess.on('error', (err) => {
      console.warn('❌ RadPalHotkeys.exe error:', err);
      radpalHotkeysProcess = null;
    });
    
    console.log('🚀 Launched RadPalHotkeys.exe (PID:', radpalHotkeysProcess.pid, ')');
  } catch (err) {
    console.warn('❌ Failed to launch RadPalHotkeys.exe:', err);
    radpalHotkeysProcess = null;
  }
});

ipcMain.handle('compile-autofill-hotkeys', (_event, shortcuts) => {
  const basePath = isDev ? __dirname : __dirname.replace('app.asar', 'app.asar.unpacked');
  const scriptPath = path.join(basePath, 'RadPalHotkeys.ahk');
  const exePath = path.join(basePath, 'RadPalHotkeys.exe');
  const ahkCompiler = path.join(basePath, 'Ahk2Exe.exe');
  const binFile = path.join(basePath, 'Unicode 64-bit.bin');

  console.log('🔧 AHK Compilation Paths:');
  console.log('  basePath:', basePath);
  console.log('  scriptPath:', scriptPath);
  console.log('  exePath:', exePath);
  console.log('  ahkCompiler:', ahkCompiler);
  console.log('  binFile:', binFile);
  console.log('  ahkCompiler exists:', fs.existsSync(ahkCompiler));
  console.log('  binFile exists:', fs.existsSync(binFile));

  const autofillShortcuts = shortcuts.filter(
    (s) => s.enabled && s.action.startsWith('autofill') && s.text && s.text.trim() !== ''
  );

  console.log('📝 Generating AutoHotkey script for', autofillShortcuts.length, 'shortcuts');
  
  // Always kill existing process first
  try {
    // Kill previous instance of RadPalHotkeys.exe (if running)
    if (radpalHotkeysProcess && !radpalHotkeysProcess.killed) {
      console.log('🛑 Terminating tracked RadPalHotkeys.exe process');
      radpalHotkeysProcess.kill();
      radpalHotkeysProcess = null;
    }
    
    // Also use taskkill as fallback for any untracked instances
    spawnSync('taskkill', ['/F', '/IM', 'RadPalHotkeys.exe']);
  } catch (err) {
    console.warn('⚠️ Could not terminate existing hotkey EXE');
  }
  
  if (autofillShortcuts.length === 0) {
    console.log('⚠️ No valid autofill shortcuts found - stopped AHK process');
    return { success: true, message: 'AutoHotkey process stopped (no shortcuts enabled)' };
  }

  const script = autofillShortcuts
  .map(({ hotkey, text }) => {
    const ahkHotkey = hotkey
      .replace('Ctrl+', '^')
      .replace('Alt+', '!')
      .replace('Shift+', '+');

    // Ensure text is not empty - if it is, use a space as placeholder
    const safeText = text || ' ';
    
    return `
${ahkHotkey}::
  SendRaw, ${safeText}
return`;
  })
  .join('\n\n');

  fs.writeFileSync(scriptPath, script);

  compileAhkCrossPlatform(ahkCompiler, scriptPath, exePath, binFile)
    .then(() => {
      if (process.platform === 'win32') {
        // Launch and track the new process (attached to parent)
        radpalHotkeysProcess = spawn(exePath, [], { stdio: 'ignore' });
        
        // Handle process exit
        radpalHotkeysProcess.on('exit', (code) => {
          console.log(`📤 RadPalHotkeys.exe exited with code ${code}`);
          radpalHotkeysProcess = null;
        });
        
        radpalHotkeysProcess.on('error', (err) => {
          console.warn('❌ RadPalHotkeys.exe error:', err);
          radpalHotkeysProcess = null;
        });
        
        console.log('✅ AHK compiled and launched from main process (PID:', radpalHotkeysProcess.pid, ')');
      } else {
        console.log('✅ AHK compilation handled for non-Windows platform');
      }
    })
    .catch((error) => {
      console.error('❌ AHK compilation failed:', error);
    });
});

// Handler to stop all window shortcuts
ipcMain.handle('stop-all-window-shortcuts', () => {
  if (windowShortcutProcesses.size > 0) {
    console.log(`🛑 Stopping ${windowShortcutProcesses.size} window shortcut(s)...`);
    for (const [name, proc] of windowShortcutProcesses) {
      try {
        if (proc && !proc.killed) {
          proc.kill();
          console.log(`  ✓ Stopped ${name}.exe`);
        }
        // Also use taskkill as fallback
        spawnSync('taskkill', ['/F', '/IM', `${name}.exe`], { timeout: 500 });
      } catch (e) {
        console.warn(`  ⚠️ Could not stop ${name}.exe:`, e.message);
      }
    }
    windowShortcutProcesses.clear();
    return { success: true, count: windowShortcutProcesses.size };
  }
  return { success: true, count: 0 };
});

// Handle window-specific shortcut compilation
ipcMain.handle('compile-window-shortcut', async (_event, payload) => {
  const { script, scriptName, windowTitle, keyToPress, hotkeyTrigger } = payload;
  
  try {
    const basePath = isDev ? __dirname : __dirname.replace('app.asar', 'app.asar.unpacked');
    const scriptPath = path.join(basePath, `${scriptName}.ahk`);
    const exePath = path.join(basePath, `${scriptName}.exe`);
    const ahkCompiler = path.join(basePath, 'Ahk2Exe.exe');
    const binFile = path.join(basePath, 'Unicode 64-bit.bin');
    
    console.log('🔧 Window Shortcut Compilation:');
    console.log('  Window:', windowTitle);
    console.log('  Key:', keyToPress);
    console.log('  Hotkey:', hotkeyTrigger);
    console.log('  Script:', scriptPath);
    console.log('  Output:', exePath);
    
    // Write the AHK script
    fs.writeFileSync(scriptPath, script);
    
    // Compile the script
    await compileAhkCrossPlatform(ahkCompiler, scriptPath, exePath, binFile);
    
    // Launch the compiled exe on Windows and track it
    if (process.platform === 'win32') {
      // Kill any existing instance of this shortcut
      if (windowShortcutProcesses.has(scriptName)) {
        const oldProcess = windowShortcutProcesses.get(scriptName);
        try {
          process.kill(oldProcess.pid);
        } catch (err) {
          // Process might already be dead
        }
        windowShortcutProcesses.delete(scriptName);
      }
      
      // Also use taskkill as fallback
      try {
        spawnSync('taskkill', ['/F', '/IM', `${scriptName}.exe`], { timeout: 500 });
      } catch (err) {
        // Process might not exist, ignore
      }
      
      // Launch and track the new process
      const shortcutProcess = spawn(exePath, [], { 
        stdio: 'ignore' 
      });
      
      // Track this process
      windowShortcutProcesses.set(scriptName, shortcutProcess);
      
      // Handle process exit
      shortcutProcess.on('exit', (code) => {
        console.log(`📤 ${scriptName}.exe exited with code ${code}`);
        windowShortcutProcesses.delete(scriptName);
      });
      
      console.log(`✅ Window shortcut compiled and launched: ${scriptName} (PID: ${shortcutProcess.pid})`);
    }
    
    return { success: true, path: exePath };
  } catch (error) {
    console.error('❌ Failed to compile window shortcut:', error);
    return { success: false, error: error.message };
  }
});

// Handler to focus findings textbox
ipcMain.handle('focus-findings-textbox', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Send a message to the renderer to focus the findings textbox
    mainWindow.webContents.send('focus-findings-field');
    return { success: true };
  }
  return { success: false };
});

// Handler for dictation import hotkey compilation
ipcMain.handle('compile-dictation-import-hotkeys', (_event, config) => {
  const basePath = isDev ? __dirname : __dirname.replace('app.asar', 'app.asar.unpacked');
  const scriptPath = path.join(basePath, 'RadPalDictationImport.ahk');
  const exePath = path.join(basePath, 'RadPalDictationImport.exe');
  const ahkCompiler = path.join(basePath, 'Ahk2Exe.exe');
  const binFile = path.join(basePath, 'Unicode 64-bit.bin');

  console.log('🔧 Dictation Import AHK Compilation:', config);

  // Kill existing process if running
  try {
    spawnSync('taskkill', ['/F', '/IM', 'RadPalDictationImport.exe']);
  } catch (err) {
    // Process might not be running, ignore
  }

  if (!config.reportEnabled && !config.impressionEnabled) {
    console.log('📌 Dictation import disabled');
    return { success: true, message: 'Dictation import disabled' };
  }

  // Build window title checks - support multiple dictation apps
  const windowTitles = config.windowTitles || ['PowerScribe', 'Fluency', 'Dragon'];
  const customTitle = config.customTitle?.trim();
  if (customTitle) {
    windowTitles.push(customTitle);
  }

  // Generate window activation logic
  const windowChecks = windowTitles.map(title => `
    if WinExist("${title}")
    {
        WinActivate
        found := true
    }`).join('\n    else ');

  // Build script sections for each enabled hotkey
  let scriptSections = [];
  
  if (config.reportEnabled && config.reportHotkey) {
    const ahkReportHotkey = config.reportHotkey
      .replace('Ctrl+', '^')
      .replace('Alt+', '!')
      .replace('Shift+', '+');
    
    scriptSections.push(`
; Report Generation Hotkey
${ahkReportHotkey}::
    ; Store current window to return to later
    WinGet, radpalWindow, ID, A
    
    ; Clear clipboard first to ensure clean state
    Clipboard := ""
    
    ; Try to find and activate dictation window
    found := false
    ${windowChecks}
    
    if (!found)
    {
        MsgBox, 0, RadPal, No dictation window found!, 2
        return
    }
    
    ; Wait for window to be active
    WinWaitActive, , , 2
    Sleep, 200
    
    ; Select all text in dictation window
    Send, ^a
    Sleep, 150
    
    ; Copy to clipboard
    Send, ^c
    ClipWait, 2  ; Wait up to 2 seconds for clipboard to contain data
    
    if (!Clipboard)
    {
        MsgBox, 0, RadPal, Failed to copy text from dictation window!, 2
        return
    }
    
    ; Store the clipboard content
    copiedText := Clipboard
    
    ; Return to RadPal window
    WinActivate, ahk_id %radpalWindow%
    WinWaitActive, ahk_id %radpalWindow%, , 2
    Sleep, 300
    
    ; Ensure RadPal window is fully focused
    WinActivate, RadPal
    Sleep, 200
    
    ; Focus the findings textbox with a more reliable method
    ; Save mouse position
    MouseGetPos, origX, origY
    
    ; Method 1: Click directly in the textbox
    ; Assuming the findings textbox is the main input area
    WinGetPos, winX, winY, winWidth, winHeight, RadPal
    
    ; Calculate click position (adjust these values based on UI)
    ; Findings textbox is typically in the upper-middle area
    clickX := winWidth / 2
    clickY := 200  ; Adjust based on your UI
    
    ; Click to focus the textbox
    Click, %clickX%, %clickY%
    Sleep, 200
    
    ; Double-click to select any word (ensures we're in text area)
    Click, 2
    Sleep, 100
    
    ; Select all existing text
    Send, ^a
    Sleep, 150
    
    ; Clear existing content
    Send, {Delete}
    Sleep, 100
    
    ; Alternative: Use Tab navigation from a known position
    ; Send, {F6}  ; Focus address bar in many browsers/Electron apps
    ; Sleep, 100
    ; Send, {Tab}  ; Tab to first field (findings)
    ; Sleep, 100
    
    ; Restore mouse position
    MouseMove, %origX%, %origY%, 0
    
    ; Restore clipboard and paste
    Clipboard := copiedText
    Sleep, 100
    Send, ^v
    Sleep, 300
    ${config.reportAction === 'generate' ? `
    ${config.reportSelectFirstStudy ? `
    ; Select first study type
    Send, {Tab}
    Sleep, 100
    Send, {Down}
    Sleep, 100
    Send, {Enter}
    Sleep, 100
    Send, +{Tab}  ; Shift+Tab to go back to findings
    Sleep, 100
    ` : ''}
    ; Trigger Report Generation with keyboard shortcut
    Send, ^!f  ; Control+Alt+F for report` : `
    ; Paste only mode - no generation`}
return`);
  }
  
  if (config.impressionEnabled && config.impressionHotkey) {
    const ahkImpressionHotkey = config.impressionHotkey
      .replace('Ctrl+', '^')
      .replace('Alt+', '!')
      .replace('Shift+', '+');
    
    scriptSections.push(`
; Impression Generation Hotkey  
${ahkImpressionHotkey}::
    ; Store current window to return to later
    WinGet, radpalWindow, ID, A
    
    ; Clear clipboard first to ensure clean state
    Clipboard := ""
    
    ; Try to find and activate dictation window
    found := false
    ${windowChecks}
    
    if (!found)
    {
        MsgBox, 0, RadPal, No dictation window found!, 2
        return
    }
    
    ; Wait for window to be active
    WinWaitActive, , , 2
    Sleep, 200
    
    ; Select all text in dictation window
    Send, ^a
    Sleep, 150
    
    ; Copy to clipboard
    Send, ^c
    ClipWait, 2  ; Wait up to 2 seconds for clipboard to contain data
    
    if (!Clipboard)
    {
        MsgBox, 0, RadPal, Failed to copy text from dictation window!, 2
        return
    }
    
    ; Store the clipboard content
    copiedText := Clipboard
    
    ; Return to RadPal window
    WinActivate, ahk_id %radpalWindow%
    WinWaitActive, ahk_id %radpalWindow%, , 2
    Sleep, 300
    
    ; Ensure RadPal window is fully focused
    WinActivate, RadPal
    Sleep, 200
    
    ; Focus the findings textbox with a more reliable method
    ; Save mouse position
    MouseGetPos, origX, origY
    
    ; Method 1: Click directly in the textbox
    ; Assuming the findings textbox is the main input area
    WinGetPos, winX, winY, winWidth, winHeight, RadPal
    
    ; Calculate click position (adjust these values based on UI)
    ; Findings textbox is typically in the upper-middle area
    clickX := winWidth / 2
    clickY := 200  ; Adjust based on your UI
    
    ; Click to focus the textbox
    Click, %clickX%, %clickY%
    Sleep, 200
    
    ; Double-click to select any word (ensures we're in text area)
    Click, 2
    Sleep, 100
    
    ; Select all existing text
    Send, ^a
    Sleep, 150
    
    ; Clear existing content
    Send, {Delete}
    Sleep, 100
    
    ; Alternative: Use Tab navigation from a known position
    ; Send, {F6}  ; Focus address bar in many browsers/Electron apps
    ; Sleep, 100
    ; Send, {Tab}  ; Tab to first field (findings)
    ; Sleep, 100
    
    ; Restore mouse position
    MouseMove, %origX%, %origY%, 0
    
    ; Restore clipboard and paste
    Clipboard := copiedText
    Sleep, 100
    Send, ^v
    Sleep, 300
    ${config.impressionAction === 'generate' ? `
    ${config.impressionSelectFirstStudy ? `
    ; Select first study type
    Send, {Tab}
    Sleep, 100
    Send, {Down}
    Sleep, 100
    Send, {Enter}
    Sleep, 100
    Send, +{Tab}  ; Shift+Tab to go back to findings
    Sleep, 100
    ` : ''}
    ; Trigger Impression Generation with keyboard shortcut
    Send, ^!g  ; Control+Alt+G for impression` : `
    ; Paste only mode - no generation`}
return`);
  }

  const script = `
#NoEnv  ; Recommended for performance and compatibility
#SingleInstance Force
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory
SetTitleMatchMode, 2  ; Allow partial window title matching
CoordMode, Mouse, Window  ; Use window-relative coordinates
SetKeyDelay, 10, 10  ; Small delay between keystrokes for reliability

${scriptSections.join('\n\n')}
`;

  fs.writeFileSync(scriptPath, script);

  compileAhkCrossPlatform(ahkCompiler, scriptPath, exePath, binFile)
    .then(() => {
      if (process.platform === 'win32') {
        // Kill previous instance if running
        if (dictationImportProcess && !dictationImportProcess.killed) {
          try {
            dictationImportProcess.kill();
          } catch (e) {}
        }
        
        // Launch and track the new process
        dictationImportProcess = spawn(exePath, [], { stdio: 'ignore' });
        
        // Handle process exit
        dictationImportProcess.on('exit', (code) => {
          console.log(`📤 RadPalDictationImport.exe exited with code ${code}`);
          dictationImportProcess = null;
        });
        
        dictationImportProcess.on('error', (err) => {
          console.warn('❌ RadPalDictationImport.exe error:', err);
          dictationImportProcess = null;
        });
        
        console.log('✅ Dictation import AHK compiled and launched (PID:', dictationImportProcess.pid, ')');
      }
    })
    .catch((error) => {
      console.error('❌ Dictation import AHK compilation failed:', error);
    });

  return { success: true, message: 'Dictation import hotkeys configured' };
});


  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Track if we're already cleaning up
let isCleaningUp = false;
let isUpdating = false;
let isQuitting = false;

// Single consolidated cleanup handler
app.on('before-quit', (event) => {
  isQuitting = true;
  
  // Skip cleanup if we're updating - let electron-updater handle it
  if (isUpdating) {
    console.log('🔄 Auto-update in progress, allowing electron-updater to control shutdown...');
    // Don't prevent default or do any cleanup
    return;
  }
  
  // Only run cleanup once
  if (isCleaningUp) {
    return;
  }
  
  console.log('🛑 App is quitting, cleaning up resources...');
  isCleaningUp = true;
  
  // Don't prevent quit, just do cleanup quickly
  
  // Clear any intervals
  if (windowMonitorInterval) {
    clearInterval(windowMonitorInterval);
    windowMonitorInterval = null;
  }
  
  // Unregister all shortcuts
  try {
    globalShortcut.unregisterAll();
  } catch (e) {}
  
  // Stop llama.cpp server
  stopLlamaServer();
  
  // Cleanup Power Mic III
  if (powerMicManager) {
    try {
      powerMicManager.cleanup();
    } catch (error) {}
  }
  
  // Cleanup dictation
  if (deepgramDictationManager) {
    try {
      deepgramDictationManager.stopDictation();
    } catch (error) {}
  }

  // Kill ALL RadPal processes on Windows
  if (process.platform === 'win32') {
    console.log('🛑 Killing all RadPal processes...');
    
    // Kill all RadPal related processes
    const processesToKill = [
      'RadPalHotkeys.exe',
      'RadPalDictationImport.exe',
      'llama-server.exe',
      'radpal.exe'
    ];
    
    for (const processName of processesToKill) {
      try {
        // Use /T flag to kill process tree
        spawnSync('taskkill', ['/F', '/IM', processName, '/T'], { timeout: 1000 });
      } catch (e) {}
    }
    
    // Also kill by window title in case the process name is different
    try {
      spawnSync('taskkill', ['/F', '/FI', 'WINDOWTITLE eq RadPal*'], { timeout: 1000 });
    } catch (e) {}
  }
  
  // Clean up tracked RadPalHotkeys process
  if (radpalHotkeysProcess) {
    try {
      radpalHotkeysProcess.kill('SIGKILL');
      radpalHotkeysProcess = null;
    } catch (e) {}
  }
  
  // Clean up tracked RadPalDictationImport process
  if (dictationImportProcess) {
    try {
      dictationImportProcess.kill('SIGKILL');
      dictationImportProcess = null;
    } catch (e) {}
  }
  
  // Clean up all window shortcut processes
  if (windowShortcutProcesses.size > 0) {
    console.log(`🧹 Cleaning up ${windowShortcutProcesses.size} window shortcut process(es)...`);
    for (const [name, proc] of windowShortcutProcesses) {
      try {
        if (proc && !proc.killed) {
          proc.kill('SIGKILL');
          console.log(`  ✓ Terminated ${name}.exe`);
        }
        // Also use taskkill as fallback
        spawnSync('taskkill', ['/F', '/IM', `${name}.exe`], { timeout: 500 });
      } catch (e) {
        console.warn(`  ⚠️ Could not terminate ${name}.exe:`, e.message);
      }
    }
    windowShortcutProcesses.clear();
  }
  
  // Destroy all windows
  try {
    BrowserWindow.getAllWindows().forEach(window => {
      window.destroy();
    });
  } catch (e) {}
});

// Backup handler to ensure app quits
app.on('will-quit', () => {
  // Skip if we're updating
  if (isUpdating) {
    console.log('🔄 Auto-update in progress, skipping will-quit cleanup');
    return;
  }
  
  // Skip if we're already cleaning up (force quit)
  if (isCleaningUp) {
    return;
  }
  
  console.log('🛑 Final cleanup before quit...');
  
  // Force kill any remaining processes
  if (process.platform === 'win32') {
    try {
      // Kill EVERYTHING RadPal related using wildcard
      spawnSync('powershell', [
        '-Command',
        'Get-Process | Where-Object {$_.ProcessName -like "*radpal*" -or $_.ProcessName -eq "llama-server"} | Stop-Process -Force'
      ], { timeout: 2000 });
    } catch (e) {}
  }
});



ipcMain.on('popup-inject-content', (_event, data) => {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.webContents.send('popup-content', data);
  } else {
    console.warn('❌ No active popup to inject content');
  }
});

// Handle token updates separately for better performance
ipcMain.on('popup-update-tokens', (_event, data) => {
  console.log('📊 Main process received token update:', data);
  if (popupWindow && !popupWindow.isDestroyed()) {
    console.log('📊 Sending tokens to popup window');
    popupWindow.webContents.send('popup-tokens', data);
  } else {
    console.warn('❌ No active popup to update tokens');
  }
});

// Dictation IPC handlers
ipcMain.handle('start-dictation', async () => {
  console.log('🎙️ Starting dictation from IPC...');
  try {
    // Check microphone permissions on macOS
    if (process.platform === 'darwin') {
      const { systemPreferences } = require('electron');
      const microphoneStatus = systemPreferences.getMediaAccessStatus('microphone');
      
      if (microphoneStatus !== 'granted') {
        if (microphoneStatus === 'denied') {
          throw new Error('Microphone access denied. Please enable microphone access in System Preferences > Security & Privacy > Microphone');
        } else if (microphoneStatus === 'not-determined') {
          // Request permission
          const granted = await systemPreferences.askForMediaAccess('microphone');
          if (!granted) {
            throw new Error('Microphone access denied');
          }
        }
      }
    }

    // Always use Deepgram (no fallback to whisper/sox)
    if (!deepgramDictationManager) {
      deepgramDictationManager = new DeepgramDictationManager();
      
      deepgramDictationManager.setCallbacks(
        (text) => {
          console.log('📝 Deepgram text received:', text);
          // Send transcribed text to all windows
          BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
              win.webContents.send('dictation-text', text);
            }
          });
        },
        (error) => {
          console.error('❌ Deepgram error:', error);
          // Send error to all windows
          BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
              win.webContents.send('dictation-error', error);
            }
          });
        },
        async () => {
          // Session complete callback
          console.log('🎯 Deepgram session complete');
          BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
              win.webContents.send('dictation-session-complete');
            }
          });
        },
        (chunkText) => {
          // Chunk complete callback
          console.log('📦 Deepgram chunk complete:', chunkText);
        }
      );
    }
    
    // Check dictation authorization first
    const session = global.supabaseSession;
    if (session?.access_token) {
      try {
        // Check if user can use dictation
        const response = await fetch('https://ynzikfmpzhtohwsfniqv.supabase.co/functions/v1/deepgram-auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': config.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ action: 'check' })
        });
        
        const data = await response.json();
        
        if (data.authorized) {
          console.log(`✅ Dictation authorized. Minutes remaining: ${data.minutesRemaining}/${data.dailyLimit}`);
          deepgramDictationManager.setApiKey(data.apiKey);
          
          // Load latest medical terms from Supabase before starting dictation
          try {
            const { loadMedicalKeywordsFromDB } = require('./medicalTermsIPC');
            await loadMedicalKeywordsFromDB();
            console.log('✅ Medical terms loaded from Supabase');
          } catch (error) {
            console.warn('⚠️ Failed to load medical terms from Supabase, using cached terms:', error);
          }
          
          // Store session start time for tracking
          deepgramDictationManager.sessionStartTime = Date.now();
          
          await deepgramDictationManager.startDictation();
        } else {
          console.error('❌ Dictation not authorized:', data.error);
          // Return error to user - don't start dictation
          throw new Error(data.error || `Daily dictation limit exceeded. Used: ${data.minutesUsed}/${data.dailyLimit} minutes`);
        }
      } catch (error) {
        console.error('❌ Failed to authorize dictation:', error);
        // Only use fallback in development mode
        if (isDev) {
          const deepgramApiKey = config.DEEP_GRAM_API || process.env.DEEP_GRAM_API || '3bc42a47fb1f49766e5a65efc8d03ad4d58630d3';
          console.log('⚠️ DEV MODE: Using fallback Deepgram API key');
          deepgramDictationManager.setApiKey(deepgramApiKey);
          await deepgramDictationManager.startDictation();
        } else {
          // In production, don't fallback - throw the error
          throw error;
        }
      }
    } else {
      // No session - only allow in dev mode
      if (isDev) {
        const deepgramApiKey = config.DEEP_GRAM_API || process.env.DEEP_GRAM_API || '3bc42a47fb1f49766e5a65efc8d03ad4d58630d3';
        console.log('🔑 DEV MODE: Setting Deepgram API key (no session):', deepgramApiKey ? `${deepgramApiKey.substring(0, 10)}...` : 'NOT SET');
        deepgramDictationManager.setApiKey(deepgramApiKey);
        await deepgramDictationManager.startDictation();
      } else {
        throw new Error('Please sign in to use dictation features');
      }
    }
    console.log('✅ Dictation started successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to start dictation:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error code:', error.code);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-dictation', async () => {
  console.log('🛑 Stopping dictation from IPC...');
  try {
    if (deepgramDictationManager) {
      // Calculate session duration and track usage
      if (deepgramDictationManager.sessionStartTime) {
        const sessionMinutes = (Date.now() - deepgramDictationManager.sessionStartTime) / 60000;
        console.log(`📊 Dictation session duration: ${sessionMinutes.toFixed(2)} minutes`);
        
        // Track usage if user is authenticated
        const session = global.supabaseSession;
        if (session?.access_token && sessionMinutes > 0.1) { // Only track if > 6 seconds
          try {
            await fetch('https://ynzikfmpzhtohwsfniqv.supabase.co/functions/v1/deepgram-auth', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': config.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
              },
              body: JSON.stringify({ 
                action: 'track',
                minutes: Math.ceil(sessionMinutes) // Round up to nearest minute
              })
            });
            console.log('✅ Dictation usage tracked');
          } catch (error) {
            console.error('⚠️ Failed to track dictation usage:', error);
          }
        }
        deepgramDictationManager.sessionStartTime = null;
      }
      
      await deepgramDictationManager.stopDictation();
      console.log('✅ Deepgram dictation stopped successfully');
    }
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to stop dictation:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('is-dictation-active', async () => {
  return deepgramDictationManager ? deepgramDictationManager.isActive() : false;
});

// Force reset dictation system (for Reset Mic button)
ipcMain.handle('force-reset-dictation', async () => {
  console.log('🔄 Force reset dictation requested from renderer...');
  try {
    if (deepgramDictationManager) {
      await deepgramDictationManager.forceReset();
      console.log('✅ Dictation system force reset completed');
      return { success: true };
    } else {
      console.log('⚠️ No dictation manager instance to reset');
      return { success: true, message: 'No active dictation to reset' };
    }
  } catch (error) {
    console.error('❌ Failed to force reset dictation:', error);
    return { success: false, error: error.message };
  }
});


// Open logic editor in main app
ipcMain.handle('open-logic-editor', async (event, data) => {
  console.log('🎯 IPC open-logic-editor received:', data);
  const { userId, studyType } = data;
  
  // Find the main app window
  const allWindows = BrowserWindow.getAllWindows();
  console.log('📋 All windows:', allWindows.map(win => ({
    url: win.webContents.getURL(),
    id: win.id,
    title: win.getTitle()
  })));
  
  const mainWindow = allWindows.find(win => 
    win.webContents.getURL().includes('index.html') && 
    !win.webContents.getURL().includes('popup.html')
  );
  
  if (mainWindow) {
    console.log('✅ Found main window, sending message:', { userId, studyType });
    // Send message to main app to open logic editor
    mainWindow.webContents.send('open-logic-editor', {
      userId,
      studyType
    });
    
    // Focus the main window
    mainWindow.focus();
    
    return { success: true };
  } else {
    console.error('❌ Main window not found for opening logic editor');
    console.log('Available windows:', allWindows.map(win => win.webContents.getURL()));
    return { success: false, error: 'Main window not found' };
  }
});


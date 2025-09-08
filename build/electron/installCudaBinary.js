/**
 * CUDA Binary Installer for llama.cpp
 * Downloads and installs CUDA-enabled llama-server.exe for GPU acceleration
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const AdmZip = require('adm-zip');
const { app } = require('electron');

// Default CUDA binary download URL - can be overridden
const DEFAULT_CUDA_BINARY_URL = 'https://github.com/ggml-org/llama.cpp/releases/download/b6191/llama-b6191-bin-win-cuda-12.4-x64.zip';

/**
 * Downloads and installs CUDA-enabled llama-server.exe
 * @param {string} cudaUrl - URL to download CUDA binary from (optional)
 * @param {Function} progressCallback - Callback for progress updates
 * @returns {Promise<boolean>} - Success status
 */
async function installCudaBinary(cudaUrl = DEFAULT_CUDA_BINARY_URL, progressCallback = () => {}) {
  // Allow single argument usage for backward compatibility
  if (typeof cudaUrl === 'function') {
    progressCallback = cudaUrl;
    cudaUrl = DEFAULT_CUDA_BINARY_URL;
  }
  try {
    console.log('🚀 Starting CUDA binary installation...');
    
    // Paths
    const electronDir = path.join(__dirname);
    const currentBinary = path.join(electronDir, 'llama-server.exe');
    const backupBinary = path.join(electronDir, 'llama-server-backup.exe');
    const tempZip = path.join(app.getPath('temp'), 'llama-cuda.zip');
    
    // Step 1: Backup existing binary if it exists
    if (fs.existsSync(currentBinary)) {
      console.log('📦 Backing up existing binary...');
      progressCallback({ status: 'Backing up existing binary...', progress: 10 });
      
      // Remove old backup if exists
      if (fs.existsSync(backupBinary)) {
        fs.unlinkSync(backupBinary);
      }
      
      // Create backup
      fs.copyFileSync(currentBinary, backupBinary);
      console.log('✅ Backup created at:', backupBinary);
    }
    
    // Step 2: Download CUDA binary ZIP
    console.log('📥 Downloading CUDA binary from:', cudaUrl);
    progressCallback({ status: 'Downloading CUDA binary (30MB)...', progress: 20 });
    
    await downloadFile(cudaUrl, tempZip, (progress) => {
      progressCallback({ 
        status: `Downloading CUDA binary... ${Math.round(progress)}%`, 
        progress: 20 + (progress * 0.5) // 20-70% for download
      });
    });
    
    console.log('✅ Download complete:', tempZip);
    
    // Step 3: Extract llama-server.exe from ZIP
    console.log('📦 Extracting CUDA binary...');
    progressCallback({ status: 'Extracting CUDA binary...', progress: 75 });
    
    const zip = new AdmZip(tempZip);
    const zipEntries = zip.getEntries();
    
    // Log all files in the ZIP for debugging
    console.log('📋 Files in ZIP:');
    const exeFiles = [];
    zipEntries.forEach(entry => {
      if (!entry.isDirectory) {
        console.log('  -', entry.entryName);
        if (entry.entryName.endsWith('.exe')) {
          exeFiles.push(entry.entryName);
        }
      }
    });
    
    let found = false;
    
    // Try different possible names
    const possibleNames = [
      'llama-server.exe',
      'server.exe', 
      'llama.cpp.exe',
      'main.exe',
      'llama-cli.exe'
    ];
    
    // First try exact matches
    for (const entry of zipEntries) {
      const fileName = entry.entryName.split('/').pop();
      const fileNameLower = fileName.toLowerCase();
      
      // Look for llama-server.exe or server.exe (case-insensitive)
      if (fileNameLower === 'llama-server.exe' || fileNameLower === 'server.exe') {
        console.log('📄 Found server binary in ZIP:', entry.entryName);
        
        // Extract to electron directory
        const content = entry.getData();
        fs.writeFileSync(currentBinary, content);
        found = true;
        
        console.log('✅ Extracted CUDA binary to:', currentBinary);
        
        // Set executable permissions on Windows
        try {
          fs.chmodSync(currentBinary, 0o755);
        } catch (e) {
          // Windows might not need this
        }
        
        break;
      }
    }
    
    // If not found, try to find any exe with 'llama' or 'server' in the name
    if (!found) {
      for (const entry of zipEntries) {
        const fileName = entry.entryName.split('/').pop().toLowerCase();
        
        if (fileName.endsWith('.exe') && 
            (fileName.includes('llama') || fileName.includes('server')) &&
            !fileName.includes('test') && 
            !fileName.includes('example')) {
          console.log('📄 Found potential server binary:', entry.entryName);
          
          const content = entry.getData();
          fs.writeFileSync(currentBinary, content);
          found = true;
          
          console.log('⚠️ Extracted alternative binary:', entry.entryName);
          console.log('✅ Saved as llama-server.exe to:', currentBinary);
          
          try {
            fs.chmodSync(currentBinary, 0o755);
          } catch (e) {
            // Windows might not need this
          }
          
          break;
        }
      }
    }
    
    if (!found) {
      console.error('❌ Could not find server binary. Available .exe files:', exeFiles);
      throw new Error(`Server binary not found in ZIP. Available executables: ${exeFiles.join(', ') || 'none'}`);
    }
    
    // Step 4: Extract CUDA DLLs if present
    console.log('📦 Extracting CUDA libraries...');
    progressCallback({ status: 'Installing CUDA libraries...', progress: 85 });
    
    let cudaDllCount = 0;
    for (const entry of zipEntries) {
      // Extract any CUDA-related DLLs
      if (entry.entryName.includes('cuda') && entry.entryName.endsWith('.dll')) {
        const dllName = path.basename(entry.entryName);
        const dllPath = path.join(electronDir, dllName);
        
        console.log('📄 Extracting CUDA DLL:', dllName);
        const content = entry.getData();
        fs.writeFileSync(dllPath, content);
        cudaDllCount++;
      }
    }
    
    console.log(`✅ Extracted ${cudaDllCount} CUDA libraries`);
    
    // Step 5: Verify the new binary
    console.log('🔍 Verifying CUDA binary...');
    progressCallback({ status: 'Verifying installation...', progress: 90 });
    
    const stats = fs.statSync(currentBinary);
    console.log('📊 Binary size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
    
    // Only fail if file is ridiculously small (less than 10KB)
    // Some server.exe files are small stubs that load DLLs
    if (stats.size < 10240) { // Less than 10KB is definitely wrong
      throw new Error('Binary appears to be corrupt or incomplete (size: ' + stats.size + ' bytes)');
    }
    
    console.log('✅ Binary verification passed');
    
    // Step 6: Clean up temp file
    if (fs.existsSync(tempZip)) {
      fs.unlinkSync(tempZip);
      console.log('🗑️ Cleaned up temporary files');
    }
    
    progressCallback({ status: 'CUDA binary installed successfully!', progress: 100 });
    console.log('🎉 CUDA binary installation complete!');
    
    return true;
    
  } catch (error) {
    console.error('❌ CUDA binary installation failed:', error);
    progressCallback({ 
      status: `Installation failed: ${error.message}`, 
      progress: 0,
      error: true 
    });
    
    // Try to restore backup if installation failed
    const backupBinary = path.join(__dirname, 'llama-server-backup.exe');
    const currentBinary = path.join(__dirname, 'llama-server.exe');
    
    if (fs.existsSync(backupBinary)) {
      console.log('🔄 Restoring backup binary...');
      fs.copyFileSync(backupBinary, currentBinary);
      console.log('✅ Backup restored');
    }
    
    return false;
  }
}

/**
 * Downloads a file with progress tracking
 */
function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        console.log('↪ Following redirect to:', redirectUrl);
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(redirectUrl, dest, onProgress).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const progress = (downloadedSize / totalSize) * 100;
        onProgress(progress);
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlinkSync(dest);
        reject(err);
      });
    }).on('error', reject);
  });
}

/**
 * Checks if current binary has CUDA support
 */
function checkCudaSupport() {
  const binaryPath = path.join(__dirname, 'llama-server.exe');
  
  if (!fs.existsSync(binaryPath)) {
    return false;
  }
  
  try {
    // Check if CUDA DLLs exist
    const cudaDlls = fs.readdirSync(__dirname).filter(f => 
      f.includes('cuda') && f.endsWith('.dll')
    );
    
    return cudaDlls.length > 0;
  } catch (error) {
    console.error('Error checking CUDA support:', error);
    return false;
  }
}

module.exports = {
  installCudaBinary,
  checkCudaSupport,
  DEFAULT_CUDA_BINARY_URL
};
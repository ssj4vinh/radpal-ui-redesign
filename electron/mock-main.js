const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;
let popupWindow;

function createWindow() {
  // Create the main browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'mock-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#1f2937',
    icon: path.join(__dirname, '../build/icon.ico')
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open DevTools for UI development
  mainWindow.webContents.openDevTools();
}

// Create popup window for compact mode
function createPopupWindow() {
  if (popupWindow) {
    popupWindow.focus();
    return;
  }

  popupWindow = new BrowserWindow({
    width: 400,
    height: 600,
    resizable: true,
    frame: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'mock-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#1f2937'
  });

  popupWindow.loadFile(path.join(__dirname, '../dist/popup.html'));
  
  popupWindow.on('closed', () => {
    popupWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Mock IPC handlers for window controls
const { ipcMain } = require('electron');

ipcMain.on('expand-window', () => {
  if (popupWindow) {
    popupWindow.close();
  }
  if (!mainWindow) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

ipcMain.on('contract-window', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
  createPopupWindow();
});

ipcMain.on('minimize-popup', () => {
  if (popupWindow) {
    popupWindow.minimize();
  }
});

ipcMain.on('close-popup', () => {
  if (popupWindow) {
    popupWindow.close();
  }
});

ipcMain.on('quit-app', () => {
  app.quit();
});

// Handle login/main mode resizing
ipcMain.on('resize-for-login-mode', () => {
  console.log('Mock: Resize for login mode');
  if (mainWindow) {
    mainWindow.setSize(500, 700);
  }
});

ipcMain.on('resize-for-main-mode', () => {
  console.log('Mock: Resize for main mode');
  if (mainWindow) {
    mainWindow.setSize(1400, 900);
  }
});

// Handle test IPC connection
ipcMain.on('test-ipc-connection', () => {
  console.log('Mock: IPC connection test received');
});
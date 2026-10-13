const { app, BrowserWindow } = require('electron');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const API_PORT = Number(process.env.PORT || 4000);
const DEV_UI_URL = process.env.ELECTRON_DEV_URL || 'http://localhost:5173';
const PRODUCTION_UI_URL = 'https://frontend-my-personal-8941.vercel.app/';
let backendProcess;
let mainWindow;

function waitForBackend(url, timeout = 120000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const retry = () => {
      if (Date.now() - startedAt >= timeout) {
        reject(new Error(`Backend did not start at ${url}`));
        return;
      }
      setTimeout(check, 250);
    };
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode >= 200 && response.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      request.on('error', retry);
      request.setTimeout(1000, () => request.destroy());
    };
    check();
  });
}

function startBackend() {
  const backendDir = path.join(__dirname, '..', 'backend');
  const backendEntry = path.join(backendDir, 'src', 'index.js');
  const nodeExecutable = process.env.NODE_BINARY || 'node';
  const env = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: String(API_PORT),
    STATIC_DIR: '',
    UPLOAD_DIR: path.join(backendDir, 'uploads'),
    CORS_ORIGIN: [
      `http://localhost:${API_PORT}`,
      `http://127.0.0.1:${API_PORT}`,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ].join(','),
  };

  backendProcess = spawn(nodeExecutable, [backendEntry], {
    cwd: backendDir,
    env,
    stdio: 'inherit',
    windowsHide: true,
  });

  backendProcess.on('error', (error) => console.error('[electron] Failed to start backend:', error));
  backendProcess.on('exit', (code, signal) => {
    if (!app.isQuitting && code !== 0) console.error(`[electron] Backend exited with ${code || signal}`);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
        // 🔴 Taskbar aur Window ka icon yahan set karein
        icon: path.join(__dirname, 'assets/icon.ico'), 
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const url = app.isPackaged ? PRODUCTION_UI_URL : DEV_UI_URL;
  if (!app.isPackaged) await waitForBackend(`http://localhost:${API_PORT}/api/health`);
  await mainWindow.loadURL(url);
}

function stopBackend() {
  if (!backendProcess || backendProcess.killed) return;
  backendProcess.kill();
  backendProcess = undefined;
}

app.whenReady().then(async () => {
  if (!app.isPackaged) startBackend();
  try {
    await createWindow();
  } catch (error) {
    console.error('[electron] Failed to open application:', error);
    app.quit();
    return;
  }

  // Initialise automatic updates only in the packaged (production) app.
  // In development the updater is never started, so it never contacts the
  // update server. Any failure here must not break the running application.
  if (app.isPackaged) {
    try {
      const { initAutoUpdater } = require('./updater.cjs');
      initAutoUpdater();
    } catch (error) {
      console.error('[electron] Auto-updater could not be started:', error && error.message);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopBackend();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
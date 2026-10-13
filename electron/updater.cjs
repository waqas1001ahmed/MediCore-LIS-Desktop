'use strict';

/**
 * MediCore-LIS automatic update module (Electron main process only).
 *
 * - Uses electron-updater with the GitHub Releases provider configured in
 *   package.json -> build.publish.
 * - Only ever runs in a packaged (production) build. In development the app
 *   never contacts the update server.
 * - Downloads updates automatically and installs them when the app quits,
 *   without ever force-closing the app or interrupting ongoing work.
 * - Logs update events to electron-log (userData/logs) without exposing any
 *   patient data, tokens, or credentials.
 */

const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Route electron-updater's internal logs through electron-log.
// Only info/warn/error are kept; nothing sensitive is ever logged.
autoUpdater.logger = log;
if (autoUpdater.logger && autoUpdater.logger.transports && autoUpdater.logger.transports.file) {
  autoUpdater.logger.transports.file.level = 'info';
}

// ---------------------------------------------------------------------------
// Behaviour configuration
// ---------------------------------------------------------------------------
autoUpdater.autoDownload = true;          // download as soon as an update is found
autoUpdater.autoInstallOnAppQuit = true;  // install the downloaded update on quit
autoUpdater.autoRunAppAfterInstall = true; // relaunch after the update installs
autoUpdater.allowPrerelease = false;      // only stable releases
autoUpdater.allowDowngrade = false;       // never downgrade an installed build

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------
let checkInProgress = false;
let updateDownloaded = false;

/** Safely forward a status to the renderer (never throws if the window is gone). */
function sendStatus(channel, payload = {}) {
  try {
    // Lazily require electron so this module can be unit-loaded outside Electron.
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      win.webContents.send('update-status', { channel, ...payload });
    }
  } catch {
    // Renderer may not exist yet; status is best-effort only.
  }
}

// ---------------------------------------------------------------------------
// electron-updater event handlers
// ---------------------------------------------------------------------------
autoUpdater.on('checking-for-update', () => {
  log.info('[updater] Checking for update…');
  sendStatus('checking');
});

autoUpdater.on('update-available', (info) => {
  const version = info && info.version ? info.version : 'unknown';
  log.info(`[updater] Update available: ${version}. Downloading…`);
  sendStatus('available', { version });
});

autoUpdater.on('update-not-available', () => {
  log.info('[updater] No update available.');
  checkInProgress = false;
  sendStatus('not-available');
});

autoUpdater.on('download-progress', (progress) => {
  const percent = Math.round(progress && progress.percent ? progress.percent : 0);
  log.info(`[updater] Download progress: ${percent}%`);
  sendStatus('progress', { percent });
});

autoUpdater.on('update-downloaded', (info) => {
  const version = info && info.version ? info.version : 'unknown';
  log.info(`[updater] Update downloaded (${version}). It will be installed when the app quits.`);
  updateDownloaded = true;
  checkInProgress = false;
  // NOTE: we intentionally do NOT call quitAndInstall here. autoInstallOnAppQuit
  // installs the update when the user quits, so we never interrupt active work.
  sendStatus('downloaded', { version });
});

autoUpdater.on('error', (error) => {
  // Log only the message. Never log the full error object — it can contain URLs
  // that embed tokens or other sensitive data.
  const message = (error && error.message) ? error.message : String(error);
  log.warn(`[updater] Update error: ${message}`);
  checkInProgress = false;
  sendStatus('error', { message });
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check for updates once. Concurrent checks are prevented so a scheduled
 * re-check cannot stack on top of an in-flight request.
 */
function checkForUpdates() {
  if (checkInProgress) {
    log.info('[updater] A check is already in progress; skipping.');
    return Promise.resolve(null);
  }
  checkInProgress = true;
  return autoUpdater
    .checkForUpdates()
    .catch((error) => {
      const message = (error && error.message) ? error.message : String(error);
      log.warn(`[updater] checkForUpdates failed: ${message}`);
      checkInProgress = false;
      return null;
    });
}

/** Whether an update has been downloaded and is waiting to install on quit. */
function isUpdateDownloaded() {
  return updateDownloaded;
}

/**
 * Start the updater. A short startup delay avoids competing with application
 * initialization and the initial network/login activity. A periodic re-check
 * runs for long-lived sessions. Only call this in a packaged build.
 */
function initAutoUpdater() {
  const STARTUP_DELAY_MS = 10000; // 10s after launch
  const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

  setTimeout(() => {
    checkForUpdates();
    const interval = setInterval(checkForUpdates, RECHECK_INTERVAL_MS);
    // Do not keep the process alive solely for the update timer.
    if (typeof interval.unref === 'function') interval.unref();
  }, STARTUP_DELAY_MS);
}

module.exports = { initAutoUpdater, checkForUpdates, isUpdateDownloaded };

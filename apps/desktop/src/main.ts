import { app, BrowserWindow, Menu, session, shell } from 'electron';
import path from 'node:path';

const WEB_URL = process.env.ELMS_WEB_URL ?? 'http://localhost:3000';
const webOrigin = new URL(WEB_URL).origin;
const isDev = !app.isPackaged;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    title: 'ObGyn e-LMS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: isDev,
    },
  });

  // CLAUDE.md rule 4: block screenshots/recording of the whole window.
  // macOS: excluded from capture. Windows 10 2004+: WDA_EXCLUDEFROMCAPTURE.
  // Linux has no equivalent; the watermark is the only protection there.
  win.setContentProtection(true);

  // Keep the app on our origin; anything else opens in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== webOrigin) {
      event.preventDefault();
      if (url.startsWith('https://')) void shell.openExternal(url);
    }
  });

  void win.loadURL(WEB_URL);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  void app.whenReady().then(() => {
    if (!isDev) Menu.setApplicationMenu(null);

    // Deny camera, mic, screen capture, etc. Only fullscreen (video player) is allowed.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) =>
      callback(permission === 'fullscreen'),
    );
    session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => callback({}));

    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

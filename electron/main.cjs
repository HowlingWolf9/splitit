const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');

// Guarantee clean application name and AppData persistence for localStorage & IndexedDB
app.name = 'SplitIt';
const appDataPath = path.join(app.getPath('appData'), 'SplitIt');
app.setPath('userData', appDataPath);

let mainWindow = null;

// Single instance enforcement
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, 'assets', 'icon.ico')
    : path.join(__dirname, 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 400,
    minHeight: 600,
    title: 'SplitIt — Modern Expense Manager',
    icon: iconPath,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  // Remove default menu bar
  Menu.setApplicationMenu(null);

  // Show window smoothly once ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default OS web browser, but allow Google OAuth popup
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('accounts.google.com') || url.includes('google.com/o/oauth2')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 540,
          height: 680,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
          }
        }
      };
    }
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Load Vite Dev Server URL if provided; otherwise load packaged production build
  const devUrlArg = process.argv.find((arg) => arg.startsWith('--dev-url='));
  const devUrl = devUrlArg ? devUrlArg.split('=')[1] : process.env.VITE_DEV_SERVER_URL;

  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handler for native Windows printing and PDF export
ipcMain.handle('splitit:print', async (event, title) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const originalTitle = win ? win.getTitle() : 'SplitIt — Modern Expense Manager';

  if (win && title) {
    win.setTitle(title);
  }

  return new Promise((resolve) => {
    event.sender.print(
      {
        silent: false,
        printBackground: true,
        color: true,
        margins: {
          marginType: 'default'
        }
      },
      (success, failureReason) => {
        if (win) {
          win.setTitle(originalTitle);
        }
        if (!success && failureReason !== 'cancelled') {
          console.error('[SplitIt Electron Print] Print spooler error:', failureReason);
        }
        resolve(success);
      }
    );
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('web-contents-created', (event, contents) => {
    // Strip Electron from User-Agent so Google OAuth doesn't trigger disallowed_useragent
    const ua = contents.getUserAgent();
    contents.setUserAgent(ua.replace(/\sElectron\/[0-9\.]+/i, ''));

    const checkOAuthUrl = (targetUrl) => {
      if (targetUrl && (targetUrl.includes('access_token=') || targetUrl.includes('#access_token='))) {
        const hashPart = targetUrl.split('#')[1] || targetUrl.split('?')[1];
        if (hashPart && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('splitit:oauth-token', hashPart);
          const win = BrowserWindow.fromWebContents(contents);
          if (win && win !== mainWindow) {
            win.close();
          }
        }
      }
    };

    contents.on('will-navigate', (e, navUrl) => checkOAuthUrl(navUrl));
    contents.on('will-redirect', (e, navUrl) => checkOAuthUrl(navUrl));
  });

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

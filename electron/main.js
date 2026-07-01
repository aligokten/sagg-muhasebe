// --- SAGG Muhasebe masaüstü uygulaması (Electron ana süreç) ---
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

// Aynı anda birden fazla pencere açılmasını engelle
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function buildMenu() {
  const template = [
    {
      label: 'Görünüm',
      submenu: [
        { label: 'Yeniden Yükle', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Tam Ekran', accelerator: 'F11', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Yakınlaştır', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Uzaklaştır', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Sıfırla', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        ...(isDev ? [{ type: 'separator' }, { label: 'Geliştirici Araçları', accelerator: 'F12', role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Yardım',
      submenu: [
        {
          label: 'SAGG Muhasebe Hakkında',
          click: () => shell.openExternal('https://aligokten.github.io/sagg-muhasebe/'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    title: 'SAGG Muhasebe',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#f3f4f6',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'build', 'index.html'));

  // Uygulama içinde açılmaya çalışılan dış bağlantıları sistem tarayıcısında aç
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

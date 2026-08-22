// --- SAGG Muhasebe masaüstü uygulaması (Electron ana süreç) ---
const { app, BrowserWindow, Menu, shell, dialog, ipcMain, net } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

function setupAutoUpdater(win) {
  autoUpdater.on('update-available', async (info) => {
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Güncelleme mevcut',
      message: `Yeni bir sürüm bulundu: v${info.version}`,
      detail: 'Güncellemeyi şimdi indirmek ister misiniz?',
      buttons: ['İndir', 'Daha Sonra'],
      cancelId: 1,
      defaultId: 0,
    });
    if (response === 0) autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Güncelleme hazır',
      message: `v${info.version} indirildi.`,
      detail: 'Uygulamayı şimdi yeniden başlatıp kurmak ister misiniz?',
      buttons: ['Şimdi Yeniden Başlat', 'Daha Sonra'],
      cancelId: 1,
      defaultId: 0,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on('error', (err) => {
    console.error('Güncelleme denetimi hatası:', err == null ? 'bilinmeyen hata' : (err.stack || err.message));
    if (manualCheckPending) {
      manualCheckPending = false;
      dialog.showMessageBox(win, {
        type: 'error',
        title: 'Güncelleme kontrolü başarısız',
        message: 'Güncellemeler kontrol edilirken bir hata oluştu. İnternet bağlantınızı kontrol edin.',
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    if (manualCheckPending) {
      manualCheckPending = false;
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'Güncel',
        message: 'SAGG Muhasebe güncel sürümü kullanıyorsunuz.',
      });
    }
  });
}

let manualCheckPending = false;

function checkForUpdates(win, { manual } = {}) {
  if (isDev) {
    if (manual) {
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'Geliştirme modu',
        message: 'Güncelleme denetimi yalnızca paketlenmiş uygulamada çalışır.',
      });
    }
    return;
  }
  if (manual) manualCheckPending = true;
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Güncelleme kontrolü başarısız:', err);
  });
}

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

function buildMenu(win) {
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
          label: 'Güncellemeleri Kontrol Et',
          click: () => checkForUpdates(win, { manual: true }),
        },
        { type: 'separator' },
        {
          label: 'SAGG Muhasebe Hakkında',
          click: () => shell.openExternal('https://aligokten.github.io/sagg-muhasebe/'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --- Canlı piyasa verisi (altın & döviz) ---
// Tarayıcıda CORS engeline takılan istek, masaüstünde ana süreçten yapılır.
// Renderer'dan gelen adres yalnızca izin verilen sağlayıcılara yönlendirilebilir.
const ALLOWED_PRICE_HOSTS = ['datshop.com.tr', 'datshop.com', 'haremaltin.com'];

const isAllowedPriceUrl = (raw) => {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    return ALLOWED_PRICE_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

ipcMain.handle('market:prices', async (_event, req) => {
  const { url, method = 'GET', headers = {}, body } = req || {};
  if (!isAllowedPriceUrl(url)) return { ok: false, error: 'İzin verilmeyen fiyat servisi adresi' };
  try {
    const res = await net.fetch(url, { method, headers, body });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    // Gövde ham metin olarak aktarılır; JSON ya da HTML çözümlemesi renderer'da yapılır.
    return { ok: true, data: await res.text() };
  } catch (err) {
    return { ok: false, error: err?.message || 'Bilinmeyen hata' };
  }
});

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
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile(path.join(__dirname, '..', 'build', 'index.html'));

  // Uygulama içinde açılmaya çalışılan dış bağlantıları sistem tarayıcısında aç
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.once('ready-to-show', () => win.show());

  return win;
}

app.whenReady().then(() => {
  const win = createWindow();
  buildMenu(win);
  setupAutoUpdater(win);
  checkForUpdates(win);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- Renderer köprüsü: yalnızca gerekli yetenekler açığa çıkarılır ---
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('saggDesktop', {
  // Canlı altın/döviz fiyatları (masaüstünde tarayıcı CORS kısıtı olmadan alınır)
  fetchMarketPrices: (request) => ipcRenderer.invoke('market:prices', request),
});

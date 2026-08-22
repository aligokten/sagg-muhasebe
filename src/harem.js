// --- Harem Altın canlı piyasa verisi (altın + döviz) ---
//
// Veri kaynağı: haremaltin.com canlı piyasa servisi. Servis tarayıcıya CORS
// başlığı göndermediği durumlar için sırasıyla birkaç kanal denenir:
//   1) Masaüstü (Electron) köprüsü — ana süreçten doğrudan istek (CORS yok)
//   2) Doğrudan tarayıcı isteği
//   3) Genel CORS aktarıcıları (yedek)
// İlk başarılı kanal sonraki isteklerde tercih edilir.

const HAREM_URL = 'https://canlipiyasalar.haremaltin.com/tmp/altin.json';

// CORS aktarıcı yedekleri (yalnızca doğrudan istek başarısız olursa kullanılır)
const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

// --- Takip edilebilen enstrümanlar ---
// unit: gram | adet | birim   (miktar girişinin birimi)
// currency: fiyatın para birimi (USD olanlar USDTRY ile TL'ye çevrilir)
export const INSTRUMENTS = [
  { code: 'ALTIN', label: 'Has Altın', unit: 'gram', group: 'Altın' },
  { code: 'KULCEALTIN', label: 'Külçe Altın', unit: 'gram', group: 'Altın' },
  { code: 'AYAR22', label: '22 Ayar Bilezik', unit: 'gram', group: 'Altın' },
  { code: 'AYAR14', label: '14 Ayar Altın', unit: 'gram', group: 'Altın' },
  { code: 'CEYREK_YENI', label: 'Çeyrek Altın (Yeni)', unit: 'adet', group: 'Altın' },
  { code: 'CEYREK_ESKI', label: 'Çeyrek Altın (Eski)', unit: 'adet', group: 'Altın' },
  { code: 'YARIM_YENI', label: 'Yarım Altın (Yeni)', unit: 'adet', group: 'Altın' },
  { code: 'YARIM_ESKI', label: 'Yarım Altın (Eski)', unit: 'adet', group: 'Altın' },
  { code: 'TEK_YENI', label: 'Tam Altın (Yeni)', unit: 'adet', group: 'Altın' },
  { code: 'TEK_ESKI', label: 'Tam Altın (Eski)', unit: 'adet', group: 'Altın' },
  { code: 'ATA_YENI', label: 'Ata Altın (Yeni)', unit: 'adet', group: 'Altın' },
  { code: 'ATA_ESKI', label: 'Ata Altın (Eski)', unit: 'adet', group: 'Altın' },
  { code: 'ATA5_YENI', label: "5'li Ata (Yeni)", unit: 'adet', group: 'Altın' },
  { code: 'ATA5_ESKI', label: "5'li Ata (Eski)", unit: 'adet', group: 'Altın' },
  { code: 'GREMESE_YENI', label: 'Gremse Altın (Yeni)', unit: 'adet', group: 'Altın' },
  { code: 'GREMESE_ESKI', label: 'Gremse Altın (Eski)', unit: 'adet', group: 'Altın' },
  { code: 'GUMUSTRY', label: 'Gümüş (Gram)', unit: 'gram', group: 'Gümüş' },
  { code: 'USDTRY', label: 'Amerikan Doları', unit: 'birim', group: 'Döviz' },
  { code: 'EURTRY', label: 'Euro', unit: 'birim', group: 'Döviz' },
  { code: 'GBPTRY', label: 'İngiliz Sterlini', unit: 'birim', group: 'Döviz' },
  { code: 'CHFTRY', label: 'İsviçre Frangı', unit: 'birim', group: 'Döviz' },
  { code: 'SARTRY', label: 'Suudi Riyali', unit: 'birim', group: 'Döviz' },
  { code: 'ONS', label: 'Ons Altın', unit: 'birim', group: 'Altın', currency: 'USD' },
  { code: 'GUMUSUSD', label: 'Gümüş / Ons', unit: 'birim', group: 'Gümüş', currency: 'USD' },
  { code: 'PLATIN', label: 'Platin / Ons', unit: 'birim', group: 'Diğer', currency: 'USD' },
  { code: 'PALADYUM', label: 'Paladyum / Ons', unit: 'birim', group: 'Diğer', currency: 'USD' },
];

export const INSTRUMENT_MAP = INSTRUMENTS.reduce((acc, i) => ({ ...acc, [i.code]: i }), {});

// Gösterge panelinde şerit halinde gösterilen öne çıkan enstrümanlar
export const FEATURED_CODES = [
  'ALTIN', 'CEYREK_YENI', 'YARIM_YENI', 'TEK_YENI', 'ATA_YENI', 'AYAR22', 'USDTRY', 'EURTRY', 'GUMUSTRY',
];

export const unitLabel = (unit) => (unit === 'adet' ? 'adet' : unit === 'gram' ? 'gram' : 'birim');

// "2.529,50" / "2529.5900" / 2529.59 -> 2529.59
export const parseHaremNumber = (raw) => {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') return isFinite(raw) ? raw : 0;
  let s = String(raw).trim().replace(/\s|₺|\$|€/g, '');
  if (!s) return 0;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) s = s.replace(/\./g, '').replace(',', '.');
  else if (hasComma) s = s.replace(',', '.');
  else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // binlik ayracı
  const n = Number(s);
  return isFinite(n) ? n : 0;
};

// Servis yanıtını { CODE: { code, alis, satis, kapanis, oran, tarih } } biçimine indirger
export const normalizePrices = (payload) => {
  const raw = payload && (payload.data || payload);
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  Object.keys(raw).forEach((code) => {
    const row = raw[code];
    if (!row || typeof row !== 'object') return;
    const alis = parseHaremNumber(row.alis);
    const satis = parseHaremNumber(row.satis);
    if (!alis && !satis) return;
    out[code] = {
      code,
      alis: alis || satis,
      satis: satis || alis,
      kapanis: parseHaremNumber(row.kapanis),
      oran: parseHaremNumber(row.oran),
      dusuk: parseHaremNumber(row.dusuk),
      yuksek: parseHaremNumber(row.yuksek),
      tarih: row.tarih || '',
    };
  });
  return out;
};

// Bir enstrümanın önceki kapanışı: servis kapanış vermezse günlük değişim
// oranından (%) geriye doğru hesaplanır.
export const previousClose = (row) => {
  if (!row) return 0;
  if (row.kapanis > 0) return row.kapanis;
  if (row.oran && row.oran !== -100) return row.alis / (1 + row.oran / 100);
  return row.alis;
};

// Fiyatı TL'ye çevirir (USD kotasyonlu enstrümanlar için USDTRY kullanılır)
export const toTry = (value, code, prices) => {
  const meta = INSTRUMENT_MAP[code];
  if (!meta || meta.currency !== 'USD') return value;
  const usd = prices?.USDTRY?.alis || 0;
  return usd ? value * usd : value;
};

const postForm = (url, signal) =>
  fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: 'dil_kodu=tr',
  });

// Kanallar sırayla denenir; başarılı olan bir sonraki çağrıda öne alınır.
let preferredChannel = null;

const CHANNELS = [
  {
    id: 'desktop',
    available: () => typeof window !== 'undefined' && !!window.saggDesktop?.fetchMarketPrices,
    run: async () => {
      const res = await window.saggDesktop.fetchMarketPrices();
      if (!res || res.ok === false) throw new Error(res?.error || 'Masaüstü köprüsü yanıt vermedi');
      return res.data;
    },
  },
  {
    id: 'direct',
    available: () => true,
    run: async (signal) => {
      const res = await postForm(HAREM_URL, signal);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  },
  ...CORS_PROXIES.map((build, i) => ({
    id: `proxy${i + 1}`,
    available: () => true,
    run: async (signal) => {
      const res = await fetch(build(HAREM_URL), { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return JSON.parse(text);
    },
  })),
];

// Canlı fiyatları getirir. Başarısızlıkta son hata fırlatılır.
export async function fetchLivePrices({ signal } = {}) {
  const ordered = [...CHANNELS].sort((a, b) => (b.id === preferredChannel ? 1 : 0) - (a.id === preferredChannel ? 1 : 0));
  let lastError = null;
  for (const ch of ordered) {
    if (!ch.available()) continue;
    try {
      const payload = await ch.run(signal);
      const prices = normalizePrices(payload);
      if (Object.keys(prices).length === 0) throw new Error('Boş fiyat listesi');
      preferredChannel = ch.id;
      return { prices, source: ch.id, fetchedAt: new Date() };
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      lastError = err;
    }
  }
  throw lastError || new Error('Canlı fiyatlar alınamadı');
}

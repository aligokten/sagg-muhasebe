// --- Canlı altın & döviz fiyatları (veri sağlayıcı katmanı) ---
//
// Varsayılan kaynak datshop.com'dur; farklı bir uç nokta ya da yedek olarak
// Harem Altın servisi uygulama içinden (Yatırım Takibi > Veri Kaynağı)
// seçilebilir. Servisin yanıt biçimi sağlayıcıdan sağlayıcıya değiştiği için
// gelen veri toleranslı bir çözümleyiciden geçirilir (bkz. normalizePrices).
//
// Tarayıcıda CORS engeline takılma ihtimaline karşı istek sırayla şu
// kanallardan denenir:
//   1) Masaüstü (Electron) köprüsü — ana süreçten doğrudan istek
//   2) Doğrudan tarayıcı isteği
//   3) Genel CORS aktarıcıları (yedek)

// datshop fiyat kaynağı. JSON uç noktası biliniyorsa uygulama içindeki
// "Veri Kaynağı" ekranından girilebilir (localStorage'da saklanır); adres
// JSON yerine HTML sayfa döndürürse fiyat tablosu sayfadan okunur.
export const DATSHOP_URL = 'https://www.datshop.com.tr';
// Gösterge panelindeki piyasa ticker'ının da kullandığı kaynak
// (bkz. components/DashboardGadgets.js): CORS açık, ücretsiz, anahtar istemez.
export const TRUNCGIL_URL = 'https://finans.truncgil.com/v4/today.json';
export const HAREM_URL = 'https://canlipiyasalar.haremaltin.com/tmp/altin.json';

export const PROVIDERS = {
  truncgil: {
    id: 'truncgil',
    label: 'Truncgil',
    defaultUrl: TRUNCGIL_URL,
    request: (url) => ({
      url,
      init: { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } },
    }),
  },
  datshop: {
    id: 'datshop',
    label: 'datshop.com.tr',
    defaultUrl: DATSHOP_URL,
    // Anahtar isteğe bağlıdır; girilmişse hem başlık hem sorgu parametresi
    // olarak gönderilir (servislerin ikisinden birini beklemesi yaygındır).
    request: (url, apiKey) => {
      const target = apiKey && !url.includes('key=') && !url.includes('token=')
        ? `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`
        : url;
      return {
        url: target,
        init: {
          method: 'GET',
          headers: {
            Accept: 'application/json, text/html;q=0.9',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}`, 'X-Api-Key': apiKey } : {}),
          },
        },
      };
    },
  },
  harem: {
    id: 'harem',
    label: 'Harem Altın',
    defaultUrl: HAREM_URL,
    request: (url) => ({
      url,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: 'dil_kodu=tr',
      },
    }),
  },
};

// --- Kullanıcı tarafından seçilen kaynak (tarayıcıda saklanır) ---
const SOURCE_KEY = 'sagg-market-source';
export const DEFAULT_SOURCE = { provider: 'truncgil', url: TRUNCGIL_URL, apiKey: '' };

export const getSource = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(SOURCE_KEY) || 'null');
    if (!raw || !PROVIDERS[raw.provider]) return { ...DEFAULT_SOURCE };
    return { ...DEFAULT_SOURCE, ...raw, url: raw.url || PROVIDERS[raw.provider].defaultUrl };
  } catch {
    return { ...DEFAULT_SOURCE };
  }
};

export const setSource = (src) => {
  try { localStorage.setItem(SOURCE_KEY, JSON.stringify(src)); } catch { /* yoksay */ }
};

// --- Takip edilebilen enstrümanlar ---
// unit: gram | adet | birim   (miktar girişinin birimi)
// currency: fiyatın para birimi (USD olanlar USDTRY ile TL'ye çevrilir)
// aliases: sağlayıcıların bu enstrüman için kullandığı diğer kod/ad karşılıkları
export const INSTRUMENTS = [
  { code: 'ALTIN', label: 'Has Altın', unit: 'gram', group: 'Altın', aliases: ['GRA', 'GRAMALTIN', 'HASALTIN', 'GRAMALTINTRY', 'XAUTRY', 'GA'] },
  { code: 'KULCEALTIN', label: 'Külçe Altın', unit: 'gram', group: 'Altın', aliases: ['KULCE', 'KULCEALTINI'] },
  { code: 'AYAR22', label: '22 Ayar Bilezik', unit: 'gram', group: 'Altın', aliases: ['22AYAR', 'AYAR22BILEZIK', 'BILEZIK22', 'YIRMIIKIAYAR', '22AYARBILEZIK'] },
  { code: 'AYAR14', label: '14 Ayar Altın', unit: 'gram', group: 'Altın', aliases: ['14AYAR', 'ONDORTAYAR', '14AYARALTIN'] },
  { code: 'CEYREK_YENI', label: 'Çeyrek Altın (Yeni)', unit: 'adet', group: 'Altın', aliases: ['CEYREKYENI', 'YENICEYREK', 'CEYREKALTIN', 'CEYREK'] },
  { code: 'CEYREK_ESKI', label: 'Çeyrek Altın (Eski)', unit: 'adet', group: 'Altın', aliases: ['CEYREKESKI', 'ESKICEYREK'] },
  { code: 'YARIM_YENI', label: 'Yarım Altın (Yeni)', unit: 'adet', group: 'Altın', aliases: ['YARIMYENI', 'YENIYARIM', 'YARIMALTIN', 'YARIM'] },
  { code: 'YARIM_ESKI', label: 'Yarım Altın (Eski)', unit: 'adet', group: 'Altın', aliases: ['YARIMESKI', 'ESKIYARIM'] },
  { code: 'TEK_YENI', label: 'Tam Altın (Yeni)', unit: 'adet', group: 'Altın', aliases: ['TEKYENI', 'TAMYENI', 'TAMALTIN', 'CUMHURIYETALTINI', 'CUMHURIYET', 'TAM', 'TEK', 'BIRLIKYENI'] },
  { code: 'TEK_ESKI', label: 'Tam Altın (Eski)', unit: 'adet', group: 'Altın', aliases: ['TEKESKI', 'TAMESKI', 'BIRLIKESKI'] },
  { code: 'ATA_YENI', label: 'Ata Altın (Yeni)', unit: 'adet', group: 'Altın', aliases: ['ATAYENI', 'YENIATA', 'ATAALTIN', 'ATALIRA', 'ATA'] },
  { code: 'ATA_ESKI', label: 'Ata Altın (Eski)', unit: 'adet', group: 'Altın', aliases: ['ATAESKI', 'ESKIATA'] },
  { code: 'ATA5_YENI', label: "5'li Ata (Yeni)", unit: 'adet', group: 'Altın', aliases: ['ATA5YENI', 'BESLIATAYENI'] },
  { code: 'ATA5_ESKI', label: "5'li Ata (Eski)", unit: 'adet', group: 'Altın', aliases: ['ATA5ESKI', 'BESLIATAESKI'] },
  { code: 'GREMESE_YENI', label: 'Gremse Altın (Yeni)', unit: 'adet', group: 'Altın', aliases: ['GREMSEYENI', 'GREMESEYENI', 'GREMSE'] },
  { code: 'GREMESE_ESKI', label: 'Gremse Altın (Eski)', unit: 'adet', group: 'Altın', aliases: ['GREMSEESKI', 'GREMESEESKI'] },
  { code: 'GUMUSTRY', label: 'Gümüş (Gram)', unit: 'gram', group: 'Gümüş', aliases: ['GUMUS', 'GRAMGUMUS', 'GUMUSALTIN', 'XAGTRY'] },
  { code: 'USDTRY', label: 'Amerikan Doları', unit: 'birim', group: 'Döviz', aliases: ['USD', 'DOLAR', 'USDTL', 'AMERIKANDOLARI'] },
  { code: 'EURTRY', label: 'Euro', unit: 'birim', group: 'Döviz', aliases: ['EUR', 'EURO', 'EURTL'] },
  { code: 'GBPTRY', label: 'İngiliz Sterlini', unit: 'birim', group: 'Döviz', aliases: ['GBP', 'STERLIN', 'GBPTL', 'INGILIZSTERLINI'] },
  { code: 'CHFTRY', label: 'İsviçre Frangı', unit: 'birim', group: 'Döviz', aliases: ['CHF', 'FRANK', 'ISVICREFRANGI'] },
  { code: 'SARTRY', label: 'Suudi Riyali', unit: 'birim', group: 'Döviz', aliases: ['SAR', 'RIYAL', 'SUUDIRIYALI'] },
  { code: 'ONS', label: 'Ons Altın', unit: 'birim', group: 'Altın', currency: 'USD', aliases: ['ONSALTIN', 'XAUUSD', 'GOLDOUNCE'] },
  { code: 'GUMUSUSD', label: 'Gümüş / Ons', unit: 'birim', group: 'Gümüş', currency: 'USD', aliases: ['XAGUSD', 'ONSGUMUS'] },
  { code: 'PLATIN', label: 'Platin / Ons', unit: 'birim', group: 'Diğer', currency: 'USD', aliases: ['XPTUSD', 'PLATINUM'] },
  { code: 'PALADYUM', label: 'Paladyum / Ons', unit: 'birim', group: 'Diğer', currency: 'USD', aliases: ['XPDUSD', 'PALLADIUM'] },
];

export const INSTRUMENT_MAP = INSTRUMENTS.reduce((acc, i) => ({ ...acc, [i.code]: i }), {});

// Gösterge panelinde şerit halinde gösterilen öne çıkan enstrümanlar
export const FEATURED_CODES = [
  'ALTIN', 'CEYREK_YENI', 'YARIM_YENI', 'TEK_YENI', 'ATA_YENI', 'AYAR22', 'USDTRY', 'EURTRY', 'GUMUSTRY',
];

export const unitLabel = (unit) => (unit === 'adet' ? 'adet' : unit === 'gram' ? 'gram' : 'birim');

// "Çeyrek Altın (Yeni)" / "ceyrek-altin" -> "CEYREKALTINYENI"
const TR_MAP = { ç: 'c', ğ: 'g', ı: 'i', İ: 'I', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', Ö: 'O', Ş: 'S', Ü: 'U' };
export const normalizeKey = (raw) =>
  String(raw || '')
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => TR_MAP[c] || c)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

// Sağlayıcı kodlarını uygulama kodlarına eşleyen sözlük
const ALIAS_TO_CODE = (() => {
  const map = {};
  INSTRUMENTS.forEach((i) => {
    map[normalizeKey(i.code)] = i.code;
    map[normalizeKey(i.label)] = i.code;
    (i.aliases || []).forEach((a) => { if (!map[normalizeKey(a)]) map[normalizeKey(a)] = i.code; });
  });
  return map;
})();

export const resolveCode = (raw) => ALIAS_TO_CODE[normalizeKey(raw)] || null;

// "2.529,50" / "2529.5900" / 2529.59 -> 2529.59
export const parseAmount = (raw) => {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') return isFinite(raw) ? raw : 0;
  let s = String(raw).trim().replace(/\s|₺|\$|€|TL|TRY/gi, '');
  if (!s) return 0;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) s = s.replace(/\./g, '').replace(',', '.');
  else if (hasComma) s = s.replace(',', '.');
  else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // binlik ayracı
  const n = Number(s);
  return isFinite(n) ? n : 0;
};

// Sağlayıcıların alan adları farklı olabilir; ilk eşleşen alan kullanılır.
const FIELD_ALIASES = {
  buy: ['alis', 'alisfiyati', 'alisfiyat', 'buy', 'buying', 'buyprice', 'bid', 'satinalma'],
  sell: ['satis', 'satisfiyati', 'satisfiyat', 'sell', 'selling', 'sellprice', 'ask'],
  close: ['kapanis', 'oncekikapanis', 'close', 'previousclose', 'prevclose', 'dunkukapanis'],
  rate: ['oran', 'degisim', 'degisimoran', 'change', 'changerate', 'changepercent', 'percent', 'yuzde'],
  low: ['dusuk', 'endusuk', 'low', 'min'],
  high: ['yuksek', 'enyuksek', 'high', 'max'],
  code: ['code', 'kod', 'symbol', 'sembol', 'name', 'isim', 'ad', 'title', 'baslik', 'currency', 'birim'],
  time: ['tarih', 'time', 'date', 'updatedat', 'guncelleme', 'saat'],
};

const pick = (row, kind) => {
  const keys = Object.keys(row || {});
  for (const alias of FIELD_ALIASES[kind]) {
    const hit = keys.find((k) => normalizeKey(k) === normalizeKey(alias));
    if (hit !== undefined && row[hit] !== null && row[hit] !== '') return row[hit];
  }
  return undefined;
};

// Yanıtın içindeki fiyat listesini bulur (sarmalayıcı alanları soyar).
const unwrap = (payload) => {
  const WRAPPERS = ['data', 'result', 'results', 'prices', 'fiyatlar', 'items', 'list', 'rates', 'kurlar', 'response', 'payload'];
  let node = payload;
  for (let depth = 0; depth < 5; depth += 1) {
    if (Array.isArray(node)) return node;
    if (!node || typeof node !== 'object') return null;
    const current = node;
    const hit = Object.keys(current).find(
      (k) => WRAPPERS.includes(k.toLowerCase()) && current[k] && typeof current[k] === 'object'
    );
    // Sarmalayıcı yoksa düğümün kendisi kod -> fiyat sözlüğüdür.
    if (!hit) return current;
    node = current[hit];
  }
  return node;
};

// Sağlayıcı yanıtını { CODE: { code, alis, satis, kapanis, oran, ... } } biçimine indirger.
// Hem { KOD: {...} } sözlüğünü hem [{ code, ... }] dizisini kabul eder.
export const normalizePrices = (payload) => {
  const node = unwrap(payload);
  if (!node || typeof node !== 'object') return {};
  const entries = Array.isArray(node)
    ? node.map((row) => [pick(row, 'code') ?? row?.code ?? '', row])
    : Object.entries(node);

  const out = {};
  entries.forEach(([rawKey, row]) => {
    if (!row || typeof row !== 'object') return;
    const code = resolveCode(rawKey) || resolveCode(pick(row, 'code')) || (rawKey ? normalizeKey(rawKey) : null);
    if (!code) return;
    const alis = parseAmount(pick(row, 'buy'));
    const satis = parseAmount(pick(row, 'sell'));
    if (!alis && !satis) return;
    // Aynı enstrümana birden çok kod eşleşirse ilk (en özel) eşleşme korunur.
    if (out[code]) return;
    out[code] = {
      code,
      alis: alis || satis,
      satis: satis || alis,
      kapanis: parseAmount(pick(row, 'close')),
      oran: parseAmount(pick(row, 'rate')),
      dusuk: parseAmount(pick(row, 'low')),
      yuksek: parseAmount(pick(row, 'high')),
      tarih: pick(row, 'time') || '',
    };
  });
  return out;
};

// --- HTML fiyat tablosu çözümleyici ---
// Kaynak JSON yerine sayfa döndürdüğünde (ör. kuyumcu fiyat panosu), sayfadaki
// "ürün adı + alış + satış" düzeni metin üzerinden okunur.

// Türkçe karakterleri ve büyük/küçük harfi sadeleştirir; boşluk düzeni korunur.
const foldText = (raw) =>
  String(raw || '')
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => TR_MAP[c] || c)
    .toUpperCase();

// Etiketten sonra gelen ilk iki sayı alış/satış kabul edilir.
const NUMBER_RE = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g;
const SEARCH_WINDOW = 120; // etiketten sonra taranan karakter sayısı

// Sayfada aranacak metin karşılıkları (özelden genele doğru sıralı)
const HTML_PATTERNS = [
  ['CEYREK_YENI', ['YENI CEYREK', 'CEYREK YENI', 'CEYREK ALTIN YENI']],
  ['CEYREK_ESKI', ['ESKI CEYREK', 'CEYREK ESKI', 'CEYREK ALTIN ESKI']],
  ['YARIM_YENI', ['YENI YARIM', 'YARIM YENI', 'YARIM ALTIN YENI']],
  ['YARIM_ESKI', ['ESKI YARIM', 'YARIM ESKI', 'YARIM ALTIN ESKI']],
  ['TEK_YENI', ['YENI TAM', 'TAM YENI', 'TAM ALTIN YENI', 'YENI TEK', 'TEK YENI']],
  ['TEK_ESKI', ['ESKI TAM', 'TAM ESKI', 'TAM ALTIN ESKI', 'ESKI TEK', 'TEK ESKI']],
  ['ATA5_YENI', ['5 LI ATA YENI', "5'LI ATA YENI", 'BESLI ATA YENI']],
  ['ATA5_ESKI', ['5 LI ATA ESKI', "5'LI ATA ESKI", 'BESLI ATA ESKI']],
  ['ATA_YENI', ['YENI ATA', 'ATA YENI', 'ATA ALTIN YENI']],
  ['ATA_ESKI', ['ESKI ATA', 'ATA ESKI', 'ATA ALTIN ESKI']],
  ['GREMESE_YENI', ['GREMSE YENI', 'GREMESE YENI']],
  ['GREMESE_ESKI', ['GREMSE ESKI', 'GREMESE ESKI']],
  ['AYAR22', ['22 AYAR BILEZIK', '22 AYAR', 'BILEZIK']],
  ['AYAR14', ['14 AYAR']],
  ['KULCEALTIN', ['KULCE ALTIN', 'KULCE']],
  ['ALTIN', ['GRAM ALTIN', 'HAS ALTIN', 'GRAM HAS ALTIN']],
  ['CEYREK_YENI', ['CEYREK ALTIN', 'CEYREK']],
  ['YARIM_YENI', ['YARIM ALTIN', 'YARIM']],
  ['TEK_YENI', ['TAM ALTIN', 'CUMHURIYET ALTINI']],
  ['ATA_YENI', ['ATA ALTIN', 'ATA LIRA']],
  ['ONS', ['ONS ALTIN', 'XAUUSD']],
  ['GUMUSTRY', ['GRAM GUMUS', 'GUMUS']],
  ['USDTRY', ['AMERIKAN DOLARI', 'DOLAR', 'USD']],
  ['EURTRY', ['EURO', 'EUR']],
  ['GBPTRY', ['INGILIZ STERLINI', 'STERLIN', 'GBP']],
  ['CHFTRY', ['ISVICRE FRANGI', 'CHF']],
  ['SARTRY', ['SUUDI RIYALI', 'SAR']],
];

// "22 AYAR" -> /22[\s\-–—|]*AYAR/ (etiketler sayfada farklı ayraçlarla yazılabilir)
const patternToRegex = (pattern) =>
  new RegExp(pattern.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\-–—|/]*'));

export const parseHtmlPrices = (html) => {
  // Etiketlerle sayıların birbirine yapışmaması için etiketler ayraca çevrilir.
  const text = foldText(String(html || '').replace(/<[^>]*>/g, ' | ').replace(/&nbsp;?/gi, ' ').replace(/&amp;/gi, '&'));
  const out = {};
  HTML_PATTERNS.forEach(([code, patterns]) => {
    if (out[code]) return;
    for (const pattern of patterns) {
      const hit = patternToRegex(pattern).exec(text);
      if (!hit) continue;
      const window = text.slice(hit.index + hit[0].length, hit.index + hit[0].length + SEARCH_WINDOW);
      const numbers = (window.match(NUMBER_RE) || []).map(parseAmount).filter((n) => n > 0);
      if (numbers.length < 2) continue;
      const [alis, satis] = numbers;
      out[code] = { code, alis, satis, kapanis: 0, oran: 0, dusuk: 0, yuksek: 0, tarih: '' };
      break;
    }
  });
  return out;
};

// Kanaldan gelen ham yanıtı (nesne ya da metin) fiyat sözlüğüne çevirir.
export const parseMarketResponse = (raw) => {
  if (raw && typeof raw === 'object') return normalizePrices(raw);
  const text = String(raw || '').trim();
  if (!text) return {};
  try {
    return normalizePrices(JSON.parse(text));
  } catch {
    return parseHtmlPrices(text); // JSON değil: sayfa üzerinden oku
  }
};

// Bir enstrümanın önceki kapanışı: servis kapanış vermezse günlük değişim
// oranından (%) geriye doğru hesaplanır.
export const previousClose = (row) => {
  if (!row) return 0;
  if (row.kapanis > 0) return row.kapanis;
  if (row.oran && row.oran !== -100) return row.alis / (1 + row.oran / 100);
  return row.alis;
};

// Günlük değişim yüzdesi. Kaynak kapanış/oran vermiyorsa null döner
// (arayüzde "değişim yok" yerine hiçbir şey gösterilmemesi için).
export const changePct = (row) => {
  if (!row) return null;
  if (!(row.kapanis > 0) && !row.oran) return null;
  const prev = previousClose(row);
  return prev ? ((row.alis - prev) / prev) * 100 : null;
};

// Fiyatı TL'ye çevirir (USD kotasyonlu enstrümanlar için USDTRY kullanılır)
export const toTry = (value, code, prices) => {
  const meta = INSTRUMENT_MAP[code];
  if (!meta || meta.currency !== 'USD') return value;
  const usd = prices?.USDTRY?.alis || 0;
  return usd ? value * usd : value;
};

// --- İstek kanalları ---
const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

// Başarılı olan kanal sonraki isteklerde önce denenir.
let preferredChannel = null;

const CHANNELS = [
  {
    id: 'desktop',
    available: () => typeof window !== 'undefined' && !!window.saggDesktop?.fetchMarketPrices,
    run: async ({ url, init }) => {
      const res = await window.saggDesktop.fetchMarketPrices({ url, method: init.method, headers: init.headers, body: init.body });
      if (!res || res.ok === false) throw new Error(res?.error || 'Masaüstü köprüsü yanıt vermedi');
      return res.data; // metin ya da nesne
    },
  },
  {
    id: 'direct',
    available: () => true,
    run: async ({ url, init }, signal) => {
      const res = await fetch(url, { ...init, signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
  },
  ...CORS_PROXIES.map((build, i) => ({
    id: `proxy${i + 1}`,
    available: () => true,
    // Aktarıcılar yalnızca GET taşıdığı için POST kullanan sağlayıcılarda atlanır.
    run: async ({ url, init }, signal) => {
      if (init.method && init.method !== 'GET') throw new Error('Aktarıcı bu isteği taşıyamaz');
      const res = await fetch(build(url), { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
  })),
];

// Canlı fiyatları getirir. Başarısızlıkta son hata fırlatılır.
export async function fetchLivePrices({ signal, source } = {}) {
  const src = source || getSource();
  const provider = PROVIDERS[src.provider] || PROVIDERS.truncgil;
  const request = provider.request(src.url || provider.defaultUrl, src.apiKey);
  const ordered = [...CHANNELS].sort((a, b) => (b.id === preferredChannel ? 1 : 0) - (a.id === preferredChannel ? 1 : 0));

  let lastError = null;
  for (const ch of ordered) {
    if (!ch.available()) continue;
    try {
      const payload = await ch.run(request, signal);
      const prices = parseMarketResponse(payload);
      if (Object.keys(prices).length === 0) throw new Error('Fiyat listesi çözümlenemedi');
      preferredChannel = ch.id;
      return { prices, source: ch.id, provider: provider.id, fetchedAt: new Date() };
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      lastError = err;
    }
  }
  throw lastError || new Error('Canlı fiyatlar alınamadı');
}

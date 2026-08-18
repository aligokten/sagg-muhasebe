// --- Defter.net hesap dökümü (PDF) ayrıştırıcı ---
// Defter uygulamasının "hesap dökümü" PDF çıktısını okuyup cari hareketlerine çevirir.
// PDF.js tarayıcıda CDN'den tembel yüklenir (uygulama açılışını yavaşlatmamak için).

import { flatCategories } from './categories';

const PDFJS_VERSION = '3.11.174';
const PDFJS_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

let pdfjsPromise = null;

export function loadPdfJs() {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return Promise.resolve(window.pdfjsLib);
  }
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PDFJS_SRC;
    s.async = true;
    s.onload = () => {
      if (!window.pdfjsLib) return reject(new Error('pdfjsLib yüklenemedi'));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      resolve(window.pdfjsLib);
    };
    s.onerror = () => { pdfjsPromise = null; reject(new Error('PDF okuyucu indirilemedi')); };
    document.head.appendChild(s);
  });
  return pdfjsPromise;
}

// Defter sütun düzeni (x koordinatları): TARİH | (işlem türü) | AÇIKLAMA | HESAP | MİKTAR | TOPLAM
// Ölçülen aralıklar: tür 145-196, açıklama 194-301, hesap 335-400, miktar 420-470, toplam 482+
const X_TYPE_START = 135;
const X_DESC_START = 190;
const X_ACCT_START = 318; // açıklama 301'de biter, hesap 335'te başlar
const X_NUM_START = 400;

const TYPE_WORDS = ['TAHSİLAT', 'SATIŞ', 'ALIŞ', 'ÖDEME'];
const DATE_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/;
const NUM_RE = /^-?[\d.]{1,20},\d{2}$/;

// "1.234.567,89" -> 1234567.89
const parseTrNumber = (s) => {
  const n = Number(String(s).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Aynı satırdaki parçalar birkaç birim kayabildiğinden (ör. genel toplam
// satırında bakiye 2 birim yukarıda) y değerleri toleransla kümelenir.
// Hareket satırları ~20, devam satırları ~10 birim aralıklı olduğundan güvenli.
const Y_TOLERANCE = 4;

// PDF metin parçalarını satırlara ve sütunlara böler.
async function extractRows(pdfjsLib, arrayBuffer) {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const rows = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items
      .filter((it) => it.str)
      .map((it) => ({ x: it.transform[4], y: it.transform[5], s: it.str }))
      .sort((a, b) => b.y - a.y); // sayfada yukarıdan aşağıya

    let group = null;
    for (const it of items) {
      if (!group || Math.abs(group.y - it.y) > Y_TOLERANCE) {
        group = { page: p, y: it.y, items: [] };
        rows.push(group);
      }
      group.items.push(it);
    }
  }
  rows.forEach((r) => r.items.sort((a, b) => a.x - b.x));
  return rows;
}

// Bir satırdaki parçaları sütunlara dağıtır. Türkçe karakterler ayrı parça
// geldiğinden aynı sütundaki parçalar birleştirilir ("SATI" + "Ş" -> "SATIŞ").
function toCells(items) {
  const cell = { date: '', type: '', desc: '', acct: '', nums: [] };
  for (const it of items) {
    const { x, s } = it;
    if (x >= X_NUM_START) {
      const t = s.trim();
      if (t) cell.nums.push({ x, text: t });
    } else if (x >= X_ACCT_START) cell.acct += s;
    else if (x >= X_DESC_START) cell.desc += s;
    else if (x >= X_TYPE_START) cell.type += s;
    else cell.date += s;
  }
  const clean = (v) => v.replace(/\s+/g, ' ').trim();
  return { date: clean(cell.date), type: clean(cell.type), desc: clean(cell.desc), acct: clean(cell.acct), nums: cell.nums };
}

// PDF'teki kategori adını uygulamadaki kategori adına eşler (bulunamazsa
// PDF'teki metin başlık biçiminde korunur, veri kaybı olmaz).
const titleCaseTr = (s) =>
  s
    .toLocaleLowerCase('tr-TR')
    .split(' ')
    .map((w) => (w ? w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1) : w))
    .join(' ');

function normalizeCategory(raw) {
  if (!raw) return '';
  const target = raw.toLocaleLowerCase('tr-TR');
  const match = flatCategories().find((c) => c.toLocaleLowerCase('tr-TR') === target);
  if (match) return match;
  if (target === 'ulaşım / araba') return 'Yakıt / Ulaşım';
  return titleCaseTr(raw);
}

/**
 * Defter hesap dökümü PDF'ini ayrıştırır.
 * @returns {{customerName, addressLines, rows, totals, pdfTotals, warnings}}
 */
export async function parseDefterPdf(file) {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const raw = await extractRows(pdfjsLib, new Uint8Array(buf));

  // Tablo başlığı ("TARİH ... AÇIKLAMA") üstündeki bloklar: firma bilgisi + cari adı/adresi
  const headerIdx = raw.findIndex((r) => {
    const c = toCells(r.items);
    return /^TAR[İI]H/.test(c.date) && /AÇIKLAMA/.test(c.desc);
  });

  let customerName = '';
  const addressLines = [];
  if (headerIdx > 0) {
    // Başlıktan hemen önceki, sol sütundaki (x<135) satırlar cariye aittir.
    const above = [];
    for (let i = headerIdx - 1; i >= 0; i--) {
      const r = raw[i];
      const left = r.items.filter((it) => it.x < X_TYPE_START);
      if (left.length !== r.items.length) break; // sağ sütuna taşan blok = firma bilgisi
      const text = left.map((it) => it.s).join('').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      above.unshift(text);
    }
    if (above.length) {
      customerName = above[0];
      addressLines.push(...above.slice(1));
    }
  }

  const rows = [];
  const warnings = [];
  let pdfTotals = null;
  let current = null;

  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 0;
  for (let i = startIdx; i < raw.length; i++) {
    const c = toCells(raw[i].items);

    // Genel toplam satırı: "TOPLAM TRY  12.100.974,00 -10.634.744,98  1.466.229,02"
    if (/^TOPLAM\b/i.test(c.date)) {
      const nums = `${c.acct} ${c.nums.map((n) => n.text).join(' ')}`.match(/-?[\d.]+,\d{2}/g) || [];
      if (nums.length >= 2) {
        pdfTotals = {
          borc: parseTrNumber(nums[0]),
          alacak: Math.abs(parseTrNumber(nums[1]) || 0),
          balance: nums[2] != null ? parseTrNumber(nums[2]) : null,
        };
      }
      current = null;
      continue;
    }

    const dm = c.date.match(DATE_RE);
    if (dm) {
      // Yeni hareket satırı
      const type = c.type.toLocaleUpperCase('tr-TR');
      if (!TYPE_WORDS.includes(type)) {
        warnings.push(`Bilinmeyen işlem türü "${c.type}" (${c.date}) — satır atlandı.`);
        current = null;
        continue;
      }
      // Sayısal sütunlar: sondaki yürüyen bakiye, ondan önceki tutar.
      const nums = c.nums.filter((n) => NUM_RE.test(n.text));
      if (nums.length < 2) {
        warnings.push(`Tutar okunamadı (${c.date} ${c.type}) — satır atlandı.`);
        current = null;
        continue;
      }
      const amount = parseTrNumber(nums[nums.length - 2].text);
      const running = parseTrNumber(nums[nums.length - 1].text);
      const [, dd, mm, yyyy, hh, mi] = dm;
      const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh || 0), Number(mi || 0));

      current = {
        date,
        dateText: c.date,
        type, // SATIŞ | ALIŞ | TAHSİLAT | ÖDEME
        category: normalizeCategory(c.desc),
        rawCategory: c.desc,
        accountName: c.acct || '',
        amount: Math.abs(amount || 0),
        signedAmount: amount,
        runningBalance: running,
        detailLines: [],
      };
      rows.push(current);
      continue;
    }

    // Ay ara toplamı ("2024 AĞUSTOS  125.000,00 -15.243,88 = 109.756,12") — içe aktarılmaz
    if (c.date && !c.type && !c.desc) { current = null; continue; }
    if (c.date && c.nums.length) { current = null; continue; }

    // Devam satırı: yalnızca açıklama sütununda metin (kişi adı / işin detayı).
    // Sayfa sonunu aşabildiği için sayfa değişiminde de akış korunur.
    if (!c.date && !c.type && c.desc && current) {
      if (!/^Bu belge DEFTER/i.test(c.desc)) current.detailLines.push(c.desc);
    }
  }

  rows.forEach((r) => { r.description = r.detailLines.join(' · '); });

  const totals = rows.reduce(
    (acc, r) => {
      if (r.type === 'SATIŞ') acc.borc += r.amount;
      else acc.alacak += r.amount;
      return acc;
    },
    { borc: 0, alacak: 0 }
  );
  totals.balance = totals.borc - totals.alacak;

  if (!rows.length) warnings.push('PDF içinde hareket bulunamadı. Dosyanın Defter hesap dökümü olduğundan emin olun.');

  return { customerName, addressLines, rows, totals, pdfTotals, warnings };
}

// Ayrıştırılan satırı uygulamanın `transactions` kaydına çevirir.
// SATIŞ -> cariye borç, ALIŞ -> cariye alacak, TAHSİLAT/ÖDEME -> kasa hareketi.
export function toTransactionPayload(row, customer, accountId) {
  const base = {
    customerId: customer.id,
    customerName: customer.name,
    projectId: null,
    amount: row.amount,
    category: row.category || null,
    description: row.description || row.category || row.type,
    importSource: 'defter-pdf',
    sourceAccountName: row.accountName || null,
    sourceBalance: row.runningBalance ?? null,
  };
  if (row.type === 'TAHSİLAT') return { ...base, type: 'tahsilat', direction: 'in', cariEffect: null, accountId: accountId || null };
  if (row.type === 'ÖDEME') return { ...base, type: 'odeme', direction: 'out', cariEffect: null, accountId: accountId || null };
  if (row.type === 'SATIŞ') return { ...base, type: 'manuel', cariEffect: 'borc', direction: null, accountId: null };
  return { ...base, type: 'manuel', cariEffect: 'alacak', direction: null, accountId: null };
}

// --- Biçimlendirme ve hesaplama yardımcıları ---

export const formatCurrency = (value) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(
    Number(value) || 0
  );

export const formatNumber = (value, digits = 2) =>
  new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);

// Firestore Timestamp / Date / string -> JS Date
// (Timestamp instance'ı .toDate() ile yakalanır; firebase'e bağımlılık yoktur)
export const toDate = (date) => {
  if (!date) return null;
  if (typeof date.toDate === 'function') return date.toDate();
  if (date.seconds !== undefined) return new Date(date.seconds * 1000);
  return new Date(date);
};

export const formatDate = (date) => {
  const d = toDate(date);
  if (!d || isNaN(d)) return '-';
  return d.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatDateShort = (date) => {
  const d = toDate(date);
  if (!d || isNaN(d)) return '-';
  return d.toLocaleDateString('tr-TR');
};

export const toInputDate = (date) => {
  const d = toDate(date) || new Date();
  if (isNaN(d)) return new Date().toISOString().split('T')[0];
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().split('T')[0];
};

export const todayInput = () => toInputDate(new Date());

// Aylık etiket (raporlar için): "2026-06"
export const monthKey = (date) => {
  const d = toDate(date);
  if (!d || isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const monthLabel = (key) => {
  if (!key) return '';
  const [y, m] = key.split('-');
  const names = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
  ];
  return `${names[Number(m) - 1]} ${y}`;
};

export const daysBetween = (a, b) => {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return 0;
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
};

// Belge numarası üretici (örn. FT2026000001)
export const nextDocNumber = (records, prefix, field = 'docNumber') => {
  const year = new Date().getFullYear();
  const re = new RegExp(`^${prefix}${year}(\\d+)$`);
  let max = 0;
  (records || []).forEach((r) => {
    const m = String(r[field] || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${prefix}${year}${String(max + 1).padStart(6, '0')}`;
};

// Tahsilat/ödeme makbuzu seri numarası üretir (örn. TH2026000001 / OD2026000001)
export const nextReceiptNo = (records, kind) =>
  nextDocNumber(records, kind === 'incomes' ? 'TH' : 'OD', 'receiptNo');

// Sayıyı Türkçe yazıya çevirir (fatura "yalnız" alanı için)
export function numberToWordsTr(num) {
  if (num === null || num === undefined) return '';
  if (num === 0) return 'Sıfır Türk Lirası';
  const birler = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
  const onlar = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];
  const binler = ['', 'Bin', 'Milyon', 'Milyar'];
  const groupToWords = (n) => {
    let y = Math.floor(n / 100),
      o = Math.floor((n % 100) / 10),
      b = n % 10,
      r = '';
    if (y > 0) r += (y > 1 ? birler[y] : '') + 'Yüz ';
    if (o > 0) r += onlar[o] + ' ';
    if (b > 0) r += birler[b] + ' ';
    return r;
  };
  const p = num.toFixed(2).split('.');
  let i = parseInt(p[0], 10);
  const f = p.length > 1 ? parseInt(p[1].padEnd(2, '0').substring(0, 2), 10) : 0;
  let w = '';
  if (i === 0) {
    w = 'Sıfır ';
  } else {
    let j = 0;
    while (i > 0) {
      const c = i % 1000;
      if (c > 0) {
        let cw = groupToWords(c);
        if (j === 1 && c === 1) cw = '';
        w = cw + binler[j] + ' ' + w;
      }
      i = Math.floor(i / 1000);
      j++;
    }
  }
  let res = w.trim() + ' Türk Lirası';
  if (f > 0) res += ', ' + groupToWords(f).trim() + ' Kuruş';
  return res;
}

// KDV dahil tutardan KDV'yi ayıklar
export const vatFromGross = (gross, rate) =>
  (Number(gross) || 0) * (Number(rate) || 0) / (100 + (Number(rate) || 0));

export const sum = (arr, fn) => (arr || []).reduce((s, x) => s + (Number(fn(x)) || 0), 0);

// Fatura/teklif kalemlerinden toplamları hesaplar
export const computeTotals = (items) => {
  let subTotal = 0;
  let vatTotal = 0;
  let discountTotal = 0;
  (items || []).forEach((it) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unitPrice) || 0;
    const line = qty * price;
    const disc = line * ((Number(it.discount) || 0) / 100);
    const net = line - disc;
    const vat = net * ((Number(it.vatRate) || 0) / 100);
    subTotal += line;
    discountTotal += disc;
    vatTotal += vat;
  });
  const grandTotal = subTotal - discountTotal + vatTotal;
  return { subTotal, discountTotal, vatTotal, grandTotal };
};

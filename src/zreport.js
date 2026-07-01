// --- Z Raporu: gün sonu kasa/banka hesap dökümü ---
// Uygulama tamamen tarayıcı tabanlı olduğundan (sunucu tarafında zamanlanmış
// bir işlem yoktur) raporlar tam olarak saat 23:59'da değil, uygulama bir
// sonraki açılışında o güne ait rapor eksikse otomatik olarak oluşturulur.
import { accountMovements } from './finance';
import { toDate } from './utils';

const pad = (n) => String(n).padStart(2, '0');

// Yerel saat dilimine göre 'YYYY-MM-DD' anahtarı üretir.
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Belirli bir tarih için tüm hesapların gün sonu dökümünü hesaplar.
export const buildZReport = (dateStr, data) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

  const accountsSummary = (data.accounts || []).map((acc) => {
    const { rows } = accountMovements(acc.id, data);
    let openingBalance = 0;
    let closingBalance = 0;
    const movements = [];
    rows.forEach((r) => {
      const rd = toDate(r.date);
      if (!rd) return;
      if (rd < dayStart) {
        openingBalance = r.balance;
        closingBalance = r.balance;
      } else if (rd <= dayEnd) {
        movements.push({ type: r.type, description: r.description, in: r.in, out: r.out, balance: r.balance });
        closingBalance = r.balance;
      }
    });
    if (movements.length === 0) closingBalance = openingBalance;
    const totalIn = movements.reduce((s, r) => s + (Number(r.in) || 0), 0);
    const totalOut = movements.reduce((s, r) => s + (Number(r.out) || 0), 0);
    return {
      accountId: acc.id, accountName: acc.name, accountType: acc.type,
      openingBalance, closingBalance, totalIn, totalOut, movements,
    };
  });

  const totals = accountsSummary.reduce(
    (t, a) => ({
      openingBalance: t.openingBalance + a.openingBalance,
      closingBalance: t.closingBalance + a.closingBalance,
      totalIn: t.totalIn + a.totalIn,
      totalOut: t.totalOut + a.totalOut,
    }),
    { openingBalance: 0, closingBalance: 0, totalIn: 0, totalOut: 0 }
  );

  return { date: dateStr, generatedAt: new Date().toISOString(), accounts: accountsSummary, totals };
};

// Eksik (henüz oluşturulmamış) gün sonu raporlarının tarihlerini döner.
// Geriye dönük aşırı yığılmayı önlemek için en fazla `capDays` gün üretilir.
export const getMissingReportDates = (existingReports, capDays = 14) => {
  const existing = new Set((existingReports || []).map((r) => r.id));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = addDays(today, -1);

  const dates = (existingReports || []).map((r) => r.id).filter(Boolean).sort();
  const lastDate = dates.length > 0 ? dates[dates.length - 1] : null;
  let cursor = lastDate
    ? addDays(new Date(...lastDate.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n)))), 1)
    : addDays(yesterday, -(capDays - 1));

  const missing = [];
  while (cursor <= yesterday && missing.length < capDays) {
    const key = dateKey(cursor);
    if (!existing.has(key)) missing.push(key);
    cursor = addDays(cursor, 1);
  }
  return missing;
};

// --- Gösterge Paneli (InvestIQ tarzı, turuncu tema) ---
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import {
  ArrowUpRight, ArrowDownRight, Download, Filter,
  Wallet, FileText, AlertTriangle, TrendingDown, TrendingUp, Quote,
} from 'lucide-react';
import { formatCurrency, monthKey, monthLabel, toDate, formatDateShort, sum } from '../utils';
import { allCariBalances, allAccountBalances, allProductStocks } from '../finance';
import { downloadExcel } from '../exportExcel';
import { randomQuote } from '../quotes';

const initials = (name) =>
  (name || '?').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

const AVATAR_COLORS = ['bg-orange-100 text-orange-700', 'bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700'];

const ChangeBadge = ({ value, light }) => {
  if (value === null || value === undefined || !isFinite(value)) return null;
  const up = value >= 0;
  const base = light ? 'bg-white/15 text-white' : up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600';
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${base}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}%{Math.abs(value).toFixed(1)}
    </span>
  );
};

// Küçük çizgi grafiği (sparkline)
const Spark = ({ data, color, id }) => (
  <ResponsiveContainer width="100%" height={48}>
    <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#spark-${id})`} dot={false} />
    </AreaChart>
  </ResponsiveContainer>
);

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const startOfWeek = () => { const d = startOfToday(); d.setDate(d.getDate() - 6); return d; };
const startOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };

const seriesFrom = (records, getDate, getAmt, months = 7) => {
  const map = {};
  records.forEach((r) => { const k = monthKey(getDate(r)); if (k) map[k] = (map[k] || 0) + (Number(getAmt(r)) || 0); });
  const out = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = monthKey(d);
    out.push({ ay: monthLabel(k).split(' ')[0].slice(0, 3), v: map[k] || 0 });
  }
  return out;
};

const monthChange = (records, getDate, getAmt) => {
  const now = new Date();
  const thisKey = monthKey(now);
  const lastKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  let cur = 0, prev = 0;
  records.forEach((r) => { const k = monthKey(getDate(r)); if (k === thisKey) cur += Number(getAmt(r)) || 0; else if (k === lastKey) prev += Number(getAmt(r)) || 0; });
  if (prev === 0) return cur > 0 ? 100 : null;
  return ((cur - prev) / prev) * 100;
};

export default function Dashboard({ data, setPage }) {
  const { invoices = [], expenses = [], incomes = [], customers = [], products = [], accounts = [], transactions = [] } = data;
  const [period, setPeriod] = useState('month');

  const cariBalances = useMemo(() => allCariBalances(data), [data]);
  const accBalances = useMemo(() => allAccountBalances(data), [data]);
  const stocks = useMemo(() => allProductStocks(data), [data]);

  const salesInv = useMemo(() => invoices.filter((i) => (i.type || 'sales') === 'sales' && i.status !== 'cancelled'), [invoices]);
  const purchInv = useMemo(() => invoices.filter((i) => i.type === 'purchase' && i.status !== 'cancelled'), [invoices]);
  const tahsilatlar = useMemo(() => transactions.filter((t) => t.type === 'tahsilat'), [transactions]);

  const totalIncome = sum(salesInv, (i) => i.grandTotal) + sum(incomes, (i) => i.amount);
  const totalExpense = sum(purchInv, (i) => i.grandTotal) + sum(expenses, (e) => e.amount);
  const tahsilatTotal = sum(tahsilatlar, (t) => t.amount);
  const cashTotal = accounts.reduce((s, a) => s + (accBalances[a.id] || 0), 0);
  const receivable = customers.reduce((s, c) => s + Math.max(0, cariBalances[c.id] || 0), 0);
  const unpaidInvoices = salesInv.filter((i) => i.status !== 'paid').length;
  const lowStock = products.filter((p) => p.type !== 'service' && (stocks[p.id] || 0) <= (p.minStock || 0)).length;

  const incomeChange = monthChange([...salesInv, ...incomes], (r) => r.date, (r) => r.grandTotal ?? r.amount);
  const expenseChange = monthChange([...purchInv, ...expenses], (r) => r.date, (r) => r.grandTotal ?? r.amount);
  const tahsilatChange = monthChange(tahsilatlar, (r) => r.date, (r) => r.amount);

  // Dönemsel toplamlar (özet kartı)
  const periodStart = period === 'today' ? startOfToday() : period === 'week' ? startOfWeek() : startOfMonth();
  const inPeriod = (d) => { const x = toDate(d); return x && x >= periodStart; };
  const periodIncome = sum(salesInv.filter((i) => inPeriod(i.date)), (i) => i.grandTotal) + sum(incomes.filter((i) => inPeriod(i.date)), (i) => i.amount);
  const periodExpense = sum(purchInv.filter((i) => inPeriod(i.date)), (i) => i.grandTotal) + sum(expenses.filter((e) => inPeriod(e.date)), (e) => e.amount);

  // Seriler
  const gelirSeries = useMemo(() => seriesFrom([...salesInv, ...incomes], (r) => r.date, (r) => r.grandTotal ?? r.amount), [salesInv, incomes]);
  const giderSeries = useMemo(() => seriesFrom([...purchInv, ...expenses], (r) => r.date, (r) => r.grandTotal ?? r.amount), [purchInv, expenses]);
  const tahsilatSeries = useMemo(() => seriesFrom(tahsilatlar, (r) => r.date, (r) => r.amount), [tahsilatlar]);
  const chart = useMemo(() => gelirSeries.map((g) => ({ ay: g.ay, tutar: g.v })), [gelirSeries]);
  const avgIncome = gelirSeries.reduce((s, x) => s + x.v, 0) / (gelirSeries.length || 1);
  const avgExpense = giderSeries.reduce((s, x) => s + x.v, 0) / (giderSeries.length || 1);

  // Son işlemler
  const recent = useMemo(() => {
    const items = [
      ...salesInv.map((i) => ({ name: i.customerSnapshot?.name, doc: i.docNumber, amount: i.grandTotal, tag: 'Satış', neg: false, date: toDate(i.date) })),
      ...purchInv.map((i) => ({ name: i.customerSnapshot?.name, doc: i.docNumber, amount: i.grandTotal, tag: 'Alış', neg: true, date: toDate(i.date) })),
      ...tahsilatlar.map((t) => ({ name: t.customerName, doc: 'Tahsilat', amount: t.amount, tag: 'Tahsilat', neg: false, date: toDate(t.date) })),
    ];
    return items.filter((x) => x.date).sort((a, b) => b.date - a.date).slice(0, 6);
  }, [salesInv, purchInv, tahsilatlar]);

  const handleExport = () => {
    const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const today = new Date().toLocaleDateString('tr-TR');
    const blocks = [
      { heading: `SATIŞ ÖZETİ — ${today}` },
      { headers: ['Özet', 'Tutar (TL)'], rows: [
        ['Toplam Gelir', round(totalIncome)], ['Toplam Gider', round(totalExpense)],
        ['Net (Kâr/Zarar)', round(totalIncome - totalExpense)], ['Toplam Tahsilat', round(tahsilatTotal)],
        ['Kasa/Banka Bakiye', round(cashTotal)], ['Toplam Alacak', round(receivable)],
      ] },
      { heading: 'Kasa / Banka Bakiyeleri', headers: ['Hesap', 'Bakiye (TL)'], rows: accounts.map((a) => [a.name, round(accBalances[a.id] || 0)]) },
      { heading: 'Cari Bakiyeleri', headers: ['Cari', 'Bakiye (TL)', 'Durum'], rows: customers.map((c) => { const b = cariBalances[c.id] || 0; return [c.name, round(b), Math.abs(b) < 0.01 ? '-' : b > 0 ? 'Borç (bize)' : 'Alacak (bizden)']; }) },
      { heading: 'Aylık Gelir (Son 7 Ay)', headers: ['Ay', 'Gelir (TL)'], rows: chart.map((c) => [c.ay, round(c.tutar)]) },
    ];
    downloadExcel(`satis-ozeti-${today.replace(/\./g, '-')}`, blocks);
  };

  const quote = useMemo(() => randomQuote(), []);

  const card = 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm';
  const heading = 'text-gray-800 dark:text-gray-100';
  const muted = 'text-gray-400 dark:text-gray-500';

  return (
    <div>
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold ${heading}`}>Tekrar hoş geldiniz 👋</h1>
          <p className={`text-sm mt-1 ${muted}`}>Gelir, gider ve tahsilatlarınızı takip edin.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setPage('reports')} className={`flex items-center gap-1.5 px-4 py-2 rounded-full ${card} text-sm font-medium text-gray-600 dark:text-gray-200 hover:opacity-90`}><Filter size={15} />Raporlar</button>
          <button onClick={handleExport} className={`flex items-center gap-1.5 px-4 py-2 rounded-full ${card} text-sm font-medium text-gray-600 dark:text-gray-200 hover:opacity-90`}><Download size={15} />Excel</button>
          <button onClick={() => setPage('invoices')} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-medium bg-orange-600 hover:bg-orange-700 shadow-sm"><FileText size={15} />Fatura Ekle</button>
        </div>
      </div>

      {/* Günün özdeyişi (her açılışta değişir) */}
      <div className="relative mb-6 ml-1">
        <div className="flex items-start gap-3 rounded-2xl rounded-tl-sm bg-orange-50 dark:bg-gray-800 border border-orange-100 dark:border-gray-700 px-4 py-3 max-w-3xl shadow-sm">
          <Quote size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
            <span className="italic">“{quote.text}”</span>
            <span className="font-semibold text-orange-600 dark:text-orange-400"> — {quote.author}</span>
          </p>
        </div>
        <span className="absolute -top-1.5 left-4 w-3 h-3 rotate-45 bg-orange-50 dark:bg-gray-800 border-l border-t border-orange-100 dark:border-gray-700" />
      </div>

      {/* Uyarı şeridi */}
      {(unpaidInvoices > 0 || lowStock > 0) && (
        <div className="flex flex-wrap gap-2 mb-5">
          {unpaidInvoices > 0 && <button onClick={() => setPage('invoices')} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100"><FileText size={13} />{unpaidInvoices} ödenmemiş fatura</button>}
          {lowStock > 0 && <button onClick={() => setPage('products')} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 text-xs font-medium hover:bg-rose-100"><AlertTriangle size={13} />{lowStock} kritik stok</button>}
        </div>
      )}

      {/* Ana yerleşim: sol (Özet + ortalamalar) | sağ (Hareketler + İşlem Geçmişi) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* SOL SÜTUN */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Özet */}
          <div className={`rounded-3xl p-5 ${card}`}>
            <div className="flex justify-between items-center mb-1">
              <div>
                <h3 className={`font-semibold ${heading}`}>Özet</h3>
                <p className={`text-xs ${muted}`}>Performansınızı takip edin</p>
              </div>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="text-xs font-medium rounded-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-1.5 outline-none">
                <option value="today">Bugün</option>
                <option value="week">Haftalık</option>
                <option value="month">Aylık</option>
              </select>
            </div>
            <div className="rounded-2xl bg-gray-50 dark:bg-gray-900/40 p-4 mt-3">
              <div className="flex gap-6 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><TrendingDown size={13} /></span>Toplam Gelir</div>
                  <p className={`text-2xl font-bold mt-1 ${heading}`}>{formatCurrency(periodIncome)}</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><TrendingUp size={13} /></span>Toplam Gider</div>
                  <p className={`text-2xl font-bold mt-1 ${heading}`}>{formatCurrency(periodExpense)}</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chart} margin={{ top: 6, right: 0, left: 0, bottom: 0 }} barCategoryGap="24%">
                  <XAxis dataKey="ay" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip cursor={{ fill: 'transparent' }} formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }} />
                  <Bar dataKey="tutar" radius={[8, 8, 8, 8]} maxBarSize={24}>
                    {chart.map((c, i) => <Cell key={i} fill={i < Math.ceil(chart.length * 0.6) ? '#ea580c' : '#fcd9b6'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ortalama kartları */}
          <div className="grid grid-cols-2 gap-5">
            {[
              { label: 'Aylık Ort. Gelir', value: avgIncome, icon: TrendingUp, c: 'text-emerald-600 bg-emerald-50', ch: incomeChange },
              { label: 'Aylık Ort. Gider', value: avgExpense, icon: TrendingDown, c: 'text-orange-600 bg-orange-50', ch: expenseChange },
              { label: 'Kasa / Banka', value: cashTotal, icon: Wallet, c: 'text-violet-600 bg-violet-50' },
              { label: 'Toplam Alacak', value: receivable, icon: ArrowUpRight, c: 'text-rose-600 bg-rose-50' },
            ].map((s, i) => (
              <div key={i} className={`rounded-3xl p-5 ${card}`}>
                <div className="flex items-center gap-2 text-xs text-gray-500"><span className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.c}`}><s.icon size={15} /></span>{s.label}</div>
                {s.ch !== undefined && <div className="mt-2"><ChangeBadge value={s.ch} /></div>}
                <p className={`text-lg font-bold mt-2 ${heading}`}>{formatCurrency(s.value)}</p>
              </div>
            ))}
          </div>

          {/* Net Durum */}
          <div className="rounded-3xl p-5 bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md flex items-center justify-between">
            <div>
              <p className="font-semibold">Net Durum</p>
              <p className="text-xs text-white/70 mt-0.5">Gelir − Gider</p>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalIncome - totalExpense)}</p>
          </div>
        </div>

        {/* SAĞ SÜTUN */}
        <div className="lg:col-span-3 flex flex-col gap-5">
          {/* Hareketler */}
          <div>
            <div className="mb-3">
              <h3 className={`font-semibold ${heading}`}>Hareketler</h3>
              <p className={`text-xs ${muted}`}>Akışınızı takip edin</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`rounded-3xl p-4 ${card}`}>
                <p className={`text-sm font-medium ${heading}`}>Tahsilat</p>
                <div className="mt-2"><ChangeBadge value={tahsilatChange} /></div>
                <p className={`text-xl font-bold mt-2 ${heading}`}>{formatCurrency(tahsilatTotal)}</p>
                <div className="mt-2"><Spark data={tahsilatSeries} color="#ea580c" id="t" /></div>
              </div>
              <div className={`rounded-3xl p-4 ${card}`}>
                <p className={`text-sm font-medium ${heading}`}>Gelir</p>
                <div className="mt-2"><ChangeBadge value={incomeChange} /></div>
                <p className={`text-xl font-bold mt-2 ${heading}`}>{formatCurrency(totalIncome)}</p>
                <div className="mt-2"><Spark data={gelirSeries} color="#f59e0b" id="g" /></div>
              </div>
              <div className="rounded-3xl p-4 bg-gradient-to-br from-[#3a2415] to-[#5a3010] text-white shadow-md">
                <p className="text-sm font-medium">Gider</p>
                <div className="mt-2"><ChangeBadge value={expenseChange} light /></div>
                <p className="text-xl font-bold mt-2">{formatCurrency(totalExpense)}</p>
                <div className="mt-2"><Spark data={giderSeries} color="#fb923c" id="e" /></div>
              </div>
            </div>
          </div>

          {/* İşlem Geçmişi */}
          <div className={`rounded-3xl p-5 flex-1 ${card}`}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className={`font-semibold ${heading}`}>İşlem Geçmişi</h3>
                <p className={`text-xs ${muted}`}>Son hareketleriniz</p>
              </div>
              <button onClick={() => setPage('activity')} className="text-xs font-medium text-orange-600 hover:text-orange-700">Tümü</button>
            </div>
            {recent.length === 0 ? (
              <p className={`text-center text-sm py-10 ${muted}`}>Henüz hareket yok</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {recent.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>{initials(r.name)}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${heading}`}>{r.name || '—'}</p>
                      <p className={`text-xs truncate ${muted}`}>{r.doc} · {formatDateShort(r.date)}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.tag === 'Tahsilat' ? 'bg-emerald-100 text-emerald-700' : r.tag === 'Alış' ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'}`}>{r.tag}</span>
                    <p className={`text-sm font-semibold w-24 text-right ${r.neg ? 'text-rose-600' : 'text-gray-800 dark:text-gray-100'}`}>{r.neg ? '-' : ''}{formatCurrency(r.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

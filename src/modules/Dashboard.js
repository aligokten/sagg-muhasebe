// --- Gösterge Paneli (modern "Sales Overview" tasarımı) ---
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  MoreHorizontal, ArrowUpRight, ArrowDownRight, Download, SlidersHorizontal,
  Wallet, Users, FileText, AlertTriangle, Package,
} from 'lucide-react';
import { formatCurrency, monthKey, monthLabel, toDate, sum } from '../utils';
import { allCariBalances, allAccountBalances, allProductStocks } from '../finance';
import { downloadExcel } from '../exportExcel';

const initials = (name) =>
  (name || '?').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

const AVATAR_COLORS = ['bg-sky-100 text-sky-700', 'bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700'];

const ChangeBadge = ({ value, light }) => {
  if (value === null || value === undefined || !isFinite(value)) return null;
  const up = value >= 0;
  const base = light ? 'bg-white/15 text-white' : up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600';
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${base}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(value).toFixed(0)}%
    </span>
  );
};

// Yarım daire gösterge (gauge)
const Gauge = ({ percent }) => {
  const p = Math.max(0, Math.min(100, percent || 0));
  const r = 80;
  const arc = Math.PI * r; // yarım çember uzunluğu
  const dash = (p / 100) * arc;
  return (
    <div className="relative w-full flex justify-center">
      <svg viewBox="0 0 200 116" className="w-56 max-w-full">
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#eef2f6" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${arc}`}
        />
      </svg>
    </div>
  );
};

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const startOfWeek = () => { const d = startOfToday(); d.setDate(d.getDate() - 6); return d; };
const startOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };

export default function Dashboard({ data, setPage }) {
  const { invoices = [], expenses = [], incomes = [], customers = [], products = [], accounts = [], transactions = [] } = data;
  const [period, setPeriod] = useState('month');

  const cariBalances = useMemo(() => allCariBalances(data), [data]);
  const accBalances = useMemo(() => allAccountBalances(data), [data]);
  const stocks = useMemo(() => allProductStocks(data), [data]);

  const salesInv = useMemo(() => invoices.filter((i) => (i.type || 'sales') === 'sales' && i.status !== 'cancelled'), [invoices]);
  const purchInv = useMemo(() => invoices.filter((i) => i.type === 'purchase' && i.status !== 'cancelled'), [invoices]);

  const totalIncome = sum(salesInv, (i) => i.grandTotal) + sum(incomes, (i) => i.amount);
  const totalExpense = sum(purchInv, (i) => i.grandTotal) + sum(expenses, (e) => e.amount);
  const cashTotal = accounts.reduce((s, a) => s + (accBalances[a.id] || 0), 0);
  const receivable = customers.reduce((s, c) => s + Math.max(0, cariBalances[c.id] || 0), 0);
  const unpaidInvoices = salesInv.filter((i) => i.status !== 'paid').length;
  const lowStock = products.filter((p) => p.type !== 'service' && (stocks[p.id] || 0) <= (p.minStock || 0)).length;

  // Aylık değişim (% vs geçen ay)
  const monthChange = (records, getDate, getAmt) => {
    const now = new Date();
    const thisKey = monthKey(now);
    const lastKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    let cur = 0, prev = 0;
    records.forEach((r) => {
      const k = monthKey(getDate(r));
      if (k === thisKey) cur += Number(getAmt(r)) || 0;
      else if (k === lastKey) prev += Number(getAmt(r)) || 0;
    });
    if (prev === 0) return cur > 0 ? 100 : null;
    return ((cur - prev) / prev) * 100;
  };
  const incomeChange = monthChange([...salesInv, ...incomes], (r) => r.date, (r) => r.grandTotal ?? r.amount);
  const expenseChange = monthChange([...purchInv, ...expenses], (r) => r.date, (r) => r.grandTotal ?? r.amount);

  // Dönemsel akış (bugün / hafta / ay)
  const periodStart = period === 'today' ? startOfToday() : period === 'week' ? startOfWeek() : startOfMonth();
  const inPeriod = (d) => { const x = toDate(d); return x && x >= periodStart; };
  const periodIncome = sum(salesInv.filter((i) => inPeriod(i.date)), (i) => i.grandTotal) + sum(incomes.filter((i) => inPeriod(i.date)), (i) => i.amount);
  const periodExpense = sum(purchInv.filter((i) => inPeriod(i.date)), (i) => i.grandTotal) + sum(expenses.filter((e) => inPeriod(e.date)), (e) => e.amount);
  const flowRatio = periodIncome + periodExpense > 0 ? (periodIncome / (periodIncome + periodExpense)) * 100 : 0;

  // Tahsilat oranı (ödenen satış / toplam satış)
  const salesTotal = sum(salesInv, (i) => i.grandTotal);
  const paidTotal = sum(salesInv.filter((i) => i.status === 'paid'), (i) => i.grandTotal);
  const collectionRate = salesTotal > 0 ? (paidTotal / salesTotal) * 100 : 0;

  // Son 7 ay gelir (istatistik grafiği)
  const chart = useMemo(() => {
    const map = {};
    [...salesInv, ...incomes].forEach((r) => {
      const k = monthKey(r.date);
      if (k) map[k] = (map[k] || 0) + (Number(r.grandTotal ?? r.amount) || 0);
    });
    const out = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = monthKey(d);
      out.push({ ay: monthLabel(k).split(' ')[0].slice(0, 3), tutar: map[k] || 0 });
    }
    return out;
  }, [salesInv, incomes]);
  const maxIdx = chart.reduce((m, c, i, a) => (c.tutar > a[m].tutar ? i : m), 0);
  const statChange = chart.length >= 2 && chart[chart.length - 2].tutar > 0
    ? ((chart[chart.length - 1].tutar - chart[chart.length - 2].tutar) / chart[chart.length - 2].tutar) * 100
    : null;

  // Son hareketler
  const recent = useMemo(() => {
    const items = [
      ...salesInv.map((i) => ({ name: i.customerSnapshot?.name, sub: `${i.docNumber} · Satış`, amount: i.grandTotal, tag: 'Satış', color: 'sky', date: toDate(i.date) })),
      ...transactions.filter((t) => t.type === 'tahsilat').map((t) => ({ name: t.customerName, sub: 'Tahsilat', amount: t.amount, tag: 'Tahsilat', color: 'emerald', date: toDate(t.date) })),
    ];
    return items.filter((x) => x.date).sort((a, b) => b.date - a.date).slice(0, 5);
  }, [salesInv, transactions]);

  const periodLabel = { today: 'Bugün', week: 'Bu Hafta', month: 'Bu Ay' }[period];

  const handleExport = () => {
    const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const today = new Date().toLocaleDateString('tr-TR');
    const blocks = [
      { heading: `SATIŞ ÖZETİ — ${today}` },
      {
        headers: ['Özet', 'Tutar (TL)'],
        rows: [
          ['Toplam Gelir', round(totalIncome)],
          ['Toplam Gider', round(totalExpense)],
          ['Net (Kâr/Zarar)', round(totalIncome - totalExpense)],
          ['Kasa/Banka Bakiye', round(cashTotal)],
          ['Toplam Alacak', round(receivable)],
          ['Tahsilat Oranı (%)', Math.round(collectionRate)],
        ],
      },
      {
        heading: 'Kasa / Banka Bakiyeleri',
        headers: ['Hesap', 'Bakiye (TL)'],
        rows: accounts.map((a) => [a.name, round(accBalances[a.id] || 0)]),
      },
      {
        heading: 'Cari Bakiyeleri',
        headers: ['Cari', 'Bakiye (TL)', 'Durum'],
        rows: customers.map((c) => {
          const b = cariBalances[c.id] || 0;
          return [c.name, round(b), Math.abs(b) < 0.01 ? '-' : b > 0 ? 'Borç (bize)' : 'Alacak (bizden)'];
        }),
      },
      {
        heading: 'Aylık Gelir (Son 7 Ay)',
        headers: ['Ay', 'Gelir (TL)'],
        rows: chart.map((c) => [c.ay, round(c.tutar)]),
      },
    ];
    downloadExcel(`satis-ozeti-${today.replace(/\./g, '-')}`, blocks);
  };

  return (
    <div>
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Satış Özeti</h1>
          <p className="text-sm text-gray-400 mt-1">Güncel finansal durumunuz ve hareketler</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"><Download size={15} />Excel'e Aktar</button>
          <button onClick={() => setPage('reports')} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-medium bg-gradient-to-r from-sky-500 to-cyan-500 hover:opacity-90 shadow-sm"><SlidersHorizontal size={15} />Raporlar</button>
        </div>
      </div>

      {/* Uyarı şeridi */}
      {(unpaidInvoices > 0 || lowStock > 0) && (
        <div className="flex flex-wrap gap-2 mb-5">
          {unpaidInvoices > 0 && (
            <button onClick={() => setPage('invoices')} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100"><FileText size={13} />{unpaidInvoices} ödenmemiş fatura</button>
          )}
          {lowStock > 0 && (
            <button onClick={() => setPage('products')} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 text-xs font-medium hover:bg-rose-100"><AlertTriangle size={13} />{lowStock} kritik stok</button>
          )}
        </div>
      )}

      {/* Üst kartlar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Sol sütun: gelir (koyu) + gider (beyaz) */}
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl p-5 bg-gradient-to-br from-[#15325a] to-[#1f4e7e] text-white shadow-md relative overflow-hidden">
            <div className="flex justify-between items-start">
              <span className="text-sm text-white/70">Toplam Gelir</span>
              <MoreHorizontal size={18} className="text-white/50" />
            </div>
            <div className="flex items-end gap-2 mt-3">
              <span className="text-3xl font-bold tracking-tight">{formatCurrency(totalIncome)}</span>
            </div>
            <div className="mt-2"><ChangeBadge value={incomeChange} light /> <span className="text-xs text-white/60 ml-1">geçen aya göre</span></div>
          </div>
          <div className="rounded-2xl p-5 bg-white border border-gray-100 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-sm text-gray-400">Toplam Gider</span>
              <MoreHorizontal size={18} className="text-gray-300" />
            </div>
            <div className="text-3xl font-bold text-gray-800 mt-3">{formatCurrency(totalExpense)}</div>
            <div className="mt-2"><ChangeBadge value={expenseChange} /> <span className="text-xs text-gray-400 ml-1">geçen aya göre</span></div>
          </div>
        </div>

        {/* Orta: dönemsel akış */}
        <div className="rounded-2xl p-5 bg-white border border-gray-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-500">Nakit Akışı</span>
            <MoreHorizontal size={18} className="text-gray-300" />
          </div>
          <div className="flex gap-1 mt-3">
            {[{ k: 'today', l: 'Bugün' }, { k: 'week', l: 'Hafta' }, { k: 'month', l: 'Ay' }].map((t) => (
              <button key={t.k} onClick={() => setPeriod(t.k)} className={`px-3 py-1 rounded-full text-xs font-medium ${period === t.k ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{t.l}</button>
            ))}
          </div>
          <div className="text-3xl font-bold text-gray-800 mt-4">{formatCurrency(periodIncome)}</div>
          <p className="text-xs text-gray-400 mt-1">{periodLabel} toplam tahsilat / gelir</p>
          <div className="mt-4">
            <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-400" style={{ width: `${flowRatio}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>Gider: {formatCurrency(periodExpense)}</span>
              <span className="text-emerald-600 font-medium">Net {formatCurrency(periodIncome - periodExpense)}</span>
            </div>
          </div>
        </div>

        {/* Sağ: tahsilat oranı gauge */}
        <div className="rounded-2xl p-5 bg-white border border-gray-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-500">Tahsilat Durumu</span>
            <MoreHorizontal size={18} className="text-gray-300" />
          </div>
          <div className="relative mt-4">
            <Gauge percent={collectionRate} />
            <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
              <span className="text-3xl font-bold text-gray-800">%{collectionRate.toFixed(0)}</span>
              <span className="text-xs text-gray-400">tahsil edildi</span>
            </div>
          </div>
          <div className="flex justify-between items-center mt-3 text-xs text-gray-400">
            <span>Toplam alacak</span>
            <span className="inline-flex items-center gap-1 font-medium text-rose-600">{formatCurrency(receivable)}</span>
          </div>
        </div>
      </div>

      {/* Alt: istatistik grafiği + son hareketler */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl p-5 bg-white border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">İstatistik</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold text-gray-800">{statChange !== null ? `${statChange >= 0 ? '+' : ''}${statChange.toFixed(0)}%` : '—'}</span>
                <ChangeBadge value={statChange} />
              </div>
              <p className="text-xs text-gray-400 mt-1">Son 7 ay aylık gelir</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chart} margin={{ top: 10, right: 0, left: 0, bottom: 0 }} barCategoryGap="28%">
              <XAxis dataKey="ay" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
              <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid #eef2f6', fontSize: 12 }} />
              <Bar dataKey="tutar" radius={[10, 10, 10, 10]} maxBarSize={42}>
                {chart.map((c, i) => <Cell key={i} fill={i === maxIdx ? '#2dd4bf' : '#dbeafe'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl p-5 shadow-sm border border-gray-100 bg-gradient-to-br from-sky-50 to-cyan-50/40">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-gray-600">Son Hareketler</h3>
            <MoreHorizontal size={18} className="text-gray-300" />
          </div>
          {recent.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">Henüz hareket yok</p>
          ) : (
            <div className="space-y-2">
              {recent.map((r, i) => (
                <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 shadow-sm">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>{initials(r.name)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.name || '—'}</p>
                    <p className="text-xs text-gray-400 truncate">{r.sub}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">{formatCurrency(r.amount)}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>{r.tag}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mini istatistik kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-5">
        {[
          { label: 'Kasa/Banka', value: formatCurrency(cashTotal), icon: Wallet, c: 'text-sky-600 bg-sky-50' },
          { label: 'Toplam Alacak', value: formatCurrency(receivable), icon: ArrowUpRight, c: 'text-rose-600 bg-rose-50' },
          { label: 'Cari Sayısı', value: customers.length, icon: Users, c: 'text-violet-600 bg-violet-50' },
          { label: 'Ürün/Hizmet', value: products.length, icon: Package, c: 'text-emerald-600 bg-emerald-50' },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.c}`}><s.icon size={20} /></div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="text-lg font-bold text-gray-800 truncate">{s.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

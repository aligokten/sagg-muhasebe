// --- Raporlar ---
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency, toDate, todayInput, monthKey, monthLabel, sum, vatFromGross } from '../utils';
import { allCariBalances } from '../finance';
import { flatCategories } from '../categories';
import { PageHeader, Card, Select, Input } from '../components/ui';

const PIE_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899', '#84cc16'];

const PERIODS = [
  { key: 'day', label: 'Günlük' },
  { key: 'week', label: 'Haftalık' },
  { key: 'month', label: 'Aylık' },
  { key: 'year', label: 'Yıllık' },
];

// Seçilen dönem türü ve referans tarihe göre [start, end) aralığını hesaplar.
function periodRange(periodType, refDateStr) {
  const ref = refDateStr ? new Date(refDateStr) : new Date();
  ref.setHours(0, 0, 0, 0);
  let start, end;
  if (periodType === 'day') {
    start = new Date(ref);
    end = new Date(ref);
    end.setDate(end.getDate() + 1);
  } else if (periodType === 'week') {
    const day = ref.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start = new Date(ref);
    start.setDate(start.getDate() + diffToMonday);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else if (periodType === 'year') {
    start = new Date(ref.getFullYear(), 0, 1);
    end = new Date(ref.getFullYear() + 1, 0, 1);
  } else {
    start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  }
  return { start, end };
}

function periodLabel(periodType, start, end) {
  const opts = { day: 'numeric', month: 'long', year: 'numeric' };
  if (periodType === 'day') return start.toLocaleDateString('tr-TR', opts);
  if (periodType === 'week') {
    const endInclusive = new Date(end);
    endInclusive.setDate(endInclusive.getDate() - 1);
    return `${start.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} — ${endInclusive.toLocaleDateString('tr-TR', opts)}`;
  }
  if (periodType === 'year') return `${start.getFullYear()}`;
  return start.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

const shiftRefDate = (periodType, refDateStr, dir) => {
  const d = refDateStr ? new Date(refDateStr) : new Date();
  if (periodType === 'day') d.setDate(d.getDate() + dir);
  else if (periodType === 'week') d.setDate(d.getDate() + dir * 7);
  else if (periodType === 'year') d.setFullYear(d.getFullYear() + dir);
  else d.setMonth(d.getMonth() + dir);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().split('T')[0];
};

const inRange = (date, start, end) => {
  const d = toDate(date);
  return d && d >= start && d < end;
};

export default function Reports({ data }) {
  const { expenses = [], incomes = [], customers = [] } = data;
  const invoices = useMemo(() => (data.invoices || []).filter((i) => i.status !== 'cancelled'), [data.invoices]);

  const [periodType, setPeriodType] = useState('month');
  const [refDate, setRefDate] = useState(todayInput());
  const [category, setCategory] = useState('');

  const { start, end } = useMemo(() => periodRange(periodType, refDate), [periodType, refDate]);
  const rangeLabel = useMemo(() => periodLabel(periodType, start, end), [periodType, start, end]);

  // Seçili dönem + kategoriye göre filtrelenmiş kayıtlar (KDV, özet ve gider dağılımı için).
  const periodExpenses = useMemo(
    () => expenses.filter((e) => inRange(e.date, start, end) && (!category || e.category === category)),
    [expenses, start, end, category]
  );
  const periodIncomes = useMemo(
    () => incomes.filter((i) => inRange(i.date, start, end) && (!category || i.category === category)),
    [incomes, start, end, category]
  );
  const periodInvoices = useMemo(() => invoices.filter((i) => inRange(i.date, start, end)), [invoices, start, end]);

  // KDV raporu (seçili döneme göre)
  const vat = useMemo(() => {
    const salesInv = periodInvoices.filter((i) => (i.type || 'sales') === 'sales');
    const purchInv = periodInvoices.filter((i) => i.type === 'purchase');
    const hesaplanan = sum(salesInv, (i) => i.vatTotal) + sum(periodIncomes, (i) => vatFromGross(i.amount, i.vatRate));
    const indirilecek = sum(purchInv, (i) => i.vatTotal) + sum(periodExpenses, (e) => vatFromGross(e.amount, e.vatRate));
    return { hesaplanan, indirilecek, odenecek: hesaplanan - indirilecek };
  }, [periodInvoices, periodExpenses, periodIncomes]);

  // Seçili dönem özeti
  const periodGelir = sum(periodInvoices.filter((i) => (i.type || 'sales') === 'sales'), (i) => i.grandTotal) + sum(periodIncomes, (i) => i.amount);
  const periodGider = sum(periodInvoices.filter((i) => i.type === 'purchase'), (i) => i.grandTotal) + sum(periodExpenses, (e) => e.amount);

  // Aylık gelir-gider (son 12 ay genel trend, dönem filtresinden bağımsız)
  const monthly = useMemo(() => {
    const map = {};
    const add = (key, field, val) => {
      if (!key) return;
      map[key] = map[key] || { key, gelir: 0, gider: 0 };
      map[key][field] += val;
    };
    invoices.filter((i) => (i.type || 'sales') === 'sales').forEach((i) => add(monthKey(i.date), 'gelir', Number(i.grandTotal) || 0));
    incomes.forEach((i) => add(monthKey(i.date), 'gelir', Number(i.amount) || 0));
    invoices.filter((i) => i.type === 'purchase').forEach((i) => add(monthKey(i.date), 'gider', Number(i.grandTotal) || 0));
    expenses.forEach((e) => add(monthKey(e.date), 'gider', Number(e.amount) || 0));
    return Object.values(map)
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-12)
      .map((m) => ({ ...m, ay: monthLabel(m.key), kar: m.gelir - m.gider }));
  }, [invoices, incomes, expenses]);

  // Gider dağılımı (seçili dönem + kategori filtresine göre)
  const expenseByCat = useMemo(() => {
    const map = {};
    periodExpenses.forEach((e) => { map[e.category || 'Diğer'] = (map[e.category || 'Diğer'] || 0) + (Number(e.amount) || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [periodExpenses]);

  // Cari yaşlandırma (en yüksek alacak/borç) — güncel bakiye, dönem filtresinden bağımsız
  const balances = useMemo(() => allCariBalances(data), [data]);
  const topReceivables = useMemo(
    () => customers.map((c) => ({ name: c.name, bal: balances[c.id] || 0 })).filter((x) => x.bal > 0.01).sort((a, b) => b.bal - a.bal).slice(0, 8),
    [customers, balances]
  );
  const topPayables = useMemo(
    () => customers.map((c) => ({ name: c.name, bal: -(balances[c.id] || 0) })).filter((x) => x.bal > 0.01).sort((a, b) => b.bal - a.bal).slice(0, 8),
    [customers, balances]
  );

  const totalGelir = sum(monthly, (m) => m.gelir);
  const totalGider = sum(monthly, (m) => m.gider);

  return (
    <div>
      <PageHeader title="Raporlar" subtitle="İşletmenizin finansal özeti" />

      {/* Dönem ve kategori filtresi */}
      <Card className="mb-6">
        <div className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriodType(p.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${periodType === p.key ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setRefDate((d) => shiftRefDate(periodType, d, -1))} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"><ChevronLeft size={18} /></button>
            <span className="text-sm font-medium text-gray-700 min-w-[11rem] text-center">{rangeLabel}</span>
            <button onClick={() => setRefDate((d) => shiftRefDate(periodType, d, 1))} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"><ChevronRight size={18} /></button>
          </div>

          <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="w-auto" />

          <div className="ml-auto w-full sm:w-56">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Tüm Kategoriler</option>
              {flatCategories().map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        </div>
      </Card>

      {/* Seçili dönem özeti */}
      <Card title={`Dönem Özeti — ${rangeLabel}`} className="mb-6">
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center"><p className="text-sm text-gray-500">Gelir</p><p className="text-2xl font-bold text-green-600">{formatCurrency(periodGelir)}</p></div>
          <div className="text-center"><p className="text-sm text-gray-500">Gider</p><p className="text-2xl font-bold text-red-600">{formatCurrency(periodGider)}</p></div>
          <div className="text-center"><p className="text-sm text-gray-500">Net Kâr/Zarar</p><p className={`text-2xl font-bold ${periodGelir - periodGider >= 0 ? 'text-orange-600' : 'text-red-600'}`}>{formatCurrency(periodGelir - periodGider)}</p></div>
        </div>
      </Card>

      {/* KDV Raporu */}
      <Card title={`KDV Raporu — ${rangeLabel}`} className="mb-6">
        <div className="p-6 space-y-3">
          <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg"><span className="font-semibold text-green-800">Hesaplanan KDV (Satış)</span><span className="font-bold text-lg text-green-600">{formatCurrency(vat.hesaplanan)}</span></div>
          <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg"><span className="font-semibold text-red-800">İndirilecek KDV (Alış/Gider)</span><span className="font-bold text-lg text-red-600">{formatCurrency(vat.indirilecek)}</span></div>
          <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg border-t-2 border-orange-200"><span className="font-semibold text-xl text-orange-800">{vat.odenecek >= 0 ? 'Ödenecek KDV' : 'Devreden KDV'}</span><span className="font-bold text-2xl text-orange-600">{formatCurrency(Math.abs(vat.odenecek))}</span></div>
          <p className="text-xs text-gray-500">* Bu rapor bilgilendirme amaçlıdır. Resmi beyanlar için mali müşavirinize danışın.</p>
        </div>
      </Card>

      {/* Aylık gelir-gider */}
      <Card title="Son 12 Ay Trend" className="mb-6">
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="text-center"><p className="text-sm text-gray-500">Toplam Gelir</p><p className="text-2xl font-bold text-green-600">{formatCurrency(totalGelir)}</p></div>
            <div className="text-center"><p className="text-sm text-gray-500">Toplam Gider</p><p className="text-2xl font-bold text-red-600">{formatCurrency(totalGider)}</p></div>
            <div className="text-center"><p className="text-sm text-gray-500">Net Kâr/Zarar</p><p className={`text-2xl font-bold ${totalGelir - totalGider >= 0 ? 'text-orange-600' : 'text-red-600'}`}>{formatCurrency(totalGelir - totalGider)}</p></div>
          </div>
          {monthly.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Gösterilecek veri yok</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthly} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ay" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="gelir" name="Gelir" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gider" name="Gider" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Gider dağılımı */}
        <Card title={`Gider Dağılımı — ${rangeLabel}`}>
          <div className="p-6">
            {expenseByCat.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Gider kaydı yok</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={expenseByCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                    {expenseByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Cari yaşlandırma */}
        <Card title="En Yüksek Alacaklar">
          <div className="p-6 space-y-2">
            {topReceivables.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Alacak yok</p>
            ) : (
              topReceivables.map((r, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700">{r.name}</span>
                  <span className="text-sm font-semibold text-red-600">{formatCurrency(r.bal)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card title="En Yüksek Borçlar (Tedarikçilere)">
        <div className="p-6 space-y-2">
          {topPayables.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Borç yok</p>
          ) : (
            topPayables.map((r, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-700">{r.name}</span>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(r.bal)}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

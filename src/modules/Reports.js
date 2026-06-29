// --- Raporlar ---
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency, monthKey, monthLabel, sum, vatFromGross } from '../utils';
import { allCariBalances } from '../finance';
import { PageHeader, Card } from '../components/ui';

const PIE_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899', '#84cc16'];

export default function Reports({ data }) {
  const { expenses = [], incomes = [], customers = [] } = data;
  const invoices = useMemo(() => (data.invoices || []).filter((i) => i.status !== 'cancelled'), [data.invoices]);

  // KDV raporu
  const vat = useMemo(() => {
    const salesInv = invoices.filter((i) => (i.type || 'sales') === 'sales');
    const purchInv = invoices.filter((i) => i.type === 'purchase');
    const hesaplanan = sum(salesInv, (i) => i.vatTotal) + sum(incomes, (i) => vatFromGross(i.amount, i.vatRate));
    const indirilecek = sum(purchInv, (i) => i.vatTotal) + sum(expenses, (e) => vatFromGross(e.amount, e.vatRate));
    return { hesaplanan, indirilecek, odenecek: hesaplanan - indirilecek };
  }, [invoices, expenses, incomes]);

  // Aylık gelir-gider
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

  // Gider dağılımı (kategori)
  const expenseByCat = useMemo(() => {
    const map = {};
    expenses.forEach((e) => { map[e.category || 'Diğer'] = (map[e.category || 'Diğer'] || 0) + (Number(e.amount) || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Cari yaşlandırma (en yüksek alacak/borç)
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

      {/* KDV Raporu */}
      <Card title="KDV Raporu" className="mb-6">
        <div className="p-6 space-y-3">
          <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg"><span className="font-semibold text-green-800">Hesaplanan KDV (Satış)</span><span className="font-bold text-lg text-green-600">{formatCurrency(vat.hesaplanan)}</span></div>
          <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg"><span className="font-semibold text-red-800">İndirilecek KDV (Alış/Gider)</span><span className="font-bold text-lg text-red-600">{formatCurrency(vat.indirilecek)}</span></div>
          <div className="flex justify-between items-center p-4 bg-sky-50 rounded-lg border-t-2 border-sky-200"><span className="font-semibold text-xl text-sky-800">{vat.odenecek >= 0 ? 'Ödenecek KDV' : 'Devreden KDV'}</span><span className="font-bold text-2xl text-sky-600">{formatCurrency(Math.abs(vat.odenecek))}</span></div>
          <p className="text-xs text-gray-500">* Bu rapor bilgilendirme amaçlıdır. Resmi beyanlar için mali müşavirinize danışın.</p>
        </div>
      </Card>

      {/* Aylık gelir-gider */}
      <Card title="Aylık Gelir / Gider" className="mb-6">
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="text-center"><p className="text-sm text-gray-500">Toplam Gelir</p><p className="text-2xl font-bold text-green-600">{formatCurrency(totalGelir)}</p></div>
            <div className="text-center"><p className="text-sm text-gray-500">Toplam Gider</p><p className="text-2xl font-bold text-red-600">{formatCurrency(totalGider)}</p></div>
            <div className="text-center"><p className="text-sm text-gray-500">Net Kâr/Zarar</p><p className={`text-2xl font-bold ${totalGelir - totalGider >= 0 ? 'text-sky-600' : 'text-red-600'}`}>{formatCurrency(totalGelir - totalGider)}</p></div>
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
        <Card title="Gider Dağılımı">
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

// --- Gösterge Paneli ---
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Users, Wallet, FileText, AlertTriangle, ScrollText } from 'lucide-react';
import { formatCurrency, formatDateShort, monthKey, monthLabel, sum, daysBetween } from '../utils';
import { allCariBalances, allAccountBalances, allProductStocks } from '../finance';
import { StatCard, Card, Badge, EmptyState } from '../components/ui';

export default function Dashboard({ data, setPage }) {
  const { invoices = [], expenses = [], incomes = [], customers = [], products = [], accounts = [], checks = [] } = data;

  const cariBalances = useMemo(() => allCariBalances(data), [data]);
  const accBalances = useMemo(() => allAccountBalances(data), [data]);
  const stocks = useMemo(() => allProductStocks(data), [data]);

  const totalIncome = sum(invoices.filter((i) => (i.type || 'sales') === 'sales'), (i) => i.grandTotal) + sum(incomes, (i) => i.amount);
  const totalExpense = sum(invoices.filter((i) => i.type === 'purchase'), (i) => i.grandTotal) + sum(expenses, (e) => e.amount);
  const cashTotal = accounts.reduce((s, a) => s + (accBalances[a.id] || 0), 0);
  const receivable = customers.reduce((s, c) => s + Math.max(0, cariBalances[c.id] || 0), 0);
  const unpaidInvoices = invoices.filter((i) => (i.type || 'sales') === 'sales' && i.status !== 'paid').length;
  const lowStock = products.filter((p) => p.type !== 'service' && (stocks[p.id] || 0) <= (p.minStock || 0)).length;

  const trend = useMemo(() => {
    const map = {};
    const add = (k, f, v) => { if (!k) return; map[k] = map[k] || { key: k, gelir: 0, gider: 0 }; map[k][f] += v; };
    invoices.filter((i) => (i.type || 'sales') === 'sales').forEach((i) => add(monthKey(i.date), 'gelir', Number(i.grandTotal) || 0));
    incomes.forEach((i) => add(monthKey(i.date), 'gelir', Number(i.amount) || 0));
    invoices.filter((i) => i.type === 'purchase').forEach((i) => add(monthKey(i.date), 'gider', Number(i.grandTotal) || 0));
    expenses.forEach((e) => add(monthKey(e.date), 'gider', Number(e.amount) || 0));
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key)).slice(-6).map((m) => ({ ...m, ay: monthLabel(m.key) }));
  }, [invoices, incomes, expenses]);

  const recentInvoices = useMemo(
    () => [...invoices].sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)).slice(0, 5),
    [invoices]
  );
  const upcomingChecks = useMemo(
    () => checks.filter((c) => c.status === 'portfolio').sort((a, b) => (a.dueDate?.seconds || 0) - (b.dueDate?.seconds || 0)).slice(0, 5),
    [checks]
  );

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Gösterge Paneli</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Toplam Gelir" value={formatCurrency(totalIncome)} color="text-green-600" icon={TrendingUp} />
        <StatCard title="Toplam Gider" value={formatCurrency(totalExpense)} color="text-red-600" icon={TrendingDown} />
        <StatCard title="Kasa/Banka Bakiye" value={formatCurrency(cashTotal)} color="text-sky-600" icon={Wallet} />
        <StatCard title="Toplam Alacak" value={formatCurrency(receivable)} color="text-purple-600" icon={Users} />
      </div>

      {/* Uyarılar */}
      {(unpaidInvoices > 0 || lowStock > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {unpaidInvoices > 0 && (
            <button onClick={() => setPage('invoices')} className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-left hover:bg-yellow-100">
              <FileText className="text-yellow-600" />
              <span className="text-sm text-yellow-800"><b>{unpaidInvoices}</b> ödenmemiş satış faturası var.</span>
            </button>
          )}
          {lowStock > 0 && (
            <button onClick={() => setPage('products')} className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-left hover:bg-red-100">
              <AlertTriangle className="text-red-600" />
              <span className="text-sm text-red-800"><b>{lowStock}</b> ürün kritik stok seviyesinde.</span>
            </button>
          )}
        </div>
      )}

      <Card title="Gelir & Gider Trendi (Son 6 Ay)" className="mb-6">
        <div className="p-6">
          {trend.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Henüz veri yok. Fatura ve gider ekleyerek başlayın.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trend} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="gGelir" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gGider" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ay" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Area type="monotone" dataKey="gelir" name="Gelir" stroke="#22c55e" fill="url(#gGelir)" strokeWidth={2} />
                <Area type="monotone" dataKey="gider" name="Gider" stroke="#ef4444" fill="url(#gGider)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Son Faturalar">
          {recentInvoices.length === 0 ? <EmptyState message="Henüz fatura yok" icon={FileText} /> : (
            <div className="divide-y divide-gray-100">
              {recentInvoices.map((inv) => (
                <div key={inv.id} className="flex justify-between items-center px-6 py-3 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{inv.customerSnapshot?.name}</p>
                    <p className="text-xs text-gray-400">{inv.docNumber} · {formatDateShort(inv.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">{formatCurrency(inv.grandTotal)}</p>
                    <Badge color={(inv.type || 'sales') === 'sales' ? 'sky' : 'purple'}>{(inv.type || 'sales') === 'sales' ? 'Satış' : 'Alış'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Yaklaşan Çek/Senet">
          {upcomingChecks.length === 0 ? <EmptyState message="Portföyde çek/senet yok" icon={ScrollText} /> : (
            <div className="divide-y divide-gray-100">
              {upcomingChecks.map((c) => {
                const late = daysBetween(new Date(), c.dueDate) < 0;
                return (
                  <div key={c.id} className="flex justify-between items-center px-6 py-3 hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{c.customerName || (c.type === 'senet' ? 'Senet' : 'Çek')}</p>
                      <p className="text-xs text-gray-400">Vade: {formatDateShort(c.dueDate)} {late && <span className="text-red-500">· gecikti</span>}</p>
                    </div>
                    <span className={`text-sm font-semibold ${c.direction === 'received' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(c.amount)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

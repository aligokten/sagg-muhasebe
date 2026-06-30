// --- Tüm İşlemler: tüm para hareketlerinin birleşik listesi ---
import React, { useMemo, useState } from 'react';
import { Download, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatCurrency, formatDateShort, toDate, monthKey, sum } from '../utils';
import { PageHeader, Card, Table, Td, Badge, EmptyState, StatCard, Button, Select, Input } from '../components/ui';
import { downloadExcel } from '../exportExcel';

const TYPE_META = {
  satis: { label: 'Satış Faturası', color: 'sky' },
  alis: { label: 'Alış Faturası', color: 'purple' },
  tahsilat: { label: 'Tahsilat', color: 'green' },
  odeme: { label: 'Ödeme', color: 'red' },
  gelir: { label: 'Gelir', color: 'green' },
  gider: { label: 'Gider', color: 'yellow' },
  transfer: { label: 'Virman', color: 'gray' },
  manuel: { label: 'Cari Hareket', color: 'blue' },
};

export default function AllTransactions({ data }) {
  const { invoices = [], transactions = [], incomes = [], expenses = [], accounts = [] } = data;
  const [cat, setCat] = useState('all');
  const [period, setPeriod] = useState('all');
  const [search, setSearch] = useState('');

  const accName = (id) => accounts.find((a) => a.id === id)?.name || '';

  const items = useMemo(() => {
    const out = [];
    invoices.filter((i) => i.status !== 'cancelled').forEach((i) => {
      const sales = (i.type || 'sales') === 'sales';
      out.push({ date: toDate(i.date), cat: sales ? 'satis' : 'alis', label: i.customerSnapshot?.name || '', sub: i.docNumber || '', amount: Number(i.grandTotal) || 0, flow: 'doc' });
    });
    transactions.forEach((t) => {
      if (t.type === 'transfer') { out.push({ date: toDate(t.date), cat: 'transfer', label: t.description || 'Hesaplar arası virman', sub: '', amount: Number(t.amount) || 0, flow: 'doc' }); return; }
      const known = t.type === 'tahsilat' || t.type === 'odeme';
      out.push({
        date: toDate(t.date),
        cat: known ? t.type : 'manuel',
        label: t.customerName || t.description || '',
        sub: [t.category, accName(t.accountId)].filter(Boolean).join(' · '),
        amount: Number(t.amount) || 0,
        flow: t.type === 'tahsilat' ? 'in' : t.type === 'odeme' ? 'out' : (t.cariEffect === 'alacak' ? 'in' : 'out'),
      });
    });
    incomes.forEach((i) => out.push({ date: toDate(i.date), cat: 'gelir', label: i.customerName || i.description || i.category || '', sub: [i.category, accName(i.accountId)].filter(Boolean).join(' · '), amount: Number(i.amount) || 0, flow: 'in' }));
    expenses.forEach((e) => out.push({ date: toDate(e.date), cat: 'gider', label: e.customerName || e.description || e.category || '', sub: [e.category, accName(e.accountId)].filter(Boolean).join(' · '), amount: Number(e.amount) || 0, flow: 'out' }));
    return out.filter((x) => x.date && !isNaN(x.date));
  }, [invoices, transactions, incomes, expenses, accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const now = new Date();
    const inPeriod = (d) => {
      if (period === 'all') return true;
      if (period === 'month') return monthKey(d) === monthKey(now);
      if (period === 'last') return monthKey(d) === monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      if (period === '3m') return d >= new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return true;
    };
    const s = search.trim().toLowerCase();
    return items
      .filter((x) => (cat === 'all' || x.cat === cat) && inPeriod(x.date) && (!s || `${x.label} ${x.sub} ${TYPE_META[x.cat]?.label}`.toLowerCase().includes(s)))
      .sort((a, b) => b.date - a.date);
  }, [items, cat, period, search]);

  const totalIn = sum(filtered.filter((x) => x.flow === 'in'), (x) => x.amount);
  const totalOut = sum(filtered.filter((x) => x.flow === 'out'), (x) => x.amount);

  const exportExcel = () => {
    const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
    downloadExcel('tum-islemler', [
      { heading: `TÜM İŞLEMLER — ${new Date().toLocaleDateString('tr-TR')}` },
      { rows: [['Toplam Giriş', round(totalIn)], ['Toplam Çıkış', round(totalOut)], ['Net', round(totalIn - totalOut)]] },
      {
        headers: ['Tarih', 'Tür', 'Açıklama', 'Detay', 'Yön', 'Tutar (TL)'],
        rows: filtered.map((x) => [
          formatDateShort(x.date), TYPE_META[x.cat]?.label || x.cat, x.label, x.sub,
          x.flow === 'in' ? 'Giriş' : x.flow === 'out' ? 'Çıkış' : 'Belge', round(x.amount),
        ]),
      },
    ]);
  };

  return (
    <div>
      <PageHeader title="Tüm İşlemler" subtitle="Faturalar, tahsilat/ödeme, gelir/gider ve virmanların birleşik listesi">
        <Button variant="secondary" icon={Download} onClick={exportExcel} disabled={filtered.length === 0}>Excel'e Aktar</Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Toplam Giriş" value={formatCurrency(totalIn)} icon={ArrowDownLeft} color="text-green-600" hint="Tahsilat + gelir" />
        <StatCard title="Toplam Çıkış" value={formatCurrency(totalOut)} icon={ArrowUpRight} color="text-red-600" hint="Ödeme + gider" />
        <StatCard title="Net Akış" value={formatCurrency(totalIn - totalOut)} color={totalIn - totalOut >= 0 ? 'text-green-600' : 'text-red-600'} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-44">
          <option value="all">Tüm türler</option>
          <option value="tahsilat">Tahsilat</option>
          <option value="odeme">Ödeme</option>
          <option value="gelir">Gelir</option>
          <option value="gider">Gider</option>
          <option value="satis">Satış Faturası</option>
          <option value="alis">Alış Faturası</option>
          <option value="transfer">Virman</option>
          <option value="manuel">Cari Hareket</option>
        </Select>
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40">
          <option value="all">Tüm zamanlar</option>
          <option value="month">Bu Ay</option>
          <option value="last">Geçen Ay</option>
          <option value="3m">Son 3 Ay</option>
        </Select>
        <Input placeholder="Ara (cari, açıklama)..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[180px]" />
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState message="İşlem bulunamadı" />
        ) : (
          <Table headers={[{ label: 'Tarih' }, { label: 'Tür' }, { label: 'Açıklama' }, { label: 'Yön' }, { label: 'Tutar', align: 'right' }]}>
            {filtered.map((x, i) => {
              const m = TYPE_META[x.cat] || { label: x.cat, color: 'gray' };
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <Td className="text-gray-500">{formatDateShort(x.date)}</Td>
                  <Td><Badge color={m.color}>{m.label}</Badge></Td>
                  <Td className="text-gray-700">
                    <span className="font-medium text-gray-900">{x.label || '—'}</span>
                    {x.sub && <span className="block text-xs text-gray-400">{x.sub}</span>}
                  </Td>
                  <Td>
                    {x.flow === 'in' ? <Badge color="green">Giriş</Badge> : x.flow === 'out' ? <Badge color="red">Çıkış</Badge> : <Badge color="gray">Belge</Badge>}
                  </Td>
                  <Td align="right" className={`font-semibold ${x.flow === 'in' ? 'text-green-600' : x.flow === 'out' ? 'text-red-600' : 'text-gray-700'}`}>
                    {x.flow === 'in' ? '+' : x.flow === 'out' ? '-' : ''}{formatCurrency(x.amount)}
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">{filtered.length} işlem listeleniyor</div>
        )}
      </Card>
    </div>
  );
}

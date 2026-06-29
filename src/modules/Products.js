// --- Stok / Ürün & Hizmetler ---
import React, { useState, useMemo } from 'react';
import { Edit, Trash2, Package, AlertTriangle, ArrowLeft, ArrowDownUp } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatCurrency, formatNumber, formatDateShort, todayInput } from '../utils';
import { allProductStocks, productStock } from '../finance';
import {
  PageHeader, AddButton, Card, Table, Td, Badge, EmptyState, StatCard,
  FormModal, ConfirmDialog, Button, Field, Input, Select,
} from '../components/ui';

function ProductForm({ existing, userId, onClose }) {
  const [form, setForm] = useState(
    existing || {
      name: '', code: '', category: '', unit: 'Adet', type: 'product',
      purchasePrice: 0, salePrice: 0, vatRate: 20, openingStock: 0, minStock: 0,
    }
  );
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    const payload = {
      ...form,
      purchasePrice: Number(form.purchasePrice) || 0,
      salePrice: Number(form.salePrice) || 0,
      vatRate: Number(form.vatRate) || 0,
      openingStock: Number(form.openingStock) || 0,
      minStock: Number(form.minStock) || 0,
    };
    delete payload.id;
    try {
      if (existing) await updateRecord(userId, 'products', existing.id, payload);
      else await addRecord(userId, 'products', payload);
      onClose();
    } catch (err) { console.error(err); alert('Ürün kaydedilemedi.'); }
  };
  return (
    <FormModal title={existing ? 'Ürün Düzenle' : 'Yeni Ürün / Hizmet'} size="lg" onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Ad" className="md:col-span-2"><Input name="name" value={form.name} onChange={set} required /></Field>
        <Field label="Stok Kodu"><Input name="code" value={form.code} onChange={set} /></Field>
        <Field label="Kategori"><Input name="category" value={form.category} onChange={set} /></Field>
        <Field label="Tür"><Select name="type" value={form.type} onChange={set}><option value="product">Ürün (stok takipli)</option><option value="service">Hizmet</option></Select></Field>
        <Field label="Birim"><Input name="unit" value={form.unit} onChange={set} /></Field>
        <Field label="Alış Fiyatı"><Input type="number" step="0.01" name="purchasePrice" value={form.purchasePrice} onChange={set} /></Field>
        <Field label="Satış Fiyatı"><Input type="number" step="0.01" name="salePrice" value={form.salePrice} onChange={set} /></Field>
        <Field label="KDV %"><Select name="vatRate" value={form.vatRate} onChange={set}>{[0, 1, 10, 20].map((r) => <option key={r} value={r}>%{r}</option>)}</Select></Field>
        {form.type === 'product' && (
          <>
            <Field label="Açılış Stoğu"><Input type="number" step="any" name="openingStock" value={form.openingStock} onChange={set} /></Field>
            <Field label="Kritik Stok Seviyesi"><Input type="number" step="any" name="minStock" value={form.minStock} onChange={set} /></Field>
          </>
        )}
      </div>
    </FormModal>
  );
}

function StockMoveForm({ product, userId, onClose }) {
  const [form, setForm] = useState({ direction: 'in', quantity: '', date: todayInput(), description: '' });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(form.quantity) > 0)) return;
    await addRecord(userId, 'stockMovements', {
      productId: product.id, productName: product.name,
      direction: form.direction, quantity: Number(form.quantity),
      description: form.description || (form.direction === 'in' ? 'Stok girişi' : 'Stok çıkışı'),
      date: Timestamp.fromDate(new Date(form.date)),
    });
    onClose();
  };
  return (
    <FormModal title={`Stok Hareketi — ${product.name}`} onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4">
        <Field label="Hareket Türü"><Select name="direction" value={form.direction} onChange={set}><option value="in">Giriş (+)</option><option value="out">Çıkış (-)</option></Select></Field>
        <Field label="Miktar"><Input type="number" step="any" name="quantity" value={form.quantity} onChange={set} required /></Field>
        <Field label="Tarih"><Input type="date" name="date" value={form.date} onChange={set} /></Field>
        <Field label="Açıklama"><Input name="description" value={form.description} onChange={set} /></Field>
      </div>
    </FormModal>
  );
}

function ProductDetail({ product, data, userId, onBack }) {
  const { invoices = [], stockMovements = [] } = data;
  const [moveOpen, setMoveOpen] = useState(false);
  const rows = useMemo(() => {
    const out = [];
    invoices.forEach((inv) => (inv.items || []).forEach((it) => {
      if (it.productId !== product.id) return;
      out.push({ date: inv.date, type: inv.type === 'purchase' ? 'Alış' : 'Satış', desc: inv.docNumber, qty: inv.type === 'purchase' ? Number(it.quantity) : -Number(it.quantity) });
    }));
    stockMovements.filter((m) => m.productId === product.id).forEach((m) => {
      out.push({ date: m.date, type: m.direction === 'in' ? 'Giriş' : 'Çıkış', desc: m.description, qty: m.direction === 'in' ? Number(m.quantity) : -Number(m.quantity) });
    });
    out.sort((a, b) => (a.date?.seconds || 0) - (b.date?.seconds || 0));
    return out;
  }, [product, invoices, stockMovements]);
  const stock = productStock(product.id, data);

  return (
    <div>
      <button onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-4"><ArrowLeft size={16} className="mr-1" />Stok listesine dön</button>
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{product.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{product.code || ''} · {product.category || 'Kategorisiz'}</p>
        </div>
        {product.type !== 'service' && <Button icon={ArrowDownUp} onClick={() => setMoveOpen(true)}>Stok Hareketi</Button>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard title="Mevcut Stok" value={`${formatNumber(stock)} ${product.unit || ''}`} color={stock <= (product.minStock || 0) ? 'text-red-600' : 'text-green-600'} />
        <StatCard title="Alış Fiyatı" value={formatCurrency(product.purchasePrice)} color="text-gray-700" />
        <StatCard title="Satış Fiyatı" value={formatCurrency(product.salePrice)} color="text-gray-700" />
        <StatCard title="KDV" value={`%${product.vatRate}`} color="text-gray-700" />
      </div>
      <Card title="Stok Hareketleri">
        {rows.length === 0 ? <EmptyState message="Henüz stok hareketi yok" /> : (
          <Table headers={[{ label: 'Tarih' }, { label: 'İşlem' }, { label: 'Açıklama' }, { label: 'Miktar', align: 'right' }]}>
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <Td className="text-gray-500">{formatDateShort(r.date)}</Td>
                <Td><Badge color={r.qty >= 0 ? 'green' : 'red'}>{r.type}</Badge></Td>
                <Td className="text-gray-600">{r.desc}</Td>
                <Td align="right" className={r.qty >= 0 ? 'text-green-600' : 'text-red-600'}>{r.qty >= 0 ? '+' : ''}{formatNumber(r.qty)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {moveOpen && <StockMoveForm product={product} userId={userId} onClose={() => setMoveOpen(false)} />}
    </div>
  );
}

export default function Products({ data, userId }) {
  const { products = [] } = data;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  const stocks = useMemo(() => allProductStocks(data), [data]);
  const filtered = useMemo(() => products.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const lowStock = products.filter((p) => p.type !== 'service' && (stocks[p.id] || 0) <= (p.minStock || 0)).length;
  const stockValue = products.reduce((s, p) => s + (stocks[p.id] || 0) * (p.purchasePrice || 0), 0);

  if (selected) {
    const fresh = products.find((p) => p.id === selected.id) || selected;
    return <ProductDetail product={fresh} data={data} userId={userId} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <PageHeader title="Stok / Ürünler" subtitle="Ürün ve hizmetlerinizi yönetin">
        <AddButton label="Yeni Ürün" onClick={() => { setEditing(null); setFormOpen(true); }} />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Ürün / Hizmet" value={products.length} icon={Package} color="text-sky-600" />
        <StatCard title="Kritik Stok" value={lowStock} icon={AlertTriangle} color="text-red-600" />
        <StatCard title="Stok Değeri (maliyet)" value={formatCurrency(stockValue)} color="text-gray-700" />
      </div>

      <div className="mb-4"><Input placeholder="Ürün ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" /></div>

      <Card>
        {filtered.length === 0 ? <EmptyState message="Ürün bulunamadı" /> : (
          <Table headers={[{ label: 'Kod' }, { label: 'Ad' }, { label: 'Alış', align: 'right' }, { label: 'Satış', align: 'right' }, { label: 'Stok', align: 'right' }, { label: '' }]}>
            {filtered.map((p) => {
              const stock = stocks[p.id] || 0;
              const low = p.type !== 'service' && stock <= (p.minStock || 0);
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <Td className="text-gray-500">{p.code || '-'}</Td>
                  <Td className="font-medium text-gray-900 cursor-pointer" onClick={() => setSelected(p)}>{p.name}{p.type === 'service' && <Badge color="blue"> Hizmet</Badge>}</Td>
                  <Td align="right" className="text-gray-600">{formatCurrency(p.purchasePrice)}</Td>
                  <Td align="right" className="font-semibold text-gray-800">{formatCurrency(p.salePrice)}</Td>
                  <Td align="right">{p.type === 'service' ? <span className="text-gray-400">—</span> : <span className={low ? 'text-red-600 font-semibold' : 'text-gray-700'}>{formatNumber(stock)} {p.unit}</span>}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditing(p); setFormOpen(true); }} className="p-2 rounded-full hover:bg-gray-200 text-gray-500"><Edit size={16} /></button>
                      <button onClick={() => setConfirmId(p.id)} className="p-2 rounded-full hover:bg-gray-200 text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {formOpen && <ProductForm existing={editing} userId={userId} onClose={() => { setFormOpen(false); setEditing(null); }} />}
      {confirmId && <ConfirmDialog message="Bu ürünü silmek istediğinize emin misiniz?" onConfirm={() => deleteRecord(userId, 'products', confirmId)} onClose={() => setConfirmId(null)} />}
    </div>
  );
}

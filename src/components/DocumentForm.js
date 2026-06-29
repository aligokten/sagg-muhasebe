// --- Fatura / Teklif / Sipariş / İrsaliye için ortak belge formu ---
import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { Button, Field, Input, Select } from './ui';
import { formatCurrency, computeTotals, toInputDate, nextDocNumber } from '../utils';

const emptyItem = () => ({ productId: '', description: '', quantity: 1, unit: 'Adet', unitPrice: 0, discount: 0, vatRate: 20 });

// type: 'invoice' | 'quote' | 'order' | 'waybill'
// kind: 'sales' | 'purchase' (faturalar/siparişler için)
export default function DocumentForm({
  title,
  numberPrefix,
  numberField = 'docNumber',
  existing,
  records = [],
  customers = [],
  products = [],
  projects = [],
  authors = [],
  kind = 'sales',
  showStatus,
  statusOptions,
  dateLabel = 'Tarih',
  secondDateLabel,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(() => ({
    customerId: '',
    projectId: '',
    authorId: '',
    docNumber: existing ? '' : nextDocNumber(records, numberPrefix, numberField),
    date: toInputDate(new Date()),
    dueDate: toInputDate(new Date()),
    items: [emptyItem()],
    note: '',
    status: statusOptions ? statusOptions[0].value : undefined,
  }));

  const customerProjects = projects.filter((p) => p.customerId === form.customerId);

  useEffect(() => {
    if (existing) {
      setForm({
        ...existing,
        date: toInputDate(existing.date),
        dueDate: toInputDate(existing.dueDate || existing.validUntil || existing.date),
        items: existing.items?.length ? existing.items : [emptyItem()],
      });
    }
  }, [existing]);

  const setField = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleItem = (idx, field, value) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'productId' && value) {
        const p = products.find((x) => x.id === value);
        if (p) {
          items[idx].description = p.name;
          items[idx].unit = p.unit || 'Adet';
          items[idx].unitPrice = kind === 'purchase' ? p.purchasePrice || 0 : p.salePrice || 0;
          items[idx].vatRate = p.vatRate ?? 20;
        }
      }
      return { ...f, items };
    });
  };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (idx) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const totals = useMemo(() => computeTotals(form.items), [form.items]);

  const submit = (e) => {
    e.preventDefault();
    const customer = customers.find((c) => c.id === form.customerId);
    if (!customer) return alert('Lütfen cari hesap seçin.');
    if (!form.docNumber) return alert('Lütfen belge numarası girin.');
    const cleanItems = form.items
      .filter((it) => it.description || it.productId)
      .map((it) => ({
        productId: it.productId || '',
        description: it.description,
        quantity: Number(it.quantity) || 0,
        unit: it.unit || 'Adet',
        unitPrice: Number(it.unitPrice) || 0,
        discount: Number(it.discount) || 0,
        vatRate: Number(it.vatRate) || 0,
      }));
    if (!cleanItems.length) return alert('En az bir kalem ekleyin.');
    onSave({
      ...form,
      customerId: form.customerId,
      projectId: form.projectId || null,
      authorId: form.authorId || null,
      customerSnapshot: customer,
      items: cleanItems,
      ...totals,
      type: kind,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl my-8">
        <form onSubmit={submit}>
          <div className="p-5 border-b flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X /></button>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Field label={kind === 'purchase' ? 'Tedarikçi' : 'Cari Hesap'} className="lg:col-span-2">
                <Select
                  name="customerId"
                  value={form.customerId}
                  onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value, projectId: '' }))}
                  required
                >
                  <option value="">Seçiniz...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
              {customerProjects.length > 0 && (
                <Field label="İş / Proje" className="lg:col-span-2">
                  <Select name="projectId" value={form.projectId || ''} onChange={setField}>
                    <option value="">Genel (işe bağlı değil)</option>
                    {customerProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </Field>
              )}
              {authors.length > 0 && (
                <Field label="Müellif" className="lg:col-span-2">
                  <Select name="authorId" value={form.authorId || ''} onChange={setField}>
                    <option value="">Seçilmedi</option>
                    {authors.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.branch})</option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Belge No">
                <Input name="docNumber" value={form.docNumber} onChange={setField} required />
              </Field>
              <Field label={dateLabel}>
                <Input type="date" name="date" value={form.date} onChange={setField} required />
              </Field>
              {secondDateLabel && (
                <Field label={secondDateLabel}>
                  <Input type="date" name="dueDate" value={form.dueDate} onChange={setField} />
                </Field>
              )}
              {showStatus && statusOptions && (
                <Field label="Durum">
                  <Select name="status" value={form.status} onChange={setField}>
                    {statusOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-gray-600 mb-3">Kalemler</h4>
              <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 uppercase mb-1 px-1">
                <span className="col-span-4">Ürün / Hizmet</span>
                <span className="col-span-1 text-right">Miktar</span>
                <span className="col-span-1">Birim</span>
                <span className="col-span-2 text-right">Birim Fiyat</span>
                <span className="col-span-1 text-right">İsk.%</span>
                <span className="col-span-1 text-right">KDV%</span>
                <span className="col-span-1 text-right">Tutar</span>
              </div>
              {form.items.map((item, idx) => {
                const line = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                const net = line - line * ((Number(item.discount) || 0) / 100);
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-center">
                    <div className="col-span-12 md:col-span-4 flex gap-1">
                      <Select value={item.productId} onChange={(e) => handleItem(idx, 'productId', e.target.value)} className="w-1/2">
                        <option value="">Seç</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </Select>
                      <Input placeholder="Açıklama" value={item.description} onChange={(e) => handleItem(idx, 'description', e.target.value)} />
                    </div>
                    <Input type="number" step="any" className="col-span-3 md:col-span-1 text-right" value={item.quantity} onChange={(e) => handleItem(idx, 'quantity', e.target.value)} />
                    <Input className="col-span-3 md:col-span-1" value={item.unit} onChange={(e) => handleItem(idx, 'unit', e.target.value)} />
                    <Input type="number" step="any" className="col-span-3 md:col-span-2 text-right" value={item.unitPrice} onChange={(e) => handleItem(idx, 'unitPrice', e.target.value)} />
                    <Input type="number" step="any" className="col-span-3 md:col-span-1 text-right" value={item.discount} onChange={(e) => handleItem(idx, 'discount', e.target.value)} />
                    <Select className="col-span-4 md:col-span-1" value={item.vatRate} onChange={(e) => handleItem(idx, 'vatRate', e.target.value)}>
                      {[0, 1, 10, 20].map((r) => <option key={r} value={r}>{r}</option>)}
                    </Select>
                    <span className="col-span-6 md:col-span-1 text-right text-sm text-gray-700">{formatCurrency(net)}</span>
                    <button type="button" onClick={() => removeItem(idx)} className="col-span-2 md:hidden text-red-500 text-sm">Kaldır</button>
                    <button type="button" onClick={() => removeItem(idx)} className="hidden md:flex col-span-12 justify-end -mt-8 text-red-400 hover:text-red-600">
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
              <button type="button" onClick={addItem} className="text-sm font-medium text-sky-600 hover:text-sky-800 mt-2">+ Kalem Ekle</button>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Not / Açıklama">
                <textarea name="note" value={form.note || ''} onChange={setField} className="p-2 border border-gray-300 rounded-md h-24 outline-none focus:ring-2 focus:ring-sky-500" />
              </Field>
              <div className="space-y-2 self-end">
                <div className="flex justify-between text-gray-600"><span>Ara Toplam:</span><span className="font-medium">{formatCurrency(totals.subTotal)}</span></div>
                <div className="flex justify-between text-gray-600"><span>İskonto:</span><span className="font-medium">- {formatCurrency(totals.discountTotal)}</span></div>
                <div className="flex justify-between text-gray-600"><span>KDV:</span><span className="font-medium">{formatCurrency(totals.vatTotal)}</span></div>
                <div className="flex justify-between font-bold text-xl text-gray-800 border-t pt-2"><span>Genel Toplam:</span><span>{formatCurrency(totals.grandTotal)}</span></div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
            <Button type="button" variant="secondary" onClick={onClose}>İptal</Button>
            <Button type="submit">Kaydet</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

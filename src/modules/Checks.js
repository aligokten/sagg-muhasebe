// --- Çek & Senet ---
import React, { useState, useMemo } from 'react';
import { Edit, Trash2, ScrollText, CheckCircle2 } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatCurrency, formatDateShort, todayInput, sum, daysBetween } from '../utils';
import {
  PageHeader, AddButton, Card, Table, Td, Badge, EmptyState, StatCard,
  FormModal, ConfirmDialog, Field, Input, Select,
} from '../components/ui';

const statusMeta = {
  portfolio: { label: 'Portföyde', color: 'yellow' },
  cashed: { label: 'Tahsil/Ödendi', color: 'green' },
  endorsed: { label: 'Ciro Edildi', color: 'blue' },
  returned: { label: 'Karşılıksız', color: 'red' },
};

function CheckForm({ existing, userId, customers, onClose }) {
  const [form, setForm] = useState(
    existing || {
      type: 'cek', direction: 'received', customerId: '', amount: '',
      serialNo: '', bank: '', date: todayInput(), dueDate: todayInput(), status: 'portfolio',
    }
  );
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(form.amount) > 0)) return alert('Tutar girin.');
    const customer = customers.find((c) => c.id === form.customerId);
    const payload = {
      ...form, amount: Number(form.amount), customerName: customer?.name || '',
      date: Timestamp.fromDate(new Date(form.date)),
      dueDate: Timestamp.fromDate(new Date(form.dueDate)),
    };
    delete payload.id;
    if (existing) await updateRecord(userId, 'checks', existing.id, payload);
    else await addRecord(userId, 'checks', payload);
    onClose();
  };
  return (
    <FormModal title={existing ? 'Çek/Senet Düzenle' : 'Yeni Çek / Senet'} size="lg" onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Tür"><Select name="type" value={form.type} onChange={set}><option value="cek">Çek</option><option value="senet">Senet</option></Select></Field>
        <Field label="Yön"><Select name="direction" value={form.direction} onChange={set}><option value="received">Alınan (müşteri çeki)</option><option value="issued">Verilen (kendi çekimiz)</option></Select></Field>
        <Field label="Cari Hesap" className="md:col-span-2"><Select name="customerId" value={form.customerId} onChange={set}><option value="">Seçiniz...</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Tutar"><Input type="number" step="0.01" name="amount" value={form.amount} onChange={set} required /></Field>
        <Field label="Seri No"><Input name="serialNo" value={form.serialNo} onChange={set} /></Field>
        <Field label="Banka"><Input name="bank" value={form.bank} onChange={set} /></Field>
        <Field label="Durum"><Select name="status" value={form.status} onChange={set}>{Object.entries(statusMeta).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
        <Field label="Düzenleme Tarihi"><Input type="date" name="date" value={form.date} onChange={set} /></Field>
        <Field label="Vade Tarihi"><Input type="date" name="dueDate" value={form.dueDate} onChange={set} /></Field>
      </div>
    </FormModal>
  );
}

export default function Checks({ data, userId }) {
  const { checks = [], customers = [] } = data;
  const [tab, setTab] = useState('received');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const list = useMemo(
    () => checks.filter((c) => (c.direction || 'received') === tab).sort((a, b) => (a.dueDate?.seconds || 0) - (b.dueDate?.seconds || 0)),
    [checks, tab]
  );
  const portfolioTotal = sum(list.filter((c) => c.status === 'portfolio'), (c) => c.amount);
  const isReceived = tab === 'received';

  return (
    <div>
      <PageHeader title="Çek & Senet" subtitle="Alınan ve verilen çek/senet takibi">
        <AddButton label="Yeni Çek/Senet" onClick={() => { setEditing(null); setFormOpen(true); }} />
      </PageHeader>

      <div className="flex gap-2 mb-4">
        {[{ k: 'received', l: 'Alınan (Tahsil)' }, { k: 'issued', l: 'Verilen (Ödeme)' }].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t.k ? 'bg-sky-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{t.l}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard title="Adet" value={list.length} icon={ScrollText} color="text-sky-600" />
        <StatCard title="Portföydeki Toplam" value={formatCurrency(portfolioTotal)} color={isReceived ? 'text-green-600' : 'text-red-600'} />
      </div>

      <Card>
        {list.length === 0 ? <EmptyState message="Kayıt bulunamadı" /> : (
          <Table headers={[{ label: 'Vade' }, { label: 'Cari' }, { label: 'Tür' }, { label: 'Seri/Banka' }, { label: 'Durum' }, { label: 'Tutar', align: 'right' }, { label: '' }]}>
            {list.map((c) => {
              const st = statusMeta[c.status || 'portfolio'];
              const days = daysBetween(new Date(), c.dueDate);
              const overdue = c.status === 'portfolio' && days < 0;
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <Td className={overdue ? 'text-red-600 font-semibold' : 'text-gray-600'}>{formatDateShort(c.dueDate)}{overdue && ' ⚠'}</Td>
                  <Td className="text-gray-700">{c.customerName || '-'}</Td>
                  <Td>{c.type === 'senet' ? 'Senet' : 'Çek'}</Td>
                  <Td className="text-gray-500">{c.serialNo} {c.bank && `· ${c.bank}`}</Td>
                  <Td><Badge color={st.color}>{st.label}</Badge></Td>
                  <Td align="right" className="font-semibold text-gray-800">{formatCurrency(c.amount)}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      {c.status === 'portfolio' && (
                        <button title="Tahsil/Ödendi olarak işaretle" onClick={() => updateRecord(userId, 'checks', c.id, { status: 'cashed' })} className="p-2 rounded-full hover:bg-gray-200 text-green-600"><CheckCircle2 size={16} /></button>
                      )}
                      <button onClick={() => { setEditing(c); setFormOpen(true); }} className="p-2 rounded-full hover:bg-gray-200 text-gray-500"><Edit size={16} /></button>
                      <button onClick={() => setConfirmId(c.id)} className="p-2 rounded-full hover:bg-gray-200 text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {formOpen && <CheckForm existing={editing} userId={userId} customers={customers} onClose={() => { setFormOpen(false); setEditing(null); }} />}
      {confirmId && <ConfirmDialog message="Bu kaydı silmek istediğinize emin misiniz?" onConfirm={() => deleteRecord(userId, 'checks', confirmId)} onClose={() => setConfirmId(null)} />}
    </div>
  );
}

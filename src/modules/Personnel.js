// --- Personel & Maaş ---
import React, { useState, useMemo } from 'react';
import { Edit, Trash2, UserCog, Banknote } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatCurrency, formatDateShort, todayInput, sum } from '../utils';
import {
  PageHeader, AddButton, Card, Table, Td, Badge, EmptyState, StatCard,
  FormModal, ConfirmDialog, Field, Input, Select,
} from '../components/ui';

function PersonForm({ existing, userId, onClose }) {
  const [form, setForm] = useState(
    existing || { name: '', role: '', salary: '', tcNo: '', phone: '', iban: '', startDate: todayInput(), status: 'active' }
  );
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    const payload = { ...form, salary: Number(form.salary) || 0 };
    delete payload.id;
    if (existing) await updateRecord(userId, 'personnel', existing.id, payload);
    else await addRecord(userId, 'personnel', payload);
    onClose();
  };
  return (
    <FormModal title={existing ? 'Personel Düzenle' : 'Yeni Personel'} size="lg" onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Ad Soyad"><Input name="name" value={form.name} onChange={set} required /></Field>
        <Field label="Görev"><Input name="role" value={form.role} onChange={set} /></Field>
        <Field label="Net Maaş"><Input type="number" step="0.01" name="salary" value={form.salary} onChange={set} /></Field>
        <Field label="T.C. Kimlik No"><Input name="tcNo" value={form.tcNo} onChange={set} /></Field>
        <Field label="Telefon"><Input name="phone" value={form.phone} onChange={set} /></Field>
        <Field label="IBAN"><Input name="iban" value={form.iban} onChange={set} /></Field>
        <Field label="İşe Giriş"><Input type="date" name="startDate" value={form.startDate} onChange={set} /></Field>
        <Field label="Durum"><Select name="status" value={form.status} onChange={set}><option value="active">Aktif</option><option value="passive">Pasif</option></Select></Field>
      </div>
    </FormModal>
  );
}

function SalaryForm({ person, userId, accounts, onClose }) {
  const [form, setForm] = useState({ amount: person.salary || '', date: todayInput(), accountId: accounts[0]?.id || '', period: '' });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(form.amount) > 0)) return;
    await addRecord(userId, 'expenses', {
      date: Timestamp.fromDate(new Date(form.date)),
      category: 'Personel', description: `Maaş ödemesi - ${person.name}${form.period ? ` (${form.period})` : ''}`,
      amount: Number(form.amount), vatRate: 0, accountId: form.accountId || null, personId: person.id,
    });
    onClose();
    alert('Maaş ödemesi gider olarak kaydedildi.');
  };
  return (
    <FormModal title={`Maaş Ödemesi — ${person.name}`} onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4">
        <Field label="Tutar"><Input type="number" step="0.01" name="amount" value={form.amount} onChange={set} required /></Field>
        <Field label="Dönem"><Input name="period" value={form.period} onChange={set} placeholder="örn. Haziran 2026" /></Field>
        <Field label="Tarih"><Input type="date" name="date" value={form.date} onChange={set} /></Field>
        <Field label="Ödeme Hesabı"><Select name="accountId" value={form.accountId} onChange={set}><option value="">Belirtilmedi</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
      </div>
    </FormModal>
  );
}

export default function Personnel({ data, userId }) {
  const { personnel = [], accounts = [] } = data;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [salaryFor, setSalaryFor] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const active = personnel.filter((p) => p.status !== 'passive');
  const payroll = useMemo(() => sum(active, (p) => p.salary), [active]);

  return (
    <div>
      <PageHeader title="Personel" subtitle="Çalışan ve maaş yönetimi">
        <AddButton label="Yeni Personel" onClick={() => { setEditing(null); setFormOpen(true); }} />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Toplam Personel" value={personnel.length} icon={UserCog} color="text-sky-600" />
        <StatCard title="Aktif Personel" value={active.length} color="text-green-600" />
        <StatCard title="Aylık Maaş Toplamı" value={formatCurrency(payroll)} color="text-gray-700" />
      </div>

      <Card>
        {personnel.length === 0 ? <EmptyState message="Henüz personel yok" /> : (
          <Table headers={[{ label: 'Ad Soyad' }, { label: 'Görev' }, { label: 'İşe Giriş' }, { label: 'Durum' }, { label: 'Maaş', align: 'right' }, { label: '' }]}>
            {personnel.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Td className="font-medium text-gray-900">{p.name}</Td>
                <Td className="text-gray-500">{p.role || '-'}</Td>
                <Td className="text-gray-500">{formatDateShort(p.startDate)}</Td>
                <Td><Badge color={p.status === 'passive' ? 'gray' : 'green'}>{p.status === 'passive' ? 'Pasif' : 'Aktif'}</Badge></Td>
                <Td align="right" className="font-semibold text-gray-800">{formatCurrency(p.salary)}</Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <button title="Maaş Öde" onClick={() => setSalaryFor(p)} className="p-2 rounded-full hover:bg-gray-200 text-green-600"><Banknote size={16} /></button>
                    <button onClick={() => { setEditing(p); setFormOpen(true); }} className="p-2 rounded-full hover:bg-gray-200 text-gray-500"><Edit size={16} /></button>
                    <button onClick={() => setConfirmId(p.id)} className="p-2 rounded-full hover:bg-gray-200 text-red-500"><Trash2 size={16} /></button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {formOpen && <PersonForm existing={editing} userId={userId} onClose={() => { setFormOpen(false); setEditing(null); }} />}
      {salaryFor && <SalaryForm person={salaryFor} userId={userId} accounts={accounts} onClose={() => setSalaryFor(null)} />}
      {confirmId && <ConfirmDialog message="Bu personeli silmek istediğinize emin misiniz?" onConfirm={() => deleteRecord(userId, 'personnel', confirmId)} onClose={() => setConfirmId(null)} />}
    </div>
  );
}

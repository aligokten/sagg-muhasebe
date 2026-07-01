// --- Gelir & Gider (kategori + cari ilişkili) ---
import React, { useState, useMemo } from 'react';
import { Edit, Trash2, TrendingUp, TrendingDown, Receipt as ReceiptIcon } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatCurrency, formatDateShort, todayInput, toInputDate, sum, vatFromGross, nextReceiptNo } from '../utils';
import {
  PageHeader, AddButton, Card, Table, Td, EmptyState, StatCard,
  FormModal, ConfirmDialog, Field, Input, Select,
} from '../components/ui';
import { CategorySelect } from '../categories';
import ReceiptView from '../components/ReceiptView';

export function EntryForm({ kind, existing, existingList, userId, accounts, customers, projects, onClose, onCreated }) {
  const isIncome = kind === 'incomes';
  const [form, setForm] = useState(
    existing
      ? {
          ...existing,
          date: toInputDate(existing.date),
          category: existing.category || '',
          accountId: existing.accountId || '',
          customerId: existing.customerId || '',
          projectId: existing.projectId || '',
        }
      : { date: todayInput(), category: '', description: '', amount: '', vatRate: 20, accountId: accounts[0]?.id || '', customerId: '', projectId: '' }
  );
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const customerProjects = projects.filter((p) => p.customerId === form.customerId);
  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(form.amount) > 0)) return;
    const customer = customers.find((c) => c.id === form.customerId);
    const payload = {
      ...form, amount: Number(form.amount), vatRate: Number(form.vatRate) || 0,
      accountId: form.accountId || null,
      customerId: form.customerId || null,
      customerName: customer?.name || null,
      projectId: form.projectId || null,
      date: Timestamp.fromDate(new Date(form.date)),
    };
    delete payload.id;
    if (existing) {
      await updateRecord(userId, kind, existing.id, payload);
    } else {
      const receiptNo = nextReceiptNo(existingList, kind);
      const ref = await addRecord(userId, kind, { ...payload, receiptNo });
      onCreated && onCreated({ ...payload, id: ref.id, receiptNo });
    }
    onClose();
  };
  return (
    <FormModal title={`${existing ? 'Düzenle' : 'Yeni'} ${isIncome ? 'Gelir' : 'Gider'}`} size="lg" onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Tarih"><Input type="date" name="date" value={form.date} onChange={set} required /></Field>
        <Field label="Kategori"><CategorySelect name="category" value={form.category} onChange={set} /></Field>
        <Field label="Cari (opsiyonel)"><Select name="customerId" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, projectId: '' })}><option value="">Seçilmedi</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        {customerProjects.length > 0 ? (
          <Field label="İş / Proje"><Select name="projectId" value={form.projectId} onChange={set}><option value="">Genel</option>{customerProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        ) : <div />}
        <Field label="Açıklama" className="md:col-span-2"><Input name="description" value={form.description} onChange={set} /></Field>
        <Field label="Tutar (KDV Dahil)"><Input type="number" step="0.01" name="amount" value={form.amount} onChange={set} required /></Field>
        <Field label="KDV %"><Select name="vatRate" value={form.vatRate} onChange={set}>{[0, 1, 10, 20].map((r) => <option key={r} value={r}>%{r}</option>)}</Select></Field>
        <Field label="Kasa / Banka" className="md:col-span-2"><Select name="accountId" value={form.accountId} onChange={set}><option value="">Belirtilmedi</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
      </div>
      {form.customerId && (
        <p className="text-xs text-gray-400 mt-3">Bu kayıt seçili carinin hesap ekstresinde de görünecek ({isIncome ? 'alacak' : 'borç'} olarak).</p>
      )}
    </FormModal>
  );
}

export default function CashFlow({ data, userId }) {
  const { expenses = [], incomes = [], accounts = [], customers = [], projects = [], companyProfile, scriptsLoaded } = data;
  const [tab, setTab] = useState('expenses');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [receiptFor, setReceiptFor] = useState(null); // { kind, record }

  const isIncome = tab === 'incomes';
  const list = useMemo(() => {
    const arr = isIncome ? incomes : expenses;
    return [...arr].sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
  }, [isIncome, incomes, expenses]);

  const total = sum(list, (x) => x.amount);
  const accName = (id) => accounts.find((a) => a.id === id)?.name || '-';

  const openReceipt = async (record) => {
    let receiptNo = record.receiptNo;
    if (!receiptNo) {
      receiptNo = nextReceiptNo(list, tab);
      await updateRecord(userId, tab, record.id, { receiptNo });
    }
    setReceiptFor({ kind: tab, record: { ...record, receiptNo } });
  };

  return (
    <div>
      <PageHeader title="Gelir & Gider" subtitle="Kategori ve cari ilişkili gelir/gider kayıtları">
        <AddButton label={isIncome ? 'Yeni Gelir' : 'Yeni Gider'} onClick={() => { setEditing(null); setFormOpen(true); }} />
      </PageHeader>

      <div className="flex gap-2 mb-4">
        {[{ k: 'expenses', l: 'Giderler' }, { k: 'incomes', l: 'Gelirler' }].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t.k ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{t.l}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard title={isIncome ? 'Toplam Gelir' : 'Toplam Gider'} value={formatCurrency(total)} icon={isIncome ? TrendingUp : TrendingDown} color={isIncome ? 'text-green-600' : 'text-red-600'} />
        <StatCard title="Toplam KDV" value={formatCurrency(sum(list, (x) => vatFromGross(x.amount, x.vatRate)))} color="text-gray-700" />
      </div>

      <Card>
        {list.length === 0 ? <EmptyState message="Kayıt yok" /> : (
          <Table headers={[{ label: 'Tarih' }, { label: 'Kategori' }, { label: 'Açıklama' }, { label: 'Cari' }, { label: 'Hesap' }, { label: 'Tutar', align: 'right' }, { label: '' }]}>
            {list.map((x) => (
              <tr key={x.id} className="hover:bg-gray-50">
                <Td className="text-gray-500">{formatDateShort(x.date)}</Td>
                <Td className="text-gray-600">{x.category || '-'}</Td>
                <Td className="font-medium text-gray-900">{x.description}</Td>
                <Td className="text-gray-500">{x.customerName || '-'}</Td>
                <Td className="text-gray-500">{accName(x.accountId)}</Td>
                <Td align="right" className={`font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(x.amount)}</Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openReceipt(x)} title="Makbuz" className="p-2 rounded-full hover:bg-gray-200 text-gray-500"><ReceiptIcon size={16} /></button>
                    <button onClick={() => { setEditing(x); setFormOpen(true); }} className="p-2 rounded-full hover:bg-gray-200 text-gray-500"><Edit size={16} /></button>
                    <button onClick={() => setConfirmId(x.id)} className="p-2 rounded-full hover:bg-gray-200 text-red-500"><Trash2 size={16} /></button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {formOpen && (
        <EntryForm
          kind={tab}
          existing={editing}
          existingList={list}
          userId={userId}
          accounts={accounts}
          customers={customers}
          projects={projects}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onCreated={(record) => setReceiptFor({ kind: tab, record })}
        />
      )}
      {confirmId && <ConfirmDialog message="Bu kaydı silmek istediğinize emin misiniz?" onConfirm={() => deleteRecord(userId, tab, confirmId)} onClose={() => setConfirmId(null)} />}
      {receiptFor && (
        <ReceiptView
          kind={receiptFor.kind}
          record={receiptFor.record}
          companyProfile={companyProfile}
          accounts={accounts}
          scriptsLoaded={scriptsLoaded}
          onClose={() => setReceiptFor(null)}
        />
      )}
    </div>
  );
}

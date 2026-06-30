// --- Kasa & Banka Hesapları + hareketler + virman ---
import React, { useState, useMemo } from 'react';
import { Edit, Trash2, Landmark, ArrowLeft, ArrowLeftRight, Wallet } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatCurrency, formatDateShort, todayInput } from '../utils';
import { accountMovements, allAccountBalances } from '../finance';
import {
  PageHeader, AddButton, Card, Table, Td, Badge, EmptyState, StatCard,
  FormModal, ConfirmDialog, Button, Field, Input, Select,
} from '../components/ui';

function AccountForm({ existing, userId, onClose }) {
  const [form, setForm] = useState(existing || { name: '', type: 'Banka', iban: '', openingBalance: 0 });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    const payload = { ...form, openingBalance: Number(form.openingBalance) || 0 };
    delete payload.id;
    if (existing) await updateRecord(userId, 'accounts', existing.id, payload);
    else await addRecord(userId, 'accounts', payload);
    onClose();
  };
  return (
    <FormModal title={existing ? 'Hesap Düzenle' : 'Yeni Kasa / Banka'} onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4">
        <Field label="Hesap Adı"><Input name="name" value={form.name} onChange={set} required placeholder="örn. İş Bankası TL" /></Field>
        <Field label="Tür"><Select name="type" value={form.type} onChange={set}><option>Banka</option><option>Nakit Kasa</option><option>Kredi Kartı</option><option>POS</option></Select></Field>
        <Field label="IBAN"><Input name="iban" value={form.iban} onChange={set} /></Field>
        <Field label="Açılış Bakiyesi"><Input type="number" step="0.01" name="openingBalance" value={form.openingBalance} onChange={set} /></Field>
      </div>
    </FormModal>
  );
}

function MovementForm({ account, userId, onClose }) {
  const [form, setForm] = useState({ direction: 'in', amount: '', date: todayInput(), description: '' });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(form.amount) > 0)) return;
    await addRecord(userId, 'transactions', {
      type: 'manuel', accountId: account.id, direction: form.direction,
      amount: Number(form.amount), description: form.description || (form.direction === 'in' ? 'Giriş' : 'Çıkış'),
      date: Timestamp.fromDate(new Date(form.date)),
    });
    onClose();
  };
  return (
    <FormModal title={`Hareket — ${account.name}`} onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4">
        <Field label="Tür"><Select name="direction" value={form.direction} onChange={set}><option value="in">Para Girişi (+)</option><option value="out">Para Çıkışı (-)</option></Select></Field>
        <Field label="Tutar"><Input type="number" step="0.01" name="amount" value={form.amount} onChange={set} required /></Field>
        <Field label="Tarih"><Input type="date" name="date" value={form.date} onChange={set} /></Field>
        <Field label="Açıklama"><Input name="description" value={form.description} onChange={set} /></Field>
      </div>
    </FormModal>
  );
}

function TransferForm({ accounts, userId, onClose }) {
  const [form, setForm] = useState({ fromAccountId: accounts[0]?.id || '', toAccountId: accounts[1]?.id || '', amount: '', date: todayInput(), description: '' });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (form.fromAccountId === form.toAccountId) return alert('Farklı hesaplar seçin.');
    if (!(Number(form.amount) > 0)) return;
    await addRecord(userId, 'transactions', {
      type: 'transfer', fromAccountId: form.fromAccountId, toAccountId: form.toAccountId,
      amount: Number(form.amount), description: form.description || 'Virman',
      date: Timestamp.fromDate(new Date(form.date)),
    });
    onClose();
  };
  return (
    <FormModal title="Hesaplar Arası Virman" onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4">
        <Field label="Gönderen Hesap"><Select name="fromAccountId" value={form.fromAccountId} onChange={set}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Alan Hesap"><Select name="toAccountId" value={form.toAccountId} onChange={set}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Tutar"><Input type="number" step="0.01" name="amount" value={form.amount} onChange={set} required /></Field>
        <Field label="Tarih"><Input type="date" name="date" value={form.date} onChange={set} /></Field>
        <Field label="Açıklama"><Input name="description" value={form.description} onChange={set} /></Field>
      </div>
    </FormModal>
  );
}

function AccountDetail({ account, data, userId, onBack }) {
  const [moveOpen, setMoveOpen] = useState(false);
  const { rows, balance } = useMemo(() => accountMovements(account.id, data), [account, data]);
  return (
    <div>
      <button onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-4"><ArrowLeft size={16} className="mr-1" />Hesap listesine dön</button>
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{account.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{account.type} · {account.iban || '-'}</p>
        </div>
        <Button icon={Wallet} onClick={() => setMoveOpen(true)}>Para Giriş/Çıkış</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Toplam Giriş" value={formatCurrency(rows.reduce((s, r) => s + r.in, 0))} color="text-green-600" />
        <StatCard title="Toplam Çıkış" value={formatCurrency(rows.reduce((s, r) => s + r.out, 0))} color="text-red-600" />
        <StatCard title="Bakiye" value={formatCurrency(balance)} color={balance >= 0 ? 'text-orange-600' : 'text-red-600'} />
      </div>
      <Card title="Hesap Hareketleri">
        {rows.length === 0 ? <EmptyState message="Henüz hareket yok" /> : (
          <Table headers={[{ label: 'Tarih' }, { label: 'İşlem' }, { label: 'Açıklama' }, { label: 'Giriş', align: 'right' }, { label: 'Çıkış', align: 'right' }, { label: 'Bakiye', align: 'right' }]}>
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <Td className="text-gray-500">{formatDateShort(r.date)}</Td>
                <Td><Badge color={r.in ? 'green' : 'red'}>{r.type}</Badge></Td>
                <Td className="text-gray-600">{r.description}</Td>
                <Td align="right" className="text-green-600">{r.in ? formatCurrency(r.in) : '-'}</Td>
                <Td align="right" className="text-red-600">{r.out ? formatCurrency(r.out) : '-'}</Td>
                <Td align="right" className="font-semibold text-gray-800">{formatCurrency(r.balance)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {moveOpen && <MovementForm account={account} userId={userId} onClose={() => setMoveOpen(false)} />}
    </div>
  );
}

export default function Accounts({ data, userId }) {
  const { accounts = [] } = data;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const balances = useMemo(() => allAccountBalances(data), [data]);
  const total = accounts.reduce((s, a) => s + (balances[a.id] || 0), 0);

  if (selected) {
    const fresh = accounts.find((a) => a.id === selected.id) || selected;
    return <AccountDetail account={fresh} data={data} userId={userId} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <PageHeader title="Kasa & Banka" subtitle="Nakit ve banka hesaplarınız">
        <Button variant="secondary" icon={ArrowLeftRight} onClick={() => setTransferOpen(true)} disabled={accounts.length < 2}>Virman</Button>
        <AddButton label="Yeni Hesap" onClick={() => { setEditing(null); setFormOpen(true); }} />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard title="Hesap Sayısı" value={accounts.length} icon={Landmark} color="text-orange-600" />
        <StatCard title="Toplam Bakiye" value={formatCurrency(total)} color={total >= 0 ? 'text-green-600' : 'text-red-600'} />
      </div>

      <Card>
        {accounts.length === 0 ? <EmptyState message="Henüz kasa/banka hesabı yok" /> : (
          <Table headers={[{ label: 'Hesap Adı' }, { label: 'Tür' }, { label: 'IBAN' }, { label: 'Bakiye', align: 'right' }, { label: '' }]}>
            {accounts.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <Td className="font-medium text-gray-900 cursor-pointer" onClick={() => setSelected(a)}>{a.name}</Td>
                <Td className="text-gray-500">{a.type}</Td>
                <Td className="text-gray-500">{a.iban || '-'}</Td>
                <Td align="right" className={`font-semibold ${(balances[a.id] || 0) >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{formatCurrency(balances[a.id] || 0)}</Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => { setEditing(a); setFormOpen(true); }} className="p-2 rounded-full hover:bg-gray-200 text-gray-500"><Edit size={16} /></button>
                    <button onClick={() => setConfirmId(a.id)} className="p-2 rounded-full hover:bg-gray-200 text-red-500"><Trash2 size={16} /></button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {formOpen && <AccountForm existing={editing} userId={userId} onClose={() => { setFormOpen(false); setEditing(null); }} />}
      {transferOpen && <TransferForm accounts={accounts} userId={userId} onClose={() => setTransferOpen(false)} />}
      {confirmId && <ConfirmDialog message="Bu hesabı silmek istediğinize emin misiniz?" onConfirm={() => deleteRecord(userId, 'accounts', confirmId)} onClose={() => setConfirmId(null)} />}
    </div>
  );
}

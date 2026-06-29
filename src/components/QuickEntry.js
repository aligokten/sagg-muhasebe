// --- Cari/iş ekranı için satır içi hızlı kayıt çubuğu (Defter.net tarzı) ---
import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { addRecord, Timestamp } from '../firebase';
import { Input, Select } from './ui';
import { todayInput } from '../utils';

const ACTIONS = [
  { key: 'satis', label: 'Satış', color: 'bg-gray-700' },
  { key: 'tahsilat', label: 'Tahsilat', color: 'bg-green-600' },
  { key: 'alis', label: 'Alış', color: 'bg-gray-700' },
  { key: 'odeme', label: 'Ödeme', color: 'bg-red-600' },
];

// customer: cari nesnesi; projectId: opsiyonel iş/proje; accounts: kasa/banka
export default function QuickEntry({ customer, projectId = null, userId, accounts = [] }) {
  const [action, setAction] = useState('tahsilat');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [date, setDate] = useState(todayInput());
  const [saving, setSaving] = useState(false);

  const needsAccount = action === 'tahsilat' || action === 'odeme';

  const save = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) return;
    setSaving(true);
    const base = {
      customerId: customer.id,
      customerName: customer.name,
      projectId: projectId || null,
      amount: amt,
      description: description || ACTIONS.find((a) => a.key === action).label,
      date: Timestamp.fromDate(new Date(date)),
    };
    let payload;
    if (action === 'tahsilat') payload = { ...base, type: 'tahsilat', direction: 'in', accountId: accountId || null };
    else if (action === 'odeme') payload = { ...base, type: 'odeme', direction: 'out', accountId: accountId || null };
    else if (action === 'satis') payload = { ...base, type: 'manuel', cariEffect: 'borc' };
    else payload = { ...base, type: 'manuel', cariEffect: 'alacak' };
    try {
      await addRecord(userId, 'transactions', payload);
      setAmount('');
      setDescription('');
    } catch (e) {
      console.error(e);
      alert('Kayıt eklenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-4">
      <div className="flex flex-wrap gap-1 mb-3">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            onClick={() => setAction(a.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${action === a.key ? `${a.color} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
        <Input type="number" step="0.01" inputMode="decimal" placeholder="Tutar" value={amount} onChange={(e) => setAmount(e.target.value)} className="sm:col-span-3" />
        <Input placeholder="Açıklama" value={description} onChange={(e) => setDescription(e.target.value)} className="sm:col-span-4" />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:col-span-2" />
        {needsAccount ? (
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="sm:col-span-2">
            <option value="">Kasa/Banka</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        ) : (
          <div className="sm:col-span-2" />
        )}
        <button
          onClick={save}
          disabled={saving || !(Number(amount) > 0)}
          className="sm:col-span-1 flex items-center justify-center gap-1 bg-sky-600 text-white rounded-lg py-2 px-3 text-sm font-medium hover:bg-sky-700 disabled:opacity-40"
        >
          <Check size={16} /> Kaydet
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        {action === 'satis' && 'Satış: cariye borç yazılır (fatura oluşturmaz).'}
        {action === 'tahsilat' && 'Tahsilat: cariden para alındı (alacak azalır), seçilen kasaya girer.'}
        {action === 'alis' && 'Alış: cariye alacak yazılır (fatura oluşturmaz).'}
        {action === 'odeme' && 'Ödeme: cariye para ödendi (borç azalır), seçilen kasadan çıkar.'}
        {projectId && ' Bu kayıt seçili işe/projeye işlenir.'}
      </p>
    </div>
  );
}

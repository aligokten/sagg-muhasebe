// --- Taşeronlar (inşaat işlerinde yetkilendirilen taşeron firma/ustalar) ---
// Not: Müellif kayıtlarından (Authors.js) tamamen ayrı bir koleksiyonda tutulur.
import React, { useState, useMemo } from 'react';
import { Edit, Trash2, HardHat } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord } from '../firebase';
import { formatCurrency } from '../utils';
import { contractorTotals } from '../finance';
import {
  PageHeader, AddButton, Card, Table, Td, Badge, EmptyState, StatCard,
  FormModal, ConfirmDialog, Field, Input, Select,
} from '../components/ui';

export const TRADES = [
  'Kaba İnşaat', 'İnce İnşaat', 'Elektrik Tesisatı', 'Sıhhi Tesisat',
  'Mekanik (Isıtma/Soğutma)', 'Boya-Badana', 'Alçı-Sıva', 'Çatı-Yalıtım',
  'Doğrama (PVC/Alüminyum)', 'Peyzaj', 'Diğer',
];

function ContractorForm({ existing, userId, onClose }) {
  const [form, setForm] = useState(existing || { name: '', trade: 'Kaba İnşaat', phone: '', email: '', iban: '', note: '' });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    const payload = { ...form };
    delete payload.id;
    try {
      if (existing) await updateRecord(userId, 'subcontractors', existing.id, payload);
      else await addRecord(userId, 'subcontractors', payload);
      onClose();
    } catch (err) { console.error(err); alert('Taşeron kaydedilemedi.'); }
  };
  return (
    <FormModal title={existing ? 'Taşeron Düzenle' : 'Yeni Taşeron'} size="lg" onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Ad Soyad / Firma" className="md:col-span-2"><Input name="name" value={form.name} onChange={set} required /></Field>
        <Field label="İş Kolu"><Select name="trade" value={form.trade} onChange={set}>{TRADES.map((b) => <option key={b}>{b}</option>)}</Select></Field>
        <Field label="Telefon"><Input name="phone" value={form.phone} onChange={set} /></Field>
        <Field label="E-posta"><Input type="email" name="email" value={form.email} onChange={set} /></Field>
        <Field label="IBAN"><Input name="iban" value={form.iban} onChange={set} /></Field>
        <Field label="Not" className="md:col-span-2"><Input name="note" value={form.note} onChange={set} /></Field>
      </div>
    </FormModal>
  );
}

export default function Contractors({ data, userId }) {
  const { subcontractors = [] } = data;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const totals = useMemo(() => {
    const m = {};
    subcontractors.forEach((a) => { m[a.id] = contractorTotals(a.id, data); });
    return m;
  }, [subcontractors, data]);

  const grandRemaining = subcontractors.reduce((s, a) => s + (totals[a.id]?.remaining || 0), 0);

  return (
    <div>
      <PageHeader title="Taşeronlar" subtitle="İnşaat işlerinde yetkilendirilen taşeron firma/ustalar">
        <AddButton label="Yeni Taşeron" onClick={() => { setEditing(null); setFormOpen(true); }} />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard title="Taşeron Sayısı" value={subcontractors.length} icon={HardHat} color="text-orange-600" />
        <StatCard title="Toplam Kalan Borç" value={formatCurrency(grandRemaining)} color="text-red-600" hint="Taşeronlara ödenecek" />
      </div>

      <Card>
        {subcontractors.length === 0 ? (
          <EmptyState message="Henüz taşeron yok. İnşaat işlerinde 'Taşeron Yetkilendir' ile projelere atayabilmek için önce buradan ekleyin." icon={HardHat} />
        ) : (
          <Table headers={[{ label: 'Taşeron' }, { label: 'İş Kolu' }, { label: 'Telefon' }, { label: 'Sözleşme', align: 'right' }, { label: 'Ödenen', align: 'right' }, { label: 'Kalan', align: 'right' }, { label: '' }]}>
            {subcontractors.map((a) => {
              const t = totals[a.id] || { agreed: 0, paid: 0, remaining: 0 };
              return (
                <tr key={a.id} className="hover:bg-gray-50">
                  <Td className="font-medium text-gray-900">{a.name}</Td>
                  <Td><Badge color="sky">{a.trade}</Badge></Td>
                  <Td className="text-gray-500">{a.phone || '-'}</Td>
                  <Td align="right" className="text-gray-700">{formatCurrency(t.agreed)}</Td>
                  <Td align="right" className="text-green-600">{formatCurrency(t.paid)}</Td>
                  <Td align="right" className={`font-semibold ${t.remaining > 0.01 ? 'text-red-600' : 'text-gray-500'}`}>{formatCurrency(t.remaining)}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditing(a); setFormOpen(true); }} className="p-2 rounded-full hover:bg-gray-200 text-gray-500"><Edit size={16} /></button>
                      <button onClick={() => setConfirmId(a.id)} className="p-2 rounded-full hover:bg-gray-200 text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {formOpen && <ContractorForm existing={editing} userId={userId} onClose={() => { setFormOpen(false); setEditing(null); }} />}
      {confirmId && <ConfirmDialog message="Bu taşeronu silmek istediğinize emin misiniz?" onConfirm={() => deleteRecord(userId, 'subcontractors', confirmId)} onClose={() => setConfirmId(null)} />}
    </div>
  );
}

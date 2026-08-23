// --- Kredi Kartı Borç Durumu ---
// Kartlar kart görseli şeklinde bir grid'de listelenir. Her kart için hesap
// kesim tarihindeki ekstre borcu girilir; ödemeler ayrı kayıtlar olarak
// eklenir. Kalan borç = ekstre borcu − dönem içi ödemeler.
import React, { useState, useMemo } from 'react';
import { Edit, Trash2, CreditCard, ArrowLeft, Banknote, FileText, CalendarClock, AlertTriangle, Wallet } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatCurrency, formatDateShort, todayInput, toInputDate, toDate, daysBetween, sum } from '../utils';
import {
  PageHeader, AddButton, Card, Table, Td, EmptyState,
  FormModal, ConfirmDialog, Button, Field, Input, Textarea,
} from '../components/ui';

// Kart renkleri (kart görselinde degrade olarak kullanılır)
export const CARD_COLORS = [
  { key: 'black', dot: '#111827', grad: 'linear-gradient(135deg,#4b5563 0%,#111827 60%)' },
  { key: 'purple', dot: '#7c3aed', grad: 'linear-gradient(135deg,#a78bfa 0%,#6d28d9 60%)' },
  { key: 'blue', dot: '#2563eb', grad: 'linear-gradient(135deg,#60a5fa 0%,#1d4ed8 60%)' },
  { key: 'cyan', dot: '#06b6d4', grad: 'linear-gradient(135deg,#22d3ee 0%,#0e7490 60%)' },
  { key: 'green', dot: '#16a34a', grad: 'linear-gradient(135deg,#4ade80 0%,#15803d 60%)' },
  { key: 'yellow', dot: '#eab308', grad: 'linear-gradient(135deg,#fde047 0%,#ca8a04 60%)' },
  { key: 'orange', dot: '#ea580c', grad: 'linear-gradient(135deg,#fb923c 0%,#c2410c 60%)' },
  { key: 'red', dot: '#dc2626', grad: 'linear-gradient(135deg,#f87171 0%,#b91c1c 60%)' },
  { key: 'pink', dot: '#ec4899', grad: 'linear-gradient(135deg,#f9a8d4 0%,#be185d 60%)' },
];
const colorOf = (key) => CARD_COLORS.find((c) => c.key === key) || CARD_COLORS[0];

// Bir kartın dönem ödemeleri: ekstre tarihinden sonra yapılanlar sayılır.
// Ekstre tarihi girilmemişse kartın tüm ödemeleri dikkate alınır.
export const cardPeriodPayments = (card, payments) => {
  const from = toDate(card.statementDate);
  return (payments || [])
    .filter((p) => p.cardId === card.id)
    .filter((p) => {
      if (!from) return true;
      const d = toDate(p.date);
      return d && d >= from;
    });
};

export const cardRemaining = (card, payments) =>
  (Number(card.statementDebt) || 0) - sum(cardPeriodPayments(card, payments), (p) => p.amount);

// Son ödeme tarihine kalan gün / gecikme durumu
export const dueMeta = (card, remaining) => {
  const due = toDate(card.dueDate);
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const left = daysBetween(today, due);
  if (remaining <= 0.01) return { color: 'green', text: 'Ödendi', left, urgent: false };
  if (left < 0) return { color: 'red', text: `${Math.abs(left)} gün gecikti`, left, urgent: true };
  if (left === 0) return { color: 'red', text: 'Son gün', left, urgent: true };
  if (left <= 7) return { color: 'yellow', text: `${left} gün kaldı`, left, urgent: true };
  return { color: 'sky', text: `${left} gün kaldı`, left, urgent: false };
};

// --- Kart görseli (form önizlemesi ve grid için ortak) ---
function CardVisual({ card, remaining, meta, compact }) {
  const c = colorOf(card.color);
  const limit = Number(card.limit) || 0;
  const used = Math.max(0, remaining);
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : null;
  return (
    <div
      className="relative w-full rounded-2xl text-white overflow-hidden shadow-lg"
      style={{ background: c.grad, aspectRatio: '1.586 / 1', minHeight: compact ? 168 : 190 }}
    >
      {/* cam parlaklığı */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(140deg,rgba(255,255,255,.22),rgba(255,255,255,0) 45%)' }} />
      <div className="relative h-full p-4 flex flex-col justify-between">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <p className="font-semibold leading-tight truncate">{card.name || 'Kart Adı'}</p>
            <p className="text-[11px] text-white/70 truncate">{card.bank || 'Banka'}</p>
          </div>
          {meta && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${meta.color === 'green' ? 'bg-white/25' : meta.urgent ? 'bg-black/35' : 'bg-white/20'}`}>
              {meta.text}
            </span>
          )}
        </div>

        {/* çip */}
        <div className="w-9 h-6 rounded-md" style={{ background: 'linear-gradient(135deg,#f5d68a,#c9a227)' }} />

        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/70">Kalan Borç</p>
          <p className="text-xl font-bold leading-tight">{formatCurrency(Math.max(0, remaining ?? 0))}</p>
          {pct !== null && (
            <div className="mt-2">
              <div className="h-1 rounded-full bg-white/25 overflow-hidden">
                <div className="h-full bg-white/80" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-white/70 mt-1">
                <span>Limit {formatCurrency(limit)}</span>
                <span>{card.dueDate ? `Son ödeme ${formatDateShort(card.dueDate)}` : 'Son ödeme —'}</span>
              </div>
            </div>
          )}
          {pct === null && card.dueDate && (
            <p className="text-[10px] text-white/70 mt-1">Son ödeme {formatDateShort(card.dueDate)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Kart ekleme / düzenleme (canlı önizlemeli) ---
function CardForm({ existing, userId, onClose }) {
  const [form, setForm] = useState(
    existing
      ? {
          ...existing,
          color: existing.color || 'black',
          statementDate: existing.statementDate ? toInputDate(existing.statementDate) : '',
          dueDate: existing.dueDate ? toInputDate(existing.dueDate) : '',
        }
      : { name: '', bank: '', color: 'black', limit: '', statementDebt: '', statementDate: todayInput(), dueDate: '', note: '' }
  );
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    const payload = {
      ...form,
      limit: Number(form.limit) || 0,
      statementDebt: Number(form.statementDebt) || 0,
      statementDate: form.statementDate ? Timestamp.fromDate(new Date(form.statementDate)) : null,
      dueDate: form.dueDate ? Timestamp.fromDate(new Date(form.dueDate)) : null,
    };
    delete payload.id;
    try {
      if (existing) await updateRecord(userId, 'creditCards', existing.id, payload);
      else await addRecord(userId, 'creditCards', payload);
      onClose();
    } catch (err) { console.error(err); alert('Kart kaydedilemedi.'); }
  };

  const previewRemaining = Number(form.statementDebt) || 0;
  return (
    <FormModal
      title={existing ? 'Kartı Düzenle' : 'Yeni Kredi Kartı'}
      size="lg"
      onSubmit={submit}
      onClose={onClose}
      submitLabel={existing ? 'Kaydet' : 'Kartı Oluştur'}
    >
      {/* Canlı önizleme */}
      <div className="bg-gray-50 rounded-2xl p-5 mb-5 flex justify-center">
        <div style={{ width: '100%', maxWidth: 340 }}>
          <CardVisual card={{ ...form, dueDate: form.dueDate || null }} remaining={previewRemaining} meta={null} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Kart Adı" className="md:col-span-2">
          <Input name="name" value={form.name} onChange={set} required placeholder="örn. Bonus Platinum" />
        </Field>

        <Field label="Kart Rengi" className="md:col-span-2">
          <div className="flex flex-wrap gap-2">
            {CARD_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-label={c.key}
                onClick={() => setForm({ ...form, color: c.key })}
                className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center bg-white transition-colors ${form.color === c.key ? 'border-gray-900' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <span className="w-5 h-5 rounded-full block" style={{ background: c.dot }} />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Banka"><Input name="bank" value={form.bank} onChange={set} placeholder="örn. Garanti BBVA" /></Field>
        <Field label="Kart Limiti"><Input type="number" step="0.01" name="limit" value={form.limit} onChange={set} /></Field>
        <Field label="Ekstre Borcu (hesap kesiminde)"><Input type="number" step="0.01" name="statementDebt" value={form.statementDebt} onChange={set} /></Field>
        <Field label="Hesap Kesim Tarihi"><Input type="date" name="statementDate" value={form.statementDate} onChange={set} /></Field>
        <Field label="Son Ödeme Tarihi"><Input type="date" name="dueDate" value={form.dueDate} onChange={set} /></Field>
        <div />
        <Field label="Not" className="md:col-span-2"><Textarea name="note" value={form.note} onChange={set} /></Field>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Kalan borç, ekstre borcundan hesap kesim tarihinden sonra girilen ödemeler düşülerek hesaplanır.
      </p>
    </FormModal>
  );
}

// --- Yeni ekstre (hesap kesimi) ---
function StatementForm({ card, userId, onClose }) {
  const [form, setForm] = useState({
    statementDebt: '',
    statementDate: todayInput(),
    dueDate: card.dueDate ? toInputDate(card.dueDate) : '',
  });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await updateRecord(userId, 'creditCards', card.id, {
        statementDebt: Number(form.statementDebt) || 0,
        statementDate: form.statementDate ? Timestamp.fromDate(new Date(form.statementDate)) : null,
        dueDate: form.dueDate ? Timestamp.fromDate(new Date(form.dueDate)) : null,
      });
      onClose();
    } catch (err) { console.error(err); alert('Ekstre kaydedilemedi.'); }
  };
  return (
    <FormModal title={`${card.name} — Yeni Ekstre`} onSubmit={submit} onClose={onClose} submitLabel="Ekstreyi Kaydet">
      <div className="grid grid-cols-1 gap-4">
        <Field label="Toplam Ekstre Borcu"><Input type="number" step="0.01" name="statementDebt" value={form.statementDebt} onChange={set} required autoFocus /></Field>
        <Field label="Hesap Kesim Tarihi"><Input type="date" name="statementDate" value={form.statementDate} onChange={set} required /></Field>
        <Field label="Son Ödeme Tarihi"><Input type="date" name="dueDate" value={form.dueDate} onChange={set} /></Field>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Yeni ekstre kaydedildiğinde kalan borç bu tutardan başlar; bu tarihten sonra eklediğiniz ödemeler düşülür.
        Önceki dönem ödemeleri geçmişte kalır, silinmez.
      </p>
    </FormModal>
  );
}

// --- Ödeme ekle / düzenle ---
function PaymentForm({ card, existing, userId, onClose }) {
  const [form, setForm] = useState(
    existing
      ? { ...existing, date: toInputDate(existing.date) }
      : { amount: '', date: todayInput(), description: '' }
  );
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(form.amount) > 0)) return alert('Tutar girin.');
    const payload = {
      cardId: card.id,
      cardName: card.name,
      amount: Number(form.amount),
      description: form.description || 'Kart ödemesi',
      date: Timestamp.fromDate(new Date(form.date)),
    };
    try {
      if (existing) await updateRecord(userId, 'creditCardPayments', existing.id, payload);
      else await addRecord(userId, 'creditCardPayments', payload);
      onClose();
    } catch (err) { console.error(err); alert('Ödeme kaydedilemedi.'); }
  };
  return (
    <FormModal title={`${card.name} — ${existing ? 'Ödemeyi Düzenle' : 'Ödeme Ekle'}`} onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4">
        <Field label="Ödeme Tutarı"><Input type="number" step="0.01" name="amount" value={form.amount} onChange={set} required autoFocus /></Field>
        <Field label="Ödeme Tarihi"><Input type="date" name="date" value={form.date} onChange={set} required /></Field>
        <Field label="Açıklama"><Input name="description" value={form.description} onChange={set} placeholder="örn. Asgari ödeme" /></Field>
      </div>
    </FormModal>
  );
}

// --- Kart detayı: dönem özeti + ödeme geçmişi ---
function CardDetail({ card, data, userId, onBack }) {
  const payments = useMemo(() => data.creditCardPayments || [], [data.creditCardPayments]);
  const [payOpen, setPayOpen] = useState(false);
  const [editPay, setEditPay] = useState(null);
  const [stmtOpen, setStmtOpen] = useState(false);
  const [confirmPayId, setConfirmPayId] = useState(null);

  const periodPayments = useMemo(
    () => cardPeriodPayments(card, payments).sort((a, b) => (toDate(b.date) || 0) - (toDate(a.date) || 0)),
    [card, payments]
  );
  const allPayments = useMemo(
    () => payments.filter((p) => p.cardId === card.id).sort((a, b) => (toDate(b.date) || 0) - (toDate(a.date) || 0)),
    [payments, card.id]
  );
  const paid = sum(periodPayments, (p) => p.amount);
  const remaining = (Number(card.statementDebt) || 0) - paid;
  const meta = dueMeta(card, remaining);
  const older = allPayments.filter((p) => !periodPayments.some((q) => q.id === p.id));
  const limit = Number(card.limit) || 0;

  return (
    <div>
      <button onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-4"><ArrowLeft size={16} className="mr-1" />Kart listesine dön</button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-1">
          <CardVisual card={card} remaining={remaining} meta={meta} />
        </div>
        <div className="lg:col-span-2 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap gap-2 justify-end">
            <Button icon={Banknote} onClick={() => setPayOpen(true)}>Ödeme Ekle</Button>
            <Button icon={FileText} variant="secondary" onClick={() => setStmtOpen(true)}>Yeni Ekstre</Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-gray-100 bg-white">
              <p className="text-xs text-gray-500">Ekstre Borcu</p>
              <p className="text-lg font-bold text-gray-800">{formatCurrency(card.statementDebt)}</p>
              <p className="text-[11px] text-gray-400">{card.statementDate ? formatDateShort(card.statementDate) : 'Tarih yok'}</p>
            </div>
            <div className="p-3 rounded-xl border border-gray-100 bg-white">
              <p className="text-xs text-gray-500">Bu Dönem Ödenen</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(paid)}</p>
              <p className="text-[11px] text-gray-400">{periodPayments.length} ödeme</p>
            </div>
            <div className="p-3 rounded-xl border border-gray-100 bg-white">
              <p className="text-xs text-gray-500">Kalan Borç</p>
              <p className={`text-lg font-bold ${remaining > 0.01 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(Math.max(0, remaining))}</p>
              {remaining < -0.01 && <p className="text-[11px] text-gray-400">{formatCurrency(-remaining)} fazla ödeme</p>}
            </div>
            <div className="p-3 rounded-xl border border-gray-100 bg-white">
              <p className="text-xs text-gray-500">Kullanılabilir Limit</p>
              <p className="text-lg font-bold text-gray-800">{limit ? formatCurrency(limit - Math.max(0, remaining)) : '-'}</p>
              <p className="text-[11px] text-gray-400">{limit ? `Limit: ${formatCurrency(limit)}` : 'Limit girilmedi'}</p>
            </div>
          </div>
          {card.note && <p className="text-sm text-gray-500">{card.note}</p>}
        </div>
      </div>

      {meta && (
        <div className={`mb-6 flex items-center gap-2 p-3 rounded-lg text-sm ${meta.color === 'red' ? 'bg-red-50 text-red-700' : meta.color === 'yellow' ? 'bg-yellow-50 text-yellow-800' : meta.color === 'green' ? 'bg-green-50 text-green-700' : 'bg-sky-50 text-sky-700'}`}>
          {meta.color === 'green' ? <Banknote size={18} /> : <CalendarClock size={18} />}
          Son ödeme tarihi {formatDateShort(card.dueDate)} — <b>{meta.text}</b>
        </div>
      )}

      <Card title="Bu Dönem Yapılan Ödemeler" className="mb-6">
        {periodPayments.length === 0 ? (
          <EmptyState message="Bu dönemde henüz ödeme yok. 'Ödeme Ekle' ile kaydedin." icon={Banknote} />
        ) : (
          <Table headers={[{ label: 'Tarih' }, { label: 'Açıklama' }, { label: 'Tutar', align: 'right' }, { label: '' }]}>
            {periodPayments.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Td className="text-gray-500">{formatDateShort(p.date)}</Td>
                <Td className="text-gray-700">{p.description}</Td>
                <Td align="right" className="font-semibold text-green-600">{formatCurrency(p.amount)}</Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditPay(p)} className="p-2 rounded-full hover:bg-gray-200 text-gray-500"><Edit size={16} /></button>
                    <button onClick={() => setConfirmPayId(p.id)} className="p-2 rounded-full hover:bg-gray-200 text-red-500"><Trash2 size={16} /></button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {older.length > 0 && (
        <Card title="Önceki Dönem Ödemeleri">
          <p className="px-6 pt-4 text-xs text-gray-400">Güncel hesap kesim tarihinden önce yapılan ödemeler; kalan borç hesabına katılmaz.</p>
          <Table headers={[{ label: 'Tarih' }, { label: 'Açıklama' }, { label: 'Tutar', align: 'right' }, { label: '' }]}>
            {older.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Td className="text-gray-400">{formatDateShort(p.date)}</Td>
                <Td className="text-gray-500">{p.description}</Td>
                <Td align="right" className="text-gray-500">{formatCurrency(p.amount)}</Td>
                <Td align="right">
                  <button onClick={() => setConfirmPayId(p.id)} className="p-2 rounded-full hover:bg-gray-200 text-red-500"><Trash2 size={16} /></button>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {payOpen && <PaymentForm card={card} userId={userId} onClose={() => setPayOpen(false)} />}
      {editPay && <PaymentForm card={card} existing={editPay} userId={userId} onClose={() => setEditPay(null)} />}
      {stmtOpen && <StatementForm card={card} userId={userId} onClose={() => setStmtOpen(false)} />}
      {confirmPayId && <ConfirmDialog message="Bu ödemeyi silmek istediğinize emin misiniz?" onConfirm={() => deleteRecord(userId, 'creditCardPayments', confirmPayId)} onClose={() => setConfirmPayId(null)} />}
    </div>
  );
}

export default function CreditCards({ data, userId }) {
  const { creditCards = [], creditCardPayments = [] } = data;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [payFor, setPayFor] = useState(null);

  const rows = useMemo(
    () => creditCards.map((c) => {
      const remaining = cardRemaining(c, creditCardPayments);
      return { ...c, _remaining: remaining, _paid: sum(cardPeriodPayments(c, creditCardPayments), (p) => p.amount), _meta: dueMeta(c, remaining) };
    }),
    [creditCards, creditCardPayments]
  );

  const totalLimit = rows.reduce((s, c) => s + (Number(c.limit) || 0), 0);
  const totalDebt = rows.reduce((s, c) => s + Math.max(0, c._remaining), 0);
  const available = Math.max(0, totalLimit - totalDebt);
  const usePct = totalLimit > 0 ? Math.min(100, (totalDebt / totalLimit) * 100) : 0;

  // Yaklaşan borçlar: 7 gün içinde son ödeme tarihi dolan ya da gecikmiş kartlar
  const upcoming = useMemo(
    () => rows
      .filter((c) => c._meta && c._meta.urgent && c._remaining > 0.01)
      .sort((a, b) => a._meta.left - b._meta.left),
    [rows]
  );
  const upcomingTotal = upcoming.reduce((s, c) => s + Math.max(0, c._remaining), 0);
  const overdue = upcoming.filter((c) => c._meta.left < 0).length;

  if (selected) {
    const fresh = creditCards.find((c) => c.id === selected.id);
    if (fresh) return <CardDetail card={fresh} data={data} userId={userId} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <PageHeader title="Kredi Kartı Borç Durumu" subtitle="Kart ekstrelerinizi ve ödemelerinizi takip edin">
        <AddButton label="Yeni Kart" onClick={() => { setEditing(null); setFormOpen(true); }} />
      </PageHeader>

      {/* Üst özet: toplam limit · toplam borç · yaklaşan borçlar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Toplam Kart Limiti</p>
            <Wallet size={18} className="text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(totalLimit)}</p>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-3">
            <div className={`h-full ${usePct > 80 ? 'bg-red-500' : usePct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${usePct}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Kullanılabilir: <b className="text-gray-600">{formatCurrency(available)}</b></p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Toplam Kart Borcu</p>
            <CreditCard size={18} className="text-red-600" />
          </div>
          <p className={`text-2xl font-bold mt-1 ${totalDebt > 0.01 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(totalDebt)}</p>
          <p className="text-xs text-gray-400 mt-3">
            {creditCards.length} kart · Limit kullanımı <b className="text-gray-600">%{usePct.toFixed(0)}</b>
          </p>
        </div>

        <div className={`p-5 rounded-2xl border shadow-sm ${overdue > 0 ? 'bg-red-50 border-red-100' : upcoming.length > 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Yaklaşan Borçlar</p>
            {overdue > 0 ? <AlertTriangle size={18} className="text-red-600" /> : <CalendarClock size={18} className="text-yellow-600" />}
          </div>
          <p className={`text-2xl font-bold mt-1 ${upcoming.length > 0 ? 'text-gray-800' : 'text-green-600'}`}>
            {upcoming.length > 0 ? formatCurrency(upcomingTotal) : 'Yok'}
          </p>
          {upcoming.length === 0 ? (
            <p className="text-xs text-gray-400 mt-3">7 gün içinde ödemesi dolan kart yok.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {upcoming.slice(0, 3).map((c) => (
                <button key={c.id} onClick={() => setSelected(c)} className="w-full flex justify-between items-center gap-2 text-xs hover:underline">
                  <span className="truncate text-gray-600">{c.name}</span>
                  <span className={`flex-shrink-0 font-medium ${c._meta.left < 0 ? 'text-red-600' : 'text-yellow-700'}`}>{c._meta.text}</span>
                </button>
              ))}
              {upcoming.length > 3 && <p className="text-[11px] text-gray-400">+{upcoming.length - 3} kart daha</p>}
            </div>
          )}
        </div>
      </div>

      {/* Kart grid'i */}
      {rows.length === 0 ? (
        <Card><EmptyState message="Henüz kredi kartı eklenmedi. 'Yeni Kart' ile başlayın." icon={CreditCard} /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {rows.map((c) => (
            <div key={c.id} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3">
              <button type="button" onClick={() => setSelected(c)} className="block w-full text-left" title="Kart detayı">
                <CardVisual card={c} remaining={c._remaining} meta={c._meta} compact />
              </button>
              <div className="flex items-center justify-between mt-3 px-1">
                <div className="text-xs text-gray-500">
                  Ekstre: <b className="text-gray-700">{formatCurrency(c.statementDebt)}</b>
                  <span className="mx-1">·</span>
                  Ödenen: <b className="text-green-600">{formatCurrency(c._paid)}</b>
                </div>
                <div className="flex gap-1">
                  <button title="Ödeme ekle" onClick={() => setPayFor(c)} className="p-2 rounded-full hover:bg-gray-100 text-green-600"><Banknote size={16} /></button>
                  <button title="Düzenle" onClick={() => { setEditing(c); setFormOpen(true); }} className="p-2 rounded-full hover:bg-gray-100 text-gray-500"><Edit size={16} /></button>
                  <button title="Sil" onClick={() => setConfirmId(c.id)} className="p-2 rounded-full hover:bg-gray-100 text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && <CardForm existing={editing} userId={userId} onClose={() => { setFormOpen(false); setEditing(null); }} />}
      {payFor && <PaymentForm card={payFor} userId={userId} onClose={() => setPayFor(null)} />}
      {confirmId && (
        <ConfirmDialog
          message="Bu kartı silmek istediğinize emin misiniz? (Karta ait ödeme kayıtları da listelerden kalkar.)"
          onConfirm={() => deleteRecord(userId, 'creditCards', confirmId)}
          onClose={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}

// --- Kredi Kartı Borç Durumu ---
// Her kart için hesap kesim tarihindeki ekstre borcu girilir; yapılan ödemeler
// ayrı kayıtlar olarak eklenir. Kalan borç = ekstre borcu − dönem içi ödemeler.
import React, { useState, useMemo } from 'react';
import { Edit, Trash2, CreditCard, ArrowLeft, Banknote, FileText, CalendarClock, AlertTriangle } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatCurrency, formatDateShort, todayInput, toInputDate, toDate, daysBetween, sum } from '../utils';
import {
  PageHeader, AddButton, Card, Table, Td, Badge, EmptyState, StatCard,
  FormModal, ConfirmDialog, Button, Field, Input, Textarea,
} from '../components/ui';

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
const dueMeta = (card, remaining) => {
  const due = toDate(card.dueDate);
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const left = daysBetween(today, due);
  if (remaining <= 0.01) return { color: 'green', text: 'Ödendi' };
  if (left < 0) return { color: 'red', text: `${Math.abs(left)} gün gecikti` };
  if (left === 0) return { color: 'red', text: 'Son gün' };
  if (left <= 7) return { color: 'yellow', text: `${left} gün kaldı` };
  return { color: 'sky', text: `${left} gün kaldı` };
};

// --- Kart ekleme / düzenleme ---
function CardForm({ existing, userId, onClose }) {
  const [form, setForm] = useState(
    existing
      ? {
          ...existing,
          statementDate: existing.statementDate ? toInputDate(existing.statementDate) : '',
          dueDate: existing.dueDate ? toInputDate(existing.dueDate) : '',
        }
      : { name: '', bank: '', limit: '', statementDebt: '', statementDate: todayInput(), dueDate: '', note: '' }
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
  return (
    <FormModal title={existing ? 'Kartı Düzenle' : 'Yeni Kredi Kartı'} size="lg" onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Kart Adı" className="md:col-span-2"><Input name="name" value={form.name} onChange={set} required placeholder="örn. Bonus Platinum" /></Field>
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

  return (
    <div>
      <button onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-4"><ArrowLeft size={16} className="mr-1" />Kart listesine dön</button>

      <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><CreditCard size={22} className="text-orange-600" />{card.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {card.bank || 'Banka belirtilmedi'}
            {card.statementDate && <> · Hesap kesim: {formatDateShort(card.statementDate)}</>}
            {card.dueDate && <> · Son ödeme: {formatDateShort(card.dueDate)}</>}
          </p>
          {card.note && <p className="text-sm text-gray-500 mt-1">{card.note}</p>}
        </div>
        <div className="flex gap-2 items-start flex-wrap">
          <Button icon={Banknote} onClick={() => setPayOpen(true)}>Ödeme Ekle</Button>
          <Button icon={FileText} variant="secondary" onClick={() => setStmtOpen(true)}>Yeni Ekstre</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard title="Ekstre Borcu" value={formatCurrency(card.statementDebt)} color="text-gray-800" hint={card.statementDate ? formatDateShort(card.statementDate) : 'Tarih girilmedi'} />
        <StatCard title="Bu Dönem Ödenen" value={formatCurrency(paid)} color="text-green-600" hint={`${periodPayments.length} ödeme`} />
        <StatCard title="Kalan Borç" value={formatCurrency(Math.max(0, remaining))} color={remaining > 0.01 ? 'text-red-600' : 'text-green-600'} hint={remaining < -0.01 ? `${formatCurrency(-remaining)} fazla ödeme` : undefined} />
        <StatCard title="Kullanılabilir Limit" value={card.limit ? formatCurrency((Number(card.limit) || 0) - Math.max(0, remaining)) : '-'} color="text-gray-700" hint={card.limit ? `Limit: ${formatCurrency(card.limit)}` : 'Limit girilmedi'} />
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

  const totalDebt = rows.reduce((s, c) => s + Math.max(0, c._remaining), 0);
  const totalStatement = rows.reduce((s, c) => s + (Number(c.statementDebt) || 0), 0);
  const totalPaid = rows.reduce((s, c) => s + c._paid, 0);
  const overdue = rows.filter((c) => c._meta && (c._meta.color === 'red')).length;

  if (selected) {
    const fresh = creditCards.find((c) => c.id === selected.id);
    if (fresh) return <CardDetail card={fresh} data={data} userId={userId} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <PageHeader title="Kredi Kartı Borç Durumu" subtitle="Kart ekstrelerinizi ve ödemelerinizi takip edin">
        <AddButton label="Yeni Kart" onClick={() => { setEditing(null); setFormOpen(true); }} />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard title="Kart Sayısı" value={creditCards.length} icon={CreditCard} color="text-orange-600" />
        <StatCard title="Toplam Ekstre Borcu" value={formatCurrency(totalStatement)} color="text-gray-800" />
        <StatCard title="Toplam Ödenen" value={formatCurrency(totalPaid)} color="text-green-600" />
        <StatCard title="Toplam Kalan Borç" value={formatCurrency(totalDebt)} color={totalDebt > 0.01 ? 'text-red-600' : 'text-green-600'} />
      </div>

      {overdue > 0 && (
        <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <AlertTriangle size={18} />{overdue} kartın son ödeme tarihi geçti ya da bugün doluyor.
        </div>
      )}

      <Card>
        {rows.length === 0 ? (
          <EmptyState message="Henüz kredi kartı eklenmedi. 'Yeni Kart' ile başlayın." icon={CreditCard} />
        ) : (
          <Table headers={[
            { label: 'Kart' }, { label: 'Banka' }, { label: 'Son Ödeme' }, { label: 'Durum' },
            { label: 'Ekstre Borcu', align: 'right' }, { label: 'Ödenen', align: 'right' }, { label: 'Kalan', align: 'right' }, { label: '' },
          ]}>
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <Td className="font-medium text-gray-900 cursor-pointer" onClick={() => setSelected(c)}>{c.name}</Td>
                <Td className="text-gray-500">{c.bank || '-'}</Td>
                <Td className="text-gray-500">{c.dueDate ? formatDateShort(c.dueDate) : '-'}</Td>
                <Td>{c._meta ? <Badge color={c._meta.color}>{c._meta.text}</Badge> : <span className="text-gray-300 text-sm">-</span>}</Td>
                <Td align="right" className="text-gray-700">{formatCurrency(c.statementDebt)}</Td>
                <Td align="right" className="text-green-600">{formatCurrency(c._paid)}</Td>
                <Td align="right" className={`font-semibold ${c._remaining > 0.01 ? 'text-red-600' : 'text-gray-500'}`}>{formatCurrency(Math.max(0, c._remaining))}</Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <button title="Ödeme ekle" onClick={() => setPayFor(c)} className="p-2 rounded-full hover:bg-gray-200 text-green-600"><Banknote size={16} /></button>
                    <button title="Düzenle" onClick={() => { setEditing(c); setFormOpen(true); }} className="p-2 rounded-full hover:bg-gray-200 text-gray-500"><Edit size={16} /></button>
                    <button title="Sil" onClick={() => setConfirmId(c.id)} className="p-2 rounded-full hover:bg-gray-200 text-red-500"><Trash2 size={16} /></button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

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

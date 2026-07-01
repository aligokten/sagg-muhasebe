// --- Yönetici: kullanıcı aboneliklerini elle onaylama/uzatma ---
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, PauseCircle, RotateCcw, Save } from 'lucide-react';
import {
  subscribeAllSubscriptions, updateSubscription, Timestamp,
  subscribeAllPaymentRequests, updatePaymentRequest, subscribePaymentInfo, setPaymentInfo,
} from '../firebase';
import { formatDateShort, toDate } from '../utils';
import {
  PageHeader, Card, Table, Td, Badge, EmptyState, FormModal, Field, Input, Select, Button,
} from '../components/ui';

function PaymentInfoCard() {
  const [form, setForm] = useState({ bankName: '', accountHolder: '', iban: '', note: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => subscribePaymentInfo((d) => {
    if (d) setForm({ bankName: d.bankName || '', accountHolder: d.accountHolder || '', iban: d.iban || '', note: d.note || '' });
  }), []);

  const save = async (e) => {
    e.preventDefault();
    await setPaymentInfo(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card title="Ödeme Alınacak Hesap Bilgileri" className="mb-6">
      <form onSubmit={save} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Banka Adı"><Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></Field>
        <Field label="Hesap Sahibi"><Input value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} /></Field>
        <Field label="IBAN" className="md:col-span-2"><Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} /></Field>
        <Field label="Not (opsiyonel)" className="md:col-span-2"><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="örn. Açıklama kısmına e-posta adresinizi yazınız" /></Field>
        <div className="md:col-span-2 flex items-center gap-3">
          <Button type="submit" icon={Save}>Kaydet</Button>
          {saved && <span className="text-sm text-green-600">Kaydedildi ✓</span>}
        </div>
      </form>
    </Card>
  );
}

const STATUS_META = {
  trial: { label: 'Deneme', color: 'blue' },
  active: { label: 'Aktif', color: 'green' },
  expired: { label: 'Süresi Doldu', color: 'red' },
  suspended: { label: 'Askıda', color: 'yellow' },
};

const statusOf = (sub) => {
  if (!sub) return 'expired';
  const now = Date.now();
  if (sub.status === 'active') return sub.expiresAt && toDate(sub.expiresAt).getTime() < now ? 'expired' : 'active';
  if (sub.status === 'trial') return sub.trialEndsAt && toDate(sub.trialEndsAt).getTime() < now ? 'expired' : 'trial';
  return sub.status || 'expired';
};

const DURATIONS = [
  { k: '1m', l: '+1 Ay', days: 30 },
  { k: '3m', l: '+3 Ay', days: 90 },
  { k: '6m', l: '+6 Ay', days: 180 },
  { k: '12m', l: '+1 Yıl', days: 365 },
];

function ActivateForm({ sub, onClose, onSaved }) {
  const [duration, setDuration] = useState('1m');
  const [note, setNote] = useState(sub.note || '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const days = DURATIONS.find((d) => d.k === duration).days;
    const base = sub.status === 'active' && sub.expiresAt && toDate(sub.expiresAt).getTime() > Date.now()
      ? toDate(sub.expiresAt)
      : new Date();
    const expiresAt = Timestamp.fromDate(new Date(base.getTime() + days * 24 * 60 * 60 * 1000));
    await updateSubscription(sub.id, { status: 'active', plan: 'aylik', expiresAt, note });
    setBusy(false);
    onSaved && onSaved();
    onClose();
  };

  return (
    <FormModal title={`Aktifleştir — ${sub.email}`} onSubmit={submit} onClose={onClose} submitLabel="Kaydet">
      <div className="space-y-3">
        <Field label="Süre">
          <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
            {DURATIONS.map((d) => <option key={d.k} value={d.k}>{d.l}</option>)}
          </Select>
        </Field>
        <Field label="Not (opsiyonel)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="örn. Havale ile ödendi 01.07.2026" /></Field>
        {busy && <p className="text-xs text-gray-400">Kaydediliyor...</p>}
      </div>
    </FormModal>
  );
}

export default function AdminSubscriptions() {
  const [subs, setSubs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activating, setActivating] = useState(null);
  const [activatingReqId, setActivatingReqId] = useState(null);

  useEffect(() => subscribeAllSubscriptions(setSubs), []);
  useEffect(() => subscribeAllPaymentRequests(setRequests), []);

  const rows = useMemo(
    () => [...subs].sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)),
    [subs]
  );

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === 'pending').sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)),
    [requests]
  );

  const suspend = (sub) => {
    if (!window.confirm(`${sub.email} hesabı askıya alınsın mı?`)) return;
    updateSubscription(sub.id, { status: 'suspended' });
  };

  const reactivateTrial = (sub) => {
    if (!window.confirm(`${sub.email} için deneme süresi yeniden başlatılsın mı (7 gün)?`)) return;
    updateSubscription(sub.id, {
      status: 'trial',
      trialEndsAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    });
  };

  const openActivate = (sub, reqId = null) => { setActivating(sub); setActivatingReqId(reqId); };
  const closeActivate = () => { setActivating(null); setActivatingReqId(null); };
  const dismissRequest = (req) => updatePaymentRequest(req.id, { status: 'handled' });
  const activateFromRequest = (req) => openActivate(subs.find((s) => s.id === req.uid) || { id: req.uid, email: req.email }, req.id);

  return (
    <div>
      <PageHeader title="Abonelikler" subtitle="Kullanıcı hesaplarını elle onaylayın, uzatın veya askıya alın" />

      <PaymentInfoCard />

      {pendingRequests.length > 0 && (
        <Card title="Ödeme Talepleri" className="mb-6">
          <Table headers={[{ label: 'E-posta' }, { label: 'Yöntem' }, { label: 'Tarih' }, { label: '' }]}>
            {pendingRequests.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <Td className="font-medium text-gray-900">{r.email}</Td>
                <Td><Badge color={r.method === 'havale' ? 'blue' : 'purple'}>{r.method === 'havale' ? 'Havale/EFT' : 'Kredi Kartı'}</Badge></Td>
                <Td className="text-gray-500">{formatDateShort(r.createdAt)}</Td>
                <Td align="right">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => dismissRequest(r)}>Kapat</Button>
                    <Button icon={CheckCircle} onClick={() => activateFromRequest(r)}>Aktifleştir</Button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Card>
        {rows.length === 0 ? <EmptyState message="Henüz kayıtlı kullanıcı yok" /> : (
          <Table headers={[{ label: 'E-posta' }, { label: 'Durum' }, { label: 'Plan' }, { label: 'Bitiş / Deneme Sonu' }, { label: 'Not' }, { label: '' }]}>
            {rows.map((s) => {
              const st = statusOf(s);
              const meta = STATUS_META[st] || STATUS_META.expired;
              const dateVal = s.status === 'active' ? s.expiresAt : s.trialEndsAt;
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <Td className="font-medium text-gray-900">{s.email}</Td>
                  <Td><Badge color={meta.color}>{meta.label}</Badge></Td>
                  <Td className="text-gray-500">{s.plan || '-'}</Td>
                  <Td className="text-gray-500">{dateVal ? formatDateShort(dateVal) : '-'}</Td>
                  <Td className="text-gray-400 text-xs max-w-[200px] truncate">{s.note || '-'}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openActivate(s)} title="Aktifleştir / Süre Uzat" className="p-2 rounded-full hover:bg-gray-200 text-green-600"><CheckCircle size={16} /></button>
                      <button onClick={() => reactivateTrial(s)} title="Denemeyi Yenile" className="p-2 rounded-full hover:bg-gray-200 text-blue-500"><RotateCcw size={16} /></button>
                      <button onClick={() => suspend(s)} title="Askıya Al" className="p-2 rounded-full hover:bg-gray-200 text-red-500"><PauseCircle size={16} /></button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      {activating && (
        <ActivateForm
          sub={activating}
          onClose={closeActivate}
          onSaved={() => { if (activatingReqId) updatePaymentRequest(activatingReqId, { status: 'handled' }); }}
        />
      )}
    </div>
  );
}

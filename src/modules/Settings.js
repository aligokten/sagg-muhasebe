// --- Ayarlar (Şirket Profili) ---
import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { setRecord } from '../firebase';
import { PageHeader, Card, Button, Field, Input, Textarea } from '../components/ui';

export default function Settings({ userId, companyProfile }) {
  const [profile, setProfile] = useState({
    companyName: '', address: '', taxOffice: '', taxId: '', phone: '', email: '', website: '',
    bankAccounts: [{ bankName: '', iban: '' }],
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (companyProfile) setProfile((p) => ({ ...p, ...companyProfile, bankAccounts: companyProfile.bankAccounts?.length ? companyProfile.bankAccounts : [{ bankName: '', iban: '' }] }));
  }, [companyProfile]);

  const set = (e) => setProfile({ ...profile, [e.target.name]: e.target.value });
  const setBank = (i, e) => {
    const banks = [...profile.bankAccounts];
    banks[i] = { ...banks[i], [e.target.name]: e.target.value };
    setProfile({ ...profile, bankAccounts: banks });
  };
  const addBank = () => setProfile({ ...profile, bankAccounts: [...profile.bankAccounts, { bankName: '', iban: '' }] });
  const removeBank = (i) => setProfile({ ...profile, bankAccounts: profile.bankAccounts.filter((_, idx) => idx !== i) });

  const save = async () => {
    try {
      await setRecord(userId, 'companyProfile', 'main', profile, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); alert('Kaydedilemedi.'); }
  };

  return (
    <div>
      <PageHeader title="Ayarlar" subtitle="Şirket ve fatura bilgileriniz" />

      <Card title="Şirket Bilgileri" className="mb-6">
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Şirket / Ünvan" className="md:col-span-2"><Input name="companyName" value={profile.companyName || ''} onChange={set} /></Field>
          <Field label="Vergi Dairesi"><Input name="taxOffice" value={profile.taxOffice || ''} onChange={set} /></Field>
          <Field label="Vergi / TC No"><Input name="taxId" value={profile.taxId || ''} onChange={set} /></Field>
          <Field label="Telefon"><Input name="phone" value={profile.phone || ''} onChange={set} /></Field>
          <Field label="E-posta"><Input name="email" value={profile.email || ''} onChange={set} /></Field>
          <Field label="Web Sitesi"><Input name="website" value={profile.website || ''} onChange={set} /></Field>
          <Field label="Adres" className="md:col-span-2"><Textarea name="address" value={profile.address || ''} onChange={set} /></Field>
        </div>
      </Card>

      <Card title="Banka Hesapları (Faturada gösterilir)" className="mb-6">
        <div className="p-6">
          {profile.bankAccounts.map((acc, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3 items-center">
              <Input name="bankName" value={acc.bankName} onChange={(e) => setBank(i, e)} placeholder="Banka Adı" className="md:col-span-2" />
              <Input name="iban" value={acc.iban} onChange={(e) => setBank(i, e)} placeholder="IBAN" className="md:col-span-3" />
              <button onClick={() => removeBank(i)} className="text-red-500 hover:text-red-700 justify-self-start"><X size={20} /></button>
            </div>
          ))}
          <button onClick={addBank} className="text-sm font-medium text-sky-600 hover:text-sky-800 mt-1">+ Banka Hesabı Ekle</button>
        </div>
      </Card>

      <div className="flex justify-end items-center gap-3">
        {saved && <span className="text-sm text-green-600">Kaydedildi ✓</span>}
        <Button icon={Save} onClick={save}>Kaydet</Button>
      </div>
    </div>
  );
}

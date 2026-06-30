// --- Ayarlar (Şirket Profili + Yedekleme) ---
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Download, Upload } from 'lucide-react';
import { setRecord } from '../firebase';
import { PageHeader, Card, Button, Field, Input, Textarea } from '../components/ui';
import { downloadBackup, restoreBackup, countRecords } from '../backup';

export default function Settings({ userId, companyProfile, data = {} }) {
  const fileRef = useRef(null);
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('Seçilen yedek MEVCUT hesaba EKLENECEK (üzerine yazmaz). Boş bir hesaba yüklemeniz önerilir. Devam edilsin mi?')) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const n = await restoreBackup(userId, parsed);
      alert(`${n} kayıt geri yüklendi. Veriler birkaç saniye içinde görünecek.`);
    } catch (err) {
      console.error(err);
      alert('Geri yükleme başarısız: ' + (err.message || 'Geçersiz dosya'));
    } finally {
      setRestoring(false);
    }
  };
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

      <div className="flex justify-end items-center gap-3 mb-8">
        {saved && <span className="text-sm text-green-600">Kaydedildi ✓</span>}
        <Button icon={Save} onClick={save}>Kaydet</Button>
      </div>

      <Card title="Veri Yedekleme / Taşıma" className="mb-6">
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-4">
            Tüm verilerinizi (<b>{countRecords(data)}</b> kayıt) bir JSON dosyasına yedekleyebilir veya başka bir
            hesaba/cihaza taşımak için geri yükleyebilirsiniz.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button icon={Download} variant="secondary" onClick={() => downloadBackup(data)}>Yedek Al (JSON indir)</Button>
            <Button icon={Upload} onClick={() => fileRef.current?.click()} disabled={restoring}>
              {restoring ? 'Yükleniyor...' : 'Yedeği Geri Yükle'}
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleRestore} className="hidden" />
          </div>
          <div className="mt-5 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="font-medium text-gray-600">Misafir verilerini hesaba taşıma:</p>
            <p>1) Misafir (giriş yapmadan) haldeyken <b>Yedek Al</b> ile dosyayı indirin.</p>
            <p>2) Sol menüden hesabınıza <b>Giriş Yap</b>.</p>
            <p>3) Bu sayfada <b>Yedeği Geri Yükle</b> ile indirdiğiniz dosyayı seçin. Verileriniz hesaba taşınır ve tüm cihazlara senkron olur.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

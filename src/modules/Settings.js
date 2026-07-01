// --- Ayarlar (Şirket Profili + Yedekleme) ---
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Download, Upload, Image as ImageIcon } from 'lucide-react';
import { setRecord } from '../firebase';
import { PageHeader, Card, Button, Field, Input, Textarea } from '../components/ui';
import { downloadBackup, restoreBackup, countRecords, loadFromUid, writeLoaded } from '../backup';

export default function Settings({ userId, companyProfile, data = {} }) {
  const fileRef = useRef(null);
  const [restoring, setRestoring] = useState(false);
  const [sourceUid, setSourceUid] = useState('');
  const [migrating, setMigrating] = useState(false);

  const handleMigrate = async () => {
    const src = sourceUid.trim();
    if (!src) return alert('Eski Kullanıcı ID (UID) girin.');
    if (src === userId) return alert('Kaynak ID, şu anki hesabınızla aynı olamaz.');
    setMigrating(true);
    try {
      const loaded = await loadFromUid(src);
      if (loaded.total === 0) {
        alert('Bu ID altında kayıt bulunamadı. Firebase Console → Authentication → Users listesindeki diğer (anonim) UID değerlerini deneyin.');
        return;
      }
      if (!window.confirm(`${loaded.total} kayıt bulundu. Bu veriler şu anki hesabınıza taşınsın mı?`)) return;
      const n = await writeLoaded(userId, loaded);
      alert(`${n} kayıt taşındı. Birkaç saniye içinde görünecek. Artık güvenlik kuralını eski (katı) haline geri alabilirsiniz.`);
      setSourceUid('');
    } catch (err) {
      console.error(err);
      if (String(err.code || err.message).includes('permission')) {
        alert('İzin hatası: Eski hesabın verisini okuyabilmek için Firestore kuralını geçici olarak gevşetmeniz gerekir (talimatlar bu sayfada).');
      } else {
        alert('Taşıma başarısız: ' + (err.message || err.code || ''));
      }
    } finally {
      setMigrating(false);
    }
  };

  const logoRef = useRef(null);

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Lütfen bir görsel dosyası seçin.');
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 240;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        setProfile((p) => ({ ...p, logo: canvas.toDataURL('image/png') }));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

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
        <div className="px-6 pt-6">
          <span className="text-sm font-medium text-gray-600">Firma Logosu</span>
          <div className="flex items-center gap-4 mt-2">
            <div className="w-24 h-24 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
              {profile.logo ? <img src={profile.logo} alt="logo" className="max-w-full max-h-full object-contain" /> : <ImageIcon className="text-gray-300" size={28} />}
            </div>
            <div className="flex flex-col gap-2">
              <Button type="button" variant="secondary" icon={Upload} onClick={() => logoRef.current?.click()}>Logo Yükle</Button>
              {profile.logo && <button type="button" onClick={() => setProfile((p) => ({ ...p, logo: '' }))} className="text-sm text-red-500 hover:text-red-700">Logoyu Kaldır</button>}
              <input ref={logoRef} type="file" accept="image/*" onChange={handleLogo} className="hidden" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Logo, menüdeki başlıkta ve fatura/teklif çıktılarında görünür. Değişikliği <b>Kaydet</b> ile uygulayın.</p>
        </div>
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
          <button onClick={addBank} className="text-sm font-medium text-orange-600 hover:text-orange-800 mt-1">+ Banka Hesabı Ekle</button>
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
            <p className="font-medium text-gray-600">Başka bir hesaba taşıma:</p>
            <p>1) Kaynak hesapla giriş yapmışken <b>Yedek Al</b> ile dosyayı indirin.</p>
            <p>2) Çıkış yapıp hedef hesaba <b>Giriş Yap</b>.</p>
            <p>3) Bu sayfada <b>Yedeği Geri Yükle</b> ile indirdiğiniz dosyayı seçin. Verileriniz hesaba taşınır ve tüm cihazlara senkron olur.</p>
          </div>
        </div>
      </Card>

      <Card title="Eski Hesaptan Veri Kurtarma / Taşıma" className="mb-6">
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-2">
            Yanlışlıkla yeni bir hesaba geçtiyseniz, eski hesabınızdaki verileri buradan bu hesaba taşıyabilirsiniz.
          </p>
          <div className="text-xs text-gray-500 bg-amber-50 rounded-lg p-3 mb-4 space-y-1">
            <p className="font-medium text-amber-700">Önce Firestore kuralını GEÇİCİ olarak gevşetin:</p>
            <p>Firebase Console → Firestore Database → Rules → aşağıdakini yapıştırıp Publish edin:</p>
            <pre className="bg-white border rounded p-2 mt-1 overflow-x-auto text-[11px] leading-snug">{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/users/{userId}/{document=**} {
      allow write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null; // GEÇİCİ
    }
  }
}`}</pre>
            <p className="mt-1">Taşıma bittikten sonra <b>read</b> satırını eski haline (<code>request.auth.uid == userId</code>) geri alın.</p>
          </div>
          <p className="text-xs text-gray-500 mb-1">Eski Kullanıcı ID (Firebase Console → Authentication → Users → eski hesabın UID'i):</p>
          <div className="flex flex-wrap gap-3 items-center">
            <Input value={sourceUid} onChange={(e) => setSourceUid(e.target.value)} placeholder="örn. a2hwft1BjdOGKiBXp4HsRz0LVTu1" className="flex-1 min-w-[240px]" />
            <Button icon={Upload} onClick={handleMigrate} disabled={migrating}>{migrating ? 'Taşınıyor...' : 'Veriyi Taşı'}</Button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Şu anki hesabınızın UID'i: <code className="break-all">{userId}</code></p>
        </div>
      </Card>
    </div>
  );
}

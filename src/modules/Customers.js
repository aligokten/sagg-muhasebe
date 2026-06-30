// --- Cari Hesaplar (müşteri / tedarikçi) + işler/projeler + ekstre + tahsilat/ödeme ---
import React, { useState, useMemo } from 'react';
import { ArrowLeft, Edit, Trash2, Wallet, HandCoins, Download, Users, Briefcase, PlusCircle, DraftingCompass, Banknote } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatCurrency, formatDateShort, todayInput, toInputDate } from '../utils';
import { downloadExcel, tl } from '../exportExcel';
import { cariMovements, allCariBalances, customerProjectBalances, subcontractPaid, subcontractRemaining } from '../finance';
import {
  PageHeader, AddButton, Card, Table, Td, Badge, EmptyState, StatCard,
  FormModal, ConfirmDialog, Button, Field, Input, Select, Textarea, ActionMenu,
} from '../components/ui';
import QuickEntry from '../components/QuickEntry';
import { BRANCHES } from './Authors';
import { CategorySelect } from '../categories';

const balanceBadge = (bal) => {
  if (Math.abs(bal) < 0.01) return <Badge color="gray">Bakiye Yok</Badge>;
  return bal > 0
    ? <span className="font-semibold text-red-600">{formatCurrency(bal)} (B)</span>
    : <span className="font-semibold text-green-600">{formatCurrency(-bal)} (A)</span>;
};

const balanceText = (bal) =>
  bal >= 0 ? `${formatCurrency(bal)} Borç` : `${formatCurrency(-bal)} Alacak`;

// Cari/iş ekstresini Excel (.xls) hesap dökümü olarak indirir.
function exportLedgerExcel(heading, customer, rows, balance, showProject, filename) {
  const totalBorc = rows.reduce((s, r) => s + r.borc, 0);
  const totalAlacak = rows.reduce((s, r) => s + r.alacak, 0);
  const headers = ['Tarih', 'İşlem', 'Açıklama', ...(showProject ? ['İş/Proje'] : []), 'Borç', 'Alacak', 'Bakiye'];
  const dataRows = rows.map((r) => [
    formatDateShort(r.date), r.type,
    r.description + (r.category ? ` (${r.category})` : ''),
    ...(showProject ? [r.projectName || 'Genel'] : []),
    r.borc ? tl(r.borc) : '', r.alacak ? tl(r.alacak) : '',
    `${tl(Math.abs(r.balance))} ${r.balance >= 0 ? '(B)' : '(A)'}`,
  ]);
  const totalRow = ['', 'TOPLAM', '', ...(showProject ? [''] : []), tl(totalBorc), tl(totalAlacak), `${tl(Math.abs(balance))} ${balance >= 0 ? 'B' : 'A'}`];
  downloadExcel(filename, [
    { heading },
    { rows: [
      ['Tarih', new Date().toLocaleDateString('tr-TR')],
      ['Cari', customer.name],
      ['Vergi/TCKN', customer.taxId || customer.tcNo || '-'],
      ['Genel Bakiye', `${tl(Math.abs(balance))} ${balance >= 0 ? 'Borç' : 'Alacak'}`],
    ] },
    { headers, rows: [...dataRows, totalRow] },
  ]);
}

// --- Cari ekleme/düzenleme formu ---
function CustomerForm({ existing, userId, onClose }) {
  const [form, setForm] = useState(
    existing || {
      name: '', accountType: 'Tüzel Kişi', role: 'customer',
      taxOffice: '', taxId: '', tcNo: '', email: '', phone: '', address: '',
      openingBalance: 0, openingType: 'borc',
    }
  );
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    const payload = { ...form, openingBalance: Number(form.openingBalance) || 0 };
    delete payload.id;
    try {
      if (existing) await updateRecord(userId, 'customers', existing.id, payload);
      else await addRecord(userId, 'customers', payload);
      onClose();
    } catch (err) { console.error(err); alert('Cari kaydedilemedi.'); }
  };
  return (
    <FormModal title={existing ? 'Cari Düzenle' : 'Yeni Cari Hesap'} size="lg" onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Ünvan / Ad Soyad" className="md:col-span-2"><Input name="name" value={form.name} onChange={set} required /></Field>
        <Field label="Tip"><Select name="accountType" value={form.accountType} onChange={set}><option>Tüzel Kişi</option><option>Şahıs</option></Select></Field>
        <Field label="Cari Rolü"><Select name="role" value={form.role} onChange={set}><option value="customer">Müşteri</option><option value="supplier">Tedarikçi</option><option value="both">Müşteri + Tedarikçi</option></Select></Field>
        {form.accountType === 'Tüzel Kişi' ? (
          <>
            <Field label="Vergi Dairesi"><Input name="taxOffice" value={form.taxOffice} onChange={set} /></Field>
            <Field label="Vergi No (VKN)"><Input name="taxId" value={form.taxId} onChange={set} /></Field>
          </>
        ) : (
          <Field label="T.C. Kimlik No" className="md:col-span-2"><Input name="tcNo" value={form.tcNo} onChange={set} /></Field>
        )}
        <Field label="E-posta"><Input type="email" name="email" value={form.email} onChange={set} /></Field>
        <Field label="Telefon"><Input name="phone" value={form.phone} onChange={set} /></Field>
        <Field label="Adres" className="md:col-span-2"><Textarea name="address" value={form.address} onChange={set} /></Field>
        <Field label="Açılış Bakiyesi"><Input type="number" step="0.01" name="openingBalance" value={form.openingBalance} onChange={set} /></Field>
        <Field label="Açılış Türü"><Select name="openingType" value={form.openingType} onChange={set}><option value="borc">Borç (bize borçlu)</option><option value="alacak">Alacak (biz borçluyuz)</option></Select></Field>
      </div>
    </FormModal>
  );
}

// --- İş / Proje ekleme-düzenleme formu ---
function ProjectForm({ customerId, existing, userId, onClose }) {
  const [form, setForm] = useState(
    existing || { customerId, name: '', description: '', address: '', status: 'active', openingBalance: 0, openingType: 'borc' }
  );
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    const payload = { ...form, customerId, openingBalance: Number(form.openingBalance) || 0 };
    delete payload.id;
    try {
      if (existing) await updateRecord(userId, 'projects', existing.id, payload);
      else await addRecord(userId, 'projects', payload);
      onClose();
    } catch (err) { console.error(err); alert('İş kaydedilemedi.'); }
  };
  return (
    <FormModal title={existing ? 'İş / Proje Düzenle' : 'Yeni İş / Proje'} size="lg" onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="İş Adı" className="md:col-span-2"><Input name="name" value={form.name} onChange={set} required placeholder="örn. Bağdat Cd. Arsası - İnşaat" /></Field>
        <Field label="Adres / Ada-Parsel" className="md:col-span-2"><Input name="address" value={form.address} onChange={set} /></Field>
        <Field label="Açıklama" className="md:col-span-2"><Textarea name="description" value={form.description} onChange={set} /></Field>
        <Field label="Durum"><Select name="status" value={form.status} onChange={set}><option value="active">Devam Ediyor</option><option value="done">Tamamlandı</option><option value="paused">Beklemede</option></Select></Field>
        <div />
        <Field label="Açılış Bakiyesi"><Input type="number" step="0.01" name="openingBalance" value={form.openingBalance} onChange={set} /></Field>
        <Field label="Açılış Türü"><Select name="openingType" value={form.openingType} onChange={set}><option value="borc">Borç (bize borçlu)</option><option value="alacak">Alacak (biz borçluyuz)</option></Select></Field>
      </div>
    </FormModal>
  );
}

// --- Tahsilat / Ödeme formu (opsiyonel iş/proje seçimli) ---
function PaymentForm({ type, customer, userId, accounts, projects, lockedProjectId, onClose }) {
  const isCollect = type === 'tahsilat';
  const [form, setForm] = useState({
    date: todayInput(), amount: '', accountId: accounts[0]?.id || '',
    method: 'Nakit', category: '', description: '', projectId: lockedProjectId || '',
  });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const lockedProject = projects.find((p) => p.id === lockedProjectId);
  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(form.amount) > 0)) return alert('Tutar girin.');
    try {
      await addRecord(userId, 'transactions', {
        type, customerId: customer.id, customerName: customer.name,
        projectId: form.projectId || null,
        amount: Number(form.amount), accountId: form.accountId || null,
        direction: isCollect ? 'in' : 'out', method: form.method,
        category: form.category || null,
        description: form.description || form.category || (isCollect ? 'Tahsilat' : 'Ödeme'),
        date: Timestamp.fromDate(new Date(form.date)),
      });
      onClose();
    } catch (err) { console.error(err); alert('İşlem kaydedilemedi.'); }
  };
  return (
    <FormModal title={`${customer.name} — ${isCollect ? 'Tahsilat' : 'Ödeme'}`} onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4">
        {lockedProjectId ? (
          <div className="text-sm bg-sky-50 text-sky-800 rounded-md p-2">İş: <b>{lockedProject?.name}</b></div>
        ) : projects.length > 0 ? (
          <Field label="İş / Proje"><Select name="projectId" value={form.projectId} onChange={set}><option value="">Genel (işe bağlı değil)</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        ) : null}
        <Field label="Tarih"><Input type="date" name="date" value={form.date} onChange={set} required /></Field>
        <Field label="Tutar"><Input type="number" step="0.01" name="amount" value={form.amount} onChange={set} required /></Field>
        <Field label="Kategori"><CategorySelect name="category" value={form.category} onChange={set} /></Field>
        <Field label="Kasa / Banka"><Select name="accountId" value={form.accountId} onChange={set}><option value="">Belirtilmedi</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Ödeme Şekli"><Select name="method" value={form.method} onChange={set}><option>Nakit</option><option>Havale/EFT</option><option>Kredi Kartı</option><option>Çek</option><option>Senet</option></Select></Field>
        <Field label="Açıklama"><Input name="description" value={form.description} onChange={set} /></Field>
      </div>
    </FormModal>
  );
}

// --- Projeye müellif atama formu ---
function SubcontractForm({ project, authors, userId, onClose }) {
  const [form, setForm] = useState({ authorId: authors[0]?.id || '', branch: authors[0]?.branch || 'Mimari', agreedAmount: '', note: '' });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const onAuthor = (e) => {
    const a = authors.find((x) => x.id === e.target.value);
    setForm((f) => ({ ...f, authorId: e.target.value, branch: a?.branch || f.branch }));
  };
  const submit = async (e) => {
    e.preventDefault();
    const author = authors.find((a) => a.id === form.authorId);
    if (!author) return alert('Müellif seçin.');
    try {
      await addRecord(userId, 'subcontracts', {
        projectId: project.id, customerId: project.customerId,
        authorId: author.id, authorName: author.name, branch: form.branch,
        agreedAmount: Number(form.agreedAmount) || 0, note: form.note,
      });
      onClose();
    } catch (err) { console.error(err); alert('Atama kaydedilemedi.'); }
  };
  if (authors.length === 0) {
    return (
      <FormModal title="Müellif Ata" onSubmit={(e) => { e.preventDefault(); onClose(); }} onClose={onClose} submitLabel="Kapat">
        <p className="text-gray-600 text-sm">Önce <b>Müellifler</b> menüsünden mühendis/taşeron ekleyin, sonra buradan projeye atayabilirsiniz.</p>
      </FormModal>
    );
  }
  return (
    <FormModal title={`Müellif Ata — ${project.name}`} onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4">
        <Field label="Müellif"><Select name="authorId" value={form.authorId} onChange={onAuthor}>{authors.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.branch})</option>)}</Select></Field>
        <Field label="Branş / İş"><Select name="branch" value={form.branch} onChange={set}>{BRANCHES.map((b) => <option key={b}>{b}</option>)}</Select></Field>
        <Field label="Sözleşme Bedeli"><Input type="number" step="0.01" name="agreedAmount" value={form.agreedAmount} onChange={set} required /></Field>
        <Field label="Not"><Input name="note" value={form.note} onChange={set} /></Field>
      </div>
    </FormModal>
  );
}

// --- Müellife ödeme formu ---
function AuthorPaymentForm({ subcontract, userId, accounts, onClose }) {
  const remaining = subcontract._remaining ?? 0;
  const [form, setForm] = useState({ amount: '', date: todayInput(), accountId: accounts[0]?.id || '', description: '' });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(form.amount) > 0)) return;
    try {
      await addRecord(userId, 'transactions', {
        type: 'odeme', direction: 'out',
        authorId: subcontract.authorId, authorName: subcontract.authorName,
        subcontractId: subcontract.id, projectId: subcontract.projectId,
        amount: Number(form.amount), accountId: form.accountId || null,
        description: form.description || `Müellif ödemesi - ${subcontract.authorName}`,
        date: Timestamp.fromDate(new Date(form.date)),
      });
      onClose();
    } catch (err) { console.error(err); alert('Ödeme kaydedilemedi.'); }
  };
  return (
    <FormModal title={`Müellif Ödemesi — ${subcontract.authorName}`} onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4">
        <div className="text-sm bg-gray-50 rounded-md p-2 text-gray-600">Kalan borç: <b className="text-red-600">{formatCurrency(remaining)}</b></div>
        <Field label="Tutar"><Input type="number" step="0.01" name="amount" value={form.amount} onChange={set} required /></Field>
        <Field label="Tarih"><Input type="date" name="date" value={form.date} onChange={set} /></Field>
        <Field label="Ödeme Hesabı"><Select name="accountId" value={form.accountId} onChange={set}><option value="">Belirtilmedi</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Açıklama"><Input name="description" value={form.description} onChange={set} /></Field>
      </div>
    </FormModal>
  );
}

// --- Hareket (tahsilat/ödeme/manuel) düzenleme formu ---
function TransactionForm({ customer, existing, userId, accounts, projects, onClose }) {
  const initialAction = existing.type === 'tahsilat' ? 'tahsilat'
    : existing.type === 'odeme' ? 'odeme'
    : existing.cariEffect === 'borc' ? 'satis' : 'alis';
  const [form, setForm] = useState({
    action: initialAction,
    amount: existing.amount ?? '',
    category: existing.category || '',
    description: existing.description || '',
    date: toInputDate(existing.date),
    accountId: existing.accountId || '',
    projectId: existing.projectId || '',
  });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const needsAccount = form.action === 'tahsilat' || form.action === 'odeme';
  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(form.amount) > 0)) return alert('Tutar girin.');
    const labels = { tahsilat: 'Tahsilat', odeme: 'Ödeme', satis: 'Satış', alis: 'Alış' };
    const base = {
      customerId: customer.id, customerName: customer.name,
      projectId: form.projectId || null,
      amount: Number(form.amount),
      category: form.category || null,
      description: form.description || form.category || labels[form.action],
      date: Timestamp.fromDate(new Date(form.date)),
    };
    let payload;
    if (form.action === 'tahsilat') payload = { ...base, type: 'tahsilat', direction: 'in', cariEffect: null, accountId: form.accountId || null };
    else if (form.action === 'odeme') payload = { ...base, type: 'odeme', direction: 'out', cariEffect: null, accountId: form.accountId || null };
    else if (form.action === 'satis') payload = { ...base, type: 'manuel', cariEffect: 'borc', direction: null, accountId: null };
    else payload = { ...base, type: 'manuel', cariEffect: 'alacak', direction: null, accountId: null };
    try {
      await updateRecord(userId, 'transactions', existing.id, payload);
      onClose();
    } catch (err) { console.error(err); alert('Güncellenemedi.'); }
  };
  return (
    <FormModal title="Hareket Düzenle" onSubmit={submit} onClose={onClose}>
      <div className="flex flex-wrap gap-1 mb-3">
        {[['tahsilat', 'Tahsilat'], ['odeme', 'Ödeme'], ['satis', 'Satış (Borç)'], ['alis', 'Alış (Alacak)']].map(([k, l]) => (
          <button type="button" key={k} onClick={() => setForm((f) => ({ ...f, action: k }))} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${form.action === k ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4">
        {projects.length > 0 && (
          <Field label="İş / Proje"><Select name="projectId" value={form.projectId} onChange={set}><option value="">Genel</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        )}
        <Field label="Tarih"><Input type="date" name="date" value={form.date} onChange={set} required /></Field>
        <Field label="Tutar"><Input type="number" step="0.01" name="amount" value={form.amount} onChange={set} required /></Field>
        <Field label="Kategori"><CategorySelect name="category" value={form.category} onChange={set} /></Field>
        {needsAccount && <Field label="Kasa / Banka"><Select name="accountId" value={form.accountId} onChange={set}><option value="">Belirtilmedi</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>}
        <Field label="Açıklama"><Input name="description" value={form.description} onChange={set} /></Field>
      </div>
    </FormModal>
  );
}

// --- Ekstre tablosu (cari ya da proje) ---
function LedgerTable({ rows, showProject, onEditTx, onDeleteTx }) {
  const actions = !!(onEditTx || onDeleteTx);
  const headers = [
    { label: 'Tarih' }, { label: 'İşlem' }, { label: 'Açıklama' },
    ...(showProject ? [{ label: 'İş/Proje' }] : []),
    { label: 'Borç', align: 'right' }, { label: 'Alacak', align: 'right' }, { label: 'Bakiye', align: 'right' },
    ...(actions ? [{ label: '' }] : []),
  ];
  return (
    <Table headers={headers}>
      {rows.map((r, i) => (
        <tr key={i} className="hover:bg-gray-50">
          <Td className="text-gray-500">{formatDateShort(r.date)}</Td>
          <Td><Badge color={r.borc ? 'red' : 'green'}>{r.type}</Badge></Td>
          <Td className="text-gray-600">
            {r.description}
            {r.category && <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">{r.category}</span>}
          </Td>
          {showProject && <Td className="text-gray-500">{r.projectName || <span className="text-gray-300">Genel</span>}</Td>}
          <Td align="right" className="text-red-600">{r.borc ? formatCurrency(r.borc) : '-'}</Td>
          <Td align="right" className="text-green-600">{r.alacak ? formatCurrency(r.alacak) : '-'}</Td>
          <Td align="right" className="font-semibold text-gray-800">{formatCurrency(Math.abs(r.balance))} {r.balance >= 0 ? '(B)' : '(A)'}</Td>
          {actions && (
            <Td align="right">
              {r.ref?.kind === 'transaction' ? (
                <ActionMenu
                  items={[
                    { label: 'Düzenle', icon: Edit, onClick: () => onEditTx(r.ref.id) },
                    { label: 'Sil', icon: Trash2, danger: true, onClick: () => onDeleteTx(r.ref.id) },
                  ]}
                />
              ) : null}
            </Td>
          )}
        </tr>
      ))}
    </Table>
  );
}

// --- İş / Proje detay (proje bazlı ekstre + müellifler) ---
function ProjectLedger({ customer, project, data, userId, onBack }) {
  const { accounts = [], authors = [] } = data;
  const [editOpen, setEditOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [payFor, setPayFor] = useState(null);
  const [confirmSubId, setConfirmSubId] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [confirmTxId, setConfirmTxId] = useState(null);
  const customerProjects = (data.projects || []).filter((p) => p.customerId === customer.id);
  const txById = (id) => (data.transactions || []).find((t) => t.id === id);

  const { rows, balance } = useMemo(() => cariMovements(customer.id, data, project.id), [customer, project, data]);
  const totalBorc = rows.reduce((s, r) => s + r.borc, 0);
  const totalAlacak = rows.reduce((s, r) => s + r.alacak, 0);

  const subs = useMemo(
    () => (data.subcontracts || [])
      .filter((s) => s.projectId === project.id)
      .map((s) => ({ ...s, _paid: subcontractPaid(s.id, data), _remaining: subcontractRemaining(s, data) })),
    [data, project.id]
  );
  const subAgreed = subs.reduce((s, x) => s + (Number(x.agreedAmount) || 0), 0);
  const subPaid = subs.reduce((s, x) => s + x._paid, 0);
  const subRemaining = subAgreed - subPaid;

  return (
    <div>
      <button onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-4"><ArrowLeft size={16} className="mr-1" />{customer.name} işlerine dön</button>
      <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Briefcase size={22} className="text-sky-600" />{project.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{customer.name}{project.address ? ` · ${project.address}` : ''}</p>
          {project.description && <p className="text-sm text-gray-500 mt-1">{project.description}</p>}
        </div>
        <div className="flex gap-2 items-start flex-wrap">
          <Button icon={Download} variant="secondary" onClick={() => exportLedgerExcel(`${project.name} — İŞ EKSTRESİ`, customer, rows, balance, false, `${customer.name}-${project.name}-ekstre`)}>Excel'e Aktar</Button>
          <Button icon={Edit} variant="secondary" onClick={() => setEditOpen(true)}>İşi Düzenle</Button>
        </div>
      </div>

      {/* Hızlı kayıt çubuğu (işe işlenir) */}
      <QuickEntry customer={customer} projectId={project.id} userId={userId} accounts={accounts} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Müşteriye Kestiğimiz (Borç)" value={formatCurrency(totalBorc)} color="text-red-600" />
        <StatCard title="Müşteriden Tahsil (Alacak)" value={formatCurrency(totalAlacak)} color="text-green-600" />
        <StatCard title="Müşteri Bakiyesi" value={balanceText(balance)} color={balance >= 0 ? 'text-red-600' : 'text-green-600'} />
      </div>

      {/* Müellifler / Taşeronlar */}
      <Card title="Müellifler / Taşeronlar" className="mb-6" actions={<Button icon={PlusCircle} onClick={() => setSubOpen(true)}>Müellif Ata</Button>}>
        {subs.length === 0 ? (
          <EmptyState message="Bu işe atanmış müellif yok. Taşere edeceğiniz branşlar için müellif atayın." icon={DraftingCompass} />
        ) : (
          <>
            <Table headers={[{ label: 'Müellif' }, { label: 'Branş' }, { label: 'Sözleşme', align: 'right' }, { label: 'Ödenen', align: 'right' }, { label: 'Kalan', align: 'right' }, { label: '' }]}>
              {subs.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <Td className="font-medium text-gray-900">{s.authorName}</Td>
                  <Td><Badge color="purple">{s.branch}</Badge></Td>
                  <Td align="right" className="text-gray-700">{formatCurrency(s.agreedAmount)}</Td>
                  <Td align="right" className="text-green-600">{formatCurrency(s._paid)}</Td>
                  <Td align="right" className={`font-semibold ${s._remaining > 0.01 ? 'text-red-600' : 'text-gray-500'}`}>{formatCurrency(s._remaining)}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <button title="Ödeme yap" onClick={() => setPayFor(s)} className="p-2 rounded-full hover:bg-gray-200 text-green-600"><Banknote size={16} /></button>
                      <button title="Atamayı sil" onClick={() => setConfirmSubId(s.id)} className="p-2 rounded-full hover:bg-gray-200 text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
            <div className="flex flex-wrap gap-6 justify-end px-4 py-3 border-t text-sm">
              <span className="text-gray-500">Toplam Sözleşme: <b className="text-gray-800">{formatCurrency(subAgreed)}</b></span>
              <span className="text-gray-500">Ödenen: <b className="text-green-600">{formatCurrency(subPaid)}</b></span>
              <span className="text-gray-500">Kalan Borç: <b className="text-red-600">{formatCurrency(subRemaining)}</b></span>
            </div>
          </>
        )}
      </Card>

      <Card title="Müşteri Hesap Ekstresi (bu iş)">
        {rows.length === 0 ? <EmptyState message="Bu iş için henüz hareket yok" /> : (
          <LedgerTable rows={rows} showProject={false} onEditTx={(id) => setEditTx(txById(id))} onDeleteTx={(id) => setConfirmTxId(id)} />
        )}
      </Card>

      {editOpen && <ProjectForm customerId={customer.id} existing={project} userId={userId} onClose={() => setEditOpen(false)} />}
      {subOpen && <SubcontractForm project={project} authors={authors} userId={userId} onClose={() => setSubOpen(false)} />}
      {payFor && <AuthorPaymentForm subcontract={payFor} userId={userId} accounts={accounts} onClose={() => setPayFor(null)} />}
      {confirmSubId && <ConfirmDialog message="Bu müellif atamasını silmek istediğinize emin misiniz? (Yapılan ödemeler silinmez.)" onConfirm={() => deleteRecord(userId, 'subcontracts', confirmSubId)} onClose={() => setConfirmSubId(null)} />}
      {editTx && <TransactionForm customer={customer} existing={editTx} userId={userId} accounts={accounts} projects={customerProjects} onClose={() => setEditTx(null)} />}
      {confirmTxId && <ConfirmDialog message="Bu hareketi (tahsilat/ödeme) silmek istediğinize emin misiniz?" onConfirm={() => deleteRecord(userId, 'transactions', confirmTxId)} onClose={() => setConfirmTxId(null)} />}
    </div>
  );
}

// --- Cari detay / ekstre + işler listesi ---
function CustomerDetail({ customer, data, userId, onBack }) {
  const { accounts = [], projects = [] } = data;
  const [payment, setPayment] = useState(null);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [confirmProjectId, setConfirmProjectId] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [confirmTxId, setConfirmTxId] = useState(null);
  const txById = (id) => (data.transactions || []).find((t) => t.id === id);

  const customerProjects = useMemo(() => projects.filter((p) => p.customerId === customer.id), [projects, customer.id]);
  const projectBalances = useMemo(() => customerProjectBalances(customer.id, data), [customer.id, data]);
  const { rows, balance } = useMemo(() => cariMovements(customer.id, data), [customer, data]);

  const exportEkstre = () => exportLedgerExcel(`${customer.name} — HESAP EKSTRESİ`, customer, rows, balance, customerProjects.length > 0, customer.name + '-ekstre');

  if (selectedProject) {
    const fresh = customerProjects.find((p) => p.id === selectedProject.id);
    if (fresh) return <ProjectLedger customer={customer} project={fresh} data={data} userId={userId} onBack={() => setSelectedProject(null)} />;
  }

  const totalBorc = rows.reduce((s, r) => s + r.borc, 0);
  const totalAlacak = rows.reduce((s, r) => s + r.alacak, 0);

  return (
    <div>
      <button onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-4"><ArrowLeft size={16} className="mr-1" />Cari listesine dön</button>

      <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{customer.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{customer.accountType} · {customer.taxId || customer.tcNo || '-'}</p>
          {customer.phone && <p className="text-sm text-gray-500">{customer.phone} · {customer.email}</p>}
        </div>
        <div className="flex gap-2 items-start flex-wrap">
          <Button icon={Wallet} variant="success" onClick={() => setPayment('tahsilat')}>Tahsilat</Button>
          <Button icon={HandCoins} variant="danger" onClick={() => setPayment('odeme')}>Ödeme</Button>
          <Button icon={Download} variant="secondary" onClick={exportEkstre}>Excel'e Aktar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Toplam Borç" value={formatCurrency(totalBorc)} color="text-red-600" />
        <StatCard title="Toplam Alacak" value={formatCurrency(totalAlacak)} color="text-green-600" />
        <StatCard title="Genel Bakiye" value={balanceText(balance)} color={balance >= 0 ? 'text-red-600' : 'text-green-600'} />
      </div>

      {/* Hızlı kayıt çubuğu */}
      <QuickEntry customer={customer} userId={userId} accounts={accounts} />

      {/* İşler / Projeler */}
      <Card title="İşler / Projeler" className="mb-6" actions={<Button icon={PlusCircle} onClick={() => setProjectFormOpen(true)}>Yeni İş</Button>}>
        {customerProjects.length === 0 ? (
          <EmptyState message="Bu cariye ait iş/proje yok. Farklı arsa/işleri ayrı takip etmek için 'Yeni İş' ekleyin." icon={Briefcase} />
        ) : (
          <Table headers={[{ label: 'İş / Proje' }, { label: 'Adres' }, { label: 'Durum' }, { label: 'Bakiye', align: 'right' }, { label: '' }]}>
            {customerProjects.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Td className="font-medium text-gray-900 cursor-pointer" onClick={() => setSelectedProject(p)}>
                  <span className="flex items-center gap-2"><Briefcase size={15} className="text-sky-600" />{p.name}</span>
                </Td>
                <Td className="text-gray-500">{p.address || '-'}</Td>
                <Td><Badge color={p.status === 'done' ? 'green' : p.status === 'paused' ? 'yellow' : 'sky'}>{p.status === 'done' ? 'Tamamlandı' : p.status === 'paused' ? 'Beklemede' : 'Devam Ediyor'}</Badge></Td>
                <Td align="right">{balanceBadge(projectBalances[p.id] || 0)}</Td>
                <Td align="right">
                  <button onClick={() => setConfirmProjectId(p.id)} className="p-2 rounded-full hover:bg-gray-200 text-red-500"><Trash2 size={16} /></button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Genel Hesap Ekstresi">
        {rows.length === 0 ? (
          <EmptyState message="Bu cari için henüz hareket yok" />
        ) : (
          <LedgerTable rows={rows} showProject={customerProjects.length > 0} onEditTx={(id) => setEditTx(txById(id))} onDeleteTx={(id) => setConfirmTxId(id)} />
        )}
      </Card>

      {payment && <PaymentForm type={payment === 'tahsilat' ? 'tahsilat' : 'odeme'} customer={customer} userId={userId} accounts={accounts} projects={customerProjects} onClose={() => setPayment(null)} />}
      {projectFormOpen && <ProjectForm customerId={customer.id} userId={userId} onClose={() => setProjectFormOpen(false)} />}
      {confirmProjectId && <ConfirmDialog message="Bu işi/projeyi silmek istediğinize emin misiniz? (İşe bağlı hareketler silinmez, 'Genel' altında kalır.)" onConfirm={() => deleteRecord(userId, 'projects', confirmProjectId)} onClose={() => setConfirmProjectId(null)} />}
      {editTx && <TransactionForm customer={customer} existing={editTx} userId={userId} accounts={accounts} projects={customerProjects} onClose={() => setEditTx(null)} />}
      {confirmTxId && <ConfirmDialog message="Bu hareketi (tahsilat/ödeme) silmek istediğinize emin misiniz?" onConfirm={() => deleteRecord(userId, 'transactions', confirmTxId)} onClose={() => setConfirmTxId(null)} />}
    </div>
  );
}

export default function Customers({ data, userId }) {
  const { customers = [] } = data;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  const balances = useMemo(() => allCariBalances(data), [data]);

  const filtered = useMemo(
    () => customers.filter((c) => c.name?.toLowerCase().includes(search.toLowerCase())),
    [customers, search]
  );

  const totalReceivable = customers.reduce((s, c) => s + Math.max(0, balances[c.id] || 0), 0);
  const totalPayable = customers.reduce((s, c) => s + Math.max(0, -(balances[c.id] || 0)), 0);

  if (selected) {
    const fresh = customers.find((c) => c.id === selected.id) || selected;
    return <CustomerDetail customer={fresh} data={data} userId={userId} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <PageHeader title="Cari Hesaplar" subtitle="Müşteri ve tedarikçi hesaplarınız">
        <AddButton label="Yeni Cari" onClick={() => { setEditing(null); setFormOpen(true); }} />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Cari Sayısı" value={customers.length} icon={Users} color="text-sky-600" />
        <StatCard title="Toplam Alacak" value={formatCurrency(totalReceivable)} color="text-red-600" hint="Bizden alacaklı olduğumuz" />
        <StatCard title="Toplam Borç" value={formatCurrency(totalPayable)} color="text-green-600" hint="Bizim borçlu olduğumuz" />
      </div>

      <div className="mb-4">
        <Input placeholder="Cari ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState message="Cari hesap bulunamadı" />
        ) : (
          <Table headers={[{ label: 'Ünvan' }, { label: 'Tip' }, { label: 'Vergi/TCKN' }, { label: 'Telefon' }, { label: 'Bakiye', align: 'right' }, { label: '' }]}>
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <Td className="font-medium text-gray-900 cursor-pointer" onClick={() => setSelected(c)}>{c.name}</Td>
                <Td className="text-gray-500">{c.role === 'supplier' ? 'Tedarikçi' : c.role === 'both' ? 'Müşteri+Tedarikçi' : 'Müşteri'}</Td>
                <Td className="text-gray-500">{c.taxId || c.tcNo || '-'}</Td>
                <Td className="text-gray-500">{c.phone || '-'}</Td>
                <Td align="right">{balanceBadge(balances[c.id] || 0)}</Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => { setEditing(c); setFormOpen(true); }} className="p-2 rounded-full hover:bg-gray-200 text-gray-500"><Edit size={16} /></button>
                    <button onClick={() => setConfirmId(c.id)} className="p-2 rounded-full hover:bg-gray-200 text-red-500"><Trash2 size={16} /></button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {formOpen && <CustomerForm existing={editing} userId={userId} onClose={() => { setFormOpen(false); setEditing(null); }} />}
      {confirmId && <ConfirmDialog message="Bu cari hesabı silmek istediğinize emin misiniz?" onConfirm={() => deleteRecord(userId, 'customers', confirmId)} onClose={() => setConfirmId(null)} />}
    </div>
  );
}

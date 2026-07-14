// --- Cari Hesaplar (müşteri / tedarikçi) + işler/projeler + ekstre + tahsilat/ödeme ---
import React, { useState, useMemo } from 'react';
import {
  ArrowLeft, Edit, Trash2, Wallet, HandCoins, Download, Users, Briefcase, PlusCircle, DraftingCompass, Banknote,
  FolderKanban, HardHat, AudioLines, ListChecks, Link2, Unlink,
} from 'lucide-react';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatCurrency, formatDateShort, todayInput, toInputDate, toDate } from '../utils';
import { downloadExcel } from '../exportExcel';
import {
  cariMovements, allCariBalances,
  subcontractPaid, subcontractRemaining, contractorPaid, contractorRemaining,
} from '../finance';
import {
  PageHeader, AddButton, Card, Table, Td, Badge, EmptyState, StatCard,
  FormModal, ConfirmDialog, Button, Field, Input, Select, Textarea, ActionMenu,
} from '../components/ui';
import QuickEntry from '../components/QuickEntry';
import { BRANCHES } from './Authors';
import { TRADES } from './Contractors';
import { EntryForm as IncomeExpenseForm } from './CashFlow';
import { CategorySelect } from '../categories';

export const ROLE_OPTIONS = [
  { value: 'customer', label: 'Müşteri' },
  { value: 'supplier', label: 'Tedarikçi' },
  { value: 'both', label: 'Müşteri + Tedarikçi' },
  { value: 'kiraci', label: 'Kiracı' },
  { value: 'malsahibi', label: 'Mal Sahibi' },
  { value: 'apartman', label: 'İşyeri / Apartman Yönetimi' },
];
const roleLabel = (role) => ROLE_OPTIONS.find((r) => r.value === role)?.label || 'Müşteri';

// İş/proje türleri (her biri ayrı ikonla temsil edilir)
const JOB_TYPES = [
  { key: 'proje', label: 'Proje', icon: FolderKanban },
  { key: 'insaat', label: 'İnşaat', icon: HardHat },
  { key: 'akustik', label: 'Akustik Rapor', icon: AudioLines },
  { key: 'takip', label: 'İş Takibi', icon: ListChecks },
];
const jobTypeMeta = (key) => JOB_TYPES.find((j) => j.key === key) || JOB_TYPES[0];

// Bir cariye ait işler: sahibi olduğu işler + tedarikçi olarak bağlandığı mevcut işler
const getCustomerProjects = (customerId, data) => {
  const owned = (data.projects || []).filter((p) => p.customerId === customerId);
  const linkedIds = (data.projectLinks || []).filter((l) => l.customerId === customerId).map((l) => l.projectId);
  const linked = (data.projects || [])
    .filter((p) => linkedIds.includes(p.id) && p.customerId !== customerId)
    .map((p) => ({ ...p, _linked: true }));
  return [...owned, ...linked];
};

const balanceBadge = (bal) => {
  if (Math.abs(bal) < 0.01) return <Badge color="gray">Bakiye Yok</Badge>;
  return bal > 0
    ? <span className="font-semibold text-red-600">{formatCurrency(bal)} (B)</span>
    : <span className="font-semibold text-green-600">{formatCurrency(-bal)} (A)</span>;
};

const balanceText = (bal) =>
  bal >= 0 ? `${formatCurrency(bal)} Borç` : `${formatCurrency(-bal)} Alacak`;

// Cari/iş ekstresini Excel hesap dökümü olarak indirir (tutarlar gerçek sayı).
function exportLedgerExcel(heading, customer, rows, balance, showProject, filename) {
  const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const totalBorc = rows.reduce((s, r) => s + r.borc, 0);
  const totalAlacak = rows.reduce((s, r) => s + r.alacak, 0);
  const headers = ['Tarih', 'İşlem', 'Açıklama', ...(showProject ? ['İş/Proje'] : []), 'Borç', 'Alacak', 'Bakiye', 'Durum'];
  const dataRows = rows.map((r) => [
    formatDateShort(r.date), r.type,
    r.description + (r.category ? ` (${r.category})` : ''),
    ...(showProject ? [r.projectName || 'Genel'] : []),
    r.borc ? round(r.borc) : '', r.alacak ? round(r.alacak) : '',
    round(Math.abs(r.balance)), r.balance >= 0 ? 'Borç' : 'Alacak',
  ]);
  const totalRow = ['', 'TOPLAM', '', ...(showProject ? [''] : []), round(totalBorc), round(totalAlacak), round(Math.abs(balance)), balance >= 0 ? 'Borç' : 'Alacak'];
  downloadExcel(filename, [
    { heading },
    { rows: [
      ['Tarih', new Date().toLocaleDateString('tr-TR')],
      ['Cari', customer.name],
      ['Vergi/TCKN', customer.taxId || customer.tcNo || '-'],
      ['Genel Bakiye', round(Math.abs(balance))],
      ['Durum', balance >= 0 ? 'Borç (bizden alacaklı)' : 'Alacak (bize borçlu)'],
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
        <Field label="Cari Rolü"><Select name="role" value={form.role} onChange={set}>{ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</Select></Field>
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
    existing || { customerId, jobType: 'proje', name: '', description: '', address: '', status: 'active', openingBalance: 0, openingType: 'borc' }
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
        <Field label="İş Türü" className="md:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {JOB_TYPES.map((jt) => (
              <button
                key={jt.key}
                type="button"
                onClick={() => setForm({ ...form, jobType: jt.key })}
                className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors ${(form.jobType || 'proje') === jt.key ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                <jt.icon size={18} />
                {jt.label}
              </button>
            ))}
          </div>
        </Field>
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

// --- Tedarikçi için "Yeni İş": mevcut inşaat işleri arasından seçim + "Diğer İş" ---
// Aynı işin farklı carilerde ayrı ayrı (ve hataya açık şekilde) tekrar girilmesini
// önlemek için tedarikçi, projeyi yeniden oluşturmaz; var olan projeye bağlanır.
function JobLinkForm({ customer, data, userId, onClose, onOtherJob }) {
  const [selectedId, setSelectedId] = useState('');
  const already = new Set(getCustomerProjects(customer.id, data).map((p) => p.id));
  const options = (data.projects || [])
    .filter((p) => p.jobType === 'insaat' && !already.has(p.id))
    .map((p) => ({ ...p, _owner: (data.customers || []).find((c) => c.id === p.customerId)?.name || '' }));

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedId) return alert('Bir iş seçin.');
    try {
      await addRecord(userId, 'projectLinks', { projectId: selectedId, customerId: customer.id });
      onClose();
    } catch (err) { console.error(err); alert('Bağlantı kaydedilemedi.'); }
  };

  return (
    <FormModal title={`${customer.name} — Yeni İş`} onSubmit={submit} onClose={onClose} submitLabel="Bu İşe Bağla">
      <p className="text-sm text-gray-500 mb-3">
        Tedarikçi kayıtlarında aynı iş yeniden oluşturulmaz; mevcut inşaat işlerinden birine bağlanır.
        Böylece tüm cariler aynı işin tek kaydı üzerinden senkron takip edilir. Listede olmayan bir iş için <b>Diğer İş</b> seçeneğini kullanın.
      </p>
      {options.length === 0 ? (
        <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4 text-center">Bağlanabilecek kayıtlı bir inşaat işi yok.</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {options.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border text-left transition-colors ${selectedId === p.id ? 'bg-orange-50 border-orange-400' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
            >
              <HardHat size={17} className="text-orange-600 flex-shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-800 truncate">{p.name}</span>
                <span className="block text-xs text-gray-400 truncate">{p._owner}{p.address ? ` · ${p.address}` : ''}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => { onOtherJob(); onClose(); }}
        className="flex items-center gap-2 w-full px-3 py-2.5 mt-3 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 text-sm"
      >
        <PlusCircle size={16} />Diğer İş (listede yok, yeni iş oluştur)
      </button>
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
          <div className="text-sm bg-orange-50 text-orange-800 rounded-md p-2">İş: <b>{lockedProject?.name}</b></div>
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
        <p className="text-gray-600 text-sm">Önce <b>Müellifler</b> menüsünden mühendis ekleyin, sonra buradan projeye atayabilirsiniz.</p>
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

// --- Projeye taşeron yetkilendirme formu (müellifden ayrı) ---
function ContractorAssignForm({ project, subcontractors, userId, onClose }) {
  const [form, setForm] = useState({ contractorId: subcontractors[0]?.id || '', trade: subcontractors[0]?.trade || 'Kaba İnşaat', agreedAmount: '', note: '' });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const onContractor = (e) => {
    const c = subcontractors.find((x) => x.id === e.target.value);
    setForm((f) => ({ ...f, contractorId: e.target.value, trade: c?.trade || f.trade }));
  };
  const submit = async (e) => {
    e.preventDefault();
    const contractor = subcontractors.find((c) => c.id === form.contractorId);
    if (!contractor) return alert('Taşeron seçin.');
    try {
      await addRecord(userId, 'contractorAssignments', {
        projectId: project.id, customerId: project.customerId,
        contractorId: contractor.id, contractorName: contractor.name, trade: form.trade,
        agreedAmount: Number(form.agreedAmount) || 0, note: form.note,
      });
      onClose();
    } catch (err) { console.error(err); alert('Yetkilendirme kaydedilemedi.'); }
  };
  if (subcontractors.length === 0) {
    return (
      <FormModal title="Taşeron Yetkilendir" onSubmit={(e) => { e.preventDefault(); onClose(); }} onClose={onClose} submitLabel="Kapat">
        <p className="text-gray-600 text-sm">Önce <b>Taşeronlar</b> menüsünden taşeron ekleyin, sonra buradan işe yetkilendirebilirsiniz.</p>
      </FormModal>
    );
  }
  return (
    <FormModal title={`Taşeron Yetkilendir — ${project.name}`} onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4">
        <Field label="Taşeron"><Select name="contractorId" value={form.contractorId} onChange={onContractor}>{subcontractors.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.trade})</option>)}</Select></Field>
        <Field label="İş Kolu"><Select name="trade" value={form.trade} onChange={set}>{TRADES.map((b) => <option key={b}>{b}</option>)}</Select></Field>
        <Field label="Sözleşme Bedeli"><Input type="number" step="0.01" name="agreedAmount" value={form.agreedAmount} onChange={set} required /></Field>
        <Field label="Not"><Input name="note" value={form.note} onChange={set} /></Field>
      </div>
    </FormModal>
  );
}

// --- Taşerona ödeme formu ---
function ContractorPaymentForm({ assignment, userId, accounts, onClose }) {
  const remaining = assignment._remaining ?? 0;
  const [form, setForm] = useState({ amount: '', date: todayInput(), accountId: accounts[0]?.id || '', description: '' });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(form.amount) > 0)) return;
    try {
      await addRecord(userId, 'transactions', {
        type: 'odeme', direction: 'out',
        contractorId: assignment.contractorId, contractorName: assignment.contractorName,
        contractorAssignmentId: assignment.id, projectId: assignment.projectId,
        amount: Number(form.amount), accountId: form.accountId || null,
        description: form.description || `Taşeron ödemesi - ${assignment.contractorName}`,
        date: Timestamp.fromDate(new Date(form.date)),
      });
      onClose();
    } catch (err) { console.error(err); alert('Ödeme kaydedilemedi.'); }
  };
  return (
    <FormModal title={`Taşeron Ödemesi — ${assignment.contractorName}`} onSubmit={submit} onClose={onClose}>
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
          <button type="button" key={k} onClick={() => setForm((f) => ({ ...f, action: k }))} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${form.action === k ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
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
// Ekstredeki hangi kayıt türlerinin doğrudan düzenlenip silinebileceği.
// Fatura ve çek/senet kendi sayfalarında (Faturalar / Çek & Senet) yönetilir.
const EDITABLE_REF_KINDS = ['transaction', 'income', 'expense'];

function LedgerTable({ rows, showProject, onEdit, onDelete }) {
  const actions = !!(onEdit || onDelete);
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
              {EDITABLE_REF_KINDS.includes(r.ref?.kind) ? (
                <ActionMenu
                  items={[
                    { label: 'Düzenle', icon: Edit, onClick: () => onEdit(r.ref) },
                    { label: 'Sil', icon: Trash2, danger: true, onClick: () => onDelete(r.ref) },
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
  const { accounts = [], authors = [], subcontractors = [] } = data;
  const [editOpen, setEditOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [payFor, setPayFor] = useState(null);
  const [confirmSubId, setConfirmSubId] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [confirmTxId, setConfirmTxId] = useState(null);
  const [editIncomeExpense, setEditIncomeExpense] = useState(null); // { kind, record }
  const [confirmIncomeExpense, setConfirmIncomeExpense] = useState(null); // { kind, id }
  const customerProjects = getCustomerProjects(customer.id, data);
  const txById = (id) => (data.transactions || []).find((t) => t.id === id);
  const JobIcon = jobTypeMeta(project.jobType).icon;
  const isConstruction = project.jobType === 'insaat';

  const handleLedgerEdit = (ref) => {
    if (ref.kind === 'transaction') setEditTx(txById(ref.id));
    else if (ref.kind === 'income') setEditIncomeExpense({ kind: 'incomes', record: (data.incomes || []).find((x) => x.id === ref.id) });
    else if (ref.kind === 'expense') setEditIncomeExpense({ kind: 'expenses', record: (data.expenses || []).find((x) => x.id === ref.id) });
  };
  const handleLedgerDelete = (ref) => {
    if (ref.kind === 'transaction') setConfirmTxId(ref.id);
    else if (ref.kind === 'income') setConfirmIncomeExpense({ kind: 'incomes', id: ref.id });
    else if (ref.kind === 'expense') setConfirmIncomeExpense({ kind: 'expenses', id: ref.id });
  };

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

  const contractorAssigns = useMemo(
    () => (data.contractorAssignments || [])
      .filter((c) => c.projectId === project.id)
      .map((c) => ({ ...c, _paid: contractorPaid(c.id, data), _remaining: contractorRemaining(c, data) })),
    [data, project.id]
  );
  const conAgreed = contractorAssigns.reduce((s, x) => s + (Number(x.agreedAmount) || 0), 0);
  const conPaid = contractorAssigns.reduce((s, x) => s + x._paid, 0);
  const conRemaining = conAgreed - conPaid;

  // Bu işe tedarikçi olarak bağlı cariler + hareketleri (tek işin tüm taraflarda senkron görünmesi)
  const linkedRows = useMemo(() => {
    if (!isConstruction) return [];
    const linkedCustomerIds = (data.projectLinks || [])
      .filter((l) => l.projectId === project.id)
      .map((l) => l.customerId);
    const out = [];
    linkedCustomerIds.forEach((cid) => {
      const partyName = (data.customers || []).find((c) => c.id === cid)?.name || '';
      const { rows: r } = cariMovements(cid, data, project.id);
      r.forEach((row) => out.push({ ...row, partyName }));
    });
    return out.sort((a, b) => (toDate(a.date)?.getTime() || 0) - (toDate(b.date)?.getTime() || 0));
  }, [isConstruction, data, project.id]);

  return (
    <div>
      <button onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-4"><ArrowLeft size={16} className="mr-1" />{customer.name} işlerine dön</button>
      <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><JobIcon size={22} className="text-orange-600" />{project.name}</h1>
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

      {/* İnşaat işlerinde Taşeronlar, diğer iş türlerinde Müellifler (ayrı kayıtlar) */}
      {isConstruction ? (
        <Card title="Taşeronlar" className="mb-6" actions={<Button icon={PlusCircle} onClick={() => setSubOpen(true)}>Taşeron Yetkilendir</Button>}>
          {contractorAssigns.length === 0 ? (
            <EmptyState message="Bu işe yetkilendirilmiş taşeron yok. İş kollarına göre taşeron yetkilendirin." icon={HardHat} />
          ) : (
            <>
              <Table headers={[{ label: 'Taşeron' }, { label: 'İş Kolu' }, { label: 'Sözleşme', align: 'right' }, { label: 'Ödenen', align: 'right' }, { label: 'Kalan', align: 'right' }, { label: '' }]}>
                {contractorAssigns.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <Td className="font-medium text-gray-900">{s.contractorName}</Td>
                    <Td><Badge color="sky">{s.trade}</Badge></Td>
                    <Td align="right" className="text-gray-700">{formatCurrency(s.agreedAmount)}</Td>
                    <Td align="right" className="text-green-600">{formatCurrency(s._paid)}</Td>
                    <Td align="right" className={`font-semibold ${s._remaining > 0.01 ? 'text-red-600' : 'text-gray-500'}`}>{formatCurrency(s._remaining)}</Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1">
                        <button title="Ödeme yap" onClick={() => setPayFor(s)} className="p-2 rounded-full hover:bg-gray-200 text-green-600"><Banknote size={16} /></button>
                        <button title="Yetkilendirmeyi sil" onClick={() => setConfirmSubId(s.id)} className="p-2 rounded-full hover:bg-gray-200 text-red-500"><Trash2 size={16} /></button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </Table>
              <div className="flex flex-wrap gap-6 justify-end px-4 py-3 border-t text-sm">
                <span className="text-gray-500">Toplam Sözleşme: <b className="text-gray-800">{formatCurrency(conAgreed)}</b></span>
                <span className="text-gray-500">Ödenen: <b className="text-green-600">{formatCurrency(conPaid)}</b></span>
                <span className="text-gray-500">Kalan Borç: <b className="text-red-600">{formatCurrency(conRemaining)}</b></span>
              </div>
            </>
          )}
        </Card>
      ) : (
        <Card title="Müellifler" className="mb-6" actions={<Button icon={PlusCircle} onClick={() => setSubOpen(true)}>Müellif Ata</Button>}>
          {subs.length === 0 ? (
            <EmptyState message="Bu işe atanmış müellif yok. Projelendirme branşlarına göre müellif atayın." icon={DraftingCompass} />
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
      )}

      {isConstruction && linkedRows.length > 0 && (
        <Card title="Bağlı Tedarikçi Hareketleri (bu iş)" className="mb-6">
          <p className="px-6 pt-4 text-xs text-gray-400">Bu işe tedarikçi olarak bağlanan carilerin, aynı iş kaydı üzerinden işlenen hareketleri.</p>
          <Table headers={[{ label: 'Tarih' }, { label: 'Cari' }, { label: 'İşlem' }, { label: 'Açıklama' }, { label: 'Borç', align: 'right' }, { label: 'Alacak', align: 'right' }]}>
            {linkedRows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <Td className="text-gray-500">{formatDateShort(r.date)}</Td>
                <Td className="font-medium text-gray-700">{r.partyName}</Td>
                <Td><Badge color={r.borc ? 'red' : 'green'}>{r.type}</Badge></Td>
                <Td className="text-gray-600">{r.description}</Td>
                <Td align="right" className="text-red-600">{r.borc ? formatCurrency(r.borc) : '-'}</Td>
                <Td align="right" className="text-green-600">{r.alacak ? formatCurrency(r.alacak) : '-'}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Card title="Müşteri Hesap Ekstresi (bu iş)">
        {rows.length === 0 ? <EmptyState message="Bu iş için henüz hareket yok" /> : (
          <LedgerTable rows={rows} showProject={false} onEdit={handleLedgerEdit} onDelete={handleLedgerDelete} />
        )}
      </Card>

      {editOpen && <ProjectForm customerId={customer.id} existing={project} userId={userId} onClose={() => setEditOpen(false)} />}
      {subOpen && (
        isConstruction
          ? <ContractorAssignForm project={project} subcontractors={subcontractors} userId={userId} onClose={() => setSubOpen(false)} />
          : <SubcontractForm project={project} authors={authors} userId={userId} onClose={() => setSubOpen(false)} />
      )}
      {payFor && (
        isConstruction
          ? <ContractorPaymentForm assignment={payFor} userId={userId} accounts={accounts} onClose={() => setPayFor(null)} />
          : <AuthorPaymentForm subcontract={payFor} userId={userId} accounts={accounts} onClose={() => setPayFor(null)} />
      )}
      {confirmSubId && (
        <ConfirmDialog
          message={`Bu ${isConstruction ? 'taşeron yetkilendirmesini' : 'müellif atamasını'} silmek istediğinize emin misiniz? (Yapılan ödemeler silinmez.)`}
          onConfirm={() => deleteRecord(userId, isConstruction ? 'contractorAssignments' : 'subcontracts', confirmSubId)}
          onClose={() => setConfirmSubId(null)}
        />
      )}
      {editTx && <TransactionForm customer={customer} existing={editTx} userId={userId} accounts={accounts} projects={customerProjects} onClose={() => setEditTx(null)} />}
      {confirmTxId && <ConfirmDialog message="Bu hareketi (tahsilat/ödeme) silmek istediğinize emin misiniz?" onConfirm={() => deleteRecord(userId, 'transactions', confirmTxId)} onClose={() => setConfirmTxId(null)} />}
      {editIncomeExpense && (
        <IncomeExpenseForm
          kind={editIncomeExpense.kind}
          existing={editIncomeExpense.record}
          existingList={[]}
          userId={userId}
          accounts={accounts}
          customers={data.customers || []}
          projects={data.projects || []}
          subcontractors={data.subcontractors || []}
          onClose={() => setEditIncomeExpense(null)}
        />
      )}
      {confirmIncomeExpense && (
        <ConfirmDialog
          message={`Bu ${confirmIncomeExpense.kind === 'incomes' ? 'geliri' : 'gideri'} silmek istediğinize emin misiniz?`}
          onConfirm={() => deleteRecord(userId, confirmIncomeExpense.kind, confirmIncomeExpense.id)}
          onClose={() => setConfirmIncomeExpense(null)}
        />
      )}
    </div>
  );
}

// --- Cari detay / ekstre + işler listesi ---
function CustomerDetail({ customer, data, userId, onBack }) {
  const { accounts = [] } = data;
  const [payment, setPayment] = useState(null);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [confirmProjectId, setConfirmProjectId] = useState(null);
  const [confirmUnlinkId, setConfirmUnlinkId] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [confirmTxId, setConfirmTxId] = useState(null);
  const [editIncomeExpense, setEditIncomeExpense] = useState(null); // { kind, record }
  const [confirmIncomeExpense, setConfirmIncomeExpense] = useState(null); // { kind, id }
  const txById = (id) => (data.transactions || []).find((t) => t.id === id);
  const isSupplierRole = customer.role === 'supplier' || customer.role === 'both';

  const handleLedgerEdit = (ref) => {
    if (ref.kind === 'transaction') setEditTx(txById(ref.id));
    else if (ref.kind === 'income') setEditIncomeExpense({ kind: 'incomes', record: (data.incomes || []).find((x) => x.id === ref.id) });
    else if (ref.kind === 'expense') setEditIncomeExpense({ kind: 'expenses', record: (data.expenses || []).find((x) => x.id === ref.id) });
  };
  const handleLedgerDelete = (ref) => {
    if (ref.kind === 'transaction') setConfirmTxId(ref.id);
    else if (ref.kind === 'income') setConfirmIncomeExpense({ kind: 'incomes', id: ref.id });
    else if (ref.kind === 'expense') setConfirmIncomeExpense({ kind: 'expenses', id: ref.id });
  };

  const customerProjects = useMemo(() => getCustomerProjects(customer.id, data), [data, customer.id]);
  // Not: customerProjectBalances yalnızca sahip olunan işleri hesaplar; bağlı (tedarikçi) işler
  // için bu carinin KENDİ bakiyesi gerektiğinden burada doğrudan cariMovements kullanılır.
  const projectBalances = useMemo(() => {
    const map = {};
    customerProjects.forEach((p) => { map[p.id] = cariMovements(customer.id, data, p.id).balance; });
    return map;
  }, [customerProjects, customer.id, data]);
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
      <Card
        title="İşler / Projeler"
        className="mb-6"
        actions={<Button icon={PlusCircle} onClick={() => (isSupplierRole ? setLinkFormOpen(true) : setProjectFormOpen(true))}>Yeni İş</Button>}
      >
        {customerProjects.length === 0 ? (
          <EmptyState message="Bu cariye ait iş/proje yok. Farklı arsa/işleri ayrı takip etmek için 'Yeni İş' ekleyin." icon={Briefcase} />
        ) : (
          <Table headers={[{ label: 'İş / Proje' }, { label: 'Adres' }, { label: 'Durum' }, { label: 'Bakiye', align: 'right' }, { label: '' }]}>
            {customerProjects.map((p) => {
              const PIcon = jobTypeMeta(p.jobType).icon;
              const linkDoc = p._linked ? (data.projectLinks || []).find((l) => l.projectId === p.id && l.customerId === customer.id) : null;
              return (
              <tr key={p.id} className="hover:bg-gray-50">
                <Td className="font-medium text-gray-900 cursor-pointer" onClick={() => setSelectedProject(p)}>
                  <span className="flex items-center gap-2">
                    <PIcon size={15} className="text-orange-600" />
                    {p.name}
                    {p._linked && <span title="Başka bir cariye ait, tedarikçi olarak bağlısınız" className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600"><Link2 size={10} />Bağlı</span>}
                  </span>
                </Td>
                <Td className="text-gray-500">{p.address || '-'}</Td>
                <Td><Badge color={p.status === 'done' ? 'green' : p.status === 'paused' ? 'yellow' : 'sky'}>{p.status === 'done' ? 'Tamamlandı' : p.status === 'paused' ? 'Beklemede' : 'Devam Ediyor'}</Badge></Td>
                <Td align="right">{balanceBadge(projectBalances[p.id] || 0)}</Td>
                <Td align="right">
                  {p._linked ? (
                    <button title="Bağlantıyı kaldır" onClick={() => setConfirmUnlinkId(linkDoc?.id)} className="p-2 rounded-full hover:bg-gray-200 text-gray-500"><Unlink size={16} /></button>
                  ) : (
                    <button title="İşi sil" onClick={() => setConfirmProjectId(p.id)} className="p-2 rounded-full hover:bg-gray-200 text-red-500"><Trash2 size={16} /></button>
                  )}
                </Td>
              </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Card title="Genel Hesap Ekstresi">
        {rows.length === 0 ? (
          <EmptyState message="Bu cari için henüz hareket yok" />
        ) : (
          <LedgerTable rows={rows} showProject={customerProjects.length > 0} onEdit={handleLedgerEdit} onDelete={handleLedgerDelete} />
        )}
      </Card>

      {payment && <PaymentForm type={payment === 'tahsilat' ? 'tahsilat' : 'odeme'} customer={customer} userId={userId} accounts={accounts} projects={customerProjects} onClose={() => setPayment(null)} />}
      {projectFormOpen && <ProjectForm customerId={customer.id} userId={userId} onClose={() => setProjectFormOpen(false)} />}
      {linkFormOpen && (
        <JobLinkForm
          customer={customer}
          data={data}
          userId={userId}
          onClose={() => setLinkFormOpen(false)}
          onOtherJob={() => setProjectFormOpen(true)}
        />
      )}
      {confirmProjectId && <ConfirmDialog message="Bu işi/projeyi silmek istediğinize emin misiniz? (İşe bağlı hareketler silinmez, 'Genel' altında kalır.)" onConfirm={() => deleteRecord(userId, 'projects', confirmProjectId)} onClose={() => setConfirmProjectId(null)} />}
      {confirmUnlinkId && <ConfirmDialog message="Bu işe olan bağlantınız kaldırılsın mı? (İş kaydı silinmez, sadece bu cariden bağlantısı kesilir.)" onConfirm={() => deleteRecord(userId, 'projectLinks', confirmUnlinkId)} onClose={() => setConfirmUnlinkId(null)} />}
      {editTx && <TransactionForm customer={customer} existing={editTx} userId={userId} accounts={accounts} projects={customerProjects} onClose={() => setEditTx(null)} />}
      {confirmTxId && <ConfirmDialog message="Bu hareketi (tahsilat/ödeme) silmek istediğinize emin misiniz?" onConfirm={() => deleteRecord(userId, 'transactions', confirmTxId)} onClose={() => setConfirmTxId(null)} />}
      {editIncomeExpense && (
        <IncomeExpenseForm
          kind={editIncomeExpense.kind}
          existing={editIncomeExpense.record}
          existingList={[]}
          userId={userId}
          accounts={accounts}
          customers={data.customers || []}
          projects={data.projects || []}
          subcontractors={data.subcontractors || []}
          onClose={() => setEditIncomeExpense(null)}
        />
      )}
      {confirmIncomeExpense && (
        <ConfirmDialog
          message={`Bu ${confirmIncomeExpense.kind === 'incomes' ? 'geliri' : 'gideri'} silmek istediğinize emin misiniz?`}
          onConfirm={() => deleteRecord(userId, confirmIncomeExpense.kind, confirmIncomeExpense.id)}
          onClose={() => setConfirmIncomeExpense(null)}
        />
      )}
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
        <StatCard title="Cari Sayısı" value={customers.length} icon={Users} color="text-orange-600" />
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
                <Td className="text-gray-500">{roleLabel(c.role)}</Td>
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

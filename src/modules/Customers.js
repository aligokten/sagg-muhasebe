// --- Cari Hesaplar (müşteri / tedarikçi) + işler/projeler + ekstre + tahsilat/ödeme ---
import React, { useState, useMemo } from 'react';
import { ArrowLeft, Edit, Trash2, Wallet, HandCoins, Printer, Users, Briefcase, PlusCircle } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatCurrency, formatDateShort, todayInput } from '../utils';
import { cariMovements, allCariBalances, customerProjectBalances } from '../finance';
import {
  PageHeader, AddButton, Card, Table, Td, Badge, EmptyState, StatCard,
  FormModal, ConfirmDialog, Button, Field, Input, Select, Textarea,
} from '../components/ui';

const balanceBadge = (bal) => {
  if (Math.abs(bal) < 0.01) return <Badge color="gray">Bakiye Yok</Badge>;
  return bal > 0
    ? <span className="font-semibold text-red-600">{formatCurrency(bal)} (B)</span>
    : <span className="font-semibold text-green-600">{formatCurrency(-bal)} (A)</span>;
};

const balanceText = (bal) =>
  bal >= 0 ? `${formatCurrency(bal)} Borç` : `${formatCurrency(-bal)} Alacak`;

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
    method: 'Nakit', description: '', projectId: lockedProjectId || '',
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
        description: form.description || (isCollect ? 'Tahsilat' : 'Ödeme'),
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
        <Field label="Kasa / Banka"><Select name="accountId" value={form.accountId} onChange={set}><option value="">Belirtilmedi</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Ödeme Şekli"><Select name="method" value={form.method} onChange={set}><option>Nakit</option><option>Havale/EFT</option><option>Kredi Kartı</option><option>Çek</option><option>Senet</option></Select></Field>
        <Field label="Açıklama"><Input name="description" value={form.description} onChange={set} /></Field>
      </div>
    </FormModal>
  );
}

// --- Ekstre tablosu (cari ya da proje) ---
function LedgerTable({ rows, showProject }) {
  const headers = [
    { label: 'Tarih' }, { label: 'İşlem' }, { label: 'Açıklama' },
    ...(showProject ? [{ label: 'İş/Proje' }] : []),
    { label: 'Borç', align: 'right' }, { label: 'Alacak', align: 'right' }, { label: 'Bakiye', align: 'right' },
  ];
  return (
    <Table headers={headers}>
      {rows.map((r, i) => (
        <tr key={i} className="hover:bg-gray-50">
          <Td className="text-gray-500">{formatDateShort(r.date)}</Td>
          <Td><Badge color={r.borc ? 'red' : 'green'}>{r.type}</Badge></Td>
          <Td className="text-gray-600">{r.description}</Td>
          {showProject && <Td className="text-gray-500">{r.projectName || <span className="text-gray-300">Genel</span>}</Td>}
          <Td align="right" className="text-red-600">{r.borc ? formatCurrency(r.borc) : '-'}</Td>
          <Td align="right" className="text-green-600">{r.alacak ? formatCurrency(r.alacak) : '-'}</Td>
          <Td align="right" className="font-semibold text-gray-800">{formatCurrency(Math.abs(r.balance))} {r.balance >= 0 ? '(B)' : '(A)'}</Td>
        </tr>
      ))}
    </Table>
  );
}

// --- İş / Proje detay (proje bazlı ekstre) ---
function ProjectLedger({ customer, project, data, userId, onBack }) {
  const { accounts = [], projects = [] } = data;
  const [payment, setPayment] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const { rows, balance } = useMemo(() => cariMovements(customer.id, data, project.id), [customer, project, data]);
  const totalBorc = rows.reduce((s, r) => s + r.borc, 0);
  const totalAlacak = rows.reduce((s, r) => s + r.alacak, 0);

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
          <Button icon={Wallet} variant="success" onClick={() => setPayment('tahsilat')}>Tahsilat</Button>
          <Button icon={HandCoins} variant="danger" onClick={() => setPayment('odeme')}>Ödeme</Button>
          <Button icon={Edit} variant="secondary" onClick={() => setEditOpen(true)}>Düzenle</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Toplam Borç" value={formatCurrency(totalBorc)} color="text-red-600" />
        <StatCard title="Toplam Alacak" value={formatCurrency(totalAlacak)} color="text-green-600" />
        <StatCard title="İş Bakiyesi" value={balanceText(balance)} color={balance >= 0 ? 'text-red-600' : 'text-green-600'} />
      </div>

      <Card title="İş Ekstresi">
        {rows.length === 0 ? <EmptyState message="Bu iş için henüz hareket yok" /> : <LedgerTable rows={rows} showProject={false} />}
      </Card>

      {payment && <PaymentForm type={payment === 'tahsilat' ? 'tahsilat' : 'odeme'} customer={customer} userId={userId} accounts={accounts} projects={projects.filter((p) => p.customerId === customer.id)} lockedProjectId={project.id} onClose={() => setPayment(null)} />}
      {editOpen && <ProjectForm customerId={customer.id} existing={project} userId={userId} onClose={() => setEditOpen(false)} />}
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

  const customerProjects = useMemo(() => projects.filter((p) => p.customerId === customer.id), [projects, customer.id]);
  const projectBalances = useMemo(() => customerProjectBalances(customer.id, data), [customer.id, data]);
  const { rows, balance } = useMemo(() => cariMovements(customer.id, data), [customer, data]);

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
          <Button icon={Printer} variant="secondary" onClick={() => window.print()}>Yazdır</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Toplam Borç" value={formatCurrency(totalBorc)} color="text-red-600" />
        <StatCard title="Toplam Alacak" value={formatCurrency(totalAlacak)} color="text-green-600" />
        <StatCard title="Genel Bakiye" value={balanceText(balance)} color={balance >= 0 ? 'text-red-600' : 'text-green-600'} />
      </div>

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
          <LedgerTable rows={rows} showProject={customerProjects.length > 0} />
        )}
      </Card>

      {payment && <PaymentForm type={payment === 'tahsilat' ? 'tahsilat' : 'odeme'} customer={customer} userId={userId} accounts={accounts} projects={customerProjects} onClose={() => setPayment(null)} />}
      {projectFormOpen && <ProjectForm customerId={customer.id} userId={userId} onClose={() => setProjectFormOpen(false)} />}
      {confirmProjectId && <ConfirmDialog message="Bu işi/projeyi silmek istediğinize emin misiniz? (İşe bağlı hareketler silinmez, 'Genel' altında kalır.)" onConfirm={() => deleteRecord(userId, 'projects', confirmProjectId)} onClose={() => setConfirmProjectId(null)} />}
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

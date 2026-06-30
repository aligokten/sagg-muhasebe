// --- Teklifler (müellif bazlı) ---
// Cari seçilir, her satıra bir müellif + ücreti girilir. Kaydedince
// cariye yeni bir İş/Proje açılır ve müellifler o işe sözleşme bedeliyle atanır.
import React, { useState, useMemo } from 'react';
import { X, Trash2, FileText, Eye, Briefcase, DraftingCompass, Edit } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatCurrency, sum, nextDocNumber, todayInput, toInputDate } from '../utils';
import {
  PageHeader, AddButton, Card, Table, Td, Badge, EmptyState, StatCard,
  ConfirmDialog, Button, Field, Input, Select, ActionMenu,
} from '../components/ui';
import PrintView from '../components/PrintView';
import { BRANCHES } from './Authors';

const statusMeta = {
  pending: { label: 'Bekliyor', color: 'yellow' },
  accepted: { label: 'Kabul Edildi', color: 'green' },
  rejected: { label: 'Reddedildi', color: 'red' },
};

const emptyLine = () => ({ authorId: '', branch: '', description: '', amount: '' });

function QuoteForm({ existing, records, customers, authors, subcontracts = [], userId, onClose }) {
  const [form, setForm] = useState(() => existing ? {
    customerId: existing.customerId || '',
    projectName: existing.projectName || '',
    docNumber: existing.docNumber || '',
    date: toInputDate(existing.date),
    validUntil: toInputDate(existing.validUntil || existing.date),
    note: existing.note || '',
    lines: (existing.lines || []).map((l) => ({ authorId: l.authorId || '', branch: l.branch || '', description: l.description || '', amount: l.amount ?? '' })),
  } : {
    customerId: '',
    projectName: '',
    docNumber: nextDocNumber(records, 'TK'),
    date: todayInput(),
    validUntil: todayInput(),
    note: '',
    lines: [emptyLine()],
  });
  const [saving, setSaving] = useState(false);
  const setField = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleLine = (idx, field, value) => {
    setForm((f) => {
      const lines = [...f.lines];
      lines[idx] = { ...lines[idx], [field]: value };
      if (field === 'authorId') {
        const a = authors.find((x) => x.id === value);
        if (a && !lines[idx].branch) lines[idx].branch = a.branch || '';
      }
      return { ...f, lines };
    });
  };
  const addLine = () => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
  const removeLine = (idx) => setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));

  const total = useMemo(() => sum(form.lines, (l) => l.amount), [form.lines]);

  const submit = async (e) => {
    e.preventDefault();
    const customer = customers.find((c) => c.id === form.customerId);
    if (!customer) return alert('Lütfen cari seçin.');
    if (!form.projectName.trim()) return alert('Lütfen iş/proje adı girin.');
    const validLines = form.lines
      .filter((l) => l.authorId && Number(l.amount) > 0)
      .map((l) => {
        const a = authors.find((x) => x.id === l.authorId);
        return { authorId: l.authorId, authorName: a?.name || '', branch: l.branch || a?.branch || '', description: l.description || '', amount: Number(l.amount) };
      });
    if (validLines.length === 0) return alert('En az bir müellif satırı ekleyin (müellif + ücret).');

    setSaving(true);
    try {
      if (existing) {
        // DÜZENLEME: teklif kaydını güncelle
        await updateRecord(userId, 'quotes', existing.id, {
          projectName: form.projectName.trim(),
          date: Timestamp.fromDate(new Date(form.date)),
          validUntil: Timestamp.fromDate(new Date(form.validUntil)),
          note: form.note, lines: validLines, grandTotal: total,
        });
        // Bağlı işi ve müellif atamalarını eşitle (authorId ile eşleştir)
        if (existing.createdProjectId) {
          await updateRecord(userId, 'projects', existing.createdProjectId, { name: form.projectName.trim() });
          const projSubs = subcontracts.filter((s) => s.projectId === existing.createdProjectId);
          await Promise.all(validLines.map((l) => {
            const match = projSubs.find((s) => s.authorId === l.authorId);
            if (match) {
              return updateRecord(userId, 'subcontracts', match.id, { agreedAmount: l.amount, branch: l.branch, note: l.description, authorName: l.authorName });
            }
            return addRecord(userId, 'subcontracts', {
              projectId: existing.createdProjectId, customerId: customer.id,
              authorId: l.authorId, authorName: l.authorName, branch: l.branch,
              agreedAmount: l.amount, note: l.description,
            });
          }));
        }
        onClose();
        return;
      }

      // YENİ: cariye iş aç + müellifleri ata + teklif kaydı oluştur
      const projectRef = await addRecord(userId, 'projects', {
        customerId: customer.id, name: form.projectName.trim(),
        description: `Teklif ${form.docNumber} ile oluşturuldu`, address: '',
        status: 'active', openingBalance: 0, openingType: 'borc',
      });
      await Promise.all(validLines.map((l) =>
        addRecord(userId, 'subcontracts', {
          projectId: projectRef.id, customerId: customer.id,
          authorId: l.authorId, authorName: l.authorName, branch: l.branch,
          agreedAmount: l.amount, note: l.description,
        })
      ));
      await addRecord(userId, 'quotes', {
        docNumber: form.docNumber, customerId: customer.id, customerSnapshot: customer,
        projectName: form.projectName.trim(), createdProjectId: projectRef.id,
        date: Timestamp.fromDate(new Date(form.date)),
        validUntil: Timestamp.fromDate(new Date(form.validUntil)),
        note: form.note, lines: validLines, grandTotal: total, status: 'pending',
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Teklif kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const noAuthors = authors.length === 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8">
        <form onSubmit={submit}>
          <div className="p-5 border-b flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-800">{existing ? 'Teklif Düzenle' : 'Yeni Teklif (Müellif Bazlı)'}</h3>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X /></button>
          </div>

          <div className="p-5">
            {noAuthors && (
              <div className="mb-4 text-sm bg-amber-50 text-amber-700 rounded-md p-3">
                Önce <b>Müellifler</b> menüsünden mühendis/taşeron ekleyin. Satırlarda müellif seçebilmek için en az bir müellif gerekir.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Field label="Cari Hesap" className="lg:col-span-2">
                <Select name="customerId" value={form.customerId} onChange={setField} required disabled={!!existing}>
                  <option value="">Seçiniz...</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="İş / Proje Adı" className="lg:col-span-2">
                <Input name="projectName" value={form.projectName} onChange={setField} placeholder="örn. Bağdat Cd. Apartmanı" required />
              </Field>
              <Field label="Teklif No"><Input name="docNumber" value={form.docNumber} onChange={setField} required readOnly={!!existing} /></Field>
              <Field label="Tarih"><Input type="date" name="date" value={form.date} onChange={setField} required /></Field>
              <Field label="Geçerlilik"><Input type="date" name="validUntil" value={form.validUntil} onChange={setField} /></Field>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-gray-600 mb-3">Müellif Satırları</h4>
              <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 uppercase mb-1 px-1">
                <span className="col-span-4">Müellif</span>
                <span className="col-span-3">Branş / İş</span>
                <span className="col-span-3">Açıklama</span>
                <span className="col-span-2 text-right">Ücret</span>
              </div>
              {form.lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-center">
                  <Select className="col-span-12 md:col-span-4" value={line.authorId} onChange={(e) => handleLine(idx, 'authorId', e.target.value)}>
                    <option value="">Müellif seç</option>
                    {authors.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.branch})</option>)}
                  </Select>
                  <Select className="col-span-5 md:col-span-3" value={line.branch} onChange={(e) => handleLine(idx, 'branch', e.target.value)}>
                    <option value="">Branş</option>
                    {BRANCHES.map((b) => <option key={b}>{b}</option>)}
                  </Select>
                  <Input className="col-span-7 md:col-span-3" placeholder="Açıklama" value={line.description} onChange={(e) => handleLine(idx, 'description', e.target.value)} />
                  <Input className="col-span-10 md:col-span-2 text-right" type="number" step="0.01" placeholder="Ücret" value={line.amount} onChange={(e) => handleLine(idx, 'amount', e.target.value)} />
                  <button type="button" onClick={() => removeLine(idx)} className="col-span-2 md:col-span-12 md:hidden text-red-500 text-sm">Kaldır</button>
                  <button type="button" onClick={() => removeLine(idx)} className="hidden md:flex col-span-12 justify-end -mt-8 text-red-400 hover:text-red-600"><X size={16} /></button>
                </div>
              ))}
              <button type="button" onClick={addLine} className="text-sm font-medium text-orange-600 hover:text-orange-800 mt-2">+ Müellif Satırı Ekle</button>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Not / Açıklama">
                <textarea name="note" value={form.note} onChange={setField} className="p-2 border border-gray-300 rounded-md h-20 outline-none focus:ring-2 focus:ring-orange-500" />
              </Field>
              <div className="self-end flex justify-between font-bold text-xl text-gray-800 border-t pt-2">
                <span>Toplam Teklif:</span><span>{formatCurrency(total)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Kaydedince <b>{form.projectName || 'iş'}</b> adlı iş cariye açılır ve müellifler bu işe sözleşme bedeliyle atanır.</p>
          </div>

          <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
            <Button type="button" variant="secondary" onClick={onClose}>İptal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Quotes({ data, userId }) {
  const { quotes = [], customers = [], authors = [], subcontracts = [], companyProfile, scriptsLoaded } = data;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const list = useMemo(() => [...quotes].sort((a, b) => (b.docNumber || '').localeCompare(a.docNumber || '')), [quotes]);
  const accepted = sum(list.filter((q) => q.status === 'accepted'), (q) => q.grandTotal);

  const printable = viewing && {
    ...viewing,
    dueDate: viewing.validUntil,
    items: (viewing.lines || []).map((l) => ({
      description: `${l.branch || ''}${l.description ? ' - ' + l.description : ''}`.trim() || 'Hizmet',
      quantity: 1, unit: '', unitPrice: l.amount, discount: 0, vatRate: 0,
    })),
    subTotal: viewing.grandTotal, discountTotal: 0, vatTotal: 0,
  };

  return (
    <div>
      <PageHeader title="Teklifler" subtitle="Müellif bazlı teklif hazırlayın; kaydedince cariye iş olarak işlenir">
        <AddButton label="Yeni Teklif" onClick={() => { setEditing(null); setFormOpen(true); }} />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Teklif Sayısı" value={list.length} icon={FileText} color="text-orange-600" />
        <StatCard title="Toplam Tutar" value={formatCurrency(sum(list, (q) => q.grandTotal))} color="text-gray-700" />
        <StatCard title="Kabul Edilen" value={formatCurrency(accepted)} color="text-green-600" />
      </div>

      <Card>
        {list.length === 0 ? (
          <EmptyState message="Henüz teklif yok" icon={DraftingCompass} />
        ) : (
          <Table headers={[{ label: 'Teklif No' }, { label: 'Cari' }, { label: 'İş / Proje' }, { label: 'Müellif' }, { label: 'Durum' }, { label: 'Tutar', align: 'right' }, { label: '' }]}>
            {list.map((q) => {
              const st = statusMeta[q.status || 'pending'];
              return (
                <tr key={q.id} className="hover:bg-gray-50">
                  <Td className="font-medium text-gray-900 cursor-pointer" onClick={() => setViewing(q)}>{q.docNumber}</Td>
                  <Td className="text-gray-500">{q.customerSnapshot?.name}</Td>
                  <Td className="text-gray-600"><span className="flex items-center gap-1"><Briefcase size={14} className="text-orange-500" />{q.projectName || '-'}</span></Td>
                  <Td className="text-gray-500">{(q.lines || []).length} müellif</Td>
                  <Td><Badge color={st.color}>{st.label}</Badge></Td>
                  <Td align="right" className="font-semibold text-gray-800">{formatCurrency(q.grandTotal)}</Td>
                  <Td align="right" onClick={(e) => e.stopPropagation()}>
                    <ActionMenu
                      items={[
                        { label: 'Görüntüle / Yazdır', icon: Eye, onClick: () => setViewing(q) },
                        { label: 'Düzenle', icon: Edit, onClick: () => { setEditing(q); setFormOpen(true); } },
                        { label: 'Kabul Edildi', onClick: () => updateRecord(userId, 'quotes', q.id, { status: 'accepted' }) },
                        { label: 'Reddedildi', onClick: () => updateRecord(userId, 'quotes', q.id, { status: 'rejected' }) },
                        { label: 'Sil', icon: Trash2, danger: true, onClick: () => setConfirmId(q.id) },
                      ]}
                    />
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {formOpen && <QuoteForm existing={editing} records={quotes} customers={customers} authors={authors} subcontracts={subcontracts} userId={userId} onClose={() => { setFormOpen(false); setEditing(null); }} />}
      {viewing && <PrintView doc={printable} companyProfile={companyProfile} heading="TEKLİF" scriptsLoaded={scriptsLoaded} onClose={() => setViewing(null)} />}
      {confirmId && <ConfirmDialog message="Bu teklifi silmek istediğinize emin misiniz? (Oluşturulan iş ve müellif atamaları silinmez; onları cariden yönetebilirsiniz.)" onConfirm={() => deleteRecord(userId, 'quotes', confirmId)} onClose={() => setConfirmId(null)} />}
    </div>
  );
}

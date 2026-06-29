// --- İrsaliyeler ---
import React, { useState, useMemo } from 'react';
import { Edit, Trash2, MoreVertical, FileCheck2, Truck } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatCurrency, formatDateShort, sum, nextDocNumber } from '../utils';
import { PageHeader, AddButton, Card, Table, Td, Badge, EmptyState, StatCard, ConfirmDialog } from '../components/ui';
import DocumentForm from '../components/DocumentForm';
import PrintView from '../components/PrintView';

const statusMeta = {
  open: { label: 'Sevk Edildi', color: 'yellow' },
  invoiced: { label: 'Faturalandı', color: 'sky' },
};

export default function Waybills({ data, userId }) {
  const { waybills = [], invoices = [], customers = [], products = [], companyProfile, scriptsLoaded } = data;
  const [kind, setKind] = useState('sales');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const list = useMemo(
    () => waybills.filter((w) => (w.type || 'sales') === kind).sort((a, b) => (b.docNumber || '').localeCompare(a.docNumber || '')),
    [waybills, kind]
  );
  const isSales = kind === 'sales';

  const handleSave = async (payload) => {
    const dataToSave = { ...payload, date: Timestamp.fromDate(new Date(payload.date)) };
    delete dataToSave.id;
    delete dataToSave.dueDate;
    try {
      if (editing) await updateRecord(userId, 'waybills', editing.id, dataToSave);
      else await addRecord(userId, 'waybills', { ...dataToSave, status: 'open' });
      setFormOpen(false);
      setEditing(null);
    } catch (e) { console.error(e); alert('İrsaliye kaydedilemedi.'); }
  };

  const convertToInvoice = async (w) => {
    if (!window.confirm('İrsaliye faturaya dönüştürülsün mü?')) return;
    const { id, status, ...rest } = w;
    await addRecord(userId, 'invoices', { ...rest, docNumber: nextDocNumber(invoices.filter((i) => (i.type || 'sales') === w.type), isSales ? 'SF' : 'AF'), status: 'unpaid' });
    await updateRecord(userId, 'waybills', id, { status: 'invoiced' });
    setMenuId(null);
  };

  return (
    <div>
      <PageHeader title="İrsaliyeler" subtitle="Sevk ve mal kabul irsaliyeleri">
        <AddButton label={isSales ? 'Yeni Sevk İrsaliyesi' : 'Yeni Alış İrsaliyesi'} onClick={() => { setEditing(null); setFormOpen(true); }} />
      </PageHeader>

      <div className="flex gap-2 mb-4">
        {[{ k: 'sales', l: 'Sevk İrsaliyeleri' }, { k: 'purchase', l: 'Alış İrsaliyeleri' }].map((t) => (
          <button key={t.k} onClick={() => setKind(t.k)} className={`px-4 py-2 rounded-lg text-sm font-medium ${kind === t.k ? 'bg-sky-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{t.l}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard title="İrsaliye Sayısı" value={list.length} icon={Truck} color="text-sky-600" />
        <StatCard title="Toplam Tutar" value={formatCurrency(sum(list, (w) => w.grandTotal))} color="text-gray-700" />
      </div>

      <Card>
        {list.length === 0 ? (
          <EmptyState message="Bu kategoride irsaliye yok" />
        ) : (
          <Table headers={[{ label: 'İrsaliye No' }, { label: isSales ? 'Müşteri' : 'Tedarikçi' }, { label: 'Tarih' }, { label: 'Durum' }, { label: 'Tutar', align: 'right' }, { label: '' }]}>
            {list.map((w) => {
              const st = statusMeta[w.status || 'open'];
              return (
                <tr key={w.id} className="hover:bg-gray-50">
                  <Td className="font-medium text-gray-900 cursor-pointer" onClick={() => setViewing(w)}>{w.docNumber}</Td>
                  <Td className="text-gray-500">{w.customerSnapshot?.name}</Td>
                  <Td className="text-gray-500">{formatDateShort(w.date)}</Td>
                  <Td><Badge color={st.color}>{st.label}</Badge></Td>
                  <Td align="right" className="font-semibold text-gray-800">{formatCurrency(w.grandTotal)}</Td>
                  <Td align="right" className="relative">
                    <button onClick={() => setMenuId(menuId === w.id ? null : w.id)} className="p-2 rounded-full hover:bg-gray-200 text-gray-500"><MoreVertical size={18} /></button>
                    {menuId === w.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                        <div className="origin-top-right absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 text-left py-1">
                          <button onClick={() => { setEditing(w); setFormOpen(true); setMenuId(null); }} className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><Edit size={15} className="mr-3" />Düzenle</button>
                          <button onClick={() => convertToInvoice(w)} className="flex items-center w-full px-4 py-2 text-sm text-sky-700 hover:bg-gray-100"><FileCheck2 size={15} className="mr-3" />Faturaya Dönüştür</button>
                          <button onClick={() => { setConfirmId(w.id); setMenuId(null); }} className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"><Trash2 size={15} className="mr-3" />Sil</button>
                        </div>
                      </>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {formOpen && (
        <DocumentForm
          title={editing ? 'İrsaliye Düzenle' : isSales ? 'Yeni Sevk İrsaliyesi' : 'Yeni Alış İrsaliyesi'}
          numberPrefix={isSales ? 'Sİ' : 'Aİ'}
          existing={editing}
          records={waybills.filter((w) => (w.type || 'sales') === kind)}
          customers={customers}
          products={products}
          kind={kind}
          dateLabel="İrsaliye Tarihi"
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
      {viewing && <PrintView doc={viewing} companyProfile={companyProfile} heading="İRSALİYE" scriptsLoaded={scriptsLoaded} onClose={() => setViewing(null)} />}
      {confirmId && <ConfirmDialog message="Bu irsaliyeyi silmek istediğinize emin misiniz?" onConfirm={() => deleteRecord(userId, 'waybills', confirmId)} onClose={() => setConfirmId(null)} />}
    </div>
  );
}

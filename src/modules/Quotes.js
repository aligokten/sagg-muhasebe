// --- Teklifler ---
import React, { useState, useMemo } from 'react';
import { Edit, Trash2, MoreVertical, FileCheck2, FileText } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatCurrency, formatDateShort, sum, nextDocNumber } from '../utils';
import { PageHeader, AddButton, Card, Table, Td, Badge, EmptyState, StatCard, ConfirmDialog } from '../components/ui';
import DocumentForm from '../components/DocumentForm';
import PrintView from '../components/PrintView';

const statusMeta = {
  pending: { label: 'Bekliyor', color: 'yellow' },
  accepted: { label: 'Kabul Edildi', color: 'green' },
  rejected: { label: 'Reddedildi', color: 'red' },
  invoiced: { label: 'Faturalandı', color: 'sky' },
};

export default function Quotes({ data, userId }) {
  const { quotes = [], invoices = [], customers = [], products = [], companyProfile, scriptsLoaded } = data;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const list = useMemo(() => [...quotes].sort((a, b) => (b.docNumber || '').localeCompare(a.docNumber || '')), [quotes]);
  const accepted = sum(list.filter((q) => q.status === 'accepted'), (q) => q.grandTotal);

  const handleSave = async (payload) => {
    const dataToSave = {
      ...payload,
      date: Timestamp.fromDate(new Date(payload.date)),
      validUntil: payload.dueDate ? Timestamp.fromDate(new Date(payload.dueDate)) : null,
    };
    delete dataToSave.id;
    delete dataToSave.type;
    try {
      if (editing) await updateRecord(userId, 'quotes', editing.id, dataToSave);
      else await addRecord(userId, 'quotes', { ...dataToSave, status: dataToSave.status || 'pending' });
      setFormOpen(false);
      setEditing(null);
    } catch (e) {
      console.error(e);
      alert('Teklif kaydedilemedi.');
    }
  };

  const convertToInvoice = async (q) => {
    if (!window.confirm('Teklif satış faturasına dönüştürülsün mü?')) return;
    const { id, status, validUntil, ...rest } = q;
    await addRecord(userId, 'invoices', {
      ...rest,
      type: 'sales',
      docNumber: nextDocNumber(invoices.filter((i) => (i.type || 'sales') === 'sales'), 'SF'),
      status: 'unpaid',
    });
    await updateRecord(userId, 'quotes', id, { status: 'invoiced' });
    setMenuId(null);
    alert('Teklif faturaya dönüştürüldü.');
  };

  const setStatus = async (q, status) => {
    await updateRecord(userId, 'quotes', q.id, { status });
    setMenuId(null);
  };

  return (
    <div>
      <PageHeader title="Teklifler" subtitle="Müşterilerinize teklif hazırlayın ve takip edin">
        <AddButton label="Yeni Teklif" onClick={() => { setEditing(null); setFormOpen(true); }} />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Teklif Sayısı" value={list.length} icon={FileText} color="text-sky-600" />
        <StatCard title="Toplam Tutar" value={formatCurrency(sum(list, (q) => q.grandTotal))} color="text-gray-700" />
        <StatCard title="Kabul Edilen" value={formatCurrency(accepted)} color="text-green-600" />
      </div>

      <Card>
        {list.length === 0 ? (
          <EmptyState message="Henüz teklif yok" />
        ) : (
          <Table headers={[{ label: 'Teklif No' }, { label: 'Müşteri' }, { label: 'Tarih' }, { label: 'Durum' }, { label: 'Tutar', align: 'right' }, { label: '' }]}>
            {list.map((q) => {
              const st = statusMeta[q.status || 'pending'];
              return (
                <tr key={q.id} className="hover:bg-gray-50">
                  <Td className="font-medium text-gray-900 cursor-pointer" onClick={() => setViewing(q)}>{q.docNumber}</Td>
                  <Td className="text-gray-500">{q.customerSnapshot?.name}</Td>
                  <Td className="text-gray-500">{formatDateShort(q.date)}</Td>
                  <Td><Badge color={st.color}>{st.label}</Badge></Td>
                  <Td align="right" className="font-semibold text-gray-800">{formatCurrency(q.grandTotal)}</Td>
                  <Td align="right" className="relative">
                    <button onClick={() => setMenuId(menuId === q.id ? null : q.id)} className="p-2 rounded-full hover:bg-gray-200 text-gray-500"><MoreVertical size={18} /></button>
                    {menuId === q.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                        <div className="origin-top-right absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 text-left py-1">
                          <button onClick={() => { setEditing(q); setFormOpen(true); setMenuId(null); }} className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><Edit size={15} className="mr-3" />Düzenle</button>
                          <button onClick={() => setStatus(q, 'accepted')} className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Kabul Edildi</button>
                          <button onClick={() => setStatus(q, 'rejected')} className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Reddedildi</button>
                          <button onClick={() => convertToInvoice(q)} className="flex items-center w-full px-4 py-2 text-sm text-sky-700 hover:bg-gray-100"><FileCheck2 size={15} className="mr-3" />Faturaya Dönüştür</button>
                          <button onClick={() => { setConfirmId(q.id); setMenuId(null); }} className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"><Trash2 size={15} className="mr-3" />Sil</button>
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
          title={editing ? 'Teklif Düzenle' : 'Yeni Teklif'}
          numberPrefix="TK"
          existing={editing}
          records={quotes}
          customers={customers}
          products={products}
          projects={data.projects || []}
          authors={data.authors || []}
          kind="sales"
          dateLabel="Teklif Tarihi"
          secondDateLabel="Geçerlilik Tarihi"
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}

      {viewing && <PrintView doc={viewing} companyProfile={companyProfile} heading="TEKLİF" scriptsLoaded={scriptsLoaded} onClose={() => setViewing(null)} />}
      {confirmId && <ConfirmDialog message="Bu teklifi silmek istediğinize emin misiniz?" onConfirm={() => deleteRecord(userId, 'quotes', confirmId)} onClose={() => setConfirmId(null)} />}
    </div>
  );
}

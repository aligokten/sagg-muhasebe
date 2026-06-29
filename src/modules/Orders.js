// --- Siparişler (Satış + Alış) ---
import React, { useState, useMemo } from 'react';
import { Edit, Trash2, FileCheck2, ClipboardList, Eye, Truck } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatCurrency, formatDateShort, sum, nextDocNumber } from '../utils';
import { PageHeader, AddButton, Card, Table, Td, Badge, EmptyState, StatCard, ConfirmDialog, ActionMenu } from '../components/ui';
import DocumentForm from '../components/DocumentForm';
import PrintView from '../components/PrintView';

const statusMeta = {
  open: { label: 'Açık', color: 'yellow' },
  delivered: { label: 'Teslim Edildi', color: 'green' },
  invoiced: { label: 'Faturalandı', color: 'sky' },
  cancelled: { label: 'İptal', color: 'red' },
};

export default function Orders({ data, userId }) {
  const { orders = [], invoices = [], customers = [], products = [], companyProfile, scriptsLoaded } = data;
  const [kind, setKind] = useState('sales');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const list = useMemo(
    () => orders.filter((o) => (o.type || 'sales') === kind).sort((a, b) => (b.docNumber || '').localeCompare(a.docNumber || '')),
    [orders, kind]
  );
  const isSales = kind === 'sales';

  const handleSave = async (payload) => {
    const dataToSave = { ...payload, date: Timestamp.fromDate(new Date(payload.date)), dueDate: payload.dueDate ? Timestamp.fromDate(new Date(payload.dueDate)) : null };
    delete dataToSave.id;
    try {
      if (editing) await updateRecord(userId, 'orders', editing.id, dataToSave);
      else await addRecord(userId, 'orders', { ...dataToSave, status: dataToSave.status || 'open' });
      setFormOpen(false);
      setEditing(null);
    } catch (e) { console.error(e); alert('Sipariş kaydedilemedi.'); }
  };

  const convertToInvoice = async (o) => {
    if (!window.confirm('Sipariş faturaya dönüştürülsün mü?')) return;
    const { id, status, ...rest } = o;
    await addRecord(userId, 'invoices', {
      ...rest,
      docNumber: nextDocNumber(invoices.filter((i) => (i.type || 'sales') === o.type), isSales ? 'SF' : 'AF'),
      status: 'unpaid',
    });
    await updateRecord(userId, 'orders', id, { status: 'invoiced' });
  };

  return (
    <div>
      <PageHeader title="Siparişler" subtitle="Alınan ve verilen siparişleri takip edin">
        <AddButton label={isSales ? 'Yeni Satış Siparişi' : 'Yeni Alış Siparişi'} onClick={() => { setEditing(null); setFormOpen(true); }} />
      </PageHeader>

      <div className="flex gap-2 mb-4">
        {[{ k: 'sales', l: 'Satış Siparişleri' }, { k: 'purchase', l: 'Alış Siparişleri' }].map((t) => (
          <button key={t.k} onClick={() => setKind(t.k)} className={`px-4 py-2 rounded-lg text-sm font-medium ${kind === t.k ? 'bg-sky-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{t.l}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard title="Sipariş Sayısı" value={list.length} icon={ClipboardList} color="text-sky-600" />
        <StatCard title="Toplam Tutar" value={formatCurrency(sum(list, (o) => o.grandTotal))} color="text-gray-700" />
      </div>

      <Card>
        {list.length === 0 ? (
          <EmptyState message="Bu kategoride sipariş yok" />
        ) : (
          <Table headers={[{ label: 'Sipariş No' }, { label: isSales ? 'Müşteri' : 'Tedarikçi' }, { label: 'Tarih' }, { label: 'Durum' }, { label: 'Tutar', align: 'right' }, { label: '' }]}>
            {list.map((o) => {
              const st = statusMeta[o.status || 'open'];
              return (
                <tr key={o.id} className="hover:bg-gray-50">
                  <Td className="font-medium text-gray-900 cursor-pointer" onClick={() => setViewing(o)}>{o.docNumber}</Td>
                  <Td className="text-gray-500">{o.customerSnapshot?.name}</Td>
                  <Td className="text-gray-500">{formatDateShort(o.date)}</Td>
                  <Td><Badge color={st.color}>{st.label}</Badge></Td>
                  <Td align="right" className="font-semibold text-gray-800">{formatCurrency(o.grandTotal)}</Td>
                  <Td align="right" onClick={(e) => e.stopPropagation()}>
                    <ActionMenu
                      items={[
                        { label: 'Görüntüle', icon: Eye, onClick: () => setViewing(o) },
                        { label: 'Düzenle', icon: Edit, onClick: () => { setEditing(o); setFormOpen(true); } },
                        { label: 'Teslim Edildi', icon: Truck, onClick: () => updateRecord(userId, 'orders', o.id, { status: 'delivered' }) },
                        { label: 'Faturaya Dönüştür', icon: FileCheck2, onClick: () => convertToInvoice(o) },
                        { label: 'Sil', icon: Trash2, danger: true, onClick: () => setConfirmId(o.id) },
                      ]}
                    />
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {formOpen && (
        <DocumentForm
          title={editing ? 'Sipariş Düzenle' : isSales ? 'Yeni Satış Siparişi' : 'Yeni Alış Siparişi'}
          numberPrefix={isSales ? 'SS' : 'AS'}
          existing={editing}
          records={orders.filter((o) => (o.type || 'sales') === kind)}
          customers={customers}
          products={products}
          projects={data.projects || []}
          authors={data.authors || []}
          kind={kind}
          dateLabel="Sipariş Tarihi"
          secondDateLabel="Teslim Tarihi"
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
      {viewing && <PrintView doc={viewing} companyProfile={companyProfile} heading="SİPARİŞ" scriptsLoaded={scriptsLoaded} onClose={() => setViewing(null)} />}
      {confirmId && <ConfirmDialog message="Bu siparişi silmek istediğinize emin misiniz?" onConfirm={() => deleteRecord(userId, 'orders', confirmId)} onClose={() => setConfirmId(null)} />}
    </div>
  );
}

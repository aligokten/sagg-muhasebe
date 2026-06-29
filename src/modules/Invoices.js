// --- Faturalar (Satış + Alış) ---
import React, { useState, useMemo } from 'react';
import { Eye, Edit, Trash2, Send, FileText, Ban } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord } from '../firebase';
import { Timestamp } from '../firebase';
import { formatCurrency, formatDateShort, sum } from '../utils';
import { PageHeader, AddButton, Card, Table, Td, Badge, EmptyState, StatCard, ConfirmDialog, ActionMenu } from '../components/ui';
import DocumentForm from '../components/DocumentForm';
import PrintView from '../components/PrintView';

const statusMeta = {
  unpaid: { label: 'Ödenmedi', color: 'red' },
  partial: { label: 'Kısmi', color: 'yellow' },
  paid: { label: 'Ödendi', color: 'green' },
  cancelled: { label: 'İptal', color: 'gray' },
};

export default function Invoices({ data, userId }) {
  const { invoices = [], customers = [], products = [], companyProfile, scriptsLoaded } = data;
  const [kind, setKind] = useState('sales');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const list = useMemo(
    () => invoices.filter((i) => (i.type || 'sales') === kind).sort((a, b) => (b.docNumber || '').localeCompare(a.docNumber || '')),
    [invoices, kind]
  );

  const stats = useMemo(() => {
    const active = list.filter((i) => i.status !== 'cancelled');
    const total = sum(active, (i) => i.grandTotal);
    const unpaid = sum(active.filter((i) => i.status !== 'paid'), (i) => i.grandTotal);
    return { total, unpaid, count: active.length };
  }, [list]);

  const cancelInvoice = async (inv) => {
    if (!window.confirm(`${inv.docNumber} numaralı fatura iptal edilsin mi? (Kayıt durur, bakiyelere/stoğa yansımaz; istediğinizde geri alabilirsiniz.)`)) return;
    await updateRecord(userId, 'invoices', inv.id, { status: 'cancelled' });
  };

  const handleSave = async (payload) => {
    const dataToSave = {
      ...payload,
      date: Timestamp.fromDate(new Date(payload.date)),
      dueDate: payload.dueDate ? Timestamp.fromDate(new Date(payload.dueDate)) : null,
    };
    delete dataToSave.id;
    try {
      if (editing) await updateRecord(userId, 'invoices', editing.id, dataToSave);
      else await addRecord(userId, 'invoices', { ...dataToSave, status: dataToSave.status || 'unpaid' });
      setFormOpen(false);
      setEditing(null);
    } catch (e) {
      console.error('Fatura kaydedilemedi:', e);
      alert('Fatura kaydedilirken hata oluştu.');
    }
  };

  const cycleStatus = async (inv) => {
    const order = ['unpaid', 'partial', 'paid'];
    const next = order[(order.indexOf(inv.status || 'unpaid') + 1) % order.length];
    await updateRecord(userId, 'invoices', inv.id, { status: next });
  };

  const isSales = kind === 'sales';

  return (
    <div>
      <PageHeader title="Faturalar" subtitle="Satış ve alış faturalarınızı yönetin">
        <AddButton label={isSales ? 'Yeni Satış Faturası' : 'Yeni Alış Faturası'} onClick={() => { setEditing(null); setFormOpen(true); }} />
      </PageHeader>

      <div className="flex gap-2 mb-4">
        {[{ k: 'sales', l: 'Satış Faturaları' }, { k: 'purchase', l: 'Alış Faturaları' }].map((t) => (
          <button
            key={t.k}
            onClick={() => setKind(t.k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${kind === t.k ? 'bg-sky-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {t.l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Fatura Sayısı" value={stats.count} icon={FileText} color="text-sky-600" />
        <StatCard title="Toplam Tutar" value={formatCurrency(stats.total)} color="text-gray-700" />
        <StatCard title="Bekleyen Ödeme" value={formatCurrency(stats.unpaid)} color="text-red-600" />
      </div>

      <Card>
        {list.length === 0 ? (
          <EmptyState message="Bu kategoride henüz fatura yok" />
        ) : (
          <Table
            headers={[
              { label: 'Fatura No' },
              { label: isSales ? 'Müşteri' : 'Tedarikçi' },
              { label: 'Tarih' },
              { label: 'Durum' },
              { label: 'Tutar', align: 'right' },
              { label: '' },
            ]}
          >
            {list.map((inv) => {
              const st = statusMeta[inv.status || 'unpaid'];
              return (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <Td className="font-medium text-gray-900 cursor-pointer" onClick={() => setViewing(inv)}>{inv.docNumber}</Td>
                  <Td className="text-gray-500">{inv.customerSnapshot?.name}</Td>
                  <Td className="text-gray-500">{formatDateShort(inv.date)}</Td>
                  <Td>
                    <button onClick={() => cycleStatus(inv)} title="Durumu değiştir">
                      <Badge color={st.color}>{st.label}</Badge>
                    </button>
                  </Td>
                  <Td align="right" className="font-semibold text-gray-800">{formatCurrency(inv.grandTotal)}</Td>
                  <Td align="right" onClick={(e) => e.stopPropagation()}>
                    <ActionMenu
                      items={[
                        { label: 'Görüntüle', icon: Eye, onClick: () => setViewing(inv) },
                        { label: 'Düzenle', icon: Edit, onClick: () => { setEditing(inv); setFormOpen(true); } },
                        { label: 'Yazdır / PDF', icon: Send, onClick: () => setViewing(inv) },
                        inv.status === 'cancelled'
                          ? { label: 'İptali Geri Al', icon: Ban, onClick: () => updateRecord(userId, 'invoices', inv.id, { status: 'unpaid' }) }
                          : { label: 'İptal Et', icon: Ban, onClick: () => cancelInvoice(inv) },
                        { label: 'Sil', icon: Trash2, danger: true, onClick: () => setConfirmId(inv.id) },
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
          title={editing ? 'Fatura Düzenle' : isSales ? 'Yeni Satış Faturası' : 'Yeni Alış Faturası'}
          numberPrefix={isSales ? 'SF' : 'AF'}
          existing={editing}
          records={invoices.filter((i) => (i.type || 'sales') === kind)}
          customers={customers}
          products={products}
          projects={data.projects || []}
          authors={data.authors || []}
          kind={kind}
          dateLabel="Fatura Tarihi"
          secondDateLabel="Vade Tarihi"
          showStatus
          statusOptions={[
            { value: 'unpaid', label: 'Ödenmedi' },
            { value: 'partial', label: 'Kısmi Ödendi' },
            { value: 'paid', label: 'Ödendi' },
          ]}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}

      {viewing && (
        <PrintView
          doc={viewing}
          companyProfile={companyProfile}
          heading={(viewing.type || 'sales') === 'sales' ? 'FATURA' : 'ALIŞ FATURASI'}
          scriptsLoaded={scriptsLoaded}
          onClose={() => setViewing(null)}
        />
      )}

      {confirmId && (
        <ConfirmDialog
          message="Bu faturayı silmek istediğinize emin misiniz?"
          onConfirm={() => deleteRecord(userId, 'invoices', confirmId)}
          onClose={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}

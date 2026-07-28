// --- Yazarkasa Fişi: 60mm x 100mm tek nüsha fiş çıktısı ---
import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, Download } from 'lucide-react';
import { Button } from './ui';
import { formatCurrency, formatDate, numberToWordsTr } from '../utils';

const printStyles = `@media print{
  @page { size: 60mm 100mm; margin: 0; }
  body *{visibility:hidden}
  #cashreg-print-area,#cashreg-print-area *{visibility:visible}
  #cashreg-print-area{position:absolute;left:0;top:0}
  .no-print{display:none}
}`;

const paymentLabel = (accounts, accountId) => {
  const acc = (accounts || []).find((a) => a.id === accountId);
  if (!acc) return 'Belirtilmemiştir';
  if (acc.type === 'Nakit' || acc.type === 'Nakit Kasa') return 'Nakit';
  if (acc.type === 'Kredi Kartı') return 'Kredi Kartı';
  if (acc.type === 'POS') return 'POS';
  return 'Havale/EFT';
};

const Dashed = () => <div style={{ borderTop: '1px dashed #999', margin: '2mm 0' }} />;

export default function CashRegisterReceipt({ kind, record, companyProfile, accounts, onClose, scriptsLoaded }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const printRef = useRef(null);
  const isIncome = kind === 'incomes';
  const isPersonnel = !!record.isPersonnel;
  const title = isPersonnel ? 'MAAŞ ÖDEME FİŞİ' : isIncome ? 'TAHSİLAT FİŞİ' : 'ÖDEME FİŞİ';
  const verb = isIncome ? 'tahsil edilmiştir' : 'ödenmiştir';
  const partyName = record.payeeName || record.customerName || null;

  useEffect(() => {
    let cancelled = false;
    const lines = [
      companyProfile?.companyName || 'SAGG Muhasebe',
      title,
      `Fiş No: ${record.receiptNo || ''}`,
      `Tarih: ${formatDate(record.date)}`,
      `Tutar: ${formatCurrency(record.amount)}`,
    ];
    QRCode.toDataURL(lines.join('\n'), { margin: 1, width: 120 })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [record, title, companyProfile]);

  const handlePrint = () => window.print();

  const handlePdf = async () => {
    if (!scriptsLoaded || !window.jspdf || !window.html2canvas) {
      alert('PDF kütüphaneleri yükleniyor, lütfen birkaç saniye sonra tekrar deneyin.');
      return;
    }
    try {
      const { jsPDF } = window.jspdf;
      const canvas = await window.html2canvas(printRef.current, { scale: 3, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [60, 100] });
      pdf.addImage(imgData, 'PNG', 0, 0, 60, 100);
      pdf.save(`fis-${record.receiptNo || ''}.pdf`);
    } catch (e) {
      alert('PDF oluşturulurken bir hata oluştu.');
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-start z-50 p-4 overflow-auto">
      <style>{printStyles}</style>
      <div className="bg-white shadow-2xl my-8 rounded-lg overflow-auto max-w-full">
        <div
          id="cashreg-print-area"
          ref={printRef}
          className="bg-white text-gray-900"
          style={{ width: '60mm', height: '100mm', boxSizing: 'border-box', padding: '3mm', fontSize: '8.5px', lineHeight: 1.35, display: 'flex', flexDirection: 'column' }}
        >
          <div className="text-center">
            {companyProfile?.logo && <img src={companyProfile.logo} alt="" style={{ maxHeight: 18, maxWidth: '40mm', objectFit: 'contain', margin: '0 auto 1mm' }} />}
            <p className="font-bold" style={{ fontSize: '10px' }}>{companyProfile?.companyName || 'İşletme Adı'}</p>
            {companyProfile?.address && <p className="text-gray-600 whitespace-pre-line" style={{ fontSize: '7px' }}>{companyProfile.address}</p>}
            {companyProfile?.taxId && <p className="text-gray-600" style={{ fontSize: '7px' }}>VKN/TCKN: {companyProfile.taxId}</p>}
            {companyProfile?.phone && <p className="text-gray-600" style={{ fontSize: '7px' }}>Tel: {companyProfile.phone}</p>}
          </div>

          <Dashed />

          <p className="text-center font-bold" style={{ fontSize: '9.5px' }}>{title}</p>
          <div className="flex justify-between mt-1">
            <span>Fiş No:</span><span className="font-semibold">{record.receiptNo || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span>Tarih:</span><span>{formatDate(record.date)}</span>
          </div>

          <Dashed />

          {partyName && (
            <p className="mb-1"><span className="text-gray-500">Sayın:</span> <span className="font-semibold">{partyName}</span></p>
          )}
          <p className="mb-1"><span className="text-gray-500">Açıklama:</span> {record.description || record.category || '-'}</p>
          <p><span className="text-gray-500">Ödeme:</span> {paymentLabel(accounts, record.accountId)}</p>
          <p className="text-gray-600 mt-1" style={{ fontSize: '7px' }}>
            Bedel {paymentLabel(accounts, record.accountId)} yoluyla {verb}.
          </p>

          <Dashed />

          <div className="flex justify-between items-baseline">
            <span className="font-bold" style={{ fontSize: '9px' }}>TUTAR</span>
            <span className="font-bold" style={{ fontSize: '13px' }}>{formatCurrency(record.amount)}</span>
          </div>
          <p className="text-gray-600 mt-1" style={{ fontSize: '7px' }}>{numberToWordsTr(record.amount)}</p>

          <Dashed />

          <div className="flex flex-col items-center mt-auto">
            {qrDataUrl && <img src={qrDataUrl} alt="QR" style={{ width: 30, height: 30 }} />}
            <p className="text-center text-gray-400 mt-1" style={{ fontSize: '6px' }}>
              Bu fiş SAGG Muhasebe ile elektronik ortamda düzenlenmiştir.
            </p>
          </div>
        </div>
        <div className="p-4 bg-gray-50 flex justify-end space-x-2 no-print rounded-b-lg sticky bottom-0">
          <Button variant="secondary" onClick={onClose}>Kapat</Button>
          <Button variant="secondary" icon={Download} onClick={handlePdf}>PDF İndir</Button>
          <Button icon={Printer} onClick={handlePrint}>Yazdır</Button>
        </div>
      </div>
    </div>
  );
}

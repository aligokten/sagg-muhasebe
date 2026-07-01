// --- Tahsilat / Ödeme Makbuzu: A5 dikey, yatay A4'e 2 nüsha (İşyeri + Müşteri) ---
import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, Download } from 'lucide-react';
import { Button } from './ui';
import { formatCurrency, formatDate, numberToWordsTr } from '../utils';

const printStyles = `@media print{
  @page { size: A4 landscape; margin: 0; }
  body *{visibility:hidden}
  #receipt-print-area,#receipt-print-area *{visibility:visible}
  #receipt-print-area{position:absolute;left:0;top:0}
  .no-print{display:none}
}`;

const paymentLabel = (accounts, accountId) => {
  const acc = (accounts || []).find((a) => a.id === accountId);
  if (!acc) return 'Belirtilmemiştir';
  if (acc.type === 'Nakit Kasa') return 'Nakit';
  if (acc.type === 'Kredi Kartı') return 'Kredi Kartı';
  if (acc.type === 'POS') return 'POS';
  return 'Havale/EFT';
};

const ReceiptCopy = ({ copyLabel, divider, kind, record, companyProfile, accounts, qrDataUrl }) => {
  const isIncome = kind === 'incomes';
  const title = isIncome ? 'TAHSİLAT MAKBUZU' : 'ÖDEME MAKBUZU';
  const verb = isIncome ? 'tahsil edilmiştir' : 'ödenmiştir';
  const partyName = record.customerName || '..........................................';
  const leftSign = isIncome ? 'TESLİM EDEN (Ödeyen)' : 'ÖDEYEN (Yetkili)';
  const rightSign = isIncome ? 'TESLİM ALAN (Yetkili)' : 'TESLİM ALAN (Alacaklı)';

  return (
    <div
      className="flex flex-col bg-white text-gray-900"
      style={{ width: '148.5mm', height: '210mm', boxSizing: 'border-box', padding: '8mm', borderRight: divider ? '1px dashed #999' : 'none', flexShrink: 0 }}
    >
      <div className="flex justify-between items-start pb-2 border-b border-gray-800">
        <div style={{ maxWidth: '68%' }}>
          {companyProfile?.logo && <img src={companyProfile.logo} alt="" style={{ maxHeight: 34, maxWidth: 130, objectFit: 'contain' }} className="mb-1" />}
          <p className="font-bold text-[11px] leading-tight">{companyProfile?.companyName || 'İşletme Adı'}</p>
          {companyProfile?.address && <p className="text-[8px] text-gray-600 leading-tight whitespace-pre-line">{companyProfile.address}</p>}
          {companyProfile?.taxId && <p className="text-[8px] text-gray-600">VKN/TCKN: {companyProfile.taxId}</p>}
          {companyProfile?.phone && <p className="text-[8px] text-gray-600">Tel: {companyProfile.phone}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-[12px] whitespace-nowrap">{title}</p>
          <p className="text-[9px] mt-1">Seri No: <span className="font-semibold">{record.receiptNo || '-'}</span></p>
          <p className="text-[9px]">Tarih: {formatDate(record.date)}</p>
        </div>
      </div>

      <div className="mt-2 py-1 text-center bg-gray-100 text-[8px] font-semibold tracking-wider">{copyLabel}</div>

      <div className="mt-3 flex-1 flex flex-col border border-gray-300 rounded p-3">
        <div className="text-[9px] space-y-1.5">
          <p><span className="text-gray-500">Sayın:</span> <span className="font-semibold">{partyName}</span></p>
          <p className="text-gray-600 leading-snug">
            Aşağıda cins ve tutarı belirtilen bedel {paymentLabel(accounts, record.accountId)} yoluyla {verb}.
          </p>
        </div>

        <div className="mt-3 border border-gray-400 rounded p-2 text-[9px] space-y-1">
          <p><span className="text-gray-500">Açıklama:</span> {record.description || record.category || '-'}</p>
          <p><span className="text-gray-500">Tutar (Rakam):</span> <span className="font-bold">{formatCurrency(record.amount)}</span></p>
          <p><span className="text-gray-500">Tutar (Yazı):</span> {numberToWordsTr(record.amount)}</p>
        </div>

        <div className="mt-3 text-[8px] text-gray-400">
          Not:
          <div className="border-b border-gray-300 mt-3" />
          <div className="border-b border-gray-300 mt-4" />
        </div>

        <div className="mt-auto pt-3 flex items-start gap-3">
          {qrDataUrl && <img src={qrDataUrl} alt="QR" style={{ width: 68, height: 68, flexShrink: 0 }} />}
          <div className="flex-1 grid grid-cols-2 gap-2 text-center text-[8px]">
            <div>
              <div style={{ height: 44 }} />
              <div className="border-t border-gray-500 pt-1 leading-tight">{leftSign}<br />İmza / Kaşe</div>
            </div>
            <div>
              <div style={{ height: 44 }} />
              <div className="border-t border-gray-500 pt-1 leading-tight">{rightSign}<br />İmza / Kaşe</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 pt-2 text-center text-[7px] text-gray-400 border-t border-gray-200">
        Bu makbuz SAGG Muhasebe ile elektronik ortamda düzenlenmiştir.
      </div>
    </div>
  );
};

export default function ReceiptView({ kind, record, companyProfile, accounts, onClose, scriptsLoaded }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const printRef = useRef(null);
  const isIncome = kind === 'incomes';

  useEffect(() => {
    let cancelled = false;
    const lines = [
      companyProfile?.companyName || 'SAGG Muhasebe',
      isIncome ? 'Tahsilat Makbuzu' : 'Ödeme Makbuzu',
      `Seri No: ${record.receiptNo || ''}`,
      `Tarih: ${formatDate(record.date)}`,
      `Tutar: ${formatCurrency(record.amount)}`,
      `Taraf: ${record.customerName || '-'}`,
      `Açıklama: ${record.description || record.category || '-'}`,
    ];
    QRCode.toDataURL(lines.join('\n'), { margin: 1, width: 200 })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [record, isIncome, companyProfile]);

  const handlePrint = () => window.print();

  const handlePdf = async () => {
    if (!scriptsLoaded || !window.jspdf || !window.html2canvas) {
      alert('PDF kütüphaneleri yükleniyor, lütfen birkaç saniye sonra tekrar deneyin.');
      return;
    }
    try {
      const { jsPDF } = window.jspdf;
      const canvas = await window.html2canvas(printRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pw / canvas.width, ph / canvas.height);
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width * ratio, canvas.height * ratio);
      pdf.save(`makbuz-${record.receiptNo || ''}.pdf`);
    } catch (e) {
      alert('PDF oluşturulurken bir hata oluştu.');
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-start z-50 p-4 overflow-auto">
      <style>{printStyles}</style>
      <div className="bg-white shadow-2xl my-8 rounded-lg overflow-auto max-w-full">
        <div id="receipt-print-area" ref={printRef} className="flex" style={{ width: '297mm', minHeight: '210mm', background: '#fff' }}>
          <ReceiptCopy copyLabel="İŞYERİ NÜSHASI" divider kind={kind} record={record} companyProfile={companyProfile} accounts={accounts} qrDataUrl={qrDataUrl} />
          <ReceiptCopy copyLabel="MÜŞTERİ NÜSHASI" kind={kind} record={record} companyProfile={companyProfile} accounts={accounts} qrDataUrl={qrDataUrl} />
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

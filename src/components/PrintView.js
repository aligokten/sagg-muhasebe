// --- Yazdırılabilir belge görünümü (fatura / teklif) ---
import React, { forwardRef } from 'react';
import { Printer, Download } from 'lucide-react';
import { Button } from './ui';
import { formatCurrency, formatDate, numberToWordsTr } from '../utils';

const printStyles = `@media print{body *{visibility:hidden}#doc-print-area,#doc-print-area *{visibility:visible}#doc-print-area{position:absolute;left:0;top:0;width:100%}.no-print{display:none}}`;

const DocBody = forwardRef(({ doc, companyProfile, heading }, ref) => {
  const c = doc.customerSnapshot || {};
  return (
    <div id="doc-print-area" ref={ref} className="p-10 bg-white">
      <header className="flex justify-between items-start pb-6 border-b">
        <div>
          {companyProfile?.logo && <img src={companyProfile.logo} alt="Logo" className="max-h-20 max-w-[200px] object-contain mb-2" />}
          <h1 className="text-2xl font-bold text-gray-800">{companyProfile?.companyName || 'Şirket Adınız'}</h1>
          <p className="text-gray-500 mt-2 max-w-xs text-sm whitespace-pre-line">{companyProfile?.address || ''}</p>
          {companyProfile?.taxId && <p className="text-gray-500 text-sm mt-1">VKN: {companyProfile.taxId}</p>}
          {companyProfile?.phone && <p className="text-gray-500 text-sm">Tel: {companyProfile.phone}</p>}
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold uppercase text-gray-300">{heading}</h2>
          <p className="text-gray-600 mt-2">No: {doc.docNumber}</p>
          <p className="text-gray-500 text-sm">Tarih: {formatDate(doc.date)}</p>
          {doc.dueDate && <p className="text-gray-500 text-sm">Vade: {formatDate(doc.dueDate)}</p>}
        </div>
      </header>

      <section className="mt-6">
        <h3 className="font-semibold text-gray-400 uppercase text-xs tracking-wider">Sayın</h3>
        <p className="font-bold text-gray-800 mt-1">{c.name}</p>
        <p className="text-gray-600 text-sm max-w-md whitespace-pre-line">{c.address}</p>
        {c.accountType === 'Tüzel Kişi' ? (
          <p className="text-gray-500 text-sm mt-1">{c.taxOffice ? `${c.taxOffice} V.D. - ` : ''}VKN: {c.taxId}</p>
        ) : (
          c.tcNo && <p className="text-gray-500 text-sm mt-1">TCKN: {c.tcNo}</p>
        )}
      </section>

      <section className="mt-6">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-xs font-semibold uppercase text-gray-500">Açıklama</th>
              <th className="p-2 text-xs font-semibold uppercase text-gray-500 text-right">Miktar</th>
              <th className="p-2 text-xs font-semibold uppercase text-gray-500 text-right">Birim Fiyat</th>
              <th className="p-2 text-xs font-semibold uppercase text-gray-500 text-right">İsk.%</th>
              <th className="p-2 text-xs font-semibold uppercase text-gray-500 text-right">KDV%</th>
              <th className="p-2 text-xs font-semibold uppercase text-gray-500 text-right">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {(doc.items || []).map((item, i) => {
              const line = (item.quantity || 0) * (item.unitPrice || 0);
              const net = line - line * ((item.discount || 0) / 100);
              return (
                <tr key={i} className="border-b">
                  <td className="p-2 text-sm text-gray-800">{item.description}</td>
                  <td className="p-2 text-sm text-gray-600 text-right">{item.quantity} {item.unit}</td>
                  <td className="p-2 text-sm text-gray-600 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="p-2 text-sm text-gray-600 text-right">{item.discount || 0}</td>
                  <td className="p-2 text-sm text-gray-600 text-right">{item.vatRate || 0}</td>
                  <td className="p-2 text-sm text-gray-800 font-medium text-right">{formatCurrency(net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="flex justify-end mt-6">
        <div className="w-full max-w-sm space-y-1">
          <div className="flex justify-between text-gray-600 text-sm"><span>Ara Toplam:</span><span>{formatCurrency(doc.subTotal)}</span></div>
          {doc.discountTotal > 0 && (
            <div className="flex justify-between text-gray-600 text-sm"><span>İskonto:</span><span>- {formatCurrency(doc.discountTotal)}</span></div>
          )}
          <div className="flex justify-between text-gray-600 text-sm"><span>KDV:</span><span>{formatCurrency(doc.vatTotal)}</span></div>
          <div className="flex justify-between font-bold text-lg text-gray-800 border-t pt-2"><span>Genel Toplam:</span><span>{formatCurrency(doc.grandTotal)}</span></div>
        </div>
      </section>

      <section className="mt-6 border-t pt-3">
        <p className="text-xs text-gray-500">Yalnız: <span className="font-medium text-gray-600">{numberToWordsTr(doc.grandTotal)}</span></p>
        {doc.note && <p className="text-xs text-gray-500 mt-2 whitespace-pre-line">Not: {doc.note}</p>}
      </section>

      {(companyProfile?.bankAccounts || []).length > 0 && (
        <footer className="mt-8 border-t pt-3">
          <h3 className="font-semibold text-gray-400 uppercase text-xs tracking-wider mb-1">Ödeme Bilgileri</h3>
          {companyProfile.bankAccounts.map((acc, i) => (
            <p key={i} className="text-sm text-gray-600"><span className="font-semibold text-gray-800">{acc.bankName}:</span> {acc.iban}</p>
          ))}
        </footer>
      )}
    </div>
  );
});
DocBody.displayName = 'DocBody';

export { DocBody };

export default function PrintView({ doc, companyProfile, heading = 'FATURA', onClose, scriptsLoaded }) {
  const printRef = React.useRef(null);

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
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pw / canvas.width, ph / canvas.height);
      const x = (pw - canvas.width * ratio) / 2;
      pdf.addImage(imgData, 'PNG', x, 0, canvas.width * ratio, canvas.height * ratio);
      pdf.save(`${heading.toLowerCase()}-${doc.docNumber || ''}.pdf`);
    } catch (e) {
      alert('PDF oluşturulurken bir hata oluştu.');
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-start z-50 p-4 overflow-y-auto no-print">
      <style>{printStyles}</style>
      <div className="bg-white w-full max-w-4xl shadow-2xl my-8 rounded-lg">
        <DocBody ref={printRef} doc={doc} companyProfile={companyProfile} heading={heading} />
        <div className="p-4 bg-gray-50 flex justify-end space-x-2 no-print rounded-b-lg">
          <Button variant="secondary" onClick={onClose}>Kapat</Button>
          <Button variant="secondary" icon={Download} onClick={handlePdf}>PDF İndir</Button>
          <Button icon={Printer} onClick={handlePrint}>Yazdır</Button>
        </div>
      </div>
    </div>
  );
}

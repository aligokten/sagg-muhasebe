// --- Cari / iş hesap ekstresi: detaylı A4 PDF raporu ---
// Uzun ekstreler için html2canvas çıktısı A4 sayfalarına bölünerek eklenir;
// yazdırmada tablo başlığı her sayfada tekrar eder.
import React, { useRef, useState } from 'react';
import { Printer, Download } from 'lucide-react';
import { Button } from './ui';
import { formatCurrency, formatDate, formatDateShort } from '../utils';

const printStyles = `@media print{
  @page { size: A4 portrait; margin: 12mm; }
  body *{visibility:hidden}
  #ledger-print-area,#ledger-print-area *{visibility:visible}
  #ledger-print-area{position:absolute;left:0;top:0;width:100%;padding:0}
  #ledger-print-area thead{display:table-header-group}
  #ledger-print-area tr{page-break-inside:avoid}
  .no-print{display:none}
}`;

export default function LedgerReport({ heading, customer, project, rows, balance, showProject, companyProfile, scriptsLoaded, onClose }) {
  const printRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const totalBorc = rows.reduce((s, r) => s + (r.borc || 0), 0);
  const totalAlacak = rows.reduce((s, r) => s + (r.alacak || 0), 0);
  // Ekrandaki ekstre ile aynı sıra: en yeni işlem en üstte
  const display = [...rows].reverse();
  const first = rows[0];
  const last = rows[rows.length - 1];
  const fileBase = `${customer.name}${project ? '-' + project.name : ''}-ekstre`.replace(/[\\/:*?"<>|]/g, '-');

  const handlePrint = () => window.print();

  const handlePdf = async () => {
    if (!scriptsLoaded || !window.jspdf || !window.html2canvas) {
      alert('PDF kütüphaneleri yükleniyor, lütfen birkaç saniye sonra tekrar deneyin.');
      return;
    }
    setBusy(true);
    try {
      const el = printRef.current;
      const { jsPDF } = window.jspdf;
      const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const margin = 10;
      const contentW = pdf.internal.pageSize.getWidth() - margin * 2;   // 190mm
      const contentH = pdf.internal.pageSize.getHeight() - margin * 2;  // 277mm
      // Sayfa başına düşen kaynak piksel yüksekliği
      const sliceH = Math.floor((canvas.width * contentH) / contentW);

      // Satırların canvas üzerindeki alt sınırları — sayfa kesikleri buralara
      // hizalanır ki bir tablo satırı iki sayfaya bölünmesin.
      const pxRatio = canvas.width / el.offsetWidth;
      const elTop = el.getBoundingClientRect().top;
      const rowEdges = Array.from(el.querySelectorAll('tbody tr'))
        .map((tr) => Math.round((tr.getBoundingClientRect().bottom - elTop) * pxRatio))
        .filter((v) => v > 0 && v < canvas.height);

      // Kesme noktalarını hesapla: her sayfaya sığan son satır sınırında böl.
      const cuts = [];
      let pos = 0;
      while (pos < canvas.height) {
        const start = pos;
        const limit = start + sliceH;
        if (limit >= canvas.height) { cuts.push([start, canvas.height - start]); break; }
        const fit = rowEdges.filter((e) => e > start && e <= limit).pop();
        // Uygun satır sınırı yoksa (ör. tek parça çok uzun) sabit yükseklikte böl
        const end = fit || limit;
        cuts.push([start, end - start]);
        pos = end;
      }

      for (let i = 0; i < cuts.length; i++) {
        const [y, h] = cuts[i];
        const part = document.createElement('canvas');
        part.width = canvas.width;
        part.height = h;
        const ctx = part.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, part.width, part.height);
        ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (i > 0) pdf.addPage();
        // Beyaz zeminli metin belgesi JPEG ile çok daha küçük dosya üretir
        // (PNG ile uzun ekstreler onlarca MB'a çıkıyor).
        pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, contentW, (h * contentW) / canvas.width);
      }
      pdf.save(`${fileBase}.pdf`);
    } catch (e) {
      console.error(e);
      alert('PDF oluşturulurken bir hata oluştu.');
    } finally {
      setBusy(false);
    }
  };

  const cell = 'px-2 py-1.5 align-top';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-start z-50 p-4 overflow-y-auto">
      <style>{printStyles}</style>
      <div className="bg-white w-full max-w-4xl shadow-2xl my-8 rounded-lg">
        <div id="ledger-print-area" ref={printRef} className="p-8 bg-white text-gray-900">
          {/* Başlık */}
          <div className="flex justify-between items-start pb-3 border-b-2 border-gray-800">
            <div style={{ maxWidth: '60%' }}>
              {companyProfile?.logo && <img src={companyProfile.logo} alt="" style={{ maxHeight: 44, maxWidth: 170, objectFit: 'contain' }} className="mb-1" />}
              <p className="font-bold text-base leading-tight">{companyProfile?.companyName || 'İşletme Adı'}</p>
              {companyProfile?.address && <p className="text-[11px] text-gray-600 whitespace-pre-line leading-snug">{companyProfile.address}</p>}
              {companyProfile?.taxId && <p className="text-[11px] text-gray-600">VKN/TCKN: {companyProfile.taxId}</p>}
              {companyProfile?.phone && <p className="text-[11px] text-gray-600">Tel: {companyProfile.phone}</p>}
            </div>
            <div className="text-right flex-shrink-0">
              <h2 className="text-xl font-bold uppercase tracking-wide">{heading}</h2>
              <p className="text-[11px] text-gray-600 mt-1">Rapor Tarihi: {formatDate(new Date())}</p>
              {first && <p className="text-[11px] text-gray-600">Dönem: {formatDateShort(first.date)} — {formatDateShort(last.date)}</p>}
            </div>
          </div>

          {/* Cari bilgileri */}
          <div className="mt-4 grid grid-cols-2 gap-4 text-[11px]">
            <div>
              <p className="text-gray-400 uppercase text-[10px] tracking-wider font-semibold mb-1">Cari Hesap</p>
              <p className="font-bold text-sm">{customer.name}</p>
              {customer.accountType && <p className="text-gray-600">{customer.accountType}</p>}
              {(customer.taxId || customer.tcNo) && <p className="text-gray-600">VKN/TCKN: {customer.taxId || customer.tcNo}</p>}
              {customer.phone && <p className="text-gray-600">Tel: {customer.phone}</p>}
              {customer.address && <p className="text-gray-600 whitespace-pre-line">{customer.address}</p>}
            </div>
            {project && (
              <div>
                <p className="text-gray-400 uppercase text-[10px] tracking-wider font-semibold mb-1">İş / Proje</p>
                <p className="font-bold text-sm">{project.name}</p>
                {project.address && <p className="text-gray-600">{project.address}</p>}
                {project.description && <p className="text-gray-600">{project.description}</p>}
              </div>
            )}
          </div>

          {/* Özet */}
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <div className="border border-gray-300 rounded p-2">
              <p className="text-[10px] text-gray-500">İşlem Sayısı</p>
              <p className="font-bold text-sm">{rows.length}</p>
            </div>
            <div className="border border-gray-300 rounded p-2">
              <p className="text-[10px] text-gray-500">Toplam Borç</p>
              <p className="font-bold text-sm text-red-600">{formatCurrency(totalBorc)}</p>
            </div>
            <div className="border border-gray-300 rounded p-2">
              <p className="text-[10px] text-gray-500">Toplam Alacak</p>
              <p className="font-bold text-sm text-green-600">{formatCurrency(totalAlacak)}</p>
            </div>
            <div className="border-2 border-gray-800 rounded p-2">
              <p className="text-[10px] text-gray-500">Genel Bakiye</p>
              <p className={`font-bold text-sm ${balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(Math.abs(balance))} {balance >= 0 ? '(B)' : '(A)'}
              </p>
            </div>
          </div>

          {/* Hareketler */}
          <table className="w-full mt-4 text-[10px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-gray-100 text-gray-600 uppercase text-[9px]">
                <th className={`${cell} text-left border border-gray-300`}>Tarih</th>
                <th className={`${cell} text-left border border-gray-300`}>İşlem</th>
                <th className={`${cell} text-left border border-gray-300`}>Açıklama</th>
                <th className={`${cell} text-left border border-gray-300`}>Kategori</th>
                {showProject && <th className={`${cell} text-left border border-gray-300`}>İş/Proje</th>}
                <th className={`${cell} text-right border border-gray-300`}>Borç</th>
                <th className={`${cell} text-right border border-gray-300`}>Alacak</th>
                <th className={`${cell} text-right border border-gray-300`}>Bakiye</th>
              </tr>
            </thead>
            <tbody>
              {display.map((r, i) => (
                <tr key={i} className={i % 2 ? 'bg-gray-50' : ''}>
                  <td className={`${cell} border border-gray-300 whitespace-nowrap`}>{formatDateShort(r.date)}</td>
                  <td className={`${cell} border border-gray-300 whitespace-nowrap`}>{r.type}</td>
                  <td className={`${cell} border border-gray-300`}>{r.description || '-'}</td>
                  <td className={`${cell} border border-gray-300`}>{r.category || '-'}</td>
                  {showProject && <td className={`${cell} border border-gray-300`}>{r.projectName || 'Genel'}</td>}
                  <td className={`${cell} border border-gray-300 text-right text-red-600 whitespace-nowrap`}>{r.borc ? formatCurrency(r.borc) : '-'}</td>
                  <td className={`${cell} border border-gray-300 text-right text-green-600 whitespace-nowrap`}>{r.alacak ? formatCurrency(r.alacak) : '-'}</td>
                  <td className={`${cell} border border-gray-300 text-right font-semibold whitespace-nowrap`}>
                    {formatCurrency(Math.abs(r.balance))} {r.balance >= 0 ? '(B)' : '(A)'}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-200 font-bold">
                <td className={`${cell} border border-gray-400`} colSpan={showProject ? 5 : 4}>TOPLAM</td>
                <td className={`${cell} border border-gray-400 text-right text-red-700 whitespace-nowrap`}>{formatCurrency(totalBorc)}</td>
                <td className={`${cell} border border-gray-400 text-right text-green-700 whitespace-nowrap`}>{formatCurrency(totalAlacak)}</td>
                <td className={`${cell} border border-gray-400 text-right whitespace-nowrap`}>
                  {formatCurrency(Math.abs(balance))} {balance >= 0 ? '(B)' : '(A)'}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="mt-4 pt-2 border-t border-gray-200 text-center text-[9px] text-gray-400">
            Bu rapor SAGG Muhasebe ile elektronik ortamda düzenlenmiştir. · İşlemler en yeniden eskiye sıralanmıştır.
          </p>
        </div>

        <div className="p-4 bg-gray-50 flex justify-end space-x-2 no-print rounded-b-lg sticky bottom-0">
          <Button variant="secondary" onClick={onClose}>Kapat</Button>
          <Button variant="secondary" icon={Download} onClick={handlePdf} disabled={busy}>
            {busy ? 'Hazırlanıyor…' : 'PDF İndir'}
          </Button>
          <Button icon={Printer} onClick={handlePrint}>Yazdır</Button>
        </div>
      </div>
    </div>
  );
}

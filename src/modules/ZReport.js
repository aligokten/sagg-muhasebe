// --- Z Raporu: gün sonu kasa/banka hesap dökümleri ---
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileBarChart, Download, Printer, ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../utils';
import { downloadExcel } from '../exportExcel';
import {
  PageHeader, Card, Table, Td, EmptyState, StatCard, Button,
} from '../components/ui';

const printStyles = `@media print{
  @page { size: A4 portrait; margin: 12mm; }
  body *{visibility:hidden}
  #zreport-print-area,#zreport-print-area *{visibility:visible}
  #zreport-print-area{position:absolute;left:0;top:0;width:100%}
  .no-print{display:none}
}`;

const fmtDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
};

function exportReportExcel(report) {
  const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const blocks = [
    { heading: `Z RAPORU — ${fmtDate(report.id)}` },
    { rows: [
      ['Toplam Açılış', round(report.totals.openingBalance)],
      ['Toplam Giriş', round(report.totals.totalIn)],
      ['Toplam Çıkış', round(report.totals.totalOut)],
      ['Toplam Kapanış', round(report.totals.closingBalance)],
    ] },
  ];
  report.accounts.forEach((a) => {
    blocks.push({ heading: `${a.accountName} (${a.accountType})` });
    blocks.push({
      headers: ['İşlem', 'Açıklama', 'Giriş', 'Çıkış', 'Bakiye'],
      rows: [
        ...a.movements.map((m) => [m.type, m.description || '', m.in ? round(m.in) : '', m.out ? round(m.out) : '', round(m.balance)]),
        ['', 'Açılış / Kapanış', '', '', ''],
        ['Açılış Bakiyesi', '', '', '', round(a.openingBalance)],
        ['Kapanış Bakiyesi', '', '', '', round(a.closingBalance)],
      ],
    });
  });
  downloadExcel(`z-raporu-${report.id}`, blocks);
}

function ReportDetail({ report, scriptsLoaded }) {
  const printRef = useRef(null);
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
      const ratio = pw / canvas.width;
      let heightLeft = canvas.height * ratio;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, pw, canvas.height * ratio);
      heightLeft -= pdf.internal.pageSize.getHeight();
      while (heightLeft > 0) {
        position -= pdf.internal.pageSize.getHeight();
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pw, canvas.height * ratio);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }
      pdf.save(`z-raporu-${report.id}.pdf`);
    } catch (e) {
      alert('PDF oluşturulurken bir hata oluştu.');
      console.error(e);
    }
  };

  return (
    <div className="border-t border-gray-100">
      <div id="zreport-print-area" ref={printRef} className="bg-white p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-1">Z Raporu — {fmtDate(report.id)}</h2>
        <p className="text-xs text-gray-400 mb-4">Oluşturulma: {new Date(report.generatedAt).toLocaleString('tr-TR')}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard title="Açılış" value={formatCurrency(report.totals.openingBalance)} color="text-gray-700" />
          <StatCard title="Giriş" value={formatCurrency(report.totals.totalIn)} color="text-green-600" />
          <StatCard title="Çıkış" value={formatCurrency(report.totals.totalOut)} color="text-red-600" />
          <StatCard title="Kapanış" value={formatCurrency(report.totals.closingBalance)} color="text-orange-600" />
        </div>

        {report.accounts.map((a) => (
          <div key={a.accountId} className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="font-semibold text-gray-800 text-sm">{a.accountName} <span className="text-gray-400 font-normal">({a.accountType})</span></h3>
              <span className="text-xs text-gray-500">Açılış {formatCurrency(a.openingBalance)} → Kapanış <b className="text-gray-800">{formatCurrency(a.closingBalance)}</b></span>
            </div>
            {a.movements.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-2">Bu gün hareket yok.</p>
            ) : (
              <Table headers={[{ label: 'İşlem' }, { label: 'Açıklama' }, { label: 'Giriş', align: 'right' }, { label: 'Çıkış', align: 'right' }, { label: 'Bakiye', align: 'right' }]}>
                {a.movements.map((m, i) => (
                  <tr key={i}>
                    <Td className="text-gray-600">{m.type}</Td>
                    <Td className="text-gray-600">{m.description}</Td>
                    <Td align="right" className="text-green-600">{m.in ? formatCurrency(m.in) : '-'}</Td>
                    <Td align="right" className="text-red-600">{m.out ? formatCurrency(m.out) : '-'}</Td>
                    <Td align="right" className="font-medium text-gray-800">{formatCurrency(m.balance)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        ))}
      </div>
      <div className="p-4 bg-gray-50 flex justify-end gap-2 no-print">
        <style>{printStyles}</style>
        <Button variant="secondary" icon={Download} onClick={() => exportReportExcel(report)}>Excel'e Aktar</Button>
        <Button variant="secondary" icon={Download} onClick={handlePdf}>PDF İndir</Button>
        <Button icon={Printer} onClick={handlePrint}>Yazdır</Button>
      </div>
    </div>
  );
}

export default function ZReport({ data }) {
  const { zReports = [], scriptsLoaded } = data;
  const [openDate, setOpenDate] = useState(null);

  const reports = useMemo(
    () => [...zReports].sort((a, b) => (a.id < b.id ? 1 : -1)),
    [zReports]
  );

  useEffect(() => {
    try { localStorage.setItem('sagg-zreport-lastseen', reports[0]?.id || ''); } catch { /* yoksay */ }
  }, [reports]);

  return (
    <div>
      <PageHeader title="Z Raporu" subtitle="Her gün için otomatik oluşturulan kasa/banka gün sonu dökümü" />

      <Card>
        {reports.length === 0 ? (
          <EmptyState message="Henüz Z raporu oluşturulmadı. İlk rapor, gece yarısından sonra uygulama açıldığında otomatik oluşur." icon={FileBarChart} />
        ) : (
          <div className="divide-y divide-gray-100">
            {reports.map((r) => (
              <div key={r.id}>
                <button
                  onClick={() => setOpenDate(openDate === r.id ? null : r.id)}
                  className="flex items-center justify-between w-full px-4 py-3 hover:bg-gray-50 text-left"
                >
                  <span className="flex items-center gap-2 font-medium text-gray-800">
                    {openDate === r.id ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    {fmtDate(r.id)}
                  </span>
                  <span className="text-sm text-gray-500">
                    Giriş <span className="text-green-600 font-medium">{formatCurrency(r.totals?.totalIn)}</span> · Çıkış <span className="text-red-600 font-medium">{formatCurrency(r.totals?.totalOut)}</span> · Kapanış <b className="text-gray-800">{formatCurrency(r.totals?.closingBalance)}</b>
                  </span>
                </button>
                {openDate === r.id && <ReportDetail report={r} scriptsLoaded={scriptsLoaded} />}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

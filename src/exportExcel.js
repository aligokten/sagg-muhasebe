// --- Excel (.xls) dışa aktarma yardımcıları ---
// Bağımlılıksız: HTML tablo, Excel'in açabildiği .xls olarak indirilir.
import { formatNumber } from './utils';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Tutarı Türkçe biçimde metin olarak verir (Excel'de düzgün görünür).
export const tl = (n) => formatNumber(n, 2);

// blocks: [{ heading?, headers?: [], rows?: [[...]], }]
export function buildExcel(blocks) {
  let body = '';
  blocks.forEach((b) => {
    if (b.heading) body += `<tr><td colspan="8" style="font-weight:bold;font-size:13px;">${esc(b.heading)}</td></tr>`;
    if (b.headers) {
      body += '<tr>' + b.headers.map((h) => `<td style="font-weight:bold;background:#e8eef5;border:1px solid #c9d3df;">${esc(h)}</td>`).join('') + '</tr>';
    }
    (b.rows || []).forEach((r) => {
      body += '<tr>' + r.map((c) => `<td style="border:1px solid #dfe5ec;">${esc(c)}</td>`).join('') + '</tr>';
    });
    body += '<tr><td>&nbsp;</td></tr>';
  });
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sayfa1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:12px;">${body}</table></body></html>`;
}

export function downloadExcel(filename, blocks) {
  const html = buildExcel(blocks);
  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safe = filename.replace(/[\\/:*?"<>|]+/g, '_');
  const a = document.createElement('a');
  a.href = url;
  a.download = safe.endsWith('.xls') ? safe : `${safe}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

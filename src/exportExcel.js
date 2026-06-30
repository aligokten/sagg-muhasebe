// --- Excel dışa aktarma (Excel 2003 SpreadsheetML) ---
// Bağımlılıksız. Sayılar gerçek sayı tipiyle yazılır (toplanabilir, locale-bağımsız);
// metinler UTF-8 ile düzgün görünür.
import { formatNumber } from './utils';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Geriye dönük uyumluluk için (artık ham sayı geçilmesi tercih edilir).
export const tl = (n) => formatNumber(n, 2);

const cell = (v) => {
  if (typeof v === 'number' && isFinite(v)) {
    return `<Cell ss:StyleID="num"><Data ss:Type="Number">${v}</Data></Cell>`;
  }
  const s = String(v ?? '');
  if (s === '') return '<Cell/>';
  return `<Cell><Data ss:Type="String">${esc(s)}</Data></Cell>`;
};

const headerCell = (v) => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${esc(v)}</Data></Cell>`;

// blocks: [{ heading?, headers?: string[], rows?: (string|number)[][] }]
export function buildSpreadsheetML(blocks) {
  let rows = '';
  blocks.forEach((b) => {
    if (b.heading) rows += `<Row><Cell ss:StyleID="title"><Data ss:Type="String">${esc(b.heading)}</Data></Cell></Row>`;
    if (b.headers) rows += '<Row>' + b.headers.map(headerCell).join('') + '</Row>';
    (b.rows || []).forEach((r) => { rows += '<Row>' + r.map(cell).join('') + '</Row>'; });
    rows += '<Row></Row>';
  });
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<Styles>` +
    `<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>` +
    `<Style ss:ID="title"><Font ss:Bold="1" ss:Size="13"/></Style>` +
    `<Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#E8EEF5" ss:Pattern="Solid"/></Style>` +
    `<Style ss:ID="num"><NumberFormat ss:Format="#,##0.00"/></Style>` +
    `</Styles>` +
    `<Worksheet ss:Name="Sayfa1"><Table>${rows}</Table></Worksheet></Workbook>`;
}

export function downloadExcel(filename, blocks) {
  const xml = buildSpreadsheetML(blocks);
  const blob = new Blob(['﻿' + xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
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

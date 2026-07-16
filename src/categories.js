// --- Tahsilat / Ödeme / hareket kategorileri (Defter.net örneğine göre) ---
import React from 'react';
import { Select } from './components/ui';

// single: tek kategori · group+items: üst kategori ve alt kalemleri
export const TX_CATEGORIES = [
  { group: 'İnşaat Ödemesi', items: ['İnşaat Ödemesi', 'Beton', 'İnşaat Malzemesi', 'İşçilik'] },
  { single: 'Nakit' },
  { group: 'Ödeme', items: ['Ödeme', 'Belediye Harç Ödemesi', 'Kurum Ödemesi'] },
  { single: 'Proje Bedeli' },
  { single: 'Tahsilat' },
  { single: 'Aidat' },
  { single: 'Bağış' },
  { group: 'Fatura', items: ['Fatura', 'Elektrik', 'Isınma', 'İnternet', 'Su', 'Telefon', 'TV'] },
  { single: 'Müellif Ödemesi' },
  { single: 'Maaş' },
  { single: 'Kira' },
  { single: 'Yakıt / Ulaşım' },
  { single: 'Nakliye' },
  { single: 'Yemek' },
  { single: 'Vergi / SGK' },
  { single: 'Komisyon' },
  { single: 'Diğer' },
];

// Tüm kategori adlarını düz liste olarak döner.
export const flatCategories = () => {
  const out = [];
  TX_CATEGORIES.forEach((c) => {
    if (c.single) out.push(c.single);
    else c.items.forEach((it) => out.push(it));
  });
  return out;
};

// Gruplu kategori <select> bileşeni.
export function CategorySelect({ placeholder = 'Kategori', ...props }) {
  return (
    <Select {...props}>
      <option value="">{placeholder}</option>
      {TX_CATEGORIES.map((c, i) =>
        c.single ? (
          <option key={i} value={c.single}>{c.single}</option>
        ) : (
          <optgroup key={i} label={c.group}>
            {c.items.map((it) => (
              <option key={it} value={it}>{it === c.group ? it : `— ${it}`}</option>
            ))}
          </optgroup>
        )
      )}
    </Select>
  );
}

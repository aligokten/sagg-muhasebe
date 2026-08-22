// Firestore'da kullanıcıya özel dinlenen koleksiyonlar
export const COLLECTIONS = [
  'customers', 'projects', 'authors', 'subcontracts', 'products', 'invoices', 'quotes', 'orders', 'waybills',
  'transactions', 'accounts', 'expenses', 'incomes', 'checks',
  'personnel', 'stockMovements', 'reminders', 'investments',
  'subcontractors', 'contractorAssignments', 'projectLinks', 'zReports',
];

// "name" alanına göre alfabetik listelenen koleksiyonlar (cari, müellif,
// taşeron, personel, ürün, kasa/banka, iş/proje). Belge ve hareket
// koleksiyonları tarih/numara sırasında kaldığı için buraya dahil değildir.
export const NAME_SORTED_COLLECTIONS = [
  'customers', 'authors', 'subcontractors', 'personnel', 'products', 'accounts', 'projects',
];

// Abonelik paketi seçenekleri (müşteri seçimi + yönetici fiyatlandırması ortak anahtarları)
export const PLAN_OPTIONS = [
  { key: '1m', label: 'Aylık' },
  { key: '3m', label: '3 Aylık' },
  { key: '6m', label: '6 Aylık' },
  { key: '12m', label: 'Yıllık' },
];

// Abonelik süresi dolmadan önce hatırlatma bildiriminin gösterileceği gün sayıları (paket bazlı)
export const RENEWAL_REMINDER_DAYS = {
  '1m': [7, 5, 2],
  '3m': [15, 10, 7, 5, 2],
  '6m': [30, 15, 7, 2],
  '12m': [45, 30, 15, 7, 2],
};

// Firestore'da kullanıcıya özel dinlenen koleksiyonlar
export const COLLECTIONS = [
  'customers', 'projects', 'authors', 'subcontracts', 'products', 'invoices', 'quotes', 'orders', 'waybills',
  'transactions', 'accounts', 'expenses', 'incomes', 'checks',
  'personnel', 'stockMovements', 'reminders',
  'subcontractors', 'contractorAssignments', 'projectLinks', 'zReports',
];

// Abonelik paketi seçenekleri (müşteri seçimi + yönetici fiyatlandırması ortak anahtarları)
export const PLAN_OPTIONS = [
  { key: '1m', label: 'Aylık' },
  { key: '3m', label: '3 Aylık' },
  { key: '6m', label: '6 Aylık' },
  { key: '12m', label: 'Yıllık' },
];

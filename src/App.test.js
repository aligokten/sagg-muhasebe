import { numberToWordsTr, computeTotals, vatFromGross } from './utils';
import { cariMovements, accountMovements, productStock } from './finance';

test('numberToWordsTr para tutarını yazıya çevirir', () => {
  expect(numberToWordsTr(0)).toBe('Sıfır Türk Lirası');
  expect(numberToWordsTr(1500.5)).toContain('Bin');
  expect(numberToWordsTr(1500.5)).toContain('Kuruş');
});

test('computeTotals iskonto ve KDV ile toplamı hesaplar', () => {
  const items = [{ quantity: 2, unitPrice: 100, discount: 10, vatRate: 20 }];
  const t = computeTotals(items);
  expect(t.subTotal).toBe(200);
  expect(t.discountTotal).toBe(20);
  expect(t.vatTotal).toBeCloseTo(36); // (200-20)*0.20
  expect(t.grandTotal).toBeCloseTo(216);
});

test('vatFromGross KDV dahil tutardan KDV ayıklar', () => {
  expect(vatFromGross(120, 20)).toBeCloseTo(20);
});

test('cariMovements satış faturası borç olarak yansır', () => {
  const data = {
    customers: [{ id: 'c1', openingBalance: 0 }],
    invoices: [{ id: 'i1', customerId: 'c1', type: 'sales', grandTotal: 1000, date: new Date() }],
    transactions: [{ id: 't1', customerId: 'c1', type: 'tahsilat', amount: 400, date: new Date() }],
  };
  const { balance } = cariMovements('c1', data);
  expect(balance).toBe(600); // 1000 borç - 400 tahsilat
});

test('accountMovements giriş ve çıkışları toplar', () => {
  const data = {
    accounts: [{ id: 'a1', openingBalance: 100 }],
    transactions: [
      { id: 't1', accountId: 'a1', type: 'tahsilat', direction: 'in', amount: 500, date: new Date() },
      { id: 't2', accountId: 'a1', type: 'odeme', direction: 'out', amount: 200, date: new Date() },
    ],
    expenses: [],
    incomes: [],
  };
  expect(accountMovements('a1', data).balance).toBe(400);
});

test('cariMovements iptal faturayı saymaz, cari-bağlı gelir/gideri sayar', () => {
  const data = {
    customers: [{ id: 'c1', openingBalance: 0 }],
    invoices: [
      { id: 'i1', customerId: 'c1', type: 'sales', grandTotal: 1000, date: new Date() },
      { id: 'i2', customerId: 'c1', type: 'sales', grandTotal: 999, status: 'cancelled', date: new Date() },
    ],
    incomes: [{ id: 'g1', customerId: 'c1', amount: 300, date: new Date() }],   // alacak
    expenses: [{ id: 'e1', customerId: 'c1', amount: 200, date: new Date() }],  // borç
  };
  // 1000 (borç) - 300 (gelir/alacak) + 200 (gider/borç) = 900 ; iptal fatura sayılmaz
  expect(cariMovements('c1', data).balance).toBe(900);
});

test('cariMovements proje filtresi yalnızca o işe ait hareketleri sayar', () => {
  const data = {
    customers: [{ id: 'c1', openingBalance: 0 }],
    projects: [{ id: 'pr1', customerId: 'c1', name: 'Arsa A' }, { id: 'pr2', customerId: 'c1', name: 'Arsa B' }],
    invoices: [
      { id: 'i1', customerId: 'c1', projectId: 'pr1', type: 'sales', grandTotal: 1000, date: new Date() },
      { id: 'i2', customerId: 'c1', projectId: 'pr2', type: 'sales', grandTotal: 500, date: new Date() },
    ],
    transactions: [{ id: 't1', customerId: 'c1', projectId: 'pr1', type: 'tahsilat', amount: 400, date: new Date() }],
  };
  // Genel bakiye: 1000 + 500 - 400 = 1100
  expect(cariMovements('c1', data).balance).toBe(1100);
  // Sadece Arsa A: 1000 - 400 = 600
  expect(cariMovements('c1', data, 'pr1').balance).toBe(600);
  // Sadece Arsa B: 500
  expect(cariMovements('c1', data, 'pr2').balance).toBe(500);
});

test('productStock alış ve satışları hesaba katar', () => {
  const data = {
    products: [{ id: 'p1', openingStock: 10 }],
    invoices: [
      { type: 'purchase', items: [{ productId: 'p1', quantity: 5 }] },
      { type: 'sales', items: [{ productId: 'p1', quantity: 3 }] },
    ],
    stockMovements: [],
  };
  expect(productStock('p1', data)).toBe(12);
});

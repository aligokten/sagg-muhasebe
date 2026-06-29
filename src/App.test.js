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

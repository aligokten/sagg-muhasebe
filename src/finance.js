// --- Muhasebe hesaplama motoru ---
// Bakiyeler ve hareketler kayıtlardan dinamik olarak türetilir.
// Böylece yazma anında veri tutarsızlığı oluşmaz.
import { toDate } from './utils';

const ts = (d) => {
  const x = toDate(d);
  return x && !isNaN(x) ? x.getTime() : 0;
};

// Bir cari hesabın tüm hareketlerini (ekstre) ve bakiyesini döner.
// Bakiye = Borç - Alacak (pozitif => cari bize borçlu).
export const cariMovements = (customerId, data) => {
  const { invoices = [], transactions = [], customers = [], checks = [] } = data;
  const customer = customers.find((c) => c.id === customerId);
  const rows = [];

  if (customer && Number(customer.openingBalance)) {
    const amt = Number(customer.openingBalance) || 0;
    const isBorc = (customer.openingType || 'borc') === 'borc';
    rows.push({
      date: customer.openingDate || customer.createdAt,
      type: 'Açılış',
      description: 'Devir bakiyesi',
      borc: isBorc ? amt : 0,
      alacak: isBorc ? 0 : amt,
    });
  }

  invoices
    .filter((i) => i.customerId === customerId)
    .forEach((i) => {
      const isSales = i.type !== 'purchase';
      rows.push({
        date: i.date,
        type: isSales ? 'Satış Faturası' : 'Alış Faturası',
        description: `${i.docNumber || ''}`.trim(),
        borc: isSales ? Number(i.grandTotal) || 0 : 0,
        alacak: isSales ? 0 : Number(i.grandTotal) || 0,
        ref: { kind: 'invoice', id: i.id },
      });
    });

  transactions
    .filter((t) => t.customerId === customerId)
    .forEach((t) => {
      const amt = Number(t.amount) || 0;
      let borc = 0;
      let alacak = 0;
      let label = t.description || '';
      if (t.type === 'tahsilat') {
        alacak = amt;
        label = label || 'Tahsilat';
      } else if (t.type === 'odeme') {
        borc = amt;
        label = label || 'Ödeme';
      } else {
        if (t.cariEffect === 'borc') borc = amt;
        else alacak = amt;
      }
      rows.push({ date: t.date, type: 'Hareket', description: label, borc, alacak, ref: { kind: 'transaction', id: t.id } });
    });

  checks
    .filter((c) => c.customerId === customerId)
    .forEach((c) => {
      const amt = Number(c.amount) || 0;
      const received = c.direction === 'received';
      rows.push({
        date: c.dueDate || c.date,
        type: c.type === 'senet' ? 'Senet' : 'Çek',
        description: `${received ? 'Alınan' : 'Verilen'} ${c.serialNo || ''}`.trim(),
        borc: received ? 0 : amt,
        alacak: received ? amt : 0,
        ref: { kind: 'check', id: c.id },
      });
    });

  rows.sort((a, b) => ts(a.date) - ts(b.date));
  let running = 0;
  rows.forEach((r) => {
    running += r.borc - r.alacak;
    r.balance = running;
  });
  return { rows, balance: running };
};

export const cariBalance = (customerId, data) => cariMovements(customerId, data).balance;

// Tüm carilerin bakiyelerini tek seferde hesaplar (performanslı).
export const allCariBalances = (data) => {
  const map = {};
  (data.customers || []).forEach((c) => {
    map[c.id] = cariBalance(c.id, data);
  });
  return map;
};

// Bir kasa/banka hesabının hareketleri ve bakiyesi.
export const accountMovements = (accountId, data) => {
  const { accounts = [], transactions = [], expenses = [], incomes = [] } = data;
  const account = accounts.find((a) => a.id === accountId);
  const rows = [];

  if (account && Number(account.openingBalance)) {
    rows.push({
      date: account.openingDate || account.createdAt,
      type: 'Açılış',
      description: 'Açılış bakiyesi',
      in: Number(account.openingBalance) || 0,
      out: 0,
    });
  }

  transactions.forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'transfer') {
      if (t.fromAccountId === accountId)
        rows.push({ date: t.date, type: 'Transfer', description: t.description || 'Virman (çıkış)', in: 0, out: amt });
      if (t.toAccountId === accountId)
        rows.push({ date: t.date, type: 'Transfer', description: t.description || 'Virman (giriş)', in: amt, out: 0 });
      return;
    }
    if (t.accountId !== accountId) return;
    const dir = t.direction || (t.type === 'tahsilat' ? 'in' : t.type === 'odeme' ? 'out' : null);
    if (!dir) return;
    rows.push({
      date: t.date,
      type: t.type === 'tahsilat' ? 'Tahsilat' : t.type === 'odeme' ? 'Ödeme' : 'Hareket',
      description: t.description || '',
      in: dir === 'in' ? amt : 0,
      out: dir === 'out' ? amt : 0,
    });
  });

  incomes
    .filter((i) => i.accountId === accountId)
    .forEach((i) =>
      rows.push({ date: i.date, type: 'Gelir', description: i.description || i.category || '', in: Number(i.amount) || 0, out: 0 })
    );

  expenses
    .filter((e) => e.accountId === accountId)
    .forEach((e) =>
      rows.push({ date: e.date, type: 'Gider', description: e.description || e.category || '', in: 0, out: Number(e.amount) || 0 })
    );

  rows.sort((a, b) => ts(a.date) - ts(b.date));
  let running = 0;
  rows.forEach((r) => {
    running += r.in - r.out;
    r.balance = running;
  });
  return { rows, balance: running };
};

export const accountBalance = (accountId, data) => accountMovements(accountId, data).balance;

export const allAccountBalances = (data) => {
  const map = {};
  (data.accounts || []).forEach((a) => {
    map[a.id] = accountBalance(a.id, data);
  });
  return map;
};

// Ürün stok adedini dinamik hesaplar.
// Stok = açılış + alışlar - satışlar + manuel düzeltmeler
export const productStock = (productId, data) => {
  const { products = [], invoices = [], stockMovements = [] } = data;
  const product = products.find((p) => p.id === productId);
  let stock = Number(product?.openingStock) || 0;
  invoices.forEach((inv) => {
    (inv.items || []).forEach((it) => {
      if (it.productId !== productId) return;
      const qty = Number(it.quantity) || 0;
      stock += inv.type === 'purchase' ? qty : -qty;
    });
  });
  stockMovements
    .filter((m) => m.productId === productId)
    .forEach((m) => {
      stock += m.direction === 'in' ? Number(m.quantity) || 0 : -(Number(m.quantity) || 0);
    });
  return stock;
};

export const allProductStocks = (data) => {
  const map = {};
  (data.products || []).forEach((p) => {
    map[p.id] = productStock(p.id, data);
  });
  return map;
};

// --- Muhasebe hesaplama motoru ---
// Bakiyeler ve hareketler kayıtlardan dinamik olarak türetilir.
// Böylece yazma anında veri tutarsızlığı oluşmaz.
import { toDate } from './utils';

const ts = (d) => {
  const x = toDate(d);
  return x && !isNaN(x) ? x.getTime() : 0;
};

// Bir cari hesabın hareketlerini (ekstre) ve bakiyesini döner.
// Bakiye = Borç - Alacak (pozitif => cari bize borçlu).
// projectId verilirse yalnızca o işe/projeye ait hareketler döner
// (açılış bakiyesi de o projenin açılışı olur). projectId null ise
// carinin tüm hareketleri (tüm işler + işsiz kayıtlar) döner.
export const cariMovements = (customerId, data, projectId = null) => {
  const { invoices = [], transactions = [], customers = [], checks = [], projects = [], expenses = [], incomes = [] } = data;
  const customer = customers.find((c) => c.id === customerId);
  const projName = (id) => projects.find((p) => p.id === id)?.name || '';
  const matchProj = (rec) => (projectId == null ? true : (rec.projectId || null) === projectId);
  const rows = [];

  // Açılış bakiyesi
  if (projectId == null) {
    if (customer && Number(customer.openingBalance)) {
      const amt = Number(customer.openingBalance) || 0;
      const isBorc = (customer.openingType || 'borc') === 'borc';
      rows.push({ date: customer.openingDate || customer.createdAt, type: 'Açılış', description: 'Devir bakiyesi', borc: isBorc ? amt : 0, alacak: isBorc ? 0 : amt, projectId: null, projectName: '' });
    }
  } else {
    const proj = projects.find((p) => p.id === projectId);
    if (proj && Number(proj.openingBalance)) {
      const amt = Number(proj.openingBalance) || 0;
      const isBorc = (proj.openingType || 'borc') === 'borc';
      rows.push({ date: proj.openingDate || proj.createdAt, type: 'Açılış', description: 'İş açılış bakiyesi', borc: isBorc ? amt : 0, alacak: isBorc ? 0 : amt, projectId, projectName: proj.name });
    }
  }

  invoices
    .filter((i) => i.customerId === customerId && i.status !== 'cancelled' && matchProj(i))
    .forEach((i) => {
      const isSales = i.type !== 'purchase';
      rows.push({
        date: i.date,
        type: isSales ? 'Satış Faturası' : 'Alış Faturası',
        description: `${i.docNumber || ''}`.trim(),
        borc: isSales ? Number(i.grandTotal) || 0 : 0,
        alacak: isSales ? 0 : Number(i.grandTotal) || 0,
        projectId: i.projectId || null,
        projectName: projName(i.projectId),
        ref: { kind: 'invoice', id: i.id },
      });
    });

  transactions
    .filter((t) => t.customerId === customerId && matchProj(t))
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
      rows.push({ date: t.date, type: 'Hareket', description: label, category: t.category || '', borc, alacak, projectId: t.projectId || null, projectName: projName(t.projectId), ref: { kind: 'transaction', id: t.id } });
    });

  checks
    .filter((c) => c.customerId === customerId && matchProj(c))
    .forEach((c) => {
      const amt = Number(c.amount) || 0;
      const received = c.direction === 'received';
      rows.push({
        date: c.dueDate || c.date,
        type: c.type === 'senet' ? 'Senet' : 'Çek',
        description: `${received ? 'Alınan' : 'Verilen'} ${c.serialNo || ''}`.trim(),
        borc: received ? 0 : amt,
        alacak: received ? amt : 0,
        projectId: c.projectId || null,
        projectName: projName(c.projectId),
        ref: { kind: 'check', id: c.id },
      });
    });

  // Cari ile ilişkilendirilmiş gelir/giderler
  incomes
    .filter((i) => i.customerId === customerId && matchProj(i))
    .forEach((i) => {
      const amt = Number(i.amount) || 0;
      rows.push({ date: i.date, type: 'Gelir', description: i.description || i.category || 'Gelir', category: i.category || '', borc: 0, alacak: amt, projectId: i.projectId || null, projectName: projName(i.projectId), ref: { kind: 'income', id: i.id } });
    });
  expenses
    .filter((e) => e.customerId === customerId && matchProj(e))
    .forEach((e) => {
      const amt = Number(e.amount) || 0;
      rows.push({ date: e.date, type: 'Gider', description: e.description || e.category || 'Gider', category: e.category || '', borc: amt, alacak: 0, projectId: e.projectId || null, projectName: projName(e.projectId), ref: { kind: 'expense', id: e.id } });
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

// Bir işin/projenin bakiyesi ve hareketleri.
export const projectMovements = (project, data) => cariMovements(project.customerId, data, project.id);
export const projectBalance = (project, data) => projectMovements(project, data).balance;

// Verilen cariye ait işlerin bakiyelerini hesaplar.
export const customerProjectBalances = (customerId, data) => {
  const map = {};
  (data.projects || [])
    .filter((p) => p.customerId === customerId)
    .forEach((p) => {
      map[p.id] = projectBalance(p, data);
    });
  return map;
};

// Tüm carilerin bakiyelerini tek seferde hesaplar (performanslı).
export const allCariBalances = (data) => {
  const map = {};
  (data.customers || []).forEach((c) => {
    map[c.id] = cariBalance(c.id, data);
  });
  return map;
};

// --- Müellif / taşeron (proje bazlı) hesaplamaları ---
// Bir müellif atamasına (subcontract) yapılan toplam ödeme.
export const subcontractPaid = (subcontractId, data) =>
  (data.transactions || [])
    .filter((t) => t.subcontractId === subcontractId)
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

// Bir müellif atamasının kalan borcu = sözleşme bedeli - ödenen.
export const subcontractRemaining = (sc, data) =>
  (Number(sc.agreedAmount) || 0) - subcontractPaid(sc.id, data);

// Bir müellifin tüm projelerdeki toplam sözleşme / ödenen / kalan tutarı.
export const authorTotals = (authorId, data) => {
  const subs = (data.subcontracts || []).filter((s) => s.authorId === authorId);
  const agreed = subs.reduce((s, x) => s + (Number(x.agreedAmount) || 0), 0);
  const paid = (data.transactions || [])
    .filter((t) => t.authorId === authorId)
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  return { agreed, paid, remaining: agreed - paid };
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
    if (inv.status === 'cancelled') return;
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

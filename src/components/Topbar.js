// --- Üst bar: arama, takvim, bildirim, profil (glassmorphism açılır menüler) ---
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Menu, Search, Calendar, Bell, Mail, Settings as SettingsIcon, LogOut,
  Sun, Moon, Users, Package, Receipt, AlertTriangle, ScrollText, CalendarClock, FileBarChart,
  User, UserRound, Smile, Cat, Crown, CreditCard, Clock,
} from 'lucide-react';
import { allProductStocks } from '../finance';
import { toDate, formatDateShort, daysBetween } from '../utils';

// Profil ikonu seçenekleri (kullanıcı 5 seçenekten birini seçebilir)
export const AVATARS = { user: User, round: UserRound, smile: Smile, cat: Cat, crown: Crown };

const Pop = ({ children, onClose, width = 'w-80' }) => (
  <>
    <div className="fixed inset-0 z-30" onClick={onClose} />
    <div className={`absolute right-0 mt-2 ${width} max-w-[92vw] rounded-2xl glass p-2 z-40 text-gray-700 dark:text-gray-100`}>
      {children}
    </div>
  </>
);

const iconBtn = 'relative flex items-center justify-center w-10 h-10 rounded-full glass text-gray-600 dark:text-gray-200 hover:opacity-90';

export default function Topbar({ data, setPage, onOpenMobile, userEmail, onLogout, dark, toggleDark, logo, avatar = 'user', setAvatar, pendingPaymentRequests = 0, renewalReminderDays = null }) {
  const { customers = [], products = [], invoices = [], reminders = [], checks = [], zReports = [] } = data;
  const [open, setOpen] = useState(null); // 'cal' | 'bell' | 'profile' | null
  const [q, setQ] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setQ(''); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const stocks = useMemo(() => allProductStocks(data), [data]);

  // Arama sonuçları
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const out = [];
    customers.filter((c) => c.name?.toLowerCase().includes(s)).slice(0, 4).forEach((c) => out.push({ icon: Users, label: c.name, sub: 'Cari Hesap', page: 'customers' }));
    products.filter((p) => p.name?.toLowerCase().includes(s) || p.code?.toLowerCase().includes(s)).slice(0, 4).forEach((p) => out.push({ icon: Package, label: p.name, sub: 'Ürün/Stok', page: 'products' }));
    invoices.filter((i) => i.docNumber?.toLowerCase().includes(s) || i.customerSnapshot?.name?.toLowerCase().includes(s)).slice(0, 4).forEach((i) => out.push({ icon: Receipt, label: `${i.docNumber} · ${i.customerSnapshot?.name || ''}`, sub: 'Fatura', page: 'invoices' }));
    return out.slice(0, 10);
  }, [q, customers, products, invoices]);

  // Bildirimler
  const notifications = useMemo(() => {
    const list = [];
    const unpaid = invoices.filter((i) => (i.type || 'sales') === 'sales' && i.status !== 'paid' && i.status !== 'cancelled').length;
    if (unpaid) list.push({ icon: Receipt, color: 'text-amber-600', label: `${unpaid} ödenmemiş satış faturası`, page: 'invoices' });
    const overdue = reminders.filter((r) => !r.done && daysBetween(new Date(), r.date) < 0).length;
    if (overdue) list.push({ icon: CalendarClock, color: 'text-rose-600', label: `${overdue} geciken hatırlatıcı`, page: 'agenda' });
    const low = products.filter((p) => p.type !== 'service' && (stocks[p.id] || 0) <= (p.minStock || 0)).length;
    if (low) list.push({ icon: AlertTriangle, color: 'text-rose-600', label: `${low} ürün kritik stokta`, page: 'products' });
    const dueChecks = checks.filter((c) => c.status === 'portfolio' && daysBetween(new Date(), c.dueDate) <= 7).length;
    if (dueChecks) list.push({ icon: ScrollText, color: 'text-orange-600', label: `${dueChecks} çek/senet vadesi yakın`, page: 'checks' });
    const latestReport = zReports.reduce((max, r) => (r.id > max ? r.id : max), '');
    let lastSeen = '';
    try { lastSeen = localStorage.getItem('sagg-zreport-lastseen') || ''; } catch { /* yoksay */ }
    if (latestReport && latestReport > lastSeen) list.push({ icon: FileBarChart, color: 'text-sky-600', label: `${latestReport.split('-').reverse().join('.')} Z raporu hazır`, page: 'zreport' });
    if (pendingPaymentRequests > 0) list.push({ icon: CreditCard, color: 'text-orange-600', label: `${pendingPaymentRequests} bekleyen ödeme bildirimi`, page: 'admin' });
    if (renewalReminderDays != null) list.push({ icon: Clock, color: 'text-orange-600', label: `Aboneliğinizin süresi ${renewalReminderDays} gün sonra doluyor`, page: 'settings' });
    return list;
  }, [invoices, reminders, products, checks, stocks, zReports, pendingPaymentRequests, renewalReminderDays]);

  // Takvim: yaklaşan hatırlatıcı + çek vadeleri
  const upcoming = useMemo(() => {
    const items = [];
    reminders.filter((r) => !r.done).forEach((r) => items.push({ date: toDate(r.date), label: r.title, type: 'Hatırlatıcı', page: 'agenda' }));
    checks.filter((c) => c.status === 'portfolio').forEach((c) => items.push({ date: toDate(c.dueDate), label: `${c.type === 'senet' ? 'Senet' : 'Çek'} · ${c.customerName || ''}`, type: 'Vade', page: 'checks' }));
    return items.filter((x) => x.date && daysBetween(new Date(), x.date) >= -1).sort((a, b) => a.date - b.date).slice(0, 6);
  }, [reminders, checks]);

  const go = (page) => { setPage(page); setOpen(null); setQ(''); };
  const AvatarIcon = AVATARS[avatar] || User;

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 sm:gap-3 h-16 px-3 sm:px-6 glass border-b border-white/30 dark:border-white/10 no-print">
      <button onClick={onOpenMobile} className="md:hidden flex items-center justify-center w-10 h-10 rounded-full glass text-gray-600 dark:text-gray-200"><Menu size={20} /></button>

      {logo && (
        <button onClick={() => go('dashboard')} title="Gösterge Paneli" className="md:hidden flex items-center hover:opacity-80">
          <img src={logo} alt="Logo" className="h-8 max-w-[110px] object-contain" />
        </button>
      )}

      {/* Arama */}
      <div className="relative flex-1 max-w-md" ref={searchRef}>
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari, ürün, fatura ara..."
          className="w-full pl-9 pr-3 py-2 rounded-full glass text-sm text-gray-700 dark:text-gray-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-orange-400"
        />
        {q.trim().length >= 2 && (
          <div className="absolute left-0 right-0 mt-2 rounded-2xl glass p-2 z-40">
            {results.length === 0 ? (
              <p className="text-sm text-gray-400 px-3 py-3 text-center">Sonuç yok</p>
            ) : results.map((r, i) => (
              <button key={i} onClick={() => go(r.page)} className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left">
                <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center"><r.icon size={15} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{r.label}</span>
                  <span className="block text-xs text-gray-400">{r.sub}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 hidden sm:block" />

      {/* Koyu mod */}
      <button onClick={toggleDark} title={dark ? 'Açık mod' : 'Koyu mod'} className={`${iconBtn} text-gray-600 dark:text-yellow-300`}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>

      {/* Takvim */}
      <div className="relative">
        <button onClick={() => setOpen(open === 'cal' ? null : 'cal')} className={iconBtn} title="Takvim"><Calendar size={18} /></button>
        {open === 'cal' && (
          <Pop onClose={() => setOpen(null)}>
            <div className="flex justify-between items-center px-2 py-1.5">
              <span className="text-sm font-semibold">Yaklaşanlar</span>
              <button onClick={() => go('agenda')} className="text-xs text-orange-600">Ajanda</button>
            </div>
            {upcoming.length === 0 ? <p className="text-sm text-gray-400 px-3 py-4 text-center">Yaklaşan kayıt yok</p> : upcoming.map((u, i) => (
              <button key={i} onClick={() => go(u.page)} className="flex items-center justify-between w-full px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left">
                <span className="min-w-0"><span className="block text-sm truncate">{u.label}</span><span className="text-xs text-gray-400">{u.type}</span></span>
                <span className="text-xs text-gray-500 whitespace-nowrap ml-2">{formatDateShort(u.date)}</span>
              </button>
            ))}
          </Pop>
        )}
      </div>

      {/* Mesaj/Notlar */}
      <button onClick={() => go('agenda')} className={`${iconBtn} hidden sm:flex`} title="Notlar / Ajanda"><Mail size={18} /></button>

      {/* Bildirimler */}
      <div className="relative">
        <button onClick={() => setOpen(open === 'bell' ? null : 'bell')} className={iconBtn} title="Bildirimler">
          <Bell size={18} />
          {notifications.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center">{notifications.length}</span>}
        </button>
        {open === 'bell' && (
          <Pop onClose={() => setOpen(null)}>
            <p className="text-sm font-semibold px-2 py-1.5">Bildirimler</p>
            {notifications.length === 0 ? <p className="text-sm text-gray-400 px-3 py-4 text-center">Bildirim yok 🎉</p> : notifications.map((n, i) => (
              <button key={i} onClick={() => go(n.page)} className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left">
                <n.icon size={17} className={n.color} />
                <span className="text-sm">{n.label}</span>
              </button>
            ))}
          </Pop>
        )}
      </div>

      {/* Profil */}
      <div className="relative">
        <button onClick={() => setOpen(open === 'profile' ? null : 'profile')} className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center shadow-sm"><AvatarIcon size={19} /></button>
        {open === 'profile' && (
          <Pop onClose={() => setOpen(null)} width="w-64">
            <div className="px-3 py-2 border-b border-white/30 dark:border-white/10 mb-1">
              <p className="text-sm font-semibold truncate">{userEmail}</p>
              <p className="text-xs text-gray-400">Senkronize hesap</p>
            </div>
            {setAvatar && (
              <div className="px-3 py-2 border-b border-white/30 dark:border-white/10 mb-1">
                <p className="text-xs text-gray-400 mb-1.5">Profil ikonu</p>
                <div className="flex gap-1.5">
                  {Object.entries(AVATARS).map(([key, Icon]) => (
                    <button
                      key={key}
                      onClick={() => setAvatar(key)}
                      title={key}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${avatar === key ? 'bg-orange-600 text-white' : 'bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/20'}`}
                    >
                      <Icon size={17} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => go('settings')} className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left text-sm"><SettingsIcon size={16} />Ayarlar</button>
            <button onClick={() => { toggleDark(); }} className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left text-sm">{dark ? <Sun size={16} /> : <Moon size={16} />}{dark ? 'Açık Mod' : 'Koyu Mod'}</button>
            <button onClick={() => { onLogout(); setOpen(null); }} className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-left text-sm text-rose-600"><LogOut size={16} />Çıkış Yap</button>
          </Pop>
        )}
      </div>
    </header>
  );
}

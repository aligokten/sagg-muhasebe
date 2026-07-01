import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Receipt, BarChart3, Settings as SettingsIcon, Users, Package,
  Landmark, Ruler, FileText, ClipboardList, Truck, ScrollText, UserCog, CalendarClock,
  TrendingUp, X, AlertTriangle, DraftingCompass, LogIn, LogOut, Cloud, CloudOff, ListChecks, Calculator,
  HardHat, FileBarChart,
} from 'lucide-react';

import {
  auth, signInAnonymously, onAuthStateChanged, signOut,
  subscribeCollection, subscribeDoc, setRecord,
} from './firebase';
import { Spinner } from './components/ui';
import AuthModal from './components/AuthModal';
import Topbar from './components/Topbar';
import { COLLECTIONS } from './constants';

import Dashboard from './modules/Dashboard';
import Customers from './modules/Customers';
import Authors from './modules/Authors';
import Contractors from './modules/Contractors';
import Products from './modules/Products';
import Invoices from './modules/Invoices';
import Quotes from './modules/Quotes';
import Orders from './modules/Orders';
import Waybills from './modules/Waybills';
import Accounts from './modules/Accounts';
import Checks from './modules/Checks';
import CashFlow from './modules/CashFlow';
import Personnel from './modules/Personnel';
import Reports from './modules/Reports';
import Agenda from './modules/Agenda';
import Settings from './modules/Settings';
import AllTransactions from './modules/AllTransactions';
import ZReport from './modules/ZReport';
import { CalculatorModal } from './components/DashboardGadgets';
import ArsaPaylastir from './ArsaPaylastir';
import { buildZReport, getMissingReportDates } from './zreport';

const EMPTY_DATA = COLLECTIONS.reduce((acc, c) => ({ ...acc, [c]: [] }), {});

const NAV_GROUPS = [
  {
    title: 'Genel',
    items: [
      { id: 'dashboard', label: 'Gösterge Paneli', icon: LayoutDashboard },
      { id: 'agenda', label: 'Ajanda', icon: CalendarClock },
    ],
  },
  {
    title: 'Satış & Alış',
    items: [
      { id: 'invoices', label: 'Faturalar', icon: Receipt },
      { id: 'quotes', label: 'Teklifler', icon: FileText },
      { id: 'orders', label: 'Siparişler', icon: ClipboardList },
      { id: 'waybills', label: 'İrsaliyeler', icon: Truck },
    ],
  },
  {
    title: 'Kayıtlar',
    items: [
      { id: 'customers', label: 'Cari Hesaplar', icon: Users },
      { id: 'authors', label: 'Müellifler', icon: DraftingCompass },
      { id: 'contractors', label: 'Taşeronlar', icon: HardHat },
      { id: 'products', label: 'Stok / Ürünler', icon: Package },
      { id: 'personnel', label: 'Personel', icon: UserCog },
    ],
  },
  {
    title: 'Finans',
    items: [
      { id: 'accounts', label: 'Kasa & Banka', icon: Landmark },
      { id: 'checks', label: 'Çek & Senet', icon: ScrollText },
      { id: 'cashflow', label: 'Gelir & Gider', icon: TrendingUp },
      { id: 'activity', label: 'Tüm İşlemler', icon: ListChecks },
      { id: 'zreport', label: 'Z Raporu', icon: FileBarChart },
    ],
  },
  {
    title: 'Diğer',
    items: [
      { id: 'reports', label: 'Raporlar', icon: BarChart3 },
      { id: 'calculator', label: 'Hesap Makinesi', icon: Calculator, action: 'calc' },
      { id: 'arsapay', label: 'Arsa Paylaştır', icon: Ruler },
      { id: 'settings', label: 'Ayarlar', icon: SettingsIcon },
    ],
  },
];

const Sidebar = ({ currentPage, setCurrentPage, userEmail, isAnonymous, onAuth, onLogout, logo, mobileOpen, setMobileOpen, onOpenCalc }) => (
  <>
    {mobileOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" onClick={() => setMobileOpen(false)} />}
    <nav className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-gray-800 text-white flex flex-col no-print transform transition-transform md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700 flex-shrink-0">
        <button
          type="button"
          onClick={() => { setCurrentPage('dashboard'); setMobileOpen(false); }}
          title="Gösterge Paneli"
          className="flex items-center hover:opacity-80 transition-opacity"
        >
          {logo ? (
            <img src={logo} alt="Logo" className="h-10 max-w-[170px] object-contain" />
          ) : (
            <>
              <span className="text-2xl font-bold text-orange-400">S</span>
              <h1 className="text-lg font-bold ml-2 tracking-wide">SAGG Defter</h1>
            </>
          )}
        </button>
        <button className="md:hidden text-gray-400" onClick={() => setMobileOpen(false)}><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-3">
            <p className="px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{group.title}</p>
            <ul>
              {group.items.map((item) => (
                <li key={item.id} className="px-2">
                  <button
                    onClick={() => {
                      if (item.action === 'calc') { onOpenCalc(); setMobileOpen(false); }
                      else { setCurrentPage(item.id); setMobileOpen(false); }
                    }}
                    className={`flex items-center w-full px-3 py-2 rounded-lg transition-colors text-sm ${currentPage === item.id && !item.action ? 'bg-orange-500 text-white shadow-md' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span className="ml-3 font-medium">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-gray-700">
        {isAnonymous ? (
          <>
            <div className="flex items-center gap-2 text-xs text-amber-300 mb-2">
              <CloudOff size={14} /> Misafir (yalnız bu cihaz)
            </div>
            <button onClick={onAuth} className="flex items-center justify-center gap-2 w-full bg-orange-600 hover:bg-orange-700 text-white rounded-lg py-2 text-sm font-medium">
              <LogIn size={15} /> Giriş / Kayıt Ol
            </button>
            <p className="text-[11px] text-gray-500 mt-2">Çok cihazdan erişim için hesap oluşturun.</p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-emerald-300 mb-1">
              <Cloud size={14} /> Senkronize
            </div>
            <p className="text-xs text-gray-300 break-all mb-2">{userEmail}</p>
            <button onClick={onLogout} className="flex items-center justify-center gap-2 w-full bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg py-2 text-sm font-medium">
              <LogOut size={15} /> Çıkış Yap
            </button>
          </>
        )}
      </div>
    </nav>
  </>
);

export default function App() {
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('sagg-theme') === 'dark' || localStorage.getItem('sagg-dash-dark') === '1'; } catch { return false; }
  });

  useEffect(() => {
    const el = document.documentElement;
    if (dark) el.classList.add('dark'); else el.classList.remove('dark');
    try { localStorage.setItem('sagg-theme', dark ? 'dark' : 'light'); } catch { /* yoksay */ }
  }, [dark]);
  const toggleDark = () => setDark((d) => !d);

  const [avatar, setAvatar] = useState(() => {
    try { return localStorage.getItem('sagg-avatar') || 'user'; } catch { return 'user'; }
  });
  const pickAvatar = (a) => { setAvatar(a); try { localStorage.setItem('sagg-avatar', a); } catch { /* yoksay */ } };

  const [calcOpen, setCalcOpen] = useState(false);

  const [data, setData] = useState({ ...EMPTY_DATA, companyProfile: { companyName: '', address: '', bankAccounts: [] } });

  // PDF kütüphanelerini yükle + kimlik doğrulama
  useEffect(() => {
    const loadScript = (src) =>
      new Promise((res, rej) => {
        if (document.querySelector(`script[src="${src}"]`)) return res();
        const s = document.createElement('script');
        s.src = src; s.async = true; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
    ]).then(() => setScriptsLoaded(true)).catch((e) => console.error('PDF kütüphaneleri yüklenemedi', e));

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setUserEmail(user.email);
        setIsAnonymous(user.isAnonymous);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/configuration-not-found') {
            setAuthError("Firebase projenizde kimlik doğrulama yapılandırılmamış. Lütfen Firebase konsolundan Authentication > Sign-in method sekmesine gidip 'Anonymous' sağlayıcısını etkinleştirin.");
          } else {
            setAuthError('Kimlik doğrulanırken bir hata oluştu: ' + error.message);
          }
          setLoading(false);
        }
      }
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    if (!window.confirm('Çıkış yapılsın mı? Bu cihaz tekrar misafir moduna döner; verilerinize yeniden giriş yaparak ulaşırsınız.')) return;
    try { await signOut(auth); } catch (e) { console.error(e); }
  };

  // Tüm koleksiyonları ve şirket profilini dinle
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    // Kullanıcı değişince eski verileri temizle
    setData({ ...EMPTY_DATA, companyProfile: { companyName: '', address: '', bankAccounts: [] } });
    const unsubs = COLLECTIONS.map((name) =>
      subscribeCollection(userId, name, (docs) => setData((prev) => ({ ...prev, [name]: docs })))
    );
    unsubs.push(
      subscribeDoc(
        userId, 'companyProfile', 'main',
        (d) => setData((prev) => ({ ...prev, companyProfile: d })),
        () => {
          const def = { companyName: 'Şirket Adınız', address: '', bankAccounts: [{ bankName: '', iban: '' }] };
          setRecord(userId, 'companyProfile', 'main', def);
        }
      )
    );
    setLoading(false);
    return () => unsubs.forEach((u) => u && u());
  }, [userId]);

  // Z Raporu: uygulama açıldığında, henüz raporu oluşturulmamış geçmiş
  // günler için otomatik olarak gün sonu dökümü üretir (bkz. src/zreport.js).
  const zReportRanRef = useRef(null);
  useEffect(() => {
    if (!userId || zReportRanRef.current === userId) return;
    if (!data.accounts || data.accounts.length === 0) return;
    zReportRanRef.current = userId;
    getMissingReportDates(data.zReports || []).forEach((dateStr) => {
      setRecord(userId, 'zReports', dateStr, buildZReport(dateStr, data));
    });
  }, [userId, data]);

  if (authError) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50 text-red-900 p-8">
        <div className="text-center max-w-2xl">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="mt-4 text-2xl font-bold">Yapılandırma Hatası</h2>
          <p className="mt-2">{authError}</p>
          <p className="mt-4 text-sm text-red-700">Bu ayarı yaptıktan sonra sayfayı yenilemeniz gerekmektedir.</p>
        </div>
      </div>
    );
  }

  if (loading || !userId) {
    return <div className="flex items-center justify-center h-screen bg-gray-100"><Spinner /></div>;
  }

  const fullData = { ...data, scriptsLoaded };

  const renderPage = () => {
    switch (currentPage) {
      case 'invoices': return <Invoices data={fullData} userId={userId} />;
      case 'quotes': return <Quotes data={fullData} userId={userId} />;
      case 'orders': return <Orders data={fullData} userId={userId} />;
      case 'waybills': return <Waybills data={fullData} userId={userId} />;
      case 'customers': return <Customers data={fullData} userId={userId} />;
      case 'authors': return <Authors data={fullData} userId={userId} />;
      case 'contractors': return <Contractors data={fullData} userId={userId} />;
      case 'products': return <Products data={fullData} userId={userId} />;
      case 'personnel': return <Personnel data={fullData} userId={userId} />;
      case 'accounts': return <Accounts data={fullData} userId={userId} />;
      case 'checks': return <Checks data={fullData} userId={userId} />;
      case 'cashflow': return <CashFlow data={fullData} userId={userId} />;
      case 'activity': return <AllTransactions data={fullData} userId={userId} />;
      case 'zreport': return <ZReport data={fullData} />;
      case 'reports': return <Reports data={fullData} />;
      case 'agenda': return <Agenda data={fullData} userId={userId} />;
      case 'arsapay': return <ArsaPaylastir />;
      case 'settings': return <Settings userId={userId} companyProfile={data.companyProfile} data={fullData} />;
      default: return <Dashboard data={fullData} setPage={setCurrentPage} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 font-sans">
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        userEmail={userEmail}
        isAnonymous={isAnonymous}
        onAuth={() => setAuthOpen(true)}
        onLogout={handleLogout}
        logo={data.companyProfile?.logo}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onOpenCalc={() => setCalcOpen(true)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          data={data}
          setPage={setCurrentPage}
          onOpenMobile={() => setMobileOpen(true)}
          userEmail={userEmail}
          isAnonymous={isAnonymous}
          onAuth={() => setAuthOpen(true)}
          onLogout={handleLogout}
          dark={dark}
          toggleDark={toggleDark}
          logo={data.companyProfile?.logo}
          avatar={avatar}
          setAvatar={pickAvatar}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">{renderPage()}</main>
      </div>
      {authOpen && <AuthModal isAnonymous={isAnonymous} onClose={() => setAuthOpen(false)} />}
      <CalculatorModal open={calcOpen} onClose={() => setCalcOpen(false)} />
    </div>
  );
}

// --- Gösterge paneli gadget'ları: piyasa ticker'ı + hesap makinesi (açılır pencere) ---
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Delete, X } from 'lucide-react';

/* ============ Anlık Piyasa Fiyatları (ortak veri kancası) ============ */

// Truncgil v4 ücretsiz finans API'si (CORS: * — tarayıcıdan çekilebilir)
const API_URL = 'https://finans.truncgil.com/v4/today.json';
const ONS_GRAM = 31.1034768; // 1 ons = 31.1035 gram

const ITEMS = [
  { key: 'GRA', label: 'Gram Altın', unit: '₺' },
  { key: 'USD', label: 'Dolar', unit: '₺' },
  { key: 'EUR', label: 'Euro', unit: '₺' },
  { key: 'XU100', label: 'BIST 100', unit: '' },
  { key: 'ONS', label: 'Ons Altın', unit: '$' },
];

const num = (v) => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};

const fmt = (n, unit) => {
  if (n == null || !isFinite(n) || n === 0) return '—';
  const s = n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (unit === '₺') return `₺${s}`;
  if (unit === '$') return `$${s}`;
  return s;
};

function useMarket() {
  const [rows, setRows] = useState(null);
  const [updated, setUpdated] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(API_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('http');
      const j = await res.json();
      let ons = num(j.ONS?.Selling || j.ONS?.Buying);
      if (!ons) {
        const gra = num(j.GRA?.Selling);
        const usd = num(j.USD?.Selling);
        if (gra && usd) ons = (gra * ONS_GRAM) / usd; // gram altından türet
      }
      const out = ITEMS.map((it) => {
        const src = j[it.key] || {};
        const value = it.key === 'ONS' ? ons : num(src.Selling ?? src.Buying);
        return { ...it, value, change: num(src.Change) };
      });
      setRows(out);
      setUpdated(j.Update_Date ? j.Update_Date.slice(11, 16) : new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000); // 60 sn'de bir yenile
    return () => clearInterval(id);
  }, [load]);

  return { rows, updated, error, loading, reload: load };
}

/* ============ Piyasa Ticker'ı (yatay kayan bar) ============ */

const Chip = ({ r }) => {
  const up = r.change >= 0;
  return (
    <span className="inline-flex items-center gap-1.5 px-4 whitespace-nowrap">
      <span className="text-xs text-gray-500 dark:text-gray-400">{r.label}</span>
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums">{fmt(r.value, r.unit)}</span>
      {r.change !== 0 && (
        <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
          {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}%{Math.abs(r.change).toFixed(1)}
        </span>
      )}
      <span className="text-gray-300 dark:text-gray-600 pl-2">•</span>
    </span>
  );
};

export function MarketTicker({ className = '' }) {
  const { rows, updated, error, loading, reload } = useMarket();
  const items = rows || ITEMS.map((it) => ({ ...it, value: null, change: 0 }));

  return (
    <div className={`flex items-center gap-2 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm pl-3 pr-2 py-2 overflow-hidden ${className}`}>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${error ? 'bg-rose-400' : 'bg-emerald-400'} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${error ? 'bg-rose-500' : 'bg-emerald-500'}`} />
        </span>
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Piyasa</span>
      </div>

      {error ? (
        <button onClick={reload} className="flex-1 text-xs text-gray-400 hover:text-orange-600 text-left px-2">Fiyat verisi alınamadı — Tekrar dene</button>
      ) : (
        <div className="marquee-mask flex-1 overflow-hidden">
          <div className="marquee-track">
            {[...items, ...items].map((r, i) => <Chip key={i} r={r} />)}
          </div>
        </div>
      )}

      {updated && !error && <span className="text-[10px] text-gray-400 flex-shrink-0 hidden sm:inline">{updated}</span>}
      <button onClick={reload} title="Yenile" className="text-gray-400 hover:text-orange-600 flex-shrink-0">
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}

/* ============ Basit Hesap Makinesi ============ */

const round = (n) => Math.round(n * 1e10) / 1e10;
const apply = (a, b, op) => {
  switch (op) {
    case '+': return round(a + b);
    case '−': return round(a - b);
    case '×': return round(a * b);
    case '÷': return b === 0 ? NaN : round(a / b);
    default: return b;
  }
};

export function MiniCalculator({ onClose }) {
  const [display, setDisplay] = useState('0');
  const [acc, setAcc] = useState(null);
  const [op, setOp] = useState(null);
  const [waiting, setWaiting] = useState(false);

  const clearAll = () => { setDisplay('0'); setAcc(null); setOp(null); setWaiting(false); };
  const inputDigit = (d) => {
    if (display === 'Hata') return clearAll();
    if (waiting) { setDisplay(d); setWaiting(false); }
    else setDisplay(display === '0' ? d : display + d);
  };
  const inputDot = () => {
    if (display === 'Hata') return clearAll();
    if (waiting) { setDisplay('0.'); setWaiting(false); }
    else if (!display.includes('.')) setDisplay(display + '.');
  };
  const backspace = () => {
    if (waiting || display === 'Hata') return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
  };
  const percent = () => setDisplay(String(round(parseFloat(display) / 100)));
  const negate = () => setDisplay(String(round(parseFloat(display) * -1)));

  const chooseOp = (nextOp) => {
    const val = parseFloat(display);
    if (op && !waiting) {
      const r = apply(acc, val, op);
      if (!isFinite(r)) { setDisplay('Hata'); setAcc(null); setOp(null); setWaiting(true); return; }
      setAcc(r); setDisplay(String(r));
    } else {
      setAcc(val);
    }
    setOp(nextOp); setWaiting(true);
  };
  const equals = () => {
    if (op == null) return;
    const r = apply(acc, parseFloat(display), op);
    setDisplay(isFinite(r) ? String(r) : 'Hata');
    setAcc(null); setOp(null); setWaiting(true);
  };

  // Klavye desteği
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key;
      if (k >= '0' && k <= '9') inputDigit(k);
      else if (k === '.' || k === ',') inputDot();
      else if (k === '+') chooseOp('+');
      else if (k === '-') chooseOp('−');
      else if (k === '*') chooseOp('×');
      else if (k === '/') { e.preventDefault(); chooseOp('÷'); }
      else if (k === 'Enter' || k === '=') { e.preventDefault(); equals(); }
      else if (k === 'Backspace') backspace();
      else if (k === 'Escape') { onClose ? onClose() : clearAll(); }
      else if (k === '%') percent();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // her render'da güncel state ile bağla

  const opBtn = (o) => `rounded-xl py-3 text-base font-semibold transition-colors ${op === o ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-gray-700 dark:text-orange-400 dark:hover:bg-gray-600'}`;
  const numBtn = 'rounded-xl py-3 text-base font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700/60 dark:text-gray-100 dark:hover:bg-gray-600';
  const fnBtn = 'rounded-xl py-3 text-base font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600';

  return (
    <div className="rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Hesap Makinesi</span>
        {onClose && (
          <button onClick={onClose} title="Kapat" className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><X size={18} /></button>
        )}
      </div>
      <div className="rounded-xl bg-gray-900 dark:bg-black/40 text-white px-4 py-3 mb-3 text-right overflow-hidden">
        <span className="text-2xl font-semibold tabular-nums break-all">{display}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button onClick={clearAll} className={fnBtn}>C</button>
        <button onClick={negate} className={fnBtn}>±</button>
        <button onClick={percent} className={fnBtn}>%</button>
        <button onClick={() => chooseOp('÷')} className={opBtn('÷')}>÷</button>

        <button onClick={() => inputDigit('7')} className={numBtn}>7</button>
        <button onClick={() => inputDigit('8')} className={numBtn}>8</button>
        <button onClick={() => inputDigit('9')} className={numBtn}>9</button>
        <button onClick={() => chooseOp('×')} className={opBtn('×')}>×</button>

        <button onClick={() => inputDigit('4')} className={numBtn}>4</button>
        <button onClick={() => inputDigit('5')} className={numBtn}>5</button>
        <button onClick={() => inputDigit('6')} className={numBtn}>6</button>
        <button onClick={() => chooseOp('−')} className={opBtn('−')}>−</button>

        <button onClick={() => inputDigit('1')} className={numBtn}>1</button>
        <button onClick={() => inputDigit('2')} className={numBtn}>2</button>
        <button onClick={() => inputDigit('3')} className={numBtn}>3</button>
        <button onClick={() => chooseOp('+')} className={opBtn('+')}>+</button>

        <button onClick={() => inputDigit('0')} className={`${numBtn} col-span-2`}>0</button>
        <button onClick={inputDot} className={numBtn}>.</button>
        <button onClick={equals} className="rounded-xl py-3 text-base font-semibold bg-orange-600 text-white hover:bg-orange-700">=</button>
      </div>
      <button onClick={backspace} className="mt-2 flex items-center justify-center gap-1 w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 py-1">
        <Delete size={13} /> Sil
      </button>
    </div>
  );
}

/* ============ Hesap Makinesi açılır penceresi (sayfa blur'lanır) ============ */

export function CalculatorModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-md animate-[fadeIn_120ms_ease-out] no-print"
      onClick={onClose}
    >
      <div className="w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        <MiniCalculator onClose={onClose} />
      </div>
    </div>
  );
}

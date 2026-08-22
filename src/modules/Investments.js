// --- Altın & Döviz Yatırım Takibi (Harem Altın canlı fiyatları) ---
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  RefreshCw, PlusCircle, Edit, Trash2, TrendingUp, TrendingDown, Coins,
  Wallet, ArrowUpRight, ArrowDownRight, AlertTriangle, Radio, Database,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatCurrency, formatNumber, formatDateShort, todayInput, toInputDate } from '../utils';
import { FormModal, ConfirmDialog, Field, Input, Select, Textarea } from '../components/ui';
import {
  INSTRUMENTS, INSTRUMENT_MAP, FEATURED_CODES, PROVIDERS,
  fetchLivePrices, getSource, setSource, previousClose, changePct, toTry, unitLabel,
} from '../marketData';

const REFRESH_MS = 60 * 1000;
// Fiyatlar her zaman iki basamakla gösterilir (₺4.512,30)
const price2 = (v) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);

const PIE_COLORS = ['#f59e0b', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fb7185', '#22d3ee', '#facc15'];

// --- Canlı fiyat akışı ---
function useLivePrices(source) {
  const [state, setState] = useState({ prices: {}, fetchedAt: null, channel: null, loading: true, error: null });
  const abortRef = useRef(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState((s) => ({ ...s, loading: true }));
    try {
      const { prices, source: channel, fetchedAt } = await fetchLivePrices({ signal: ctrl.signal, source });
      setState({ prices, fetchedAt, channel, loading: false, error: null });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setState((s) => ({ ...s, loading: false, error: err?.message || 'Canlı fiyatlar alınamadı' }));
    }
  }, [source]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { clearInterval(t); abortRef.current?.abort(); };
  }, [load]);

  return { ...state, reload: load };
}

// --- Hesaplama: alım kayıtlarından varlık özeti ---
export function buildPortfolio(investments, prices) {
  const groups = {};
  (investments || []).forEach((inv) => {
    const code = inv.code;
    if (!code) return;
    const meta = INSTRUMENT_MAP[code] || {};
    const qty = Number(inv.quantity) || 0;
    const cost = Number(inv.totalCost) || qty * (Number(inv.unitCost) || 0);
    if (!groups[code]) {
      groups[code] = {
        code,
        label: inv.label || meta.label || code,
        unit: inv.unit || meta.unit || 'birim',
        quantity: 0, cost: 0, lots: [],
      };
    }
    const g = groups[code];
    g.quantity += qty;
    g.cost += cost;
    g.lots.push(inv);
  });

  const rows = Object.values(groups).map((g) => {
    const row = prices?.[g.code];
    // Güncel değer satış anındaki fiyat (alış kotasyonu) üzerinden hesaplanır.
    const unitPrice = row ? toTry(row.alis, g.code, prices) : 0;
    const prevPrice = row ? toTry(previousClose(row), g.code, prices) : 0;
    const value = g.quantity * unitPrice;
    const profit = row ? value - g.cost : 0;
    const hasDaily = changePct(row) !== null;
    const dailyChange = hasDaily ? g.quantity * (unitPrice - prevPrice) : 0;
    return {
      ...g,
      avgCost: g.quantity ? g.cost / g.quantity : 0,
      unitPrice, prevPrice, value, profit, dailyChange, hasDaily,
      profitPct: g.cost ? (profit / g.cost) * 100 : 0,
      priced: !!row,
    };
  }).sort((a, b) => b.value - a.value);

  const totals = rows.reduce((acc, r) => ({
    cost: acc.cost + r.cost,
    value: acc.value + (r.priced ? r.value : r.cost),
    profit: acc.profit + r.profit,
    dailyChange: acc.dailyChange + r.dailyChange,
  }), { cost: 0, value: 0, profit: 0, dailyChange: 0 });
  totals.profitPct = totals.cost ? (totals.profit / totals.cost) * 100 : 0;
  // Kaynak önceki kapanış vermiyorsa günlük değişim hesaplanamaz.
  totals.dailyKnown = rows.some((r) => r.hasDaily);
  const prevValue = totals.value - totals.dailyChange;
  totals.dailyPct = totals.dailyKnown && prevValue ? (totals.dailyChange / prevValue) * 100 : null;

  return { rows, totals };
}

// --- Küçük arayüz parçaları (koyu tema) ---
const Panel = ({ className = '', children }) => (
  <div className={`rounded-2xl bg-[#15191f] border border-white/5 ${className}`}>{children}</div>
);

const DeltaPill = ({ value, suffix = '%' }) => {
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${up ? 'bg-emerald-400/90 text-emerald-950' : 'bg-rose-400/90 text-rose-950'}`}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {up ? '+' : ''}{formatNumber(value, 2)}{suffix}
    </span>
  );
};

const StatTile = ({ title, value, delta, hint, icon: Icon }) => (
  <Panel className="p-5 flex flex-col justify-between min-h-[132px]">
    <div className="flex items-start justify-between">
      <p className="text-xs uppercase tracking-wider text-gray-400">{title}</p>
      {Icon && <Icon size={16} className="text-gray-500" />}
    </div>
    <p className="text-2xl sm:text-[28px] font-semibold text-white mt-3 leading-tight">{value}</p>
    <div className="flex items-center justify-between mt-3">
      <span className="text-xs text-gray-500">{hint}</span>
      {delta !== undefined && delta !== null && <DeltaPill value={delta} />}
    </div>
  </Panel>
);

const PriceChip = ({ code, row, prices }) => {
  const meta = INSTRUMENT_MAP[code] || { label: code, unit: 'birim' };
  if (!row) return null;
  const pct = changePct(row);
  const cur = meta.currency === 'USD' ? '$' : '₺';
  return (
    <Panel className="p-4 min-w-[190px] flex-shrink-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400 truncate">{meta.label}</p>
        <DeltaPill value={pct} />
      </div>
      <p className="text-xl font-semibold text-white mt-2">
        {cur}{price2(row.alis)}
      </p>
      <p className="text-[11px] text-gray-500 mt-1">
        Satış {cur}{price2(row.satis)}
        {meta.currency === 'USD' && prices?.USDTRY ? ` · ₺${formatNumber(toTry(row.alis, code, prices), 0)}` : ''}
      </p>
    </Panel>
  );
};

// --- Yatırım ekleme / düzenleme formu ---
export function InvestmentForm({ existing, userId, prices, onClose }) {
  const [form, setForm] = useState(
    existing
      ? {
          code: existing.code,
          quantity: existing.quantity ?? '',
          unitCost: existing.unitCost ?? '',
          date: toInputDate(existing.date),
          note: existing.note || '',
        }
      : { code: 'ALTIN', quantity: '', unitCost: '', date: todayInput(), note: '' }
  );
  const [touchedCost, setTouchedCost] = useState(!!existing);

  const meta = INSTRUMENT_MAP[form.code] || INSTRUMENTS[0];
  const livePrice = prices?.[form.code] ? toTry(prices[form.code].satis, form.code, prices) : 0;
  const isToday = form.date === todayInput();

  // Alım bugünse ve kullanıcı fiyatı elle değiştirmediyse, güncel satış fiyatı yazılır.
  useEffect(() => {
    if (touchedCost || !isToday || !livePrice) return;
    setForm((f) => ({ ...f, unitCost: livePrice.toFixed(2) }));
  }, [livePrice, isToday, touchedCost]);

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const setCode = (e) => { setForm({ ...form, code: e.target.value }); setTouchedCost(!!existing); };
  const setCost = (e) => { setTouchedCost(true); setForm({ ...form, unitCost: e.target.value }); };

  const quantity = Number(form.quantity) || 0;
  const unitCost = Number(form.unitCost) || 0;
  const total = quantity * unitCost;

  const submit = async (e) => {
    e.preventDefault();
    if (!(quantity > 0) || !(unitCost > 0)) return;
    const payload = {
      code: form.code,
      label: meta.label,
      unit: meta.unit,
      quantity,
      unitCost,
      totalCost: total,
      note: form.note || '',
      date: Timestamp.fromDate(new Date(form.date)),
    };
    if (existing) await updateRecord(userId, 'investments', existing.id, payload);
    else await addRecord(userId, 'investments', payload);
    onClose();
  };

  const groups = [...new Set(INSTRUMENTS.map((i) => i.group))];

  return (
    <FormModal
      title={existing ? 'Yatırımı Düzenle' : 'Yatırım Ekle'}
      size="lg"
      onSubmit={submit}
      onClose={onClose}
      submitLabel={existing ? 'Güncelle' : 'Yatırımı Kaydet'}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Yatırım Türü">
          <Select name="code" value={form.code} onChange={setCode}>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {INSTRUMENTS.filter((i) => i.group === g).map((i) => (
                  <option key={i.code} value={i.code}>{i.label}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Alım Tarihi"><Input type="date" name="date" value={form.date} onChange={set} required /></Field>
        <Field label={`Miktar (${unitLabel(meta.unit)})`}>
          <Input type="number" step="0.0001" min="0" name="quantity" value={form.quantity} onChange={set} required autoFocus />
        </Field>
        <Field label={`Alış Fiyatı (₺ / ${unitLabel(meta.unit)})`}>
          <Input type="number" step="0.01" min="0" name="unitCost" value={form.unitCost} onChange={setCost} required />
        </Field>
        <Field label="Not (opsiyonel)" className="md:col-span-2">
          <Textarea name="note" value={form.note} onChange={set} className="h-16" />
        </Field>
      </div>

      <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Toplam Maliyet</span>
          <span className="font-semibold text-gray-800">{formatCurrency(total)}</span>
        </div>
        {livePrice > 0 && (
          <div className="flex justify-between text-gray-500 mt-1 text-xs">
            <span>Güncel satış fiyatı (Harem Altın)</span>
            <span>{formatCurrency(livePrice)} / {unitLabel(meta.unit)}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-3">
        {isToday
          ? 'Bugünün fiyatı canlı verilerden otomatik dolduruldu; farklı bir fiyattan aldıysanız değiştirebilirsiniz.'
          : 'Geçmiş tarihli alımlarda fiyat otomatik doldurulmaz; o günkü alış fiyatınızı girin.'}
      </p>
    </FormModal>
  );
}

// --- Veri kaynağı ayarları (sağlayıcı, uç nokta, opsiyonel anahtar) ---
export function SourceForm({ source, onSave, onClose }) {
  const [form, setForm] = useState({ ...source });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const selectProvider = (e) => {
    const provider = e.target.value;
    setForm({ ...form, provider, url: PROVIDERS[provider].defaultUrl });
  };
  const submit = (e) => {
    e.preventDefault();
    onSave({ ...form, url: (form.url || '').trim() || PROVIDERS[form.provider].defaultUrl, apiKey: (form.apiKey || '').trim() });
    onClose();
  };
  return (
    <FormModal title="Veri Kaynağı" size="lg" onSubmit={submit} onClose={onClose} submitLabel="Kaydet ve Yenile">
      <div className="grid grid-cols-1 gap-4">
        <Field label="Sağlayıcı">
          <Select name="provider" value={form.provider} onChange={selectProvider}>
            {Object.values(PROVIDERS).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </Field>
        <Field label="Fiyat servisi adresi">
          <Input name="url" value={form.url} onChange={set} placeholder={PROVIDERS[form.provider].defaultUrl} />
        </Field>
        <Field label="API anahtarı (servis istiyorsa)">
          <Input name="apiKey" value={form.apiKey || ''} onChange={set} placeholder="Gerekmiyorsa boş bırakın" />
        </Field>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Adres bu tarayıcıda saklanır. Servisin yanıtı otomatik çözümlenir: kod → fiyat sözlüğü ya da
        liste biçimindeki JSON yanıtlar, alış/satış (alis, satis, buy, sell…) alanlarıyla eşleştirilir.
      </p>
    </FormModal>
  );
}

// --- Ana sayfa ---
export default function Investments({ data, userId }) {
  const { investments = [] } = data;
  const [source, setSourceState] = useState(getSource);
  const { prices, fetchedAt, loading, error, reload } = useLivePrices(source);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const { rows, totals } = useMemo(() => buildPortfolio(investments, prices), [investments, prices]);

  const lots = useMemo(
    () => [...investments].sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)),
    [investments]
  );

  const goldGram = prices?.ALTIN?.alis ? totals.value / prices.ALTIN.alis : 0;
  const pieData = rows.filter((r) => r.value > 0).map((r) => ({ name: r.label, value: r.value }));

  const providerLabel = (PROVIDERS[source.provider] || PROVIDERS.datshop).label;

  const saveSource = (next) => { setSource(next); setSourceState(next); };

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (inv) => { setEditing(inv); setFormOpen(true); };

  return (
    <div className="rounded-3xl bg-[#0b0d10] text-gray-100 p-4 sm:p-6 lg:p-8 shadow-xl">
      {/* Başlık */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Yatırım Takibi</h1>
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${error ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
              <Radio size={12} className={loading ? 'animate-pulse' : ''} />
              {error ? `${providerLabel} · veri yok` : `${providerLabel} · canlı`}
            </span>
            {fetchedAt && <span>Son güncelleme {fetchedAt.toLocaleTimeString('tr-TR')}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSourceOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-200"
            title="Veri kaynağı ayarları"
          >
            <Database size={15} /> Veri Kaynağı
          </button>
          <button
            onClick={reload}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-200"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Yenile
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-gray-900 hover:bg-gray-200 text-sm font-semibold"
          >
            <PlusCircle size={16} /> Yatırım Ekle
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Canlı fiyatlar alınamadı ({error}).</p>
            <p className="text-amber-200/70 text-xs mt-1">
              Kayıtlarınız ve maliyetleriniz görüntülenmeye devam eder; bağlantı sağlandığında değerler otomatik
              güncellenir. Servis adresi hatalıysa “Veri Kaynağı” ekranından düzeltebilirsiniz.
            </p>
          </div>
        </div>
      )}

      {/* Özet kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <StatTile
          title="Portföy Değeri"
          value={formatCurrency(totals.value)}
          delta={totals.dailyPct}
          hint="Bugün"
          icon={Wallet}
        />
        <StatTile
          title="Toplam Maliyet"
          value={formatCurrency(totals.cost)}
          hint={`${lots.length} alım kaydı`}
          icon={Coins}
        />
        <StatTile
          title="Kar / Zarar"
          value={formatCurrency(totals.profit)}
          delta={totals.profitPct}
          hint="Maliyete göre"
          icon={totals.profit >= 0 ? TrendingUp : TrendingDown}
        />
        <div className="rounded-2xl p-5 bg-gradient-to-br from-amber-300 via-orange-400 to-rose-400 text-gray-900 flex flex-col justify-between min-h-[132px]">
          <p className="text-xs uppercase tracking-wider text-gray-800/70">Günlük Değişim</p>
          <p className="text-2xl sm:text-[28px] font-semibold mt-3 leading-tight">
            {totals.dailyKnown
              ? `${totals.dailyChange >= 0 ? '+' : ''}${formatCurrency(totals.dailyChange)}`
              : '—'}
          </p>
          <p className="text-xs text-gray-900/70 mt-3">
            {!totals.dailyKnown
              ? 'Kaynak önceki kapanış vermiyor'
              : goldGram > 0
                ? `Portföyünüz ${formatNumber(goldGram, 2)} gram has altına denk`
                : 'Önceki kapanışa göre'}
          </p>
        </div>
      </div>

      {/* Canlı fiyat şeridi */}
      <div className="flex gap-3 overflow-x-auto pb-2 mb-6">
        {FEATURED_CODES.map((code) => <PriceChip key={code} code={code} row={prices[code]} prices={prices} />)}
        {Object.keys(prices).length === 0 && (
          <Panel className="p-4 text-sm text-gray-400 w-full">Fiyatlar yükleniyor…</Panel>
        )}
      </div>

      {/* Varlıklar + dağılım */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <Panel className="xl:col-span-2 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Varlıklarım</h3>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500 py-10 text-center">
              Henüz yatırım kaydınız yok. “Yatırım Ekle” ile ilk alımınızı girin.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-2 py-2 text-left font-medium">Tür</th>
                    <th className="px-2 py-2 text-right font-medium">Miktar</th>
                    <th className="px-2 py-2 text-right font-medium">Ort. Maliyet</th>
                    <th className="px-2 py-2 text-right font-medium">Güncel Fiyat</th>
                    <th className="px-2 py-2 text-right font-medium">Değer</th>
                    <th className="px-2 py-2 text-right font-medium">Kar / Zarar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((r) => (
                    <tr key={r.code}>
                      <td className="px-2 py-3 text-gray-100 whitespace-nowrap">{r.label}</td>
                      <td className="px-2 py-3 text-right text-gray-300 whitespace-nowrap">
                        {formatNumber(r.quantity, 4)} <span className="text-gray-500 text-xs">{unitLabel(r.unit)}</span>
                      </td>
                      <td className="px-2 py-3 text-right text-gray-300 whitespace-nowrap">{formatCurrency(r.avgCost)}</td>
                      <td className="px-2 py-3 text-right text-gray-300 whitespace-nowrap">
                        {r.priced ? formatCurrency(r.unitPrice) : <span className="text-gray-600">-</span>}
                      </td>
                      <td className="px-2 py-3 text-right text-white font-medium whitespace-nowrap">
                        {r.priced ? formatCurrency(r.value) : <span className="text-gray-600">-</span>}
                      </td>
                      <td className="px-2 py-3 text-right whitespace-nowrap">
                        {r.priced ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className={r.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {r.profit >= 0 ? '+' : ''}{formatCurrency(r.profit)}
                            </span>
                            <DeltaPill value={r.profitPct} />
                          </div>
                        ) : <span className="text-gray-600">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel className="p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Dağılım</h3>
          {pieData.length === 0 ? (
            <p className="text-sm text-gray-500 py-16 text-center">Dağılım için kayıt gerekir.</p>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="none">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v) => formatCurrency(v)}
                      contentStyle={{ background: '#15191f', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, color: '#e5e7eb' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 space-y-1.5">
                {pieData.map((p, i) => (
                  <li key={p.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-gray-300 truncate">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {p.name}
                    </span>
                    <span className="text-gray-400 flex-shrink-0">
                      %{formatNumber(totals.value ? (p.value / totals.value) * 100 : 0, 1)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      {/* Alım kayıtları */}
      <Panel className="p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Alım Kayıtları</h3>
        {lots.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">Kayıt yok.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-2 py-2 text-left font-medium">Tarih</th>
                  <th className="px-2 py-2 text-left font-medium">Tür</th>
                  <th className="px-2 py-2 text-right font-medium">Miktar</th>
                  <th className="px-2 py-2 text-right font-medium">Alış Fiyatı</th>
                  <th className="px-2 py-2 text-right font-medium">Maliyet</th>
                  <th className="px-2 py-2 text-right font-medium">Güncel Değer</th>
                  <th className="px-2 py-2 text-right font-medium">Kar / Zarar</th>
                  <th className="px-2 py-2 text-right font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {lots.map((inv) => {
                  const meta = INSTRUMENT_MAP[inv.code] || {};
                  const row = prices[inv.code];
                  const qty = Number(inv.quantity) || 0;
                  const cost = Number(inv.totalCost) || qty * (Number(inv.unitCost) || 0);
                  const value = row ? qty * toTry(row.alis, inv.code, prices) : 0;
                  const profit = value - cost;
                  return (
                    <tr key={inv.id}>
                      <td className="px-2 py-3 text-gray-300 whitespace-nowrap">{formatDateShort(inv.date)}</td>
                      <td className="px-2 py-3 text-gray-100 whitespace-nowrap">{inv.label || meta.label || inv.code}</td>
                      <td className="px-2 py-3 text-right text-gray-300 whitespace-nowrap">
                        {formatNumber(qty, 4)} <span className="text-gray-500 text-xs">{unitLabel(inv.unit || meta.unit)}</span>
                      </td>
                      <td className="px-2 py-3 text-right text-gray-300 whitespace-nowrap">{formatCurrency(inv.unitCost)}</td>
                      <td className="px-2 py-3 text-right text-gray-300 whitespace-nowrap">{formatCurrency(cost)}</td>
                      <td className="px-2 py-3 text-right text-white whitespace-nowrap">
                        {row ? formatCurrency(value) : <span className="text-gray-600">-</span>}
                      </td>
                      <td className={`px-2 py-3 text-right whitespace-nowrap ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {row ? `${profit >= 0 ? '+' : ''}${formatCurrency(profit)}` : <span className="text-gray-600">-</span>}
                      </td>
                      <td className="px-2 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(inv)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400" title="Düzenle">
                            <Edit size={15} />
                          </button>
                          <button onClick={() => setConfirmId(inv.id)} className="p-2 rounded-lg hover:bg-white/10 text-rose-400" title="Sil">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {lots.some((l) => l.note) && (
          <p className="text-[11px] text-gray-600 mt-4">Notlar kayıt düzenleme ekranından görüntülenebilir.</p>
        )}
      </Panel>

      {sourceOpen && (
        <SourceForm source={source} onSave={saveSource} onClose={() => setSourceOpen(false)} />
      )}
      {formOpen && (
        <InvestmentForm
          existing={editing}
          userId={userId}
          prices={prices}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}
      {confirmId && (
        <ConfirmDialog
          message="Bu yatırım kaydı silinsin mi?"
          onConfirm={() => deleteRecord(userId, 'investments', confirmId)}
          onClose={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}

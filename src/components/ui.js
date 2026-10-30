// --- Paylaşılan arayüz bileşenleri — SWISS DATA POP ---
// Tipografi: Inter Tight (başlık/rakam, 700-900, sıkı harf aralığı) + Inter (gövde).
// Yüzeyler: 1px kenarlıklı, yuvarlatılmış bento kartlar; gölge yerine kenarlık.
// Vurgu: tek bir vermilyon (#F43B04). Çok renkli dağınıklık yok.
import React, { useState } from 'react';
import { X, PlusCircle, Inbox, MoreVertical } from 'lucide-react';

export const Spinner = () => (
  <div className="flex items-center justify-center h-full py-20">
    <div className="w-12 h-12 rounded-full border-[3px] border-gridline border-t-accent animate-spin" />
  </div>
);

export const PageHeader = ({ title, subtitle, children }) => (
  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4">
    <div className="min-w-0">
      <div className="h-1 w-10 bg-accent rounded-full mb-3" aria-hidden="true" />
      <h1 className="font-display text-[28px] sm:text-[36px] leading-[1.05] font-extrabold tracking-hero text-ink">
        {title}
      </h1>
      {subtitle && <p className="text-sm text-muted mt-2">{subtitle}</p>}
    </div>
    {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
  </div>
);

export const Button = ({ children, variant = 'primary', icon: Icon, className = '', ...props }) => {
  const variants = {
    primary: 'bg-accent text-white hover:bg-accent-hover border border-transparent',
    secondary: 'bg-elevated border border-line text-ink hover:bg-surface',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 border border-transparent',
    danger: 'bg-red-600 text-white hover:bg-red-700 border border-transparent',
    ghost: 'bg-transparent border border-transparent text-muted hover:bg-surface hover:text-ink',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-pop text-sm font-semibold tracking-[-0.01em] transition-colors duration-120 ease-pop ${variants[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
      {children}
    </button>
  );
};

export const AddButton = ({ label = 'Yeni Ekle', onClick }) => (
  <Button onClick={onClick} icon={PlusCircle}>{label}</Button>
);

export const Card = ({ title, children, className = '', actions }) => (
  <div className={`bg-elevated rounded-bento border border-line overflow-hidden ${className}`}>
    {(title || actions) && (
      <div className="flex justify-between items-center gap-3 px-6 py-4 border-b border-line">
        {title && (
          <h3 className="font-display text-base font-bold tracking-display text-ink">{title}</h3>
        )}
        {actions}
      </div>
    )}
    {children}
  </div>
);

// Bento istatistik kutusu: etiket küçük ve versal, değer iri ve sıkı aralıklı.
export const StatCard = ({ title, value, color = 'text-ink', icon: Icon, hint }) => (
  <div className="bg-elevated p-5 rounded-bento border border-line">
    {/* Etiket ve ikon üst satırda durur; böylece rakam kutunun tam
        genişliğini kullanır ve para değerleri ortasından kırılmaz. */}
    <div className="flex items-start justify-between gap-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</h4>
      {Icon && (
        <div className="p-2 rounded-pop bg-surface border border-line flex-shrink-0 -mt-1 -mr-1">
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      )}
    </div>
    <p className={`font-display text-[clamp(20px,1.9vw,28px)] leading-[1.1] font-extrabold tracking-hero tabular-nums mt-3 break-words ${color}`}>
      {value}
    </p>
    {hint && <p className="text-xs text-muted mt-2">{hint}</p>}
  </div>
);

export const Badge = ({ children, color = 'gray' }) => {
  const colors = {
    gray: 'bg-surface text-muted border-line',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    yellow: 'bg-amber-50 text-amber-800 border-amber-200',
    blue: 'bg-sky-50 text-sky-700 border-sky-200',
    sky: 'bg-accent-soft text-accent-text border-transparent',
    purple: 'bg-violet-50 text-violet-700 border-violet-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-[0.08em] ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
};

export const EmptyState = ({ message = 'Henüz kayıt yok', icon: Icon = Inbox }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="h-14 w-14 rounded-bento border border-line pop-dots flex items-center justify-center mb-4">
      <Icon className="h-6 w-6 text-muted" />
    </div>
    <p className="text-sm text-muted max-w-sm">{message}</p>
  </div>
);

// --- Tablo bileşenleri ---
export const Table = ({ headers, children }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full">
      <thead>
        <tr className="bg-surface border-b border-gridline">
          {headers.map((h, i) => (
            <th
              key={i}
              className={`px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-[0.12em] ${h.align === 'right' ? 'text-right' : 'text-left'}`}
            >
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-elevated divide-y divide-line">{children}</tbody>
    </table>
  </div>
);

export const Td = ({ children, align = 'left', wrap = false, className = '', ...props }) => (
  <td
    className={`px-4 py-3 text-sm ${wrap ? 'whitespace-normal break-words' : 'whitespace-nowrap'} ${align === 'right' ? 'text-right tabular-nums' : 'text-left'} ${className}`}
    {...props}
  >
    {children}
  </td>
);

// --- Form girişleri ---
export const Field = ({ label, children, className = '' }) => (
  <label className={`flex flex-col ${className}`}>
    {label && (
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-1.5">{label}</span>
    )}
    {children}
  </label>
);

const inputClass =
  'px-3 py-2.5 min-h-[44px] border border-line rounded-pop bg-elevated text-ink placeholder-muted w-full ' +
  'outline-none transition-colors duration-120 ease-pop focus:border-accent focus:ring-2 focus:ring-accent-soft';

export const Input = ({ className = '', ...props }) => <input className={`${inputClass} ${className}`} {...props} />;
export const Textarea = ({ className = '', ...props }) => <textarea className={`${inputClass} h-24 ${className}`} {...props} />;
export const Select = ({ children, className = '', ...props }) => (
  <select className={`${inputClass} ${className}`} {...props}>{children}</select>
);

const MODAL_SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
};

const ModalTitle = ({ title, onClose }) => (
  <div className="px-6 py-5 border-b border-line flex justify-between items-center gap-3">
    <h3 className="font-display text-xl font-extrabold tracking-display text-ink">{title}</h3>
    <button
      type="button"
      onClick={onClose}
      aria-label="Kapat"
      className="h-10 w-10 -mr-2 flex items-center justify-center rounded-pop text-muted hover:text-ink hover:bg-surface transition-colors duration-120 ease-pop"
    >
      <X size={20} />
    </button>
  </div>
);

// --- Modal ---
export const Modal = ({ title, children, onClose, size = 'md', footer }) => (
  <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
    <div className={`bg-elevated rounded-bento border border-line w-full ${MODAL_SIZES[size]} my-8`}>
      <div className="sticky top-0 bg-elevated rounded-t-bento z-10"><ModalTitle title={title} onClose={onClose} /></div>
      <div className="p-6">{children}</div>
      {footer && <div className="px-6 py-4 bg-surface border-t border-line flex justify-end gap-3 rounded-b-bento">{footer}</div>}
    </div>
  </div>
);

// Form içeren modal: gönderim ve standart buton ayağı
export const FormModal = ({ title, children, onSubmit, onClose, size = 'md', submitLabel = 'Kaydet' }) => (
  <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
    <div className={`bg-elevated rounded-bento border border-line w-full my-8 ${MODAL_SIZES[size]}`}>
      <form onSubmit={onSubmit}>
        <ModalTitle title={title} onClose={onClose} />
        <div className="p-6">{children}</div>
        <div className="px-6 py-4 bg-surface border-t border-line flex justify-end gap-3 rounded-b-bento">
          <Button type="button" variant="secondary" onClick={onClose}>İptal</Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </div>
  </div>
);

// Satır işlemleri için dayanıklı eylem menüsü (ortalanmış action sheet).
// items: [{ label, icon, onClick, danger, hidden }]
export const ActionMenu = ({ items }) => {
  const [open, setOpen] = useState(false);
  const visible = (items || []).filter((it) => it && !it.hidden);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="h-10 w-10 inline-flex items-center justify-center rounded-pop text-muted hover:bg-surface hover:text-ink transition-colors duration-120 ease-pop"
        aria-label="İşlemler"
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <Modal title="İşlemler" size="sm" onClose={() => setOpen(false)}>
          <div className="flex flex-col -my-1">
            {visible.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setOpen(false); it.onClick && it.onClick(); }}
                className={`flex items-center gap-3 px-3 min-h-[44px] text-sm font-medium text-left rounded-pop hover:bg-surface transition-colors duration-120 ease-pop ${it.danger ? 'text-red-600' : 'text-ink'}`}
              >
                {it.icon && <it.icon size={17} />}
                {it.label}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
};

export const ConfirmDialog = ({ message, onConfirm, onClose }) => (
  <Modal
    title="Onay"
    onClose={onClose}
    size="sm"
    footer={
      <>
        <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
        <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>Sil</Button>
      </>
    }
  >
    <p className="text-sm text-muted">{message}</p>
  </Modal>
);

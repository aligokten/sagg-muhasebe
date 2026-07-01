// --- Paylaşılan arayüz bileşenleri ---
import React, { useState } from 'react';
import { X, PlusCircle, Inbox, MoreVertical } from 'lucide-react';

export const Spinner = () => (
  <div className="flex items-center justify-center h-full py-20">
    <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
  </div>
);

export const PageHeader = ({ title, subtitle, children }) => (
  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-3">
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{title}</h1>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
    {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
  </div>
);

export const Button = ({ children, variant = 'primary', icon: Icon, className = '', ...props }) => {
  const variants = {
    primary: 'bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-300',
    secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-200',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-300',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-300',
    ghost: 'text-gray-600 hover:bg-gray-100',
  };
  return (
    <button
      className={`flex items-center justify-center px-4 py-2 rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-4 text-sm font-medium ${variants[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 mr-2" />}
      {children}
    </button>
  );
};

export const AddButton = ({ label = 'Yeni Ekle', onClick }) => (
  <Button onClick={onClick} icon={PlusCircle}>{label}</Button>
);

export const Card = ({ title, children, className = '', actions }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className}`}>
    {(title || actions) && (
      <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
        {title && <h3 className="text-lg font-semibold text-gray-700">{title}</h3>}
        {actions}
      </div>
    )}
    {children}
  </div>
);

export const StatCard = ({ title, value, color = 'text-gray-700', icon: Icon, hint }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
    <div className="flex flex-col">
      <h4 className="text-sm font-medium text-gray-500">{title}</h4>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
    {Icon && (
      <div className={`p-3 rounded-full bg-opacity-10 ${color.replace('text', 'bg').replace('-600', '-100').replace('-700', '-100')}`}>
        <Icon className={`h-7 w-7 ${color}`} />
      </div>
    )}
  </div>
);

export const Badge = ({ children, color = 'gray' }) => {
  const colors = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    blue: 'bg-blue-100 text-blue-700',
    sky: 'bg-orange-100 text-orange-700',
    purple: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
};

export const EmptyState = ({ message = 'Henüz kayıt yok', icon: Icon = Inbox }) => (
  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
    <Icon className="h-12 w-12 mb-3" />
    <p className="text-sm">{message}</p>
  </div>
);

// --- Tablo bileşenleri ---
export const Table = ({ headers, children }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead>
        <tr className="bg-gray-50">
          {headers.map((h, i) => (
            <th
              key={i}
              className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${h.align === 'right' ? 'text-right' : 'text-left'}`}
            >
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>
    </table>
  </div>
);

export const Td = ({ children, align = 'left', className = '', ...props }) => (
  <td
    className={`px-4 py-3 whitespace-nowrap text-sm ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
    {...props}
  >
    {children}
  </td>
);

// --- Form girişleri ---
export const Field = ({ label, children, className = '' }) => (
  <label className={`flex flex-col ${className}`}>
    {label && <span className="text-sm font-medium text-gray-600 mb-1">{label}</span>}
    {children}
  </label>
);

const inputClass =
  'p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none w-full bg-white text-gray-900 placeholder-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-400';

export const Input = ({ className = '', ...props }) => <input className={`${inputClass} ${className}`} {...props} />;
export const Textarea = ({ className = '', ...props }) => <textarea className={`${inputClass} h-24 ${className}`} {...props} />;
export const Select = ({ children, className = '', ...props }) => (
  <select className={`${inputClass} ${className}`} {...props}>{children}</select>
);

// --- Modal ---
export const Modal = ({ title, children, onClose, size = 'md', footer }) => {
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className={`bg-white rounded-lg shadow-xl w-full ${sizes[size]} my-8`}>
        <div className="p-5 border-b flex justify-between items-center sticky top-0 bg-white rounded-t-lg z-10">
          <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3 rounded-b-lg">{footer}</div>}
      </div>
    </div>
  );
};

// Form içeren modal: gönderim ve standart buton ayağı
export const FormModal = ({ title, children, onSubmit, onClose, size = 'md', submitLabel = 'Kaydet' }) => (
  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 p-4 overflow-y-auto">
    <div className={`bg-white rounded-lg shadow-xl w-full my-8 ${({ sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', '2xl': 'max-w-6xl' })[size]}`}>
      <form onSubmit={onSubmit}>
        <div className="p-5 border-b flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X />
          </button>
        </div>
        <div className="p-5">{children}</div>
        <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
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
        className="p-2 rounded-full hover:bg-gray-200 text-gray-500"
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
                className={`flex items-center gap-3 px-3 py-3 text-sm text-left rounded-lg hover:bg-gray-100 ${it.danger ? 'text-red-600' : 'text-gray-700'}`}
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
    <p className="text-gray-600">{message}</p>
  </Modal>
);

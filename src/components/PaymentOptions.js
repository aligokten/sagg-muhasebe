// --- Müşteri: abonelik paketi + ödeme yöntemi seçimi (kredi kartı yakında / havale bildirimi) ---
import React, { useEffect, useState } from 'react';
import { CreditCard, Landmark, CheckCircle2 } from 'lucide-react';
import { subscribePaymentInfo, subscribePricingPlans, createPaymentRequest } from '../firebase';
import { formatCurrency } from '../utils';
import { PLAN_OPTIONS } from '../constants';
import { Modal, Button } from './ui';

export default function PaymentOptions({ userId, userEmail, onClose }) {
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [plan, setPlan] = useState(null);
  const [step, setStep] = useState('plan'); // plan | choose | transfer | sent
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribePaymentInfo(setPaymentInfo), []);
  useEffect(() => subscribePricingPlans(setPricing), []);

  const confirmTransferSent = async () => {
    setBusy(true);
    try {
      await createPaymentRequest(userId, userEmail, 'havale', '', plan);
      setStep('sent');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'sent') {
    return (
      <Modal title="Bildirim Alındı" size="sm" onClose={onClose}>
        <div className="text-center py-4">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-500 mb-3" />
          <p className="text-sm text-gray-600">Ödeme bildiriminiz alındı. Ödemeniz kontrol edildikten sonra hesabınız aktifleştirilecek.</p>
        </div>
      </Modal>
    );
  }

  if (step === 'transfer') {
    return (
      <Modal title="Havale / EFT ile Ödeme" size="sm" onClose={onClose}>
        {!paymentInfo ? (
          <p className="text-sm text-gray-500">Hesap bilgileri henüz tanımlanmamış. Lütfen yöneticiyle iletişime geçin.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <p><span className="text-gray-500">Banka:</span> <b>{paymentInfo.bankName}</b></p>
              <p><span className="text-gray-500">Hesap Sahibi:</span> <b>{paymentInfo.accountHolder}</b></p>
              <p><span className="text-gray-500">IBAN:</span> <b className="break-all">{paymentInfo.iban}</b></p>
              {paymentInfo.note && <p className="text-xs text-gray-400 mt-1">{paymentInfo.note}</p>}
            </div>
            <p className="text-xs text-gray-500">Açıklama kısmına e-posta adresinizi ({userEmail}) yazmanız işleminizi hızlandırır.</p>
            <Button className="w-full justify-center" disabled={busy} onClick={confirmTransferSent}>
              {busy ? 'Gönderiliyor...' : 'Ödemeyi Gönderdim, Bildir'}
            </Button>
          </div>
        )}
      </Modal>
    );
  }

  if (step === 'choose') {
    return (
      <Modal title="Ödeme Yöntemi Seçin" size="sm" onClose={onClose}>
        <div className="space-y-3">
          <button type="button" disabled className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 opacity-50 cursor-not-allowed text-left">
            <CreditCard className="text-gray-400 flex-shrink-0" size={22} />
            <span>
              <span className="block font-medium text-gray-700">Kredi Kartı ile Öde</span>
              <span className="block text-xs text-gray-400">Yakında</span>
            </span>
          </button>
          <button type="button" onClick={() => setStep('transfer')} className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-left">
            <Landmark className="text-orange-600 flex-shrink-0" size={22} />
            <span>
              <span className="block font-medium text-gray-700">Havale / EFT ile Öde</span>
              <span className="block text-xs text-gray-400">Hesap bilgilerini görüntüle</span>
            </span>
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Abonelik Paketi Seçin" size="sm" onClose={onClose}>
      <div className="space-y-3">
        {PLAN_OPTIONS.map((p) => {
          const price = pricing?.[p.key];
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => { setPlan(p.key); setStep('choose'); }}
              className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-left"
            >
              <span className="font-medium text-gray-700">{p.label}</span>
              <span className="font-semibold text-orange-600">{price ? formatCurrency(price) : 'Fiyat belirtilmemiş'}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

// --- E-posta/şifre ile giriş & kayıt (çok cihazlı erişim) ---
import React, { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import {
  auth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  EmailAuthProvider, linkWithCredential,
} from '../firebase';
import { Modal, Button, Field, Input } from './ui';

const errorMessage = (code) => {
  switch (code) {
    case 'auth/operation-not-allowed':
      return "E-posta/şifre girişi Firebase'de etkin değil. Firebase Console → Authentication → Sign-in method → Email/Password sağlayıcısını etkinleştirin.";
    case 'auth/email-already-in-use':
      return 'Bu e-posta zaten kayıtlı. Lütfen "Giriş Yap" sekmesini kullanın.';
    case 'auth/invalid-email':
      return 'Geçersiz e-posta adresi.';
    case 'auth/weak-password':
      return 'Şifre en az 6 karakter olmalı.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-posta veya şifre hatalı.';
    case 'auth/too-many-requests':
      return 'Çok fazla deneme. Lütfen biraz sonra tekrar deneyin.';
    case 'auth/credential-already-in-use':
      return 'Bu e-posta başka bir hesaba ait. "Giriş Yap" ile girin (bu cihazdaki misafir veriler taşınmaz).';
    default:
      return 'Bir hata oluştu: ' + code;
  }
};

export default function AuthModal({ isAnonymous, onClose }) {
  const [mode, setMode] = useState('register');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (mode === 'register') {
        if (isAnonymous && auth.currentUser) {
          // Misafir (anonim) hesabı e-postaya bağla → veriler korunur
          const cred = EmailAuthProvider.credential(email, pass);
          await linkWithCredential(auth.currentUser, cred);
        } else {
          await createUserWithEmailAndPassword(auth, email, pass);
        }
      } else {
        await signInWithEmailAndPassword(auth, email, pass);
      }
      onClose();
    } catch (e2) {
      console.error(e2);
      setErr(errorMessage(e2.code || e2.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Hesap" size="sm" onClose={onClose}>
      <div className="flex gap-2 mb-4">
        {[{ k: 'register', l: 'Kayıt Ol' }, { k: 'login', l: 'Giriş Yap' }].map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => { setMode(t.k); setErr(''); }}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${mode === t.k ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {t.l}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Field label="E-posta"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></Field>
        <Field label="Şifre"><Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} required minLength={6} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></Field>

        {mode === 'register' && isAnonymous && (
          <p className="text-xs text-orange-700 bg-orange-50 rounded-md p-2">
            Bu cihazdaki mevcut verileriniz bu hesaba aktarılacak ve diğer cihazlardan da erişilebilir olacak.
          </p>
        )}
        {mode === 'login' && (
          <p className="text-xs text-gray-500">Başka bir cihazda oluşturduğunuz hesapla giriş yapın; aynı verilere ulaşırsınız.</p>
        )}
        {err && <p className="text-sm text-red-600 bg-red-50 rounded-md p-2">{err}</p>}

        <Button type="submit" icon={mode === 'register' ? UserPlus : LogIn} className="w-full justify-center" disabled={busy}>
          {busy ? 'Lütfen bekleyin...' : mode === 'register' ? 'Kayıt Ol' : 'Giriş Yap'}
        </Button>
      </form>
    </Modal>
  );
}

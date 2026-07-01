// --- E-posta/şifre ile giriş & kayıt (zorunlu giriş ekranı) ---
import React, { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import {
  auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, createTrialSubscription,
} from '../firebase';
import { Button, Field, Input } from './ui';

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
    default:
      return 'Bir hata oluştu: ' + code;
  }
};

export default function AuthModal() {
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
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await createTrialSubscription(cred.user.uid, email);
      } else {
        await signInWithEmailAndPassword(auth, email, pass);
      }
    } catch (e2) {
      console.error(e2);
      setErr(errorMessage(e2.code || e2.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="text-center mb-5">
          <span className="text-3xl font-bold text-orange-500">S</span>
          <h1 className="text-lg font-bold text-gray-800">SAGG Muhasebe</h1>
        </div>

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

          {mode === 'register' && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-md p-2">Kayıt olduğunuzda 7 günlük ücretsiz deneme süreniz başlar.</p>
          )}
          {err && <p className="text-sm text-red-600 bg-red-50 rounded-md p-2">{err}</p>}

          <Button type="submit" icon={mode === 'register' ? UserPlus : LogIn} className="w-full justify-center" disabled={busy}>
            {busy ? 'Lütfen bekleyin...' : mode === 'register' ? 'Kayıt Ol' : 'Giriş Yap'}
          </Button>
        </form>
      </div>
    </div>
  );
}

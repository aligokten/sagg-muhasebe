// --- Firebase yapılandırması ve veri katmanı ---
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  onSnapshot,
  doc,
  query,
  Timestamp,
  setDoc,
  updateDoc,
  getDocs,
  getDoc,
} from 'firebase/firestore';

// Bu bilgiler Firebase projesinden alınmıştır.
const firebaseConfig = {
  apiKey: 'AIzaSyB3UzsOhB0u8kvha-kPioQX6YYRrOhEAvk',
  authDomain: 'sagg-muhasebe.firebaseapp.com',
  projectId: 'sagg-muhasebe',
  storageBucket: 'sagg-muhasebe.firebasestorage.app',
  messagingSenderId: '453864948612',
  appId: '1:453864948612:web:5736e59e08a10d524353d1',
  measurementId: 'G-PM7WXNEQG9',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = 'sagg-muhasebe-app';

export {
  onAuthStateChanged, Timestamp,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut,
};

// --- Yol yardımcıları ---
const basePath = (userId) => `artifacts/${appId}/users/${userId}`;

export const colPath = (userId, name) => `${basePath(userId)}/${name}`;
export const colRef = (userId, name) => collection(db, colPath(userId, name));
export const docRef = (userId, name, id) => doc(db, colPath(userId, name), id);

// --- Genel CRUD yardımcıları ---
export const addRecord = (userId, name, data) =>
  addDoc(colRef(userId, name), { ...data, createdAt: Timestamp.now() });

export const updateRecord = (userId, name, id, data) =>
  updateDoc(docRef(userId, name, id), data);

export const setRecord = (userId, name, id, data, options) =>
  setDoc(docRef(userId, name, id), data, options || {});

export const deleteRecord = (userId, name, id) =>
  deleteDoc(docRef(userId, name, id));

// Bir koleksiyonu canlı dinler.
export const subscribeCollection = (userId, name, cb) =>
  onSnapshot(
    query(colRef(userId, name)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error(`'${name}' okunurken hata:`, err)
  );

// Belirli bir kullanıcının bir koleksiyonunu tek seferlik okur (taşıma için).
export const fetchCollectionOnce = async (uid, name) => {
  const snap = await getDocs(colRef(uid, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Belirli bir kullanıcının tek bir dökümanını tek seferlik okur.
export const fetchDocOnce = async (uid, name, id) => {
  const s = await getDoc(docRef(uid, name, id));
  return s.exists() ? s.data() : null;
};

// Tek bir dökümanı canlı dinler.
export const subscribeDoc = (userId, name, id, cb, onMissing) =>
  onSnapshot(docRef(userId, name, id), async (snap) => {
    if (snap.exists()) cb(snap.data());
    else if (onMissing) onMissing();
  });

// --- Abonelik yönetimi (kullanıcı bazlı ayrı üst-seviye koleksiyon) ---
export const ADMIN_EMAIL = 'aligokten99@gmail.com';

const subscriptionDocRef = (uid) => doc(db, `artifacts/${appId}/subscriptions`, uid);
const subscriptionsColRef = () => collection(db, `artifacts/${appId}/subscriptions`);

export const createTrialSubscription = (uid, email) =>
  setDoc(subscriptionDocRef(uid), {
    email,
    status: 'trial',
    plan: 'trial',
    trialEndsAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    createdAt: Timestamp.now(),
  });

export const subscribeSubscription = (uid, cb) =>
  onSnapshot(subscriptionDocRef(uid), (snap) => cb(snap.exists() ? snap.data() : null));

export const subscribeAllSubscriptions = (cb) =>
  onSnapshot(
    subscriptionsColRef(),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error('abonelikler okunurken hata:', err)
  );

export const updateSubscription = (uid, data) =>
  updateDoc(subscriptionDocRef(uid), { ...data, updatedAt: Timestamp.now() });

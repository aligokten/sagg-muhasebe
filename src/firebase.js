// --- Firebase yapılandırması ve veri katmanı ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
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

export { signInAnonymously, onAuthStateChanged, Timestamp };

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

// Tek bir dökümanı canlı dinler.
export const subscribeDoc = (userId, name, id, cb, onMissing) =>
  onSnapshot(docRef(userId, name, id), async (snap) => {
    if (snap.exists()) cb(snap.data());
    else if (onMissing) onMissing();
  });

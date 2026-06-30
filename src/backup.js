// --- Veri yedekleme / geri yükleme (JSON) ---
// Tüm kayıtlar mevcut kullanıcının altından okunur (export) veya
// mevcut kullanıcının altına yazılır (import). Güvenlik kurallarına
// uygundur: yalnızca kendi verinize erişirsiniz.
import { Timestamp, addRecord, setRecord, fetchCollectionOnce, fetchDocOnce } from './firebase';
import { COLLECTIONS } from './constants';

const TS_KEY = '__ts';

const stripId = (r) => { const { id, ...rest } = r || {}; return rest; };

const serialize = (v) => {
  if (v == null) return v;
  if (typeof v.toMillis === 'function') return { [TS_KEY]: v.toMillis() };
  if (typeof v === 'object' && v.seconds !== undefined && v.nanoseconds !== undefined) {
    return { [TS_KEY]: v.seconds * 1000 + Math.round(v.nanoseconds / 1e6) };
  }
  if (Array.isArray(v)) return v.map(serialize);
  if (typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = serialize(v[k]);
    return o;
  }
  return v;
};

const revive = (v) => {
  if (v == null) return v;
  if (typeof v === 'object' && !Array.isArray(v) && v[TS_KEY] !== undefined && Object.keys(v).length === 1) {
    return Timestamp.fromMillis(v[TS_KEY]);
  }
  if (Array.isArray(v)) return v.map(revive);
  if (typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = revive(v[k]);
    return o;
  }
  return v;
};

export function buildBackup(data) {
  const out = {
    app: 'sagg-defter',
    version: 1,
    exportedAt: new Date().toISOString(),
    companyProfile: serialize(stripId(data.companyProfile || {})),
    collections: {},
  };
  COLLECTIONS.forEach((name) => {
    out.collections[name] = (data[name] || []).map((r) => serialize(stripId(r)));
  });
  return out;
}

export function countRecords(data) {
  return COLLECTIONS.reduce((n, name) => n + (data[name] || []).length, 0);
}

export function downloadBackup(data) {
  const json = JSON.stringify(buildBackup(data), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `sagg-defter-yedek-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Başka bir kullanıcının (eski misafir uid) verisini tek seferde okur.
export async function loadFromUid(sourceUid) {
  const collections = {};
  let total = 0;
  for (const name of COLLECTIONS) {
    const recs = await fetchCollectionOnce(sourceUid, name);
    collections[name] = recs;
    total += recs.length;
  }
  const companyProfile = await fetchDocOnce(sourceUid, 'companyProfile', 'main');
  return { collections, companyProfile, total };
}

// Okunan veriyi hedef kullanıcının altına yazar.
export async function writeLoaded(targetUid, loaded) {
  let count = 0;
  for (const name of COLLECTIONS) {
    const recs = loaded.collections[name] || [];
    await Promise.all(recs.map((r) => { const { id, ...rest } = r; return addRecord(targetUid, name, rest); }));
    count += recs.length;
  }
  if (loaded.companyProfile && Object.keys(loaded.companyProfile).length) {
    await setRecord(targetUid, 'companyProfile', 'main', loaded.companyProfile, { merge: true });
  }
  return count;
}

export async function restoreBackup(userId, parsed) {
  if (!parsed || parsed.app !== 'sagg-defter' || !parsed.collections) {
    throw new Error('Geçersiz yedek dosyası.');
  }
  let count = 0;
  for (const name of COLLECTIONS) {
    const recs = parsed.collections[name] || [];
    await Promise.all(recs.map((r) => addRecord(userId, name, revive(r))));
    count += recs.length;
  }
  if (parsed.companyProfile && Object.keys(parsed.companyProfile).length) {
    await setRecord(userId, 'companyProfile', 'main', revive(parsed.companyProfile), { merge: true });
  }
  return count;
}

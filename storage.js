/**
 * طبقة التخزين السحابي للمنصة — ثلاث طبقات بالترتيب:
 *  1) Firestore        → مزامنة لحظية بين كل الفروع (يُفعَّل تلقائياً عند ضبط متغيرات VITE_FIREBASE_*)
 *  2) خادم المشروع     → /api/store عند غياب إعدادات Firebase
 *  3) تخزين المتصفح    → احتياطي عند انقطاع الشبكة
 * واجهة موحّدة: cloud.get / cloud.set / cloud.subscribe — لا يعلم باقي التطبيق أي طبقة تعمل.
 */

export const KEYS = {
  org: 'rms8:org',
  ops: 'rms8:ops',
  pulse: 'rms8:pulse',
  files: 'rms8:files',
  hist: 'rms8:hist'
};

export const kb = (o) => Math.round(JSON.stringify(o || {}).length / 1024);

/* ================= إعدادات Firebase ================= */
const E = import.meta.env || {};
const FB = {
  apiKey: E.VITE_FIREBASE_API_KEY,
  authDomain: E.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: E.VITE_FIREBASE_PROJECT_ID,
  storageBucket: E.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: E.VITE_FIREBASE_SENDER_ID,
  appId: E.VITE_FIREBASE_APP_ID
};
const FB_READY = !!(FB.apiKey && FB.projectId);
const COL = E.VITE_FIREBASE_COLLECTION || 'platform';
const CHUNK = 700000; // مستند Firestore محدود بميغابايت — نقسّم القيم الكبيرة
const docId = (k) => k.replace(/[^\w-]/g, '_');

let fs = null;      // وحدات Firestore المحمّلة كسولاً
let fsFailed = false;

async function firestore() {
  if (!FB_READY || fsFailed) return null;
  if (fs) return fs;
  try {
    const [{ initializeApp }, sdk] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore')
    ]);
    const app = initializeApp(FB);
    let db;
    try {
      db = sdk.initializeFirestore(app, { localCache: sdk.persistentLocalCache({}) });
    } catch {
      db = sdk.getFirestore(app);   // متصفح لا يدعم التخزين الدائم
    }
    // دخول مجهول لتلبية قواعد الأمان (يتطلب تفعيل Anonymous Auth في Firebase)
    try {
      const auth = await import('firebase/auth');
      const a = auth.getAuth(app);
      if (!a.currentUser) await auth.signInAnonymously(a);
    } catch (e) {
      console.warn('تعذّر الدخول المجهول — تأكد من تفعيل Anonymous Auth إن كانت القواعد تشترط المصادقة.');
    }
    fs = { db, ...sdk };
    return fs;
  } catch (e) {
    console.warn('تعذّر تحميل Firestore — سيتم استخدام خادم المشروع.', e);
    fsFailed = true;
    return null;
  }
}

async function fsRead(f, key) {
  const snap = await f.getDoc(f.doc(f.db, COL, docId(key)));
  if (!snap.exists()) return undefined;
  const d = snap.data();
  return await fsAssemble(f, key, d);
}

async function fsAssemble(f, key, d) {
  if (!d) return undefined;
  if ((d.parts || 1) === 1) return d.value ? JSON.parse(d.value) : undefined;
  const parts = [];
  for (let i = 0; i < d.parts; i++) {
    const c = await f.getDoc(f.doc(f.db, COL, docId(key) + '__' + i));
    parts.push(c.exists() ? c.data().chunk : '');
  }
  try { return JSON.parse(parts.join('')); } catch { return undefined; }
}

async function fsWrite(f, key, val) {
  const s = JSON.stringify(val);
  const parts = Math.max(1, Math.ceil(s.length / CHUNK));
  if (parts > 1) {
    for (let i = 0; i < parts; i++) {
      await f.setDoc(f.doc(f.db, COL, docId(key) + '__' + i), { chunk: s.slice(i * CHUNK, (i + 1) * CHUNK) });
    }
  }
  await f.setDoc(f.doc(f.db, COL, docId(key)), {
    parts, updatedAt: Date.now(), value: parts === 1 ? s : ''
  });
  return true;
}

/* ================= خادم المشروع ================= */
let useApi = true;
const url = (k) => '/api/store/' + encodeURIComponent(k);

/* ================= تخزين المتصفح ================= */
const local = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : undefined; } catch { return undefined; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
};

/* ================= الواجهة الموحّدة ================= */
export const cloud = {
  async get(key, def) {
    const f = await firestore();
    if (f) {
      try {
        const v = await fsRead(f, key);
        if (v !== undefined) { local.set(key, v); return v; }
        return def;
      } catch (e) { console.warn('قراءة Firestore فشلت:', e); }
    }
    if (useApi && !FB_READY) {
      try {
        const r = await fetch(url(key));
        if (r.ok) {
          const j = await r.json();
          if (j.value !== null && j.value !== undefined) { local.set(key, j.value); return j.value; }
          return def;
        }
      } catch { useApi = false; }
    }
    const v = local.get(key);
    return v === undefined ? def : v;
  },

  async set(key, val) {
    const f = await firestore();
    if (f) {
      try { await fsWrite(f, key, val); local.set(key, val); return true; }
      catch (e) { console.warn('كتابة Firestore فشلت:', e); }
    }
    if (useApi && !FB_READY) {
      try {
        const r = await fetch(url(key), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: val })
        });
        if (r.ok) { local.set(key, val); return true; }
      } catch { useApi = false; }
    }
    return local.set(key, val);
  },

  /** استماع لحظي — يعيد دالة إلغاء الاشتراك، أو null إذا لم تكن الطبقة تدعمه */
  subscribe(key, cb) {
    if (!FB_READY) return null;
    let stop = null, dead = false;
    firestore().then(f => {
      if (!f || dead) return;
      stop = f.onSnapshot(f.doc(f.db, COL, docId(key)), async (snap) => {
        if (!snap.exists()) return;
        try {
          const v = await fsAssemble(f, key, snap.data());
          if (v !== undefined) { local.set(key, v); cb(v); }
        } catch (e) { console.warn('استماع Firestore:', e); }
      }, (e) => console.warn('انقطع الاستماع اللحظي:', e));
    });
    return () => { dead = true; if (stop) stop(); };
  },

  get mode() { return FB_READY ? 'firestore' : (useApi ? 'server' : 'local'); },
  get live() { return FB_READY; }
};

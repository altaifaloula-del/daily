/**
 * طبقة التخزين السحابي للمنصة — ثلاث طبقات بالترتيب:
 *  1) Firestore        → مزامنة لحظية بين كل الفروع (يُفعَّل تلقائياً عند ضبط متغيرات VITE_FIREBASE_*)
 *  2) خادم المشروع     → /api/store عند غياب إعدادات Firebase
 *  3) تخزين المتصفح    → احتياطي عند انقطاع الشبكة
 * واجهة موحّدة: cloud.get / cloud.set / cloud.subscribe — لا يعلم باقي التطبيق أي طبقة تعمل.
 */

export const KEYS = {
  org: 'rms8:org',       // المنشأة كاملة (أسرار: كلمات مشفرة، رواتب، إعدادات) — للإدارة
  dir: 'rms8:dir',       // v9: دليل عام منزوع الأسرار — يقرؤه كل الأعضاء
  core: 'rms8:core',     // v9: بيانات تشغيل مركزية — لأدوار المركز فقط
  ops: 'rms8:ops',       // الهيكل القديم — يُجمَّد بعد الهجرة ويبقى نسخة تاريخية
  pulse: 'rms8:pulse',
  files: 'rms8:files',   // الهيكل القديم للأرشيف — بعد الهجرة لكل فرع مستنده bf_
  hist: 'rms8:hist'
};
// v9: مستند لكل فرع (تشغيله وأرشيف صوره) — العزل الفعلي يفرضه الخادم عبر القواعد
export const brKey = (branchId) => 'rms8:br_' + branchId;
export const bfKey = (branchId) => 'rms8:bf_' + branchId;

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
let _fbAppP = null;

// تطبيق Firebase واحد مشترك بين المصادقة وقاعدة البيانات
async function fbApp() {
  if (!FB_READY) return null;
  if (!_fbAppP) {
    _fbAppP = (async () => {
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      return getApps().length ? getApp() : initializeApp(FB);
    })();
  }
  return _fbAppP;
}

async function fbAuthMod() {
  const app = await fbApp();
  if (!app) return null;
  const A = await import('firebase/auth');
  return { A, a: A.getAuth(app) };
}

// المستخدم الموثّق حاليًا (بعد استقرار حالة الجلسة) — لا دخول مجهولًا بعد الآن
async function authedUser() {
  const m = await fbAuthMod();
  if (!m) return null;
  await new Promise(res => { const un = m.A.onAuthStateChanged(m.a, () => { un(); res(); }); });
  return m.a.currentUser || null;
}

async function firestore() {
  if (!FB_READY || fsFailed) return null;
  if (fs) return fs;
  try {
    // لا وصول لقاعدة البيانات دون جلسة مصادقة حقيقية — تُنشأ من بوابة الدخول
    const u = await authedUser();
    if (!u) return null;
    const app = await fbApp();
    const sdk = await import('firebase/firestore');
    let db;
    try {
      db = sdk.initializeFirestore(app, { localCache: sdk.persistentLocalCache({}) });
    } catch {
      db = sdk.getFirestore(app);   // مهيأة مسبقاً أو متصفح لا يدعم التخزين الدائم
    }
    fs = { db, ...sdk };
    return fs;
  } catch (e) {
    console.warn('تعذّر تحميل Firestore — سيتم استخدام خادم المشروع.', e);
    fsFailed = true;
    return null;
  }
}

/* ================= المصادقة الحقيقية (بريد + كلمة سر لكل مستخدم) ================= */
export const authApi = {
  get enabled() { return FB_READY; },

  /** الجلسة الحالية إن وُجدت */
  async ready() {
    const u = await authedUser();
    return u ? { email: (u.email || '').toLowerCase() } : null;
  },

  async signIn(email, pass) {
    const m = await fbAuthMod(); if (!m) throw new Error('no-firebase');
    try { await m.A.setPersistence(m.a, m.A.browserLocalPersistence); } catch { }
    const cred = await m.A.signInWithEmailAndPassword(m.a, email.trim(), pass);
    return { email: (cred.user.email || '').toLowerCase() };
  },

  /** الإعداد الأول بعد الترقية: ينشئ حساب المالك ويدخله */
  async firstSetup(email, pass) {
    const m = await fbAuthMod(); if (!m) throw new Error('no-firebase');
    const cred = await m.A.createUserWithEmailAndPassword(m.a, email.trim(), pass);
    return { email: (cred.user.email || '').toLowerCase() };
  },

  async signOutAll() { const m = await fbAuthMod(); if (m) await m.A.signOut(m.a); },

  async resetPass(email) {
    const m = await fbAuthMod(); if (!m) throw new Error('no-firebase');
    await m.A.sendPasswordResetEmail(m.a, (email || '').trim());
  },

  /** إنشاء حساب مصادقة لموظف جديد دون إسقاط جلسة المدير (تطبيق ثانوي مؤقت) */
  async createUser(email, pass) {
    const { initializeApp, deleteApp } = await import('firebase/app');
    const A = await import('firebase/auth');
    const sec = initializeApp(FB, 'usr-' + Math.random().toString(36).slice(2));
    try {
      const sa = A.getAuth(sec);
      await A.createUserWithEmailAndPassword(sa, (email || '').trim(), pass);
      await A.signOut(sa);
    } finally { try { await deleteApp(sec); } catch { } }
  },

  /** تمهيد ما بعد الدخول: قائمة المدراء تُنشأ مرة واحدة باسم أول داخل، وعضويته تُرسَّخ */
  async bootstrap() {
    const f = await firestore(); if (!f) return false;
    const u = await authedUser(); if (!u) return false;
    const email = (u.email || '').toLowerCase();
    try {
      const ref = f.doc(f.db, 'platform', 'admins');
      const snap = await f.getDoc(ref);
      if (!snap.exists()) await f.setDoc(ref, { emails: [email], at: Date.now() });
    } catch { /* القائمة موجودة ولسنا مدراء — طبيعي */ }
    try { await f.setDoc(f.doc(f.db, 'members', email), { email, active: true, at: Date.now() }, { merge: true }); } catch { /* الكتابة للمدراء فقط */ }
    return true;
  },

  /** حالة عضويتي — تُفحص بعد الدخول لمنع تجربة مشوّشة لمن لا عضوية له */
  async myMembership() {
    const f = await firestore(); if (!f) return null;
    const u = await authedUser(); if (!u) return null;
    try {
      const snap = await f.getDoc(f.doc(f.db, 'members', (u.email || '').toLowerCase()));
      return { exists: snap.exists(), active: snap.exists() && snap.data().active === true };
    } catch { return { exists: false, active: false }; }
  },

  /** عضوية مستخدم (يديرها المدراء): تفعيل/تعطيل + دوره وفرعه */
  async upsertMember(email, data) {
    const f = await firestore(); if (!f) return false;
    const key = (email || '').toLowerCase();
    try {
      await f.setDoc(f.doc(f.db, 'members', key), { email: key, ...(data || {}), at: Date.now() }, { merge: true });
      return true;
    } catch { return false; }
  },

  /** مزامنة صفة «مدير» (كتابة الإعدادات) مع دور المستخدم */
  async syncAdmin(email, makeAdmin) {
    const f = await firestore(); if (!f) return false;
    const key = (email || '').toLowerCase();
    try {
      await f.updateDoc(f.doc(f.db, 'platform', 'admins'), { emails: makeAdmin ? f.arrayUnion(key) : f.arrayRemove(key) });
      return true;
    } catch { return false; }
  }
};

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
  /** v9: قراءة تُفرّق بين «غير موجود» و«مرفوض بالصلاحيات» — أساس مسار إقلاع الفروع */
  async tryGet(key) {
    const f = await firestore();
    if (f) {
      try {
        const v = await fsRead(f, key);
        if (v !== undefined) { local.set(key, v); return { ok: true, value: v }; }
        return { ok: true, value: undefined };
      } catch (e) {
        if (e && (e.code === 'permission-denied' || e.code === 'PERMISSION_DENIED')) {
          try { localStorage.removeItem(key); } catch { }   // تنظيف نسخة محلية قديمة على جهاز غير مخوّل
          return { ok: false, denied: true };
        }
        console.warn('قراءة Firestore فشلت:', e);
      }
    }
    const v = await this.get(key, undefined);
    return { ok: true, value: v };
  },

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
      catch (e) {
        console.warn('كتابة Firestore فشلت:', e);
        // رفض الصلاحيات قرارٌ من قواعد الأمان لا عطل شبكة — لا نتظاهر بالنجاح محلياً
        if (e && (e.code === 'permission-denied' || e.code === 'PERMISSION_DENIED')) return false;
      }
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

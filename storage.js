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
// v28.1: التقسيم بالبايت لا بعدد الأحرف — الحرف العربي بايتان في UTF-8 وحد مستند Firestore ميبيبايت واحد
const CHUNK_BYTES = 900000;
const MAX_PARTS = 500;          // سقف أجزاء المستند الواحد (يطابق قواعد Firestore) — يمنع حلقات قراءة لا تنتهي
const BATCH_MAX_PARTS = 10;     // حتى 10 أجزاء تُكتب مع رأسها في دفعة ذرّية واحدة (دون حد طلب 10MiB)
const docId = (k) => k.replace(/[^\w-]/g, '_');

/** يقسم نصًا إلى أجزاء لا يتجاوز كل منها maxBytes بترميز UTF-8، دون شطر أزواج البدائل */
export function splitUtf8(s, maxBytes = CHUNK_BYTES) {
  const out = [];
  let start = 0, bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const pair = c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length;
    const n = c < 0x80 ? 1 : c < 0x800 ? 2 : pair ? 4 : 3;
    if (bytes + n > maxBytes && i > start) { out.push(s.slice(start, i)); start = i; bytes = 0; }
    bytes += n;
    if (pair) i++;
  }
  out.push(s.slice(start));
  return out;
}

let fs = null;      // وحدات Firestore المحمّلة كسولاً
let fsFailed = false;
let _fbAppP = null;

// v28.1: مفاتيح تعذّرت قراءتها من السحابة (خطأ أو مستند تالف) — تُرفض الكتابة عليها حتى تنجح قراءة لاحقة،
// كي لا تُكتب نسخة فارغة أو قديمة فوق بيانات لم نستطع قراءتها
const failedReads = new Set();
// v29.0: بصمة رأس آخر نسخة قُرئت كاملة لكل مستند (updatedAt|parts). أول لقطة يرسلها الاستماع اللحظي
// بعد الإقلاع تحمل نفس البصمة غالبًا — كانت تُعيد تنزيل المستند كاملًا (بكل أجزائه) بلا أي تغيير.
const loadedStamp = new Map();
const stampOf = (d) => (d && d.updatedAt != null) ? (d.updatedAt + '|' + (d.parts || 1)) : null;

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
// v31.3 — التحقق بخطوتين (TOTP عبر تطبيق المصادقة): يفرضه Firebase نفسه بعد التسجيل — كلمة السر وحدها لا تكفي
let mfaResolver = null, mfaSecret = null;
const mfaErr = (code) => { const e = new Error(code); e.code = code; return e; };
async function reauthIf(m, u, pass, code) {
  if (!pass) return;
  const cred = m.A.EmailAuthProvider.credential(u.email, pass);
  try { await m.A.reauthenticateWithCredential(u, cred); }
  catch (e) {
    // v31.9: حساب مفعّل بخطوتين — إعادة التحقق تتطلب رمز التطبيق أيضًا
    if (e && e.code === 'auth/multi-factor-auth-required') {
      if (!code) throw mfaErr('mfa-code-needed');
      const r = m.A.getMultiFactorResolver(m.a, e);
      const h = r.hints.find(x => x.factorId === 'totp'); if (!h) throw mfaErr('mfa-unsupported');
      await r.resolveSignIn(m.A.TotpMultiFactorGenerator.assertionForSignIn(h.uid, String(code).replace(/\D/g, '')));
      return;
    }
    throw e;
  }
}
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
    try {
      const cred = await m.A.signInWithEmailAndPassword(m.a, email.trim(), pass);
      return { email: (cred.user.email || '').toLowerCase() };
    } catch (e) {
      if (e && e.code === 'auth/multi-factor-auth-required') {
        mfaResolver = m.A.getMultiFactorResolver(m.a, e);
        if (!mfaResolver.hints.some(h => h.factorId === 'totp')) throw mfaErr('mfa-unsupported');
        throw mfaErr('mfa-required');
      }
      throw e;
    }
  },

  /** الخطوة الثانية للدخول: رمز تطبيق المصادقة (6 أرقام) */
  async mfaVerify(code) {
    const m = await fbAuthMod(); if (!m || !mfaResolver) throw mfaErr('mfa-expired');
    const h = mfaResolver.hints.find(x => x.factorId === 'totp');
    const as = m.A.TotpMultiFactorGenerator.assertionForSignIn(h.uid, String(code).replace(/\D/g, ''));
    const cred = await mfaResolver.resolveSignIn(as);
    mfaResolver = null;
    return { email: (cred.user.email || '').toLowerCase() };
  },

  /** حالة التحقق بخطوتين للمستخدم الحالي: مسجّل؟ وهل استُخدم في هذه الجلسة؟ */
  async mfaInfo() {
    const m = await fbAuthMod(); const u = await authedUser(); if (!m || !u) return null;
    const fs2 = m.A.multiFactor(u).enrolledFactors.filter(f => f.factorId === 'totp');
    let used = false; try { const t = await u.getIdTokenResult(); used = !!(t.claims.firebase && t.claims.firebase.sign_in_second_factor); } catch { }
    return { enrolled: fs2.length > 0, used, factors: fs2.map(f => ({ uid: f.uid, name: f.displayName || '', at: f.enrollmentTime || '' })) };
  },

  /** بدء التسجيل: يتحقق من كلمة السر ثم يولّد السر ورابط رمز QR */
  async mfaStart(pass) {
    const m = await fbAuthMod(); const u = await authedUser(); if (!m || !u) throw mfaErr('no-session');
    await reauthIf(m, u, pass);
    const session = await m.A.multiFactor(u).getSession();
    mfaSecret = await m.A.TotpMultiFactorGenerator.generateSecret(session);
    return { key: mfaSecret.secretKey, url: mfaSecret.generateQrCodeUrl(u.email || 'user', 'ميزان') };
  },

  /** إتمام التسجيل برمز من التطبيق */
  async mfaFinish(code) {
    const m = await fbAuthMod(); const u = await authedUser(); if (!m || !u || !mfaSecret) throw mfaErr('mfa-expired');
    const as = m.A.TotpMultiFactorGenerator.assertionForEnrollment(mfaSecret, String(code).replace(/\D/g, ''));
    await m.A.multiFactor(u).enroll(as, 'تطبيق المصادقة');
    mfaSecret = null;
    return true;
  },

  /** إلغاء التحقق بخطوتين (يتطلب كلمة السر ورمز التطبيق) */
  async mfaRemove(pass, code) {
    const m = await fbAuthMod(); const u = await authedUser(); if (!m || !u) throw mfaErr('no-session');
    await reauthIf(m, u, pass, code);
    const mf = m.A.multiFactor(u);
    for (const f of mf.enrolledFactors.filter(x => x.factorId === 'totp')) await mf.unenroll(f);
    return true;
  },

  /** التسجيل يتطلب بريدًا موثّقًا: إرسال رابط التوثيق ثم التحقق بعد فتحه */
  async sendVerify() { const m = await fbAuthMod(); const u = await authedUser(); if (!m || !u) return false; await m.A.sendEmailVerification(u); return true; },
  async emailVerified() { const u = await authedUser(); if (!u) return false; try { await u.reload(); } catch { } return !!u.emailVerified; },

  /** سياسة الإلزام (platform/security) — تقرؤها قواعد الأمان أيضًا فتُفرض على الخادم */
  async getPolicy() {
    const f = await firestore(); if (!f) return null;
    try { const sn = await f.getDoc(f.doc(f.db, 'platform', 'security')); return sn.exists() ? (sn.data() || {}) : {}; } catch { return null; }
  },
  async setPolicy(p) {
    const f = await firestore(); if (!f) return false;
    try { await f.setDoc(f.doc(f.db, 'platform', 'security'), { roles: p.roles || [], admins: !!p.admins, at: Date.now() }); return true; } catch (e) { return false; }
  },

  /** الإعداد الأول بعد الترقية: ينشئ حساب المالك ويدخله */
  async firstSetup(email, pass) {
    const m = await fbAuthMod(); if (!m) throw new Error('no-firebase');
    const cred = await m.A.createUserWithEmailAndPassword(m.a, email.trim(), pass);
    return { email: (cred.user.email || '').toLowerCase() };
  },

  async signOutAll() { const m = await fbAuthMod(); if (m) await m.A.signOut(m.a); },

  /** رمز هوية الجلسة الحالية (Firebase ID token) — يُرسل لوسيط الخادم كي يتحقق من العضوية */
  async idToken() {
    const u = await authedUser();
    if (!u) return null;
    try { return await u.getIdToken(); } catch { return null; }
  },

  /** v31.9 — تغيير كلمة السر ذاتيًا: تحقق بالكلمة الحالية (ورمز التطبيق إن كان مفعّلًا) ثم التحديث */
  async changePassword(current, next, code) {
    const m = await fbAuthMod(); const u = await authedUser(); if (!m || !u) throw mfaErr('no-session');
    await reauthIf(m, u, current, code);
    await m.A.updatePassword(u, next);
    return true;
  },

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
      const d = snap.exists() ? (snap.data() || {}) : {};
      // v27.1: نعيد أيضًا ما تعتمد عليه قواعد Firestore (الفرع/النطاق/الدور) كي تُشخِّص الواجهة أي تعارض مع سجل المستخدم في المنصة
      return { exists: snap.exists(), active: snap.exists() && d.active === true, role: d.role || '', branchId: d.branchId || '', branchIds: Array.isArray(d.branchIds) ? d.branchIds : [], scope: d.scope || '' };
    } catch { return { exists: false, active: false, role: '', branchId: '', branchIds: [], scope: '' }; }
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

function corruptErr(key, why) {
  const e = new Error('data-corrupt: ' + key + ' (' + why + ')');
  e.code = 'data-corrupt';
  return e;
}

async function fsRead(f, key) {
  const snap = await f.getDoc(f.doc(f.db, COL, docId(key)));
  if (!snap.exists()) { loadedStamp.delete(key); return undefined; }
  const d = snap.data();
  const v = await fsAssemble(f, key, d);
  // v29.5: البصمة تُحفظ لكل مستند موجود (حتى الفارغ) — عليها تعتمد الكتابة المشروطة
  const st = stampOf(d); if (st) loadedStamp.set(key, st); else loadedStamp.delete(key);
  return v;
}

// v28.1: المستند التالف (جزء مفقود أو JSON غير صالح) يُرمى كخطأ صريح — كان يُعاد undefined فيُعامل كمستند
// غير موجود، ثم يكتب التطبيق نسخة فارغة فوقه
async function fsAssemble(f, key, d) {
  if (!d) return undefined;
  const parts = d.parts || 1;
  if (!Number.isInteger(parts) || parts < 1 || parts > MAX_PARTS) throw corruptErr(key, 'parts=' + d.parts);
  if (parts === 1) {
    if (!d.value) return undefined;
    try { return JSON.parse(d.value); } catch { throw corruptErr(key, 'json'); }
  }
  // v29.0: الأجزاء تُقرأ معًا بالتوازي بدل واحدٍ تلو الآخر — الترتيب محفوظ بفهرس المصفوفة
  const snaps = await Promise.all(Array.from({ length: parts }, (_, i) => f.getDoc(f.doc(f.db, COL, docId(key) + '__' + i))));
  const chunks = snaps.map((c, i) => {
    const chunk = c.exists() ? (c.data() || {}).chunk : undefined;
    if (typeof chunk !== 'string') throw corruptErr(key, 'chunk ' + i);
    return chunk;
  });
  try { return JSON.parse(chunks.join('')); } catch { throw corruptErr(key, 'json'); }
}

async function fsWrite(f, key, val) {
  const s = JSON.stringify(val);
  const chunks = splitUtf8(s);
  const parts = chunks.length;
  if (parts > MAX_PARTS) { const e = new Error('doc-too-large: ' + key); e.code = 'doc-too-large'; throw e; }
  const headRef = f.doc(f.db, COL, docId(key));
  const head = { parts, updatedAt: Date.now(), value: parts === 1 ? s : '' };
  if (parts === 1) { await f.setDoc(headRef, head); loadedStamp.set(key, stampOf(head)); return true; }
  if (parts <= BATCH_MAX_PARTS && f.writeBatch) {
    // الأجزاء والرأس معًا: إما أن تُكتب كلها أو لا يُكتب شيء — لا رأس قديم مع أجزاء جديدة
    const batch = f.writeBatch(f.db);
    chunks.forEach((chunk, i) => batch.set(f.doc(f.db, COL, docId(key) + '__' + i), { chunk }));
    batch.set(headRef, head);
    await batch.commit();
    loadedStamp.set(key, stampOf(head));
    return true;
  }
  for (let i = 0; i < parts; i++) {
    await f.setDoc(f.doc(f.db, COL, docId(key) + '__' + i), { chunk: chunks[i] });
  }
  await f.setDoc(headRef, head);
  loadedStamp.set(key, stampOf(head));
  return true;
}

/* v29.5 — كتابة مشروطة (compare-and-set) داخل معاملة Firestore:
   تُكتب القيمة فقط إن كان رأس المستند ما زال على النسخة التي قرأناها آخر مرة (updatedAt|parts).
   وإلا تُرفض بـ conflict فيعيد المنادي القراءة والتعديل على الأحدث — لا يمحو أحدٌ تعديل غيره. */
async function fsWriteIf(f, key, val, expected) {
  const s = JSON.stringify(val);
  const chunks = splitUtf8(s);
  const parts = chunks.length;
  if (parts > MAX_PARTS) { const e = new Error('doc-too-large: ' + key); e.code = 'doc-too-large'; throw e; }
  const headRef = f.doc(f.db, COL, docId(key));
  const head = { parts, updatedAt: Date.now(), value: parts === 1 ? s : '' };
  await f.runTransaction(f.db, async (tx) => {
    const cur = await tx.get(headRef);
    const curStamp = cur.exists() ? stampOf(cur.data()) : null;
    if ((curStamp || null) !== (expected || null)) { const e = new Error('conflict: ' + key); e.code = 'conflict'; throw e; }
    if (parts > 1) chunks.forEach((chunk, i) => tx.set(f.doc(f.db, COL, docId(key) + '__' + i), { chunk }));
    tx.set(headRef, head);
  });
  loadedStamp.set(key, stampOf(head));
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
        failedReads.delete(key);
        if (v !== undefined) { local.set(key, v); return { ok: true, value: v }; }
        return { ok: true, value: undefined };
      } catch (e) {
        if (e && (e.code === 'permission-denied' || e.code === 'PERMISSION_DENIED')) {
          try { localStorage.removeItem(key); } catch { }   // تنظيف نسخة محلية قديمة على جهاز غير مخوّل
          return { ok: false, denied: true };
        }
        failedReads.add(key);
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
        failedReads.delete(key);
        if (v !== undefined) { local.set(key, v); return v; }
        return def;
      } catch (e) {
        failedReads.add(key);
        cloud.lastError = { key, op: 'get', code: String((e && e.code) || ''), at: Date.now() };
        console.warn('قراءة Firestore فشلت:', e);
      }
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
      // v28.1: لا كتابة فوق مستند فشلت آخر قراءة له — ما في أيدينا قد يكون فارغًا أو قديمًا
      if (failedReads.has(key)) {
        cloud.lastError = { key, op: 'set', code: 'read-failed', at: Date.now() };
        console.warn('رُفضت الكتابة: آخر قراءة لهذا المستند فشلت —', key);
        return false;
      }
      try { await fsWrite(f, key, val); local.set(key, val); return true; }
      catch (e) {
        cloud.lastError = { key, op: 'set', code: String((e && e.code) || ''), at: Date.now() };   // v27.1: يقرؤه App لتمييز رفض الصلاحيات عن انقطاع الشبكة
        console.warn('كتابة Firestore فشلت:', e);
        // v15.18: أي فشل سحابي (صلاحيات أو شبكة أو غيره) = فشل صادق يعود للمنادي.
        // سابقاً كان غير-الصلاحيات يسقط للتخزين المحلي «بنجاح» زائف، فتظهر البيانات
        // للمستخدم لحظياً ثم «تختفي» عند أول مزامنة دورية تجلب نسخة السحابة الخالية منها
        // (أوضح أعراضه: مسودة الكاشير/مدير الفرع تختفي بعد حفظها). الصدق يُظهر رسالة
        // «تعذّر الحفظ — أعد المحاولة» بدل ضياع صامت.
        return false;
      }
    }
    // v15.18: سحابة مضبوطة لكن لا جلسة موثّقة بعد — كتابة محلية وحدها ستضيع حتماً عند
    // أول قراءة سحابية ناجحة؛ نرفض بصدق بدل النجاح الوهمي.
    if (FB_READY) return false;
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
        const d = snap.data(), st = stampOf(d);
        // v29.0: نفس النسخة التي قُرئت للتو — لا تنزيل ولا إعادة رسم. الكتابات المحلية المعلّقة تمرّ كما كانت.
        if (st && !snap.metadata?.hasPendingWrites && loadedStamp.get(key) === st && !failedReads.has(key)) return;
        try {
          const v = await fsAssemble(f, key, d);
          if (st && v !== undefined) loadedStamp.set(key, st);
          failedReads.delete(key);
          if (v !== undefined) { local.set(key, v); cb(v); }
        } catch (e) { failedReads.add(key); console.warn('استماع Firestore:', e); }
      }, (e) => console.warn('انقطع الاستماع اللحظي:', e));
    });
    return () => { dead = true; if (stop) stop(); };
  },

  /** v29.5: كتابة مشروطة — تنجح فقط إن لم يكتب أحد على المستند منذ آخر قراءة له (get/tryGet/subscribe).
   *  تعيد 'ok' أو 'conflict' (عدّل غيرك المستند — أعد القراءة والتعديل) أو 'fail'. بلا Firestore: كتابة عادية. */
  async setIfUnchanged(key, val) {
    const f = await firestore();
    if (!f) return (await this.set(key, val)) ? 'ok' : 'fail';
    if (failedReads.has(key)) { cloud.lastError = { key, op: 'set', code: 'read-failed', at: Date.now() }; return 'fail'; }
    try { await fsWriteIf(f, key, val, loadedStamp.get(key) || null); local.set(key, val); return 'ok'; }
    catch (e) {
      if (e && e.code === 'conflict') return 'conflict';
      cloud.lastError = { key, op: 'set', code: String((e && e.code) || ''), at: Date.now() };
      console.warn('كتابة Firestore المشروطة فشلت:', e);
      return 'fail';
    }
  },

  /** v28.1: هل فشلت آخر قراءة سحابية لهذا المفتاح؟ (الكتابة عليه مرفوضة حتى تنجح قراءة) */
  readFailed(key) { return failedReads.has(key); },

  lastError: null,   // v27.1: آخر خطأ سحابي {key, op, code, at}
  get mode() { return FB_READY ? 'firestore' : (useApi ? 'server' : 'local'); },
  get live() { return FB_READY; }
};

// v29.6: تحميل مكتبة قاعدة البيانات في الخلفية أثناء شاشة الدخول (وقت الخمول) — فلا ينتظرها المستخدم بعد إدخال كلمة السر
if (FB_READY && typeof window !== 'undefined') {
  const warm = () => { import('firebase/firestore').catch(() => { }); };
  if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 4000 }); else setTimeout(warm, 2500);
}

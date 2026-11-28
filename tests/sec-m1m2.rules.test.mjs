/**
 * v56.62 — إغلاق الحدّين المعلنين م-1 وم-2 في دستور الأمان (tests/security/CONSTITUTION.md) على محاكي Firestore:
 *  • م-1: مدير المنصة لا يُضعف سياسة الخطوتين القائمة، ولا يعدّل قائمة المدراء، ولا يكتب العضويات دون جلسة بخطوتين
 *         متى وُجدت سياسة غير فارغة (تُلزم المدراء أو أي دور) — v56.63 قرار المجلس الخيار أ.
 *         بلا سياسة (أو بسياسة فارغة) يبقى كل شيء كما كان، وتمهيد أول مالك لمنشأة جديدة يعمل.
 *  • م-2: السجلات المحمية fin_docs (فواتير الموردين والمبيعات والسندات) يكتبها من يكتب مصدرها rms8_core فقط:
 *         المركزي غير «العرض فقط» أو المدير. الكاشير ومدير الفرع والإقليمي مرفوضون إنشاءً وسدادًا وحذفًا.
 * كل البيانات وهمية.
 */
import { test, before, after } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, serverTimestamp, Timestamp, arrayUnion } from 'firebase/firestore';

const RULES = fs.readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8');
const PID = process.env.RULES_FILE ? 'm1m2-tenant-test' : 'm1m2-test';
let env, envNew;
const U = { owner: 'owner@test.com', fin: 'fin@test.com', gm: 'gm@test.com', ho: 'ho@test.com', acct: 'acct@test.com', ctl: 'ctl@test.com',
  view: 'view@test.com', cash: 'cash@test.com', bm: 'bm@test.com', reg: 'reg@test.com', evil: 'evil@test.com' };
const as = (k) => env.authenticatedContext('u-' + k, { email: U[k] }).firestore();
const as2fa = (k) => env.authenticatedContext('u-' + k, { email: U[k], firebase: { sign_in_provider: 'password', sign_in_second_factor: 'totp' } }).firestore();
const seed = (col, id, x) => env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), col, id), x));
const unseed = (col, id) => env.withSecurityRulesDisabled(async (ctx) => deleteDoc(doc(ctx.firestore(), col, id)));
const policy = (x) => seed('platform', 'security', { roles: [], admins: false, at: 1, ...x });
const ADMINS0 = { emails: [U.owner] };
const resetAdmins = () => seed('platform', 'admins', ADMINS0);
let n = 0; const id = (p) => p + '_' + (++n);
const HEX = 'a'.repeat(64);
// شكل ما يكتبه fdMirror في App.jsx حرفيًا: { ...fdRecord, by, at, cv } للإنشاء و{ prog, paid, updBy, updAt, cv } للسداد
const fd = (kind, k, x = {}) => ({ kind, date: '2026-11-10', digest: HEX, data: '{"amount":100}', prog: '{}', paid: 0, by: U[k], at: serverTimestamp(), cv: 560000, ...x });
const pay = (k, paid) => ({ prog: '{"paidAmount":' + paid + '}', paid, updBy: U[k], updAt: serverTimestamp(), cv: 560000 });
const seedFd = (kind, x = {}) => { const i = kind + '_' + id('s'); return seed('fin_docs', i, { ...fd(kind, 'acct', x), at: Timestamp.now() }).then(() => i); };

before(async () => {
  env = await initializeTestEnvironment({ projectId: PID, firestore: { rules: RULES } });
  envNew = await initializeTestEnvironment({ projectId: PID + '-new', firestore: { rules: RULES } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'platform', 'admins'), ADMINS0);
    const m = (k, x) => setDoc(doc(d, 'members', U[k]), { email: U[k], active: true, ...x });
    await m('owner', {});
    await m('fin', { scope: 'all', role: 'finance_department' });
    await m('gm', { scope: 'all', role: 'general_management' });
    await m('ho', { scope: 'all', role: 'head_office' });
    await m('acct', { scope: 'all', role: 'accountant' });
    await m('ctl', { scope: 'all', role: 'cost_controller' });
    await m('view', { scope: 'all', role: 'accountant_view' });
    await m('cash', { scope: 'branch', branchId: 'A', branchIds: [], role: 'cashier' });
    await m('bm', { scope: 'branch', branchId: 'A', branchIds: [], role: 'branch_manager' });
    await m('reg', { scope: 'branch', branchId: '', branchIds: ['A'], role: 'regional_manager' });
    await setDoc(doc(d, 'fin_periods', 'locks'), { lockedTo: '2026-10-31', by: U.owner, at: Timestamp.now() });
  });
});
after(async () => { if (env) await env.cleanup(); if (envNew) await envNew.cleanup(); });

/* ===================== م-1: مدير المنصة والخطوتان ===================== */
test('م-1/أ منشأة بلا سياسة: المدير بلا خطوة ثانية يعمل كما كان (قائمة المدراء، العضويات، أول تفعيل للسياسة)', async () => {
  await unseed('platform', 'security');
  try {
    await assertSucceeds(updateDoc(doc(as('owner'), 'platform', 'admins'), { emails: arrayUnion(U.gm) }), 'إضافة مدير');
    await assertSucceeds(setDoc(doc(as('owner'), 'members', 'new1@test.com'), { email: 'new1@test.com', active: true, role: 'cashier', scope: 'branch', branchId: 'A', at: 1 }, { merge: true }), 'عضوية جديدة');
    await assertSucceeds(setDoc(doc(as('owner'), 'members', U.cash), { role: 'branch_manager', at: 2 }, { merge: true }), 'تغيير دور');
    await assertSucceeds(setDoc(doc(as('owner'), 'members', U.cash), { role: 'cashier', at: 3 }, { merge: true }));
    await assertSucceeds(setDoc(doc(as('owner'), 'platform', 'security'), { roles: ['finance_department'], admins: false, at: 1 }), 'أول تفعيل لا يشمله ⇒ كما كان');
  } finally { await unseed('platform', 'security'); await resetAdmins(); }
});

test('م-1/ب سياسة فارغة {admins:false, roles:[]} = لا سياسة: التعديل بلا خطوة ثانية كما كان', async () => {
  await policy({});
  try {
    await assertSucceeds(setDoc(doc(as('owner'), 'platform', 'security'), { roles: [], admins: false, at: 2 }));
    await assertSucceeds(setDoc(doc(as('owner'), 'members', U.cash), { at: 4 }, { merge: true }));
    await assertSucceeds(updateDoc(doc(as('owner'), 'platform', 'admins'), { emails: arrayUnion(U.gm) }));
  } finally { await unseed('platform', 'security'); await resetAdmins(); }
});

test('م-1/ج PoC: سياسة تُلزم المدراء ⇒ كلمة سر مسروقة بلا خطوة ثانية لا تُطفئ السياسة ولا تضيف مديرًا ولا تغيّر دورًا', async () => {
  await policy({ admins: true, roles: ['finance_department'] });
  try {
    const o = as('owner');
    await assertFails(setDoc(doc(o, 'platform', 'security'), { roles: [], admins: false, at: 9 }), 'إطفاء السياسة');
    await assertFails(setDoc(doc(o, 'platform', 'security'), { roles: ['finance_department'], admins: false, at: 9 }), 'إعفاء المدراء');
    await assertFails(deleteDoc(doc(o, 'platform', 'security')), 'حذف السياسة');
    await assertFails(updateDoc(doc(o, 'platform', 'admins'), { emails: arrayUnion(U.evil) }), 'إضافة بريد مدير');
    await assertFails(deleteDoc(doc(o, 'platform', 'admins')), 'حذف قائمة المدراء');
    await assertFails(setDoc(doc(o, 'members', U.evil), { email: U.evil, active: true, role: 'system_admin', scope: 'all', at: 1 }), 'عضوية جديدة');
    await assertFails(setDoc(doc(o, 'members', U.cash), { role: 'finance_department', scope: 'all' }, { merge: true }), 'رفع دور الكاشير');
    await assertFails(setDoc(doc(o, 'members', U.fin), { active: false }, { merge: true }), 'إيقاف عضو');
    await assertFails(deleteDoc(doc(o, 'members', U.bm)), 'حذف عضوية');
  } finally { await unseed('platform', 'security'); await resetAdmins(); }
});

test('م-1/د المدير بجلسة بخطوتين يفعل كل شيء: العضويات وقائمة المدراء وتعديل السياسة وإضعافها وحذفها', async () => {
  await policy({ admins: true, roles: ['finance_department'] });
  try {
    const o = as2fa('owner');
    await assertSucceeds(setDoc(doc(o, 'members', 'new2@test.com'), { email: 'new2@test.com', active: true, role: 'cashier', scope: 'branch', branchId: 'A', at: 1 }));
    await assertSucceeds(setDoc(doc(o, 'members', U.cash), { role: 'cashier', at: 5 }, { merge: true }));
    await assertSucceeds(updateDoc(doc(o, 'platform', 'admins'), { emails: arrayUnion(U.gm) }));
    await assertSucceeds(setDoc(doc(o, 'platform', 'security'), { roles: ['finance_department', 'accountant'], admins: true, at: 3 }), 'تشديد');
    await assertSucceeds(setDoc(doc(o, 'platform', 'security'), { roles: [], admins: false, at: 4 }), 'إطفاء بقرار موثّق');
    await policy({ admins: true });
    await assertSucceeds(deleteDoc(doc(o, 'platform', 'security')), 'حذف');
  } finally { await unseed('platform', 'security'); await resetAdmins(); }
});

test('م-1/هـ سياسة لدور فقط (المدراء غير مُلزمين): تعديلها أو إطفاؤها يتطلب الخطوة الثانية', async () => {
  await policy({ admins: false, roles: ['finance_department'] });
  try {
    await assertFails(setDoc(doc(as('owner'), 'platform', 'security'), { roles: [], admins: false, at: 5 }), 'إطفاء سياسة دور بلا خطوة ثانية');
    await assertFails(setDoc(doc(as('owner'), 'platform', 'security'), { roles: ['finance_department', 'cashier'], admins: false, at: 5 }), 'حتى التشديد بلا خطوة ثانية');
    await assertSucceeds(setDoc(doc(as2fa('owner'), 'platform', 'security'), { roles: [], admins: false, at: 6 }), 'بالخطوة الثانية');
  } finally { await unseed('platform', 'security'); await resetAdmins(); }
});

test('م-1/هـ2 v56.63 (قرار المجلس الخيار أ) PoC: سياسة لدور فقط ⇒ المدير بلا خطوة ثانية لا يضيف مديرًا ولا يكتب عضوية', async () => {
  await policy({ admins: false, roles: ['finance_department'] });
  try {
    const o = as('owner');
    await assertFails(updateDoc(doc(o, 'platform', 'admins'), { emails: arrayUnion(U.evil) }), 'إضافة بريد مدير');
    await assertFails(deleteDoc(doc(o, 'platform', 'admins')), 'حذف قائمة المدراء');
    await assertFails(setDoc(doc(o, 'members', U.evil), { email: U.evil, active: true, role: 'system_admin', scope: 'all', at: 1 }), 'عضوية جديدة');
    await assertFails(setDoc(doc(o, 'members', U.cash), { role: 'finance_department', scope: 'all' }, { merge: true }), 'تغيير دور');
    await assertFails(setDoc(doc(o, 'members', U.cash), { at: 6 }, { merge: true }), 'حتى لمسة بلا تغيير دور (مزامنة الواجهة)');
    await assertFails(deleteDoc(doc(o, 'members', U.bm)), 'حذف عضوية');
    // المدير غير المشمول ما زال يقرأ ويعمل بلا خطوة ثانية خارج إدارة الوصول
    await assertSucceeds(getDoc(doc(o, 'members', U.cash)), 'يقرأ العضويات');
    await assertSucceeds(getDoc(doc(o, 'platform', 'admins')), 'يقرأ قائمة المدراء');
    const o2 = as2fa('owner');
    await assertSucceeds(updateDoc(doc(o2, 'platform', 'admins'), { emails: arrayUnion(U.gm) }), 'بخطوتين: إضافة مدير');
    await assertSucceeds(setDoc(doc(o2, 'members', 'new3@test.com'), { email: 'new3@test.com', active: true, role: 'cashier', scope: 'branch', branchId: 'A', at: 1 }), 'بخطوتين: عضوية جديدة');
    await assertSucceeds(setDoc(doc(o2, 'members', U.cash), { role: 'cashier', at: 7 }, { merge: true }), 'بخطوتين: تغيير دور');
  } finally { await unseed('platform', 'security'); await resetAdmins(); }
});

test('م-1/و غير المدير لا يكتب السياسة ولا قائمة المدراء ولا العضويات — حتى بخطوتين', async () => {
  await policy({ admins: true });
  try {
    for (const k of ['fin', 'gm', 'cash']) {
      await assertFails(setDoc(doc(as2fa(k), 'platform', 'security'), { roles: [], admins: false, at: 7 }), k + ' السياسة');
      await assertFails(updateDoc(doc(as2fa(k), 'platform', 'admins'), { emails: arrayUnion(U[k]) }), k + ' قائمة المدراء');
      await assertFails(setDoc(doc(as2fa(k), 'members', U[k]), { role: 'system_admin', scope: 'all' }, { merge: true }), k + ' عضويته');
    }
    await assertSucceeds(getDoc(doc(as('cash'), 'members', U.cash)), 'يقرأ عضويته');
  } finally { await unseed('platform', 'security'); await resetAdmins(); }
});

test('م-1/ز تمهيد منشأة جديدة: أول داخل ينشئ قائمة المدراء باسمه ثم عضويته (مسار storage.js bootstrap) — والثاني لا', async () => {
  const first = envNew.authenticatedContext('u-first', { email: 'first@test.com' }).firestore();
  const second = envNew.authenticatedContext('u-second', { email: 'second@test.com' }).firestore();
  await assertSucceeds(getDoc(doc(first, 'platform', 'admins')), 'قراءة القائمة الغائبة');
  await assertFails(setDoc(doc(first, 'platform', 'admins'), { emails: ['first@test.com', 'second@test.com'], at: 1 }), 'لا ينشئها باسم غيره');
  await assertSucceeds(setDoc(doc(first, 'platform', 'admins'), { emails: ['first@test.com'], at: 1 }));
  await assertSucceeds(setDoc(doc(first, 'members', 'first@test.com'), { email: 'first@test.com', active: true, at: 1 }, { merge: true }));
  await assertFails(setDoc(doc(first, 'platform', 'security'), { roles: [], admins: true, at: 1 }), 'تفعيلها على نفسه بلا خطوة ثانية مرفوض كما كان (منع قفل النفس)');
  await assertSucceeds(setDoc(doc(first, 'platform', 'security'), { roles: ['cashier'], admins: false, at: 1 }), 'أول سياسة لا تشمله تمر كما كانت');
  await assertFails(setDoc(doc(second, 'platform', 'admins'), { emails: ['second@test.com'], at: 2 }), 'الثاني لا يستولي');
  await assertFails(setDoc(doc(second, 'members', 'second@test.com'), { email: 'second@test.com', active: true, at: 1 }, { merge: true }), 'ولا يكتب عضويته');
});

/* ===================== م-2: fin_docs ===================== */
test('م-2/أ PoC: الكاشير ومدير الفرع والإقليمي والعرض فقط لا ينشئون فاتورة مورد ولا مبيعات ولا سندًا', async () => {
  for (const k of ['cash', 'bm', 'reg', 'view']) for (const kind of ['pi', 'si', 'cv']) {
    await assertFails(setDoc(doc(as(k), 'fin_docs', kind + '_' + id('x')), fd(kind, k)), k + ' ينشئ ' + kind);
  }
  await assertFails(setDoc(doc(as2fa('bm'), 'fin_docs', 'pi_' + id('x')), fd('pi', 'bm')), 'ولا بخطوتين');
});

test('م-2/ب PoC: عضو الفرع لا يسجّل سدادًا (paid/prog) ولا يحذف فاتورة مورد غير مسددة', async () => {
  const pi = await seedFd('pi'), si = await seedFd('si');
  for (const k of ['cash', 'bm', 'reg', 'view']) {
    await assertFails(updateDoc(doc(as(k), 'fin_docs', pi), pay(k, 100)), k + ' يعلّم مسددة');
    await assertFails(updateDoc(doc(as(k), 'fin_docs', si), { prog: '{"receipts":[{"amount":5}]}', paid: 5, updBy: U[k], updAt: serverTimestamp(), cv: 560000 }), k + ' تحصيل');
    await assertFails(deleteDoc(doc(as(k), 'fin_docs', pi)), k + ' يحذف');
  }
  await assertSucceeds(getDoc(doc(as('acct'), 'fin_docs', pi)), 'باقية');
});

test('م-2/ج المسارات المشروعة: كل دور مركزي يكتب rms8_core (مالية/إدارة/مكتب/محاسب/مراقب تكاليف) والمدير ينشئ ويسدّد ويحذف', async () => {
  for (const k of ['owner', 'fin', 'gm', 'ho', 'acct', 'ctl']) {
    for (const kind of ['pi', 'si', 'cv']) await assertSucceeds(setDoc(doc(as(k), 'fin_docs', kind + '_' + id(k)), fd(kind, k)), k + ' ينشئ ' + kind);
    const pi = await seedFd('pi');
    await assertSucceeds(updateDoc(doc(as(k), 'fin_docs', pi), pay(k, 40)), k + ' سداد جزئي');
    const p2 = await seedFd('pi');
    await assertSucceeds(deleteDoc(doc(as(k), 'fin_docs', p2)), k + ' يحذف غير المسددة');
  }
  // الثوابت القائمة لا تتغير: السند لا يُعدَّل، فاتورة المبيعات لا تُحذف، المسددة لا تُحذف
  const cv = await seedFd('cv'), si = await seedFd('si'), paid = await seedFd('pi', { paid: 10 });
  await assertFails(updateDoc(doc(as('acct'), 'fin_docs', cv), pay('acct', 1)), 'السند لا يُعدَّل');
  await assertFails(deleteDoc(doc(as('owner'), 'fin_docs', si)), 'المبيعات لا تُحذف');
  await assertFails(deleteDoc(doc(as('owner'), 'fin_docs', paid)), 'المسددة لا تُحذف');
});

test('م-2/د سياسة الخطوتين على المحاسب تبقى نافذة على الكتابة المشروعة', async () => {
  await policy({ roles: ['accountant'] });
  try {
    await assertFails(setDoc(doc(as('acct'), 'fin_docs', 'pi_' + id('t')), fd('pi', 'acct')), 'بلا خطوة ثانية');
    await assertSucceeds(setDoc(doc(as2fa('acct'), 'fin_docs', 'pi_' + id('t')), fd('pi', 'acct')), 'بالخطوة الثانية');
    await assertSucceeds(setDoc(doc(as('fin'), 'fin_docs', 'pi_' + id('t')), fd('pi', 'fin')), 'دور غير مشمول كما كان');
  } finally { await unseed('platform', 'security'); }
});

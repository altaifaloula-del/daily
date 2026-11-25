/**
 * v56.0 — اختبارات القواعد على محاكي Firestore لإصلاحات P0:
 *  • GAP-003: إقفال الفترات يُفرض على الخادم للإغلاقات (fin_periods/locks.lockedTo) — حتى على المدير.
 *  • GAP-002: إغلاق واحد غير مرفوض لكل فرع ويوم (closing_keys) في دفعة ذرية — إلزامي متى minCv ≥ 560000.
 *  • عزل المنشأة/الفرع ومحاولات التعديل المباشر عبر API دون الواجهة.
 */
import { test, before, after } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';

let env;
const U = { owner: 'owner@test.com', fin: 'fin@test.com', gm: 'gm@test.com', acct: 'acct@test.com', view: 'view@test.com',
  cash: 'cash@test.com', bm: 'bm@test.com', bmB: 'bmb@test.com', hr: 'hr@test.com' };
const ROLE = { owner: '', fin: 'finance_department', gm: 'general_management', acct: 'accountant', view: 'accountant_view', cash: 'cashier', bm: 'branch_manager', bmB: 'branch_manager', hr: 'hr_manager' };
const as = (k) => env.authenticatedContext('u-' + k, { email: U[k] }).firestore();
const HEX = 'a'.repeat(64), HEX2 = 'b'.repeat(64);
let CV = 400000;
const cl = (k, x = {}) => ({ branchId: 'A', date: '2026-11-14', status: 'submitted', gm: 'pending', digest: HEX, data: '{}', by: U[k], at: serverTimestamp(), cv: CV, ...x });
const seed = (col, id, x) => env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), col, id), x));
const seedCl = (id, x) => seed('closings', id, { ...cl('bm', x), at: Timestamp.now() });
const sig = (k, x) => ({ digest: HEX, email: U[k], role: ROLE[k], at: serverTimestamp(), cv: CV, branchId: 'A', ...x });
let n = 0; const id = (p) => p + '_' + (++n);
const key = (b, d, cid, k) => ({ branchId: b, date: d, id: cid, by: U[k], at: serverTimestamp() });
/** إغلاق + مفتاحه في دفعة واحدة (بروتوكول v56) */
function clBatch(k, cid, x = {}) {
  const d = as(k), r = cl(k, x), b = writeBatch(d);
  b.set(doc(d, 'closings', cid), r);
  b.set(doc(d, 'closing_keys', r.branchId + '~' + r.date), key(r.branchId, r.date, cid, k));
  return b.commit();
}

before(async () => {
  env = await initializeTestEnvironment({ projectId: process.env.RULES_FILE ? 'v56-tenant-test' : 'v56-test', firestore: { rules: fs.readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'platform', 'admins'), { emails: [U.owner] });
    const m = (k, x) => setDoc(doc(d, 'members', U[k]), { email: U[k], active: true, ...x });
    await m('owner', {});
    await m('fin', { scope: 'all', role: 'finance_department' });
    await m('gm', { scope: 'all', role: 'general_management' });
    await m('acct', { scope: 'all', role: 'accountant' });
    await m('view', { scope: 'all', role: 'accountant_view' });
    await m('cash', { scope: 'branch', branchId: 'A', branchIds: [], role: 'cashier' });
    await m('bm', { scope: 'branch', branchId: 'A', branchIds: [], role: 'branch_manager' });
    await m('bmB', { scope: 'branch', branchId: 'B', branchIds: [], role: 'branch_manager' });
    await m('hr', { scope: 'branch', branchId: 'A', branchIds: [], role: 'hr_manager' });
    await setDoc(doc(d, 'platform', 'release'), { minCv: 400000, cutover: '2026-01-01', at: 1, by: U.owner });
    await setDoc(doc(d, 'fin_periods', 'locks'), { lockedTo: '2026-10-31', by: U.owner, at: Timestamp.now() });
  });
});
after(async () => { if (env) await env.cleanup(); });

/* ===================== GAP-003: إقفال الفترات على الخادم ===================== */
test('v56-L1 لا إغلاق جديد بتاريخ في فترة مقفلة — من الفرع أو المدير', async () => {
  await assertFails(setDoc(doc(as('bm'), 'closings', id('L')), cl('bm', { date: '2026-10-15' })), 'الفرع في أكتوبر المقفل');
  await assertFails(setDoc(doc(as('bm'), 'closings', id('L')), cl('bm', { date: '2026-10-15', status: 'draft' })), 'ولا مسودة');
  await assertFails(setDoc(doc(as('owner'), 'closings', id('L')), cl('owner', { date: '2026-10-31' })), 'ولا المدير (آخر يوم مقفل)');
  await assertSucceeds(setDoc(doc(as('bm'), 'closings', id('L')), cl('bm', { date: '2026-11-01' })), 'أول يوم مفتوح');
});

test('v56-L2 إغلاق محتسب في فترة مقفلة: لا تغيير أرقام ولا نقل تاريخ ولا رفض — وما لا يمس الدفتر يمر', async () => {
  const c = id('L'); await seedCl(c, { date: '2026-10-10', status: 'approved', gm: 'pending' });
  await assertFails(setDoc(doc(as('owner'), 'closings', c), cl('owner', { date: '2026-10-10', status: 'approved', digest: HEX2 })), 'المدير يغيّر الأرقام');
  await assertFails(setDoc(doc(as('owner'), 'closings', c), cl('owner', { date: '2026-11-10', status: 'approved' })), 'نقله لفترة مفتوحة');
  await assertFails(setDoc(doc(as('owner'), 'closings', c), cl('owner', { date: '2026-10-10', status: 'draft' })), 'إعادته مسودة (يخرجه من الدفتر)');
  await assertFails(deleteDoc(doc(as('owner'), 'closings', c)), 'حذفه حتى من المدير');
  await assertSucceeds(setDoc(doc(as('fin'), 'closings', c), cl('fin', { date: '2026-10-10', status: 'approved', data: '{"transferStatus":"received"}' })), 'الخزينة: حالة التوريد بلا تغيير البصمة');
  const g = id('s'); await setDoc(doc(as('gm'), 'signoffs', g), sig('gm', { kind: 'closing', stage: 'gm', entityId: c }));
  await assertSucceeds(setDoc(doc(as('gm'), 'closings', c), cl('gm', { date: '2026-10-10', status: 'approved', gm: 'approved', sigRef: g })), 'الاعتماد النهائي لا يغيّر الدفتر');
});

test('v56-L3 رفض مرحّل في فترة مقفلة يُخرجه من الدفتر — مرفوض، ومسودة الفترة المقفلة تُحذف', async () => {
  const c = id('L'); await seedCl(c, { date: '2026-10-11', status: 'submitted' });
  const r = id('s'); await setDoc(doc(as('fin'), 'signoffs', r), sig('fin', { kind: 'closing', stage: 'reject', entityId: c }));
  await assertFails(setDoc(doc(as('fin'), 'closings', c), cl('fin', { date: '2026-10-11', status: 'rejected', sigRef: r })), 'رفض موقّع في فترة مقفلة');
  const d0 = id('L'); await seedCl(d0, { date: '2026-10-12', status: 'draft' });
  await assertSucceeds(deleteDoc(doc(as('bm'), 'closings', d0)), 'مسودة غير محتسبة تُحذف');
});

test('v56-L4 فتح الفترة يحتاج سببًا مكتوبًا، والقفل يكتبه المدير وحده', async () => {
  await assertFails(setDoc(doc(as('fin'), 'fin_periods', 'locks'), { lockedTo: '2026-11-30', by: U.fin, at: serverTimestamp() }), 'المالية تقفل');
  await assertFails(setDoc(doc(as('gm'), 'fin_periods', 'locks'), { lockedTo: '2026-09-30', by: U.gm, at: serverTimestamp(), reason: 'تصحيح' }), 'الإدارة تفتح');
  await assertFails(setDoc(doc(as('owner'), 'fin_periods', 'locks'), { lockedTo: '2026-09-30', by: U.owner, at: serverTimestamp() }), 'المدير يفتح بلا سبب');
  await assertFails(deleteDoc(doc(as('owner'), 'fin_periods', 'locks')), 'حذف القفل');
  await assertSucceeds(setDoc(doc(as('owner'), 'fin_periods', 'locks'), { lockedTo: '2026-10-31', by: U.owner, at: serverTimestamp() }), 'المدير يثبّت القفل');
});

test('v56-L5 القيد اليدوي والفاتورة: لا إنشاء في فترة مقفلة ولا اعتماد فيها', async () => {
  const fj = (k, x = {}) => ({ date: '2026-10-05', status: 'pending', digest: HEX, data: '{}', by: U[k], at: serverTimestamp(), cv: CV, ...x });
  await assertFails(setDoc(doc(as('acct'), 'fin_journal', id('j')), fj('acct')), 'قيد بتاريخ مقفل');
  await assertFails(setDoc(doc(as('owner'), 'fin_journal', id('j')), fj('owner', { status: 'posted' })), 'ولا من المدير');
  const j = id('j'); await assertSucceeds(setDoc(doc(as('acct'), 'fin_journal', j), fj('acct', { date: '2026-11-05' })), 'قيد بفترة مفتوحة');
  const fd = (k, x = {}) => ({ kind: 'pi', date: '2026-10-05', digest: HEX, data: '{}', prog: '{}', paid: 0, by: U[k], at: serverTimestamp(), cv: CV, ...x });
  await assertFails(setDoc(doc(as('acct'), 'fin_docs', 'pi_' + id('d')), fd('acct')), 'فاتورة مورد بتاريخ مقفل');
});

/* ===================== التعديل المباشر عبر API (دون الواجهة) ===================== */
test('v56-A1 القيد المعتمد لا يُعدَّل ولا يُحذف مباشرة عبر API — حتى من المدير', async () => {
  const j = id('j'); await seed('fin_journal', j, { date: '2026-11-06', status: 'posted', digest: HEX, data: '{"lines":[]}', by: U.acct, at: Timestamp.now(), cv: CV, decidedBy: U.fin, decidedAt: Timestamp.now() });
  await assertFails(updateDoc(doc(as('owner'), 'fin_journal', j), { data: '{"lines":[1]}' }), 'تعديل محتوى المرحّل');
  await assertFails(updateDoc(doc(as('owner'), 'fin_journal', j), { status: 'pending' }), 'إعادته معلّقًا');
  await assertFails(deleteDoc(doc(as('owner'), 'fin_journal', j)), 'حذف المرحّل');
  await assertFails(deleteDoc(doc(as('fin'), 'fin_journal', j)), 'ولا المعتمِد يحذفه');
});

test('v56-A2 فاتورة المبيعات المرحّلة لا تُحذف، وفاتورة المورد المسددة لا تُحذف، والسند لا يُعدَّل', async () => {
  const si = 'si_' + id('d'); await seed('fin_docs', si, { kind: 'si', date: '2026-11-06', digest: HEX, data: '{}', prog: '{}', paid: 0, by: U.acct, at: Timestamp.now(), cv: CV });
  await assertFails(deleteDoc(doc(as('owner'), 'fin_docs', si)), 'حذف فاتورة مبيعات');
  const pi = 'pi_' + id('d'); await seed('fin_docs', pi, { kind: 'pi', date: '2026-11-06', digest: HEX, data: '{}', prog: '{}', paid: 50, by: U.acct, at: Timestamp.now(), cv: CV });
  await assertFails(deleteDoc(doc(as('acct'), 'fin_docs', pi)), 'حذف فاتورة مورد مسددة جزئيًا');
  const cv = 'cv_' + id('d'); await seed('fin_docs', cv, { kind: 'cv', date: '2026-11-06', digest: HEX, data: '{}', prog: '{}', paid: 0, by: U.acct, at: Timestamp.now(), cv: CV });
  await assertFails(setDoc(doc(as('acct'), 'fin_docs', cv), { kind: 'cv', date: '2026-11-06', digest: HEX, data: '{}', prog: '{"x":1}', paid: 0, by: U.acct, at: Timestamp.now(), cv: CV, updBy: U.acct, updAt: serverTimestamp() }), 'تعديل سند');
  await assertFails(updateDoc(doc(as('acct'), 'fin_docs', pi), { data: '{"amount":1}' }), 'تعديل محتوى فاتورة');
});

test('v56-A3 عزل المنشأة/الفرع: لا قراءة ولا كتابة لبيانات فرع آخر ولا للبيانات المركزية من الفرع', async () => {
  const c = id('L'); await seedCl(c, { date: '2026-11-07' });
  await assertFails(getDoc(doc(as('bmB'), 'closings', c)), 'فرع B يقرأ إغلاق A');
  await assertFails(setDoc(doc(as('bmB'), 'closings', id('L')), cl('bmB', { date: '2026-11-07' })), 'فرع B يكتب إغلاقًا لـ A');
  await assertFails(getDoc(doc(as('bm'), 'platform', 'rms8_core')), 'الفرع يقرأ المستند المركزي (الرواتب/البنوك)');
  await assertFails(getDoc(doc(as('bm'), 'platform', 'rms8_org')), 'الفرع يقرأ إعدادات المنشأة');
  await assertFails(getDoc(doc(as('bm'), 'platform', 'rms8_br_B')), 'الفرع يقرأ مستند فرع آخر');
  await assertFails(getDoc(doc(as('hr'), 'fin_journal', 'x')), 'دور فرعي يقرأ القيود');
  await assertFails(getDoc(doc(as('bm'), 'fin_docs', 'pi_x')), 'الفرع يقرأ فواتير الموردين');
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, 'platform', 'rms8_core')), 'زائر غير مسجّل');
  const stranger = env.authenticatedContext('u-x', { email: 'stranger@other.com' }).firestore();
  await assertFails(getDoc(doc(stranger, 'platform', 'rms8_core')), 'حساب من منشأة أخرى (بلا عضوية هنا)');
  await assertFails(getDoc(doc(stranger, 'closings', c)), 'ولا يقرأ الإغلاقات');
  await assertFails(setDoc(doc(stranger, 'members', 'stranger@other.com'), { email: 'stranger@other.com', active: true, scope: 'all', role: 'system_admin' }), 'ولا يمنح نفسه عضوية');
});

test('v56-A4 إقفال الفترة دون صلاحية: الأدوار المحاسبية والفرعية لا تكتب القفل ولا إعدادات المنشأة', async () => {
  for (const k of ['acct', 'fin', 'gm', 'bm', 'view']) {
    await assertFails(setDoc(doc(as(k), 'fin_periods', 'locks'), { lockedTo: '2026-12-31', by: U[k], at: serverTimestamp() }), k + ' يكتب القفل');
    await assertFails(setDoc(doc(as(k), 'platform', 'rms8_org'), { value: '{}', parts: 1, updatedAt: 1, cv: CV }), k + ' يكتب إعدادات المنشأة (periodLocks)');
  }
});

/* ===================== GAP-002: تفرد الإغلاق لكل فرع ويوم ===================== */
test('v56-K1 قبل رفع الحد الأدنى (أجهزة قديمة): الكتابة المنفردة تبقى تعمل', async () => {
  await assertSucceeds(setDoc(doc(as('bm'), 'closings', id('K')), cl('bm', { date: '2026-11-20' })), 'إغلاق بلا مفتاح');
});

test('v56-K2 بعد رفع الحد الأدنى إلى v56: إغلاق ثانٍ للفرع واليوم نفسه مرفوض على الخادم', async () => {
  await seed('platform', 'release', { minCv: 560000, cutover: '2026-01-01', at: 1, by: U.owner }); CV = 560000;
  const a = id('K'), b = id('K');
  await assertFails(setDoc(doc(as('bm'), 'closings', a), cl('bm', { date: '2026-11-21' })), 'إنشاء بلا مفتاح');
  await assertSucceeds(clBatch('bm', a, { date: '2026-11-21' }), 'الأول: السجل + المفتاح في دفعة');
  await assertFails(clBatch('cash', b, { date: '2026-11-21' }), 'الثاني لليوم نفسه (جهاز آخر)');
  await assertFails(clBatch('bm', b, { date: '2026-11-21', status: 'draft' }), 'ولا مسودة ثانية');
  await assertSucceeds(setDoc(doc(as('bm'), 'closings', a), cl('bm', { date: '2026-11-21', data: '{"n":1}' })), 'تعديل الأول داخل خانته بلا مفتاح');
  await assertSucceeds(clBatch('bm', b, { date: '2026-11-22' }), 'يوم آخر');
  let k = null; await env.withSecurityRulesDisabled(async (ctx) => { k = (await getDoc(doc(ctx.firestore(), 'closing_keys', 'A~2026-11-21'))).data(); });
  if (!k || k.id !== a) throw new Error('المفتاح نُقل للإغلاق الثاني: ' + k.id);
});

test('v56-K3 بعد رفض الإغلاق القائم يُسمح بإعادة إغلاق اليوم', async () => {
  const a = id('K'), b = id('K');
  await assertSucceeds(clBatch('bm', a, { date: '2026-11-23' }));
  const r = id('s'); await setDoc(doc(as('fin'), 'signoffs', r), sig('fin', { kind: 'closing', stage: 'reject', entityId: a }));
  await assertFails(clBatch('cash', b, { date: '2026-11-23' }), 'قبل الرفض');
  await assertSucceeds(setDoc(doc(as('fin'), 'closings', a), cl('fin', { date: '2026-11-23', status: 'rejected', sigRef: r })), 'رفض موقّع');
  await assertSucceeds(clBatch('cash', b, { date: '2026-11-23' }), 'بعد الرفض: إغلاق جديد لليوم');
  await assertFails(setDoc(doc(as('bm'), 'closings', a), cl('bm', { date: '2026-11-23', status: 'draft' })), 'المرفوض لا يعود مسودة والخانة مشغولة');
});

test('v56-K4 المفتاح لا يُزوَّر: بلا إغلاق، أو لإغلاق فرع آخر، أو لتاريخ مختلف، أو باسم غيره', async () => {
  const d = as('bm');
  await assertFails(setDoc(doc(d, 'closing_keys', 'A~2026-11-25'), key('A', '2026-11-25', 'ghost', 'bm')), 'مفتاح لإغلاق غير موجود');
  const c = id('K'); await assertSucceeds(clBatch('bm', c, { date: '2026-11-26' }));
  await assertFails(setDoc(doc(d, 'closing_keys', 'A~2026-11-27'), key('A', '2026-11-27', c, 'bm')), 'مفتاح يوم آخر لإغلاق موجود');
  await assertFails(setDoc(doc(as('bmB'), 'closing_keys', 'B~2026-11-26'), key('B', '2026-11-26', c, 'bmB')), 'فرع آخر');
  await assertFails(setDoc(doc(d, 'closing_keys', 'A~2026-11-26'), key('A', '2026-11-26', c, 'cash')), 'باسم غيره');
  await assertFails(deleteDoc(doc(d, 'closing_keys', 'A~2026-11-26')), 'حذف مفتاح خانة مشغولة');
  await assertFails(getDoc(doc(as('bmB'), 'closing_keys', 'A~2026-11-26')), 'فرع آخر يقرأ المفتاح');
});

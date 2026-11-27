/**
 * v40.0 — اختبارات «أساس الرقابة» على محاكي Firestore: كل ثابت في tests/security/CONSTITUTION.md له حالة قبول وحالة رفض هنا.
 * لا يُدمج ولا يُنشر أي تغيير إن فشل اختبار واحد.
 */
import { test, before, after } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';

let env;
const U = {
  owner: 'owner@test.com',          // مدير (platform/admins) — عضويته بلا دور مسجّل
  fin: 'fin@test.com',              // finance_department: مدقق إغلاق + قارئ سجل
  gm: 'gm@test.com',                // general_management: اعتماد نهائي
  acct: 'acct@test.com',            // accountant: مركزي لكنه ليس قارئ سجل ولا مدقق إغلاق
  view: 'view@test.com',            // accountant_view: للعرض فقط
  cash: 'cash@test.com',            // cashier فرع A
  bm: 'bm@test.com',                // branch_manager فرع A
  bm2: 'bm2@test.com',              // branch_manager فرع A (شخص آخر)
  bmB: 'bmb@test.com',              // branch_manager فرع B
  ctl: 'ctl@test.com',              // cost_controller
  reg: 'reg@test.com'               // regional_manager مُسنَد لفرع A
};
const as = (k) => env.authenticatedContext('u-' + k, { email: U[k] }).firestore();
const HEX = 'a'.repeat(64), HEX2 = 'b'.repeat(64);
const audit = (k, x = {}) => ({ at: serverTimestamp(), email: U[k], role: x.role ?? ROLE[k], title: 'عملية', cv: 400000, ...x });
const ROLE = { owner: '', fin: 'finance_department', gm: 'general_management', acct: 'accountant', view: 'accountant_view', cash: 'cashier', bm: 'branch_manager', bm2: 'branch_manager', bmB: 'branch_manager', ctl: 'cost_controller', reg: 'regional_manager' };
const sig = (k, x) => ({ digest: HEX, email: U[k], role: ROLE[k], at: serverTimestamp(), cv: 400000, branchId: 'A', ...x });
let n = 0; const id = (p) => p + '_' + (++n);

before(async () => {
  env = await initializeTestEnvironment({ projectId: process.env.RULES_FILE ? 'security-tenant-test' : 'security-test', firestore: { rules: fs.readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8') } });
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
    await m('bm2', { scope: 'branch', branchId: 'A', branchIds: [], role: 'branch_manager' });
    await m('bmB', { scope: 'branch', branchId: 'B', branchIds: [], role: 'branch_manager' });
    await m('ctl', { scope: 'all', role: 'cost_controller' });
    await m('reg', { scope: 'branch', branchId: '', branchIds: ['A'], role: 'regional_manager' });
    await setDoc(doc(d, 'platform', 'release'), { minCv: 400000, cutover: '2026-11-13', at: 1, by: U.owner });
    await setDoc(doc(d, 'platform', 'rms8_br_A'), { value: '{}', parts: 1, cv: 400000 });
    await setDoc(doc(d, 'platform', 'rms8_pulse'), { value: '{}', parts: 1, cv: 400000 });
    await setDoc(doc(d, 'audit_log', 'seed'), { at: Timestamp.now(), email: U.cash, role: 'cashier', title: 'بذرة', cv: 400000, branchId: 'A' });
  });
});
after(async () => { if (env) await env.cleanup(); });

/* ===== سجل التدقيق ===== */
test('ث1 هوية السجل: البريد والدور من الحساب نفسه — الانتحال مرفوض', async () => {
  await assertSucceeds(setDoc(doc(as('cash'), 'audit_log', id('a')), audit('cash', { branchId: 'A' })));
  await assertFails(setDoc(doc(as('cash'), 'audit_log', id('a')), audit('cash', { email: U.gm })), 'باسم غيره');
  await assertFails(setDoc(doc(as('cash'), 'audit_log', id('a')), audit('cash', { role: 'system_admin' })), 'بدور غير دوره');
  await assertSucceeds(setDoc(doc(as('owner'), 'audit_log', id('a')), audit('owner')), 'المدير بلا دور مسجّل');
});
test('ث2 وقت السجل = وقت الخادم — الوقت من الجهاز مرفوض', async () => {
  await assertFails(setDoc(doc(as('cash'), 'audit_log', id('a')), audit('cash', { at: Timestamp.fromDate(new Date('2020-01-01')) })));
});
test('ث3 السجل لا يُعدَّل ولا يُحذف — حتى من المدير', async () => {
  for (const k of ['cash', 'fin', 'owner']) {
    await assertFails(updateDoc(doc(as(k), 'audit_log', 'seed'), { title: 'محرّف' }), k);
    await assertFails(deleteDoc(doc(as(k), 'audit_log', 'seed')), k);
  }
});
test('ث4 لا يقرأ السجل أحد من الفروع — يقرؤه أصحاب شاشة التدقيق والمدير فقط', async () => {
  for (const k of ['cash', 'bm', 'reg', 'acct', 'view', 'ctl']) await assertFails(getDoc(doc(as(k), 'audit_log', 'seed')), k);
  for (const k of ['fin', 'gm', 'owner']) await assertSucceeds(getDoc(doc(as(k), 'audit_log', 'seed')), k);
});
test('ث5 لا يسجّل عملية لفرع خارج نطاقه، والحقول محدودة', async () => {
  await assertFails(setDoc(doc(as('cash'), 'audit_log', id('a')), audit('cash', { branchId: 'B' })));
  await assertFails(setDoc(doc(as('cash'), 'audit_log', id('a')), audit('cash', { extra: 1 })), 'حقل غير معروف');
  await assertFails(setDoc(doc(as('cash'), 'audit_log', id('a')), audit('cash', { title: 'x'.repeat(201) })), 'عنوان طويل');
});
test('ث6 ترحيل السجل القديم للمدير وحده، موسومًا «قديم»', async () => {
  const leg = { at: serverTimestamp(), email: 'legacy', role: 'cashier', userName: 'خالد', title: 'قديم', cv: 400000, legacy: true, origAt: '2026-10-01T10:00:00Z' };
  await assertSucceeds(setDoc(doc(as('owner'), 'audit_log', id('l')), leg));
  await assertFails(setDoc(doc(as('fin'), 'audit_log', id('l')), leg));
  await assertFails(setDoc(doc(as('cash'), 'audit_log', id('l')), leg));
});

/* ===== الاعتمادات الموقّعة ===== */
test('ث7 التوقيع بهوية الحساب ووقت الخادم وبصمة صحيحة، ولا يُعدَّل ولا يُحذف', async () => {
  const s1 = id('closing_c1_submit');
  await assertSucceeds(setDoc(doc(as('cash'), 'signoffs', s1), sig('cash', { kind: 'closing', stage: 'submit', entityId: 'c1' })));
  await assertFails(setDoc(doc(as('cash'), 'signoffs', id('x')), sig('cash', { kind: 'closing', stage: 'submit', entityId: 'c1', email: U.bm })), 'باسم غيره');
  await assertFails(setDoc(doc(as('cash'), 'signoffs', id('x')), sig('cash', { kind: 'closing', stage: 'submit', entityId: 'c1', digest: 'zz' })), 'بصمة فاسدة');
  await assertFails(setDoc(doc(as('cash'), 'signoffs', id('x')), sig('cash', { kind: 'closing', stage: 'submit', entityId: 'c1', at: Timestamp.now() })), 'وقت الجهاز');
  await assertFails(setDoc(doc(as('cash'), 'signoffs', id('x')), sig('cash', { kind: 'salary', stage: 'submit', entityId: 'c1' })), 'نوع غير معروف');
  for (const k of ['cash', 'fin', 'owner']) { await assertFails(updateDoc(doc(as(k), 'signoffs', s1), { digest: HEX2 }), k); await assertFails(deleteDoc(doc(as(k), 'signoffs', s1)), k); }
});
test('ث8 تدقيق الإغلاق: للمدققين المؤهلين فقط، ولا يدقق المقدّم إغلاقه (قرار المالك)', async () => {
  const sub = id('closing_c2_submit');
  await assertSucceeds(setDoc(doc(as('fin'), 'signoffs', sub), sig('fin', { kind: 'closing', stage: 'submit', entityId: 'c2' })));
  await assertFails(setDoc(doc(as('fin'), 'signoffs', id('x')), sig('fin', { kind: 'closing', stage: 'audit', entityId: 'c2', subRef: sub })), 'المقدّم يدقق نفسه');
  await assertSucceeds(setDoc(doc(as('gm'), 'signoffs', id('a')), sig('gm', { kind: 'closing', stage: 'audit', entityId: 'c2', subRef: sub })), 'شخص آخر مؤهل');
  const sub3 = id('closing_c3_submit');
  await assertSucceeds(setDoc(doc(as('cash'), 'signoffs', sub3), sig('cash', { kind: 'closing', stage: 'submit', entityId: 'c3' })));
  for (const k of ['cash', 'bm', 'acct', 'ctl', 'reg']) await assertFails(setDoc(doc(as(k), 'signoffs', id('x')), sig(k, { kind: 'closing', stage: 'audit', entityId: 'c3', subRef: sub3 })), k + ' غير مؤهل');
  await assertFails(setDoc(doc(as('fin'), 'signoffs', id('x')), sig('fin', { kind: 'closing', stage: 'audit', entityId: 'c3' })), 'بلا توقيع تقديم');
  await assertFails(setDoc(doc(as('fin'), 'signoffs', id('x')), sig('fin', { kind: 'closing', stage: 'audit', entityId: 'c3', subRef: sub })), 'مرجع تقديم لإغلاق آخر');
  await assertSucceeds(setDoc(doc(as('fin'), 'signoffs', id('a')), sig('fin', { kind: 'closing', stage: 'audit', entityId: 'c3', subRef: sub3 })));
});
test('ث9 الاعتماد النهائي للإغلاق للإدارة العليا والمكتب الرئيسي والمدير فقط', async () => {
  await assertSucceeds(setDoc(doc(as('gm'), 'signoffs', id('g')), sig('gm', { kind: 'closing', stage: 'gm', entityId: 'c3' })));
  await assertSucceeds(setDoc(doc(as('owner'), 'signoffs', id('g')), sig('owner', { kind: 'closing', stage: 'gm', entityId: 'c3' })));
  await assertFails(setDoc(doc(as('fin'), 'signoffs', id('g')), sig('fin', { kind: 'closing', stage: 'gm', entityId: 'c3' })), 'المالية ليست اعتمادًا نهائيًا');
});
test('ث10 الهدر: معتمد مؤهل غير مقدّم الطلب — والمدير مستثنى كما في المنصة', async () => {
  const sub = id('waste_w1_submit');
  await assertSucceeds(setDoc(doc(as('ctl'), 'signoffs', sub), sig('ctl', { kind: 'waste', stage: 'submit', entityId: 'w1' })));
  await assertFails(setDoc(doc(as('ctl'), 'signoffs', id('x')), sig('ctl', { kind: 'waste', stage: 'approve', entityId: 'w1', subRef: sub })), 'يعتمد هدره');
  await assertFails(setDoc(doc(as('bm'), 'signoffs', id('x')), sig('bm', { kind: 'waste', stage: 'approve', entityId: 'w1', subRef: sub })), 'مدير الفرع غير مؤهل');
  await assertSucceeds(setDoc(doc(as('reg'), 'signoffs', id('a')), sig('reg', { kind: 'waste', stage: 'approve', entityId: 'w1', subRef: sub })));
  const sub2 = id('waste_w2_submit');
  await assertSucceeds(setDoc(doc(as('owner'), 'signoffs', sub2), sig('owner', { kind: 'waste', stage: 'submit', entityId: 'w2' })));
  await assertSucceeds(setDoc(doc(as('owner'), 'signoffs', id('a')), sig('owner', { kind: 'waste', stage: 'approve', entityId: 'w2', subRef: sub2 })), 'المدير مستثنى');
});
test('ث11 الجرد: لا يعتمده العادّ ولا مُعيد العدّ', async () => {
  const sub = id('count_k1_submit'), rc = id('count_k1_recount');
  await assertSucceeds(setDoc(doc(as('cash'), 'signoffs', sub), sig('cash', { kind: 'count', stage: 'submit', entityId: 'k1' })));
  await assertSucceeds(setDoc(doc(as('bm'), 'signoffs', rc), sig('bm', { kind: 'count', stage: 'recount', entityId: 'k1' })));
  await assertFails(setDoc(doc(as('bm'), 'signoffs', id('x')), sig('bm', { kind: 'count', stage: 'approve', entityId: 'k1', subRef: sub, recountRef: rc })), 'مُعيد العدّ يعتمد');
  await assertFails(setDoc(doc(as('cash'), 'signoffs', id('x')), sig('cash', { kind: 'count', stage: 'approve', entityId: 'k1', subRef: sub, recountRef: rc })), 'الكاشير غير مؤهل');
  await assertSucceeds(setDoc(doc(as('bm2'), 'signoffs', id('a')), sig('bm2', { kind: 'count', stage: 'approve', entityId: 'k1', subRef: sub, recountRef: rc })), 'مدير آخر');
});
test('ث12 أمر الشراء: مؤهل فقط، ومع تنبيه السعر لا يعتمده منشئه', async () => {
  const s0 = id('po_p0_submit'), s1 = id('po_p1_submit');
  await assertSucceeds(setDoc(doc(as('gm'), 'signoffs', s0), sig('gm', { kind: 'po', stage: 'submit', entityId: 'p0', branchId: '', alert: false })));
  await assertSucceeds(setDoc(doc(as('gm'), 'signoffs', id('a')), sig('gm', { kind: 'po', stage: 'approve', entityId: 'p0', branchId: '', subRef: s0 })), 'بلا تنبيه يعتمد أمره');
  await assertSucceeds(setDoc(doc(as('gm'), 'signoffs', s1), sig('gm', { kind: 'po', stage: 'submit', entityId: 'p1', branchId: '', alert: true })));
  await assertFails(setDoc(doc(as('gm'), 'signoffs', id('x')), sig('gm', { kind: 'po', stage: 'approve', entityId: 'p1', branchId: '', subRef: s1 })), 'تنبيه سعر — المنشئ');
  await assertFails(setDoc(doc(as('acct'), 'signoffs', id('x')), sig('acct', { kind: 'po', stage: 'approve', entityId: 'p1', branchId: '', subRef: s1 })), 'غير مؤهل');
  await assertSucceeds(setDoc(doc(as('owner'), 'signoffs', id('a')), sig('owner', { kind: 'po', stage: 'approve', entityId: 'p1', branchId: '', subRef: s1 })), 'شخص آخر');
  await assertFails(setDoc(doc(as('bm'), 'signoffs', id('x')), sig('bm', { kind: 'po', stage: 'submit', entityId: 'p2', branchId: '' })), 'فرعي لا يوقّع سجلًا مركزيًا');
});
test('ث13 السجلات السابقة لبدء التوقيع فقط تُعتمد بلا توقيع تقديم', async () => {
  await assertSucceeds(setDoc(doc(as('fin'), 'signoffs', id('a')), sig('fin', { kind: 'closing', stage: 'audit', entityId: 'old1', nosub: true, edate: '2026-11-01' })));
  await assertFails(setDoc(doc(as('fin'), 'signoffs', id('x')), sig('fin', { kind: 'closing', stage: 'audit', entityId: 'new1', nosub: true, edate: '2026-11-13' })), 'بعد بدء التوقيع');
});
test('ث14 عزل الفروع في التوقيعات: كتابةً وقراءةً', async () => {
  await assertFails(setDoc(doc(as('cash'), 'signoffs', id('x')), sig('cash', { kind: 'closing', stage: 'submit', entityId: 'cB', branchId: 'B' })));
  const sb = id('closing_cb_submit');
  await assertSucceeds(setDoc(doc(as('bmB'), 'signoffs', sb), sig('bmB', { kind: 'closing', stage: 'submit', entityId: 'cb', branchId: 'B' })));
  await assertFails(getDoc(doc(as('cash'), 'signoffs', sb)), 'فرع A لا يقرأ توقيع فرع B');
  await assertSucceeds(getDoc(doc(as('bmB'), 'signoffs', sb)));
  await assertSucceeds(getDocs(query(collection(as('cash'), 'signoffs'), where('branchId', '==', 'A'))), 'استعلام فرعه');
  await assertFails(getDocs(collection(as('cash'), 'signoffs')), 'استعلام كل التوقيعات من فرع');
});
test('ث15 العرض فقط لا يوقّع', async () => {
  await assertFails(setDoc(doc(as('view'), 'signoffs', id('x')), sig('view', { kind: 'po', stage: 'submit', entityId: 'p9', branchId: '' })));
});

/* ===== التحديث الإجباري ===== */
test('ث16 لا يكتب جهاز بإصدار أقدم من الحد الأدنى — والأجزاء تمر', async () => {
  await assertSucceeds(setDoc(doc(as('cash'), 'platform', 'rms8_br_A'), { value: '{}', parts: 1, updatedAt: 1, cv: 400000 }));
  await assertFails(setDoc(doc(as('cash'), 'platform', 'rms8_br_A'), { value: '{}', parts: 1, updatedAt: 1 }), 'إصدار قديم بلا cv');
  await assertFails(setDoc(doc(as('cash'), 'platform', 'rms8_br_A'), { value: '{}', parts: 1, updatedAt: 1, cv: 390500 }), 'إصدار أقل');
  await assertFails(setDoc(doc(as('cash'), 'platform', 'rms8_pulse'), { value: '{}', parts: 1, updatedAt: 1 }), 'النبض من إصدار قديم');
  await assertFails(setDoc(doc(as('cash'), 'audit_log', id('a')), audit('cash', { cv: 390500 })), 'سجل من إصدار قديم');
  await assertSucceeds(setDoc(doc(as('cash'), 'platform', 'rms8_br_A__vabcd_0'), { chunk: 'x' }), 'الجزء لا يحمل إصدارًا');
});
test('ث17 الحد الأدنى للإصدار يعلنه المدير وحده، ولا يُحذف', async () => {
  const rel = { minCv: 400100, cutover: '2026-11-13', at: 2, by: U.owner };
  for (const k of ['fin', 'gm', 'cash']) await assertFails(setDoc(doc(as(k), 'platform', 'release'), rel), k);
  await assertSucceeds(getDoc(doc(as('cash'), 'platform', 'release')), 'كل عضو يقرؤه ليعرف أنه يحتاج تحديثًا');
  await assertFails(setDoc(doc(as('owner'), 'platform', 'release'), { ...rel, cutover: '13-11-2026' }), 'تاريخ بصيغة خاطئة');
  await assertSucceeds(setDoc(doc(as('owner'), 'platform', 'release'), { ...rel, minCv: 400000 }));
  await assertFails(deleteDoc(doc(as('owner'), 'platform', 'release')));
});
test('ث18 سقف القراءات: مع سياسة الخطوتين والحد الأدنى للإصدار معًا تمر أثقل الطلبات المشروعة (حد 10 قراءات/1000 عملية)', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'platform', 'security'), { roles: ['x_role_not_used'], admins: false, at: 1 }); });
  try {
    await assertSucceeds(setDoc(doc(as('cash'), 'platform', 'rms8_br_A'), { value: '{}', parts: 1, updatedAt: 2, cv: 400000 }), 'رأس مستند فرع');
    const sub = id('count_k9_submit'), rc = id('count_k9_recount');
    await assertSucceeds(setDoc(doc(as('cash'), 'signoffs', sub), sig('cash', { kind: 'count', stage: 'submit', entityId: 'k9' })));
    await assertSucceeds(setDoc(doc(as('bm'), 'signoffs', rc), sig('bm', { kind: 'count', stage: 'recount', entityId: 'k9' })));
    await assertSucceeds(setDoc(doc(as('reg'), 'signoffs', id('a')), sig('reg', { kind: 'count', stage: 'approve', entityId: 'k9', subRef: sub, recountRef: rc })), 'أثقل اعتماد: مرجعان');
    await assertSucceeds(setDoc(doc(as('cash'), 'audit_log', id('a')), audit('cash', { branchId: 'A' })));
  } finally {
    await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), 'platform', 'security')); });
  }
});

test('ث21 تغيير حساب الدفع (آيبان): يعتمده شخص آخر مؤهل غير طالبه — بلا استثناء للمدير — وبالآيبان المقدَّم نفسه', async () => {
  const sub = id('ib');
  await assertSucceeds(setDoc(doc(as('owner'), 'signoffs', sub), sig('owner', { kind: 'iban', stage: 'submit', entityId: 'emp:e1', branchId: '' })), 'المدير يطلب التغيير');
  await assertFails(setDoc(doc(as('owner'), 'signoffs', id('x')), sig('owner', { kind: 'iban', stage: 'approve', entityId: 'emp:e1', branchId: '', subRef: sub })), 'الطالب يعتمد نفسه — حتى المدير');
  for (const k of ['acct', 'ctl', 'bm', 'cash', 'view']) await assertFails(setDoc(doc(as(k), 'signoffs', id('x')), sig(k, { kind: 'iban', stage: 'approve', entityId: 'emp:e1', branchId: '', subRef: sub })), k + ' غير مؤهل');
  await assertFails(setDoc(doc(as('fin'), 'signoffs', id('x')), sig('fin', { kind: 'iban', stage: 'approve', entityId: 'emp:e1', branchId: '', subRef: sub, digest: HEX2 })), 'آيبان غير المقدَّم');
  await assertFails(setDoc(doc(as('fin'), 'signoffs', id('x')), sig('fin', { kind: 'iban', stage: 'approve', entityId: 'emp:e2', branchId: '', subRef: sub })), 'مرجع طلب لجهة أخرى');
  await assertFails(setDoc(doc(as('fin'), 'signoffs', id('x')), sig('fin', { kind: 'iban', stage: 'approve', entityId: 'emp:e1', branchId: '', nosub: true, edate: '2020-01-01' })), 'لا مسار «قبل البدء»');
  await assertSucceeds(setDoc(doc(as('fin'), 'signoffs', id('a')), sig('fin', { kind: 'iban', stage: 'approve', entityId: 'emp:e1', branchId: '', subRef: sub })), 'المالية تعتمد');
  await assertSucceeds(setDoc(doc(as('gm'), 'signoffs', id('r')), sig('gm', { kind: 'iban', stage: 'reject', entityId: 'emp:e1', branchId: '', subRef: sub })), 'أو ترفض');
  await assertFails(setDoc(doc(as('bm'), 'signoffs', id('x')), sig('bm', { kind: 'iban', stage: 'submit', entityId: 'emp:e9', branchId: '' })), 'الفرع لا يطلب تغيير حسابات الدفع المركزية');
});

test('ث23 أرشيف فواتير نقطة البيع: يكتبه مسؤول النظام وحده، ويقرؤه المركز، ولا يصل إليه الفرع', async () => {
  const doc0 = { value: '[]', parts: 1, cv: 400000 };
  await assertSucceeds(setDoc(doc(as('owner'), 'platform', 'rms8_arch_A_2025'), doc0), 'مسؤول النظام يكتب');
  await assertFails(setDoc(doc(as('fin'), 'platform', 'rms8_arch_A_2025'), doc0), 'المالية لا تكتب الأرشيف');
  await assertFails(setDoc(doc(as('bm'), 'platform', 'rms8_arch_A_2025'), doc0), 'الفرع لا يكتب');
  await assertSucceeds(getDoc(doc(as('fin'), 'platform', 'rms8_arch_A_2025')), 'المركز يقرأ');
  await assertFails(getDoc(doc(as('bm'), 'platform', 'rms8_arch_A_2025')), 'الفرع لا يقرأ');
  await assertFails(setDoc(doc(as('owner'), 'platform', 'rms8_arch_A_x'), doc0), 'اسم بلا سنة مرفوض');
});

/* ===== v41.9 — الإغلاقات سجلات مستقلة (ث27–ث30) ===== */
const cl = (k, x = {}) => ({ branchId: 'A', date: '2026-11-14', status: 'submitted', gm: 'pending', digest: HEX, data: '{}', by: U[k], at: serverTimestamp(), cv: 400000, ...x });
const clOld = async (cid, x) => env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'closings', cid), { ...cl('bm', x), at: Timestamp.now() }));

test('ث27 الفرع يكتب إغلاقه مسودةً أو مرحّلًا فقط — ولا «معتمد» بلا توقيع، ولا لفرع آخر', async () => {
  const c = id('cl');
  await assertSucceeds(setDoc(doc(as('cash'), 'closings', c), cl('cash', { status: 'draft' })), 'مسودة');
  await assertSucceeds(setDoc(doc(as('cash'), 'closings', c), cl('cash')), 'ترحيل');
  await assertFails(setDoc(doc(as('bm'), 'closings', id('x')), cl('bm', { status: 'approved' })), 'الفرع يكتب «معتمد» مباشرة');
  await assertFails(setDoc(doc(as('bm'), 'closings', id('x')), cl('bm', { gm: 'approved' })), 'الفرع يكتب «اعتماد نهائي»');
  await assertFails(setDoc(doc(as('bmB'), 'closings', id('x')), cl('bmB')), 'فرع آخر');
  await assertFails(setDoc(doc(as('view'), 'closings', id('x')), cl('view')), 'العرض فقط');
  await assertFails(setDoc(doc(as('cash'), 'closings', id('x')), cl('cash', { by: U.bm })), 'باسم غيره');
  await assertFails(setDoc(doc(as('cash'), 'closings', id('x')), cl('cash', { extra: 1 })), 'حقل خارج الشكل');
  await assertSucceeds(getDoc(doc(as('bm'), 'closings', c)), 'الفرع يقرأ إغلاقه');
  await assertFails(getDoc(doc(as('bmB'), 'closings', c)), 'ولا يقرأ غيره');
});

test('ث28 التدقيق يُربط بتوقيع موثّق للمدقق نفسه على السجل نفسه وبالبصمة ذاتها', async () => {
  const c = id('cl'); await clOld(c, {});
  const sub = id('s'); await assertSucceeds(setDoc(doc(as('bm'), 'signoffs', sub), sig('bm', { kind: 'closing', stage: 'submit', entityId: c })));
  const au = id('s'); await assertSucceeds(setDoc(doc(as('fin'), 'signoffs', au), sig('fin', { kind: 'closing', stage: 'audit', entityId: c, subRef: sub })));
  await assertFails(setDoc(doc(as('fin'), 'closings', c), cl('fin', { status: 'approved' })), 'بلا مرجع توقيع');
  await assertFails(setDoc(doc(as('fin'), 'closings', c), cl('fin', { status: 'approved', sigRef: au, digest: HEX2 })), 'بصمة غير الموقّعة');
  await assertFails(setDoc(doc(as('gm'), 'closings', c), cl('gm', { status: 'approved', sigRef: au })), 'توقيع شخص آخر');
  await assertFails(setDoc(doc(as('fin'), 'closings', c), cl('fin', { status: 'approved', sigRef: sub })), 'توقيع تقديم لا تدقيق');
  const c2 = id('cl'); await clOld(c2, {});
  await assertFails(setDoc(doc(as('fin'), 'closings', c2), cl('fin', { status: 'approved', sigRef: au })), 'توقيع سجل آخر');
  await assertSucceeds(setDoc(doc(as('fin'), 'closings', c), cl('fin', { status: 'approved', sigRef: au })), 'المدقق بتوقيعه');
  const g = id('s'); await assertSucceeds(setDoc(doc(as('gm'), 'signoffs', g), sig('gm', { kind: 'closing', stage: 'gm', entityId: c })));
  await assertFails(setDoc(doc(as('gm'), 'closings', c), cl('gm', { status: 'approved', gm: 'approved', sigRef: g, digest: HEX2 })), 'الاعتماد النهائي لا يغيّر الأرقام');
  await assertSucceeds(setDoc(doc(as('gm'), 'closings', c), cl('gm', { status: 'approved', gm: 'approved', sigRef: g })), 'اعتماد نهائي بتوقيعه');
});

test('ث29 الفرع لا يلمس إغلاقًا معتمدًا — والمدير وحده يعيده مسودة أو يحذفه', async () => {
  const c = id('cl'); await clOld(c, { status: 'approved' });
  await assertFails(setDoc(doc(as('bm'), 'closings', c), cl('bm')), 'الفرع يعيده مرحّلًا');
  await assertFails(setDoc(doc(as('bm'), 'closings', c), cl('bm', { status: 'approved', digest: HEX2 })), 'الفرع يعدّل أرقامه');
  await assertFails(setDoc(doc(as('fin'), 'closings', c), cl('fin', { status: 'approved', digest: HEX2 })), 'ولا المدقق بلا قرار موقّع');
  await assertFails(deleteDoc(doc(as('bm'), 'closings', c)), 'الفرع يحذفه');
  await assertFails(deleteDoc(doc(as('fin'), 'closings', c)), 'المالية تحذفه');
  await assertSucceeds(setDoc(doc(as('fin'), 'closings', c), cl('fin', { status: 'approved', data: '{"transferStatus":"received"}' })), 'الخزينة تحدّث حالة التوريد بلا تغيير البصمة');
  await assertFails(setDoc(doc(as('fin'), 'closings', c), cl('fin', { status: 'submitted' })), 'ولا تغيّر الحالة');
  await assertFails(setDoc(doc(as('bm'), 'closings', c), cl('bm', { status: 'approved', data: '{"x":1}' })), 'الفرع لا يحدّث حتى البيانات التشغيلية للمعتمد');
  await assertSucceeds(setDoc(doc(as('owner'), 'closings', c), cl('owner', { status: 'draft' })), 'المدير يعيده مسودة');
  await assertSucceeds(deleteDoc(doc(as('bm'), 'closings', c)), 'المسودة يحذفها الفرع');
});

test('ث30 الرفض موقّع، والمرفوض يصححه الفرع ويرحّله من جديد', async () => {
  const c = id('cl'); await clOld(c, {});
  const sub = id('s'); await assertSucceeds(setDoc(doc(as('bm'), 'signoffs', sub), sig('bm', { kind: 'closing', stage: 'submit', entityId: c })));
  await assertFails(setDoc(doc(as('fin'), 'closings', c), cl('fin', { status: 'rejected' })), 'رفض بلا توقيع');
  const rj = id('s'); await assertSucceeds(setDoc(doc(as('fin'), 'signoffs', rj), sig('fin', { kind: 'closing', stage: 'reject', entityId: c, subRef: sub })));
  await assertSucceeds(setDoc(doc(as('fin'), 'closings', c), cl('fin', { status: 'rejected', sigRef: rj })), 'رفض موقّع');
  await assertSucceeds(setDoc(doc(as('bm'), 'closings', c), cl('bm', { status: 'submitted', digest: HEX2 })), 'الفرع يصحح ويرحّل');
});

/* ===== v43.5 — مسار الفحص وفرق سعر فاتورة المورد ===== */
test('ث31 فحص الاستلام: فاحص مؤهل غير المستلم — المستلم نفسه وغير المؤهل والمرجع المفقود مرفوض', async () => {
  const s0 = id('grn_g1_submit');
  await assertSucceeds(setDoc(doc(as('acct'), 'signoffs', s0), sig('acct', { kind: 'grn', stage: 'submit', entityId: 'g1', branchId: '' })));
  await assertFails(setDoc(doc(as('acct'), 'signoffs', id('x')), sig('acct', { kind: 'grn', stage: 'approve', entityId: 'g1', branchId: '', subRef: s0 })), 'المستلم يفحص استلامه');
  await assertFails(setDoc(doc(as('view'), 'signoffs', id('x')), sig('view', { kind: 'grn', stage: 'approve', entityId: 'g1', branchId: '', subRef: s0 })), 'للعرض فقط غير مؤهل');
  await assertFails(setDoc(doc(as('fin'), 'signoffs', id('x')), sig('fin', { kind: 'grn', stage: 'approve', entityId: 'g1', branchId: '', nosub: true, edate: '2026-11-01' })), 'لا مسار «قبل البدء»');
  await assertFails(setDoc(doc(as('fin'), 'signoffs', id('x')), sig('fin', { kind: 'grn', stage: 'reject', entityId: 'g1', branchId: '', subRef: s0 })), 'الفحص اعتماد واحد بكميات مقبولة/مرفوضة');
  await assertSucceeds(setDoc(doc(as('ctl'), 'signoffs', id('a')), sig('ctl', { kind: 'grn', stage: 'approve', entityId: 'g1', branchId: '', subRef: s0 })), 'مراقب التكاليف يفحص');
  await assertSucceeds(setDoc(doc(as('fin'), 'signoffs', id('a')), sig('fin', { kind: 'grn', stage: 'approve', entityId: 'g1', branchId: '', subRef: s0 })), 'المالية تفحص');
});
test('ث32 فاتورة بفرق سعر فوق التسامح: يعتمدها معتمد أوامر الشراء غير مسجّلها', async () => {
  const s0 = id('pinv_i1_submit'), s1 = id('pinv_i2_submit');
  await assertSucceeds(setDoc(doc(as('acct'), 'signoffs', s0), sig('acct', { kind: 'pinv', stage: 'submit', entityId: 'i1', branchId: '', alert: true })));
  await assertFails(setDoc(doc(as('acct'), 'signoffs', id('x')), sig('acct', { kind: 'pinv', stage: 'approve', entityId: 'i1', branchId: '', subRef: s0 })), 'مسجّلها غير مؤهل للاعتماد');
  await assertFails(setDoc(doc(as('fin'), 'signoffs', id('x')), sig('fin', { kind: 'pinv', stage: 'approve', entityId: 'i1', branchId: '', subRef: s0 })), 'المالية ليست معتمِدة أوامر شراء');
  await assertSucceeds(setDoc(doc(as('gm'), 'signoffs', id('a')), sig('gm', { kind: 'pinv', stage: 'approve', entityId: 'i1', branchId: '', subRef: s0 })), 'شخص آخر مؤهل');
  await assertSucceeds(setDoc(doc(as('acct'), 'signoffs', s1), sig('acct', { kind: 'pinv', stage: 'submit', entityId: 'i2', branchId: '', alert: false })));
  await assertFails(setDoc(doc(as('gm'), 'signoffs', id('x')), sig('gm', { kind: 'pinv', stage: 'approve', entityId: 'i2', branchId: '', subRef: s1 })), 'لا اعتماد لتقديم بلا تنبيه');

  await assertSucceeds(setDoc(doc(as('owner'), 'signoffs', id('a')), sig('owner', { kind: 'pinv', stage: 'reject', entityId: 'i1', branchId: '', subRef: s0 })), 'الرفض من معتمد آخر');
});
test('ث34 طلب شراء الفرع واستلامه لأمر شراء: مدير ذلك الفرع وحده، تقديمًا فقط', async () => {
  for (const k of ['preq', 'prcv']) {
    await assertSucceeds(setDoc(doc(as('bm'), 'signoffs', id(k + '_a_submit')), sig('bm', { kind: k, stage: 'submit', entityId: 'r1', branchId: 'A' })), 'مدير الفرع لفرعه');
    await assertFails(setDoc(doc(as('bmB'), 'signoffs', id('x')), sig('bmB', { kind: k, stage: 'submit', entityId: 'r1', branchId: 'A' })), 'مدير فرع آخر');
    await assertFails(setDoc(doc(as('bm'), 'signoffs', id('x')), sig('bm', { kind: k, stage: 'submit', entityId: 'r1', branchId: '' })), 'بلا فرع');
    for (const u of ['cash', 'reg', 'acct', 'gm', 'owner']) await assertFails(setDoc(doc(as(u), 'signoffs', id('x')), sig(u, { kind: k, stage: 'submit', entityId: 'r1', branchId: 'A' })), u + ' لا يوقّع ' + k);
    for (const st of ['approve', 'reject']) await assertFails(setDoc(doc(as('gm'), 'signoffs', id('x')), sig('gm', { kind: k, stage: st, entityId: 'r1', branchId: '', subRef: id(k + '_a_submit') })), 'لا مرحلة ' + st);
  }
});
test('ث33 تحويل الاستلام غير المطابق إلى فاتورة: المحاسب ومدير النظام فقط', async () => {
  await assertSucceeds(setDoc(doc(as('acct'), 'signoffs', id('pinv_x_submit')), sig('acct', { kind: 'pinv', stage: 'submit', entityId: 'i9', branchId: '', alert: false })), 'المحاسب');
  await assertSucceeds(setDoc(doc(as('owner'), 'signoffs', id('pinv_y_submit')), sig('owner', { kind: 'pinv', stage: 'submit', entityId: 'i9', branchId: '', alert: false })), 'مدير النظام');
  for (const k of ['gm', 'fin', 'ctl', 'view']) await assertFails(setDoc(doc(as(k), 'signoffs', id('x')), sig(k, { kind: 'pinv', stage: 'submit', entityId: 'i9', branchId: '', alert: false })), k + ' لا يحوّل');
});

/* ===== v45.7 — تحقق صريح من ادعاءات الأمان المعروضة على المالك ===== */
const as2fa = (k) => env.authenticatedContext('u-' + k, { email: U[k], firebase: { sign_in_provider: 'password', sign_in_second_factor: 'totp' } }).firestore();
test('تحقق: الفرع لا يقرأ المستند المركزي ولا مستند فرع آخر — والمركز يقرأ', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { const d = ctx.firestore();
    await setDoc(doc(d, 'platform', 'rms8_core'), { value: '{}', parts: 1, cv: 400000 }); await setDoc(doc(d, 'platform', 'rms8_br_B'), { value: '{}', parts: 1, cv: 400000 }); });
  for (const k of ['cash', 'bm']) await assertFails(getDoc(doc(as(k), 'platform', 'rms8_core')), k + ' لا يقرأ المركزي');
  await assertFails(getDoc(doc(as('bm'), 'platform', 'rms8_br_B')), 'مدير فرع A لا يقرأ فرع B');
  await assertSucceeds(getDoc(doc(as('bm'), 'platform', 'rms8_br_A')), 'يقرأ فرعه');
  await assertSucceeds(getDoc(doc(as('fin'), 'platform', 'rms8_core')), 'المركز يقرأ');
  await assertFails(setDoc(doc(as('bm'), 'platform', 'rms8_core'), { value: '{}', parts: 1, updatedAt: 3, cv: 400000 }), 'الفرع لا يكتب المركزي');
});
test('تحقق: سياسة التحقق بخطوتين — حين تُفعَّل لدور يُرفض بلا عامل ثانٍ ويُقبل به، ولا تمس الأدوار غير المشمولة', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'platform', 'security'), { roles: ['finance_department'], admins: true, at: 1 }); });
  try {
    await assertFails(getDoc(doc(as('fin'), 'platform', 'rms8_core')), 'المالية بلا خطوة ثانية ⇒ مرفوض');
    await assertSucceeds(getDoc(doc(as2fa('fin'), 'platform', 'rms8_core')), 'بالخطوة الثانية ⇒ مقبول');
    await assertFails(setDoc(doc(as('owner'), 'platform', 'release'), { minCv: 400000, cutover: '2026-11-13', at: 2, by: U.owner }), 'المدير بلا خطوة ثانية ⇒ مرفوض');
    await assertSucceeds(getDoc(doc(as('cash'), 'platform', 'rms8_br_A')), 'الكاشير غير مشمول بالسياسة');
  } finally { await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), 'platform', 'security')); }); }
});

/* ===== v45.9 — رموز إشعارات الأجهزة ===== */
test('ث35 رموز الإشعارات: العضو يسجّل رمز جهازه باسم بريده فقط، ولا يقرأ أو يحذف رموز غيره، ولا حقول إضافية (دور/فرع)', async () => {
  const tid = (c) => c.repeat(40);
  const tk = (k, x) => ({ email: U[k], token: 'fcm-token-' + 'x'.repeat(40), ua: 'test', at: 1, ...(x || {}) });
  await assertSucceeds(setDoc(doc(as('fin'), 'pushTokens', tid('a')), tk('fin')), 'العضو يسجّل رمزه');
  await assertSucceeds(getDoc(doc(as('fin'), 'pushTokens', tid('a'))), 'ويقرؤه');
  await assertFails(setDoc(doc(as('cash'), 'pushTokens', tid('b')), tk('fin')), 'لا يسجّل باسم بريد غيره');
  await assertFails(setDoc(doc(as('cash'), 'pushTokens', tid('a')), tk('cash')), 'لا يستولي على رمز غيره');
  await assertFails(getDoc(doc(as('cash'), 'pushTokens', tid('a'))), 'لا يقرأ رمز غيره');
  await assertFails(deleteDoc(doc(as('cash'), 'pushTokens', tid('a'))), 'لا يحذف رمز غيره');
  await assertFails(setDoc(doc(as('cash'), 'pushTokens', tid('c')), tk('cash', { role: 'system_admin' })), 'لا حقل دور');
  await assertFails(setDoc(doc(as('cash'), 'pushTokens', 'short'), tk('cash')), 'معرّف بطول ثابت');
  await assertSucceeds(getDoc(doc(as('owner'), 'pushTokens', tid('a'))), 'المدير يقرأ');
  await assertSucceeds(deleteDoc(doc(as('fin'), 'pushTokens', tid('a'))), 'العضو يحذف رمزه');
});

test('v56.50 سجل الإرسال للاعتماد comms_sub للخادم وحده (المراجعة الأمنية): لا قراءة ولا إنشاء ولا تعديل ولا حذف لأي دور', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { const d = ctx.firestore();
    await setDoc(doc(d, 'comms_sub', 'x'), { jobId: 'x', email: 'mk@x.sa', hash: 'h' }); });
  for (const k of ['cash', 'bm', 'fin', 'acct', 'owner']) {
    await assertFails(getDoc(doc(as(k), 'comms_sub', 'x')), k + ' يقرأ comms_sub');
    await assertFails(setDoc(doc(as(k), 'comms_sub', 'y_' + k), { jobId: 'y', email: 'other@x.sa', hash: 'h' }), k + ' يزوّر مُرسِلًا للاعتماد');
    await assertFails(updateDoc(doc(as(k), 'comms_sub', 'x'), { email: 'other@x.sa' }), k + ' يغيّر المُرسِل');
    await assertFails(deleteDoc(doc(as(k), 'comms_sub', 'x')), k + ' يحذف comms_sub');
  }
});

test('v56.50 سجل اعتماد الرسائل comms_appr للخادم وحده (المراجعة الأمنية): لا قراءة ولا إنشاء ولا تعديل ولا حذف لأي دور', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { const d = ctx.firestore();
    await setDoc(doc(d, 'comms_appr', 'x'), { jobId: 'x', email: 'gm@x.sa', byId: 'u-gm', creatorId: 'u-mk', hash: 'h' }); });
  for (const k of ['cash', 'bm', 'fin', 'acct', 'owner']) {
    await assertFails(getDoc(doc(as(k), 'comms_appr', 'x')), k + ' يقرأ comms_appr');
    await assertFails(setDoc(doc(as(k), 'comms_appr', 'y_' + k), { jobId: 'y', email: 'a@x.sa', hash: 'h' }), k + ' يزوّر اعتمادًا');
    await assertFails(updateDoc(doc(as(k), 'comms_appr', 'x'), { hash: 'h2' }), k + ' يعدّل بصمة الاعتماد');
    await assertFails(deleteDoc(doc(as(k), 'comms_appr', 'x')), k + ' يحذف comms_appr');
  }
});

test('v56.50 سجل إرسال الرسائل comms_log للخادم وحده: لا قراءة ولا كتابة ولا حذف لعضو ولا لمدير ولا للمالك', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { const d = ctx.firestore();
    await setDoc(doc(d, 'comms_log', 'x'), { jobId: 'x', kind: 'campaign', n: 3, ok: 3, dry: true, items: '[]' }); });
  for (const k of ['cash', 'bm', 'fin', 'acct', 'owner']) {
    await assertFails(getDoc(doc(as(k), 'comms_log', 'x')), k + ' يقرأ comms_log');
    await assertFails(setDoc(doc(as(k), 'comms_log', 'y_' + k), { jobId: 'y', n: 1 }), k + ' يكتب comms_log');
    await assertFails(updateDoc(doc(as(k), 'comms_log', 'x'), { ok: 0 }), k + ' يعدّل comms_log');
    await assertFails(deleteDoc(doc(as(k), 'comms_log', 'x')), k + ' يحذف comms_log');
  }
});

test('v56.46 حجوزات البيع الآجل وسجل تفويضه للخادم وحده: لا قراءة ولا كتابة ولا حذف لعضو ولا لمدير', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { const d = ctx.firestore();
    await setDoc(doc(d, 'pos_credit', 'x'), { key: 'cust:c1', holds: '[]' }); await setDoc(doc(d, 'pos_credit_log', 'x'), { orderId: 'x', amount: 10 }); });
  for (const k of ['cash', 'bm', 'fin', 'acct', 'owner']) {
    for (const c of ['pos_credit', 'pos_credit_log']) {
      await assertFails(getDoc(doc(as(k), c, 'x')), k + ' يقرأ ' + c);
      await assertFails(setDoc(doc(as(k), c, 'y_' + k), { orderId: 'y', amount: 1 }), k + ' يكتب ' + c);
      await assertFails(updateDoc(doc(as(k), c, 'x'), { amount: 0 }), k + ' يعدّل ' + c);
      await assertFails(deleteDoc(doc(as(k), c, 'x')), k + ' يحذف ' + c);
    }
  }
});

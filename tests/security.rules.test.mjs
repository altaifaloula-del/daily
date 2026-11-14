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
  env = await initializeTestEnvironment({ projectId: 'security-test', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') } });
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

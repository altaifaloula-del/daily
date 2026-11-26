/**
 * v56.4 — MUKTASAB POS الدفعة 2a: قواعد سجلات فواتير نقطة البيع pos_orders على محاكي Firestore (docs/pos/POS_DATABASE_DESIGN.md).
 * يحل B10: الفاتورة لا تُعدَّل أرقامها ولا تُحذف، والكاشير لا يلغي ولا يرتجع، ولا كتابة في فترة مقفلة ولا لفرع آخر.
 */
import { test, before, after } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

let env;
const U = { owner: 'owner@test.com', view: 'view@test.com', cash: 'cash@test.com', bm: 'bm@test.com', bmB: 'bmb@test.com', acct: 'acct@test.com' };
const as = (k) => env.authenticatedContext('u-' + k, { email: U[k] }).firestore();
const HEX = 'c'.repeat(64);
const CV = 560300;
const po = (k, x = {}) => ({ branchId: 'A', date: '2026-11-26', kind: 'sale', status: 'paid', no: 'ف1-261126-AB-0001', dev: 'AB', total: 115, vat: 15, digest: HEX, data: '{"id":"x"}', by: U[k], at: serverTimestamp(), cv: CV, ...x });
const seedPo = (id, x = {}) => env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'pos_orders', id), { ...po('cash', x), at: Timestamp.now() }));
const voidOf = (k, x = {}) => ({ ...po('cash', x), status: 'void', voidData: '{"by":"bm","reason":"خطأ"}', by: U[k], at: serverTimestamp(), cv: CV });
let n = 0; const id = (p) => p + '_' + (++n);

before(async () => {
  env = await initializeTestEnvironment({ projectId: process.env.RULES_FILE ? 'pos-tenant-test' : 'pos-test', firestore: { rules: fs.readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'platform', 'admins'), { emails: [U.owner] });
    const m = (k, x) => setDoc(doc(d, 'members', U[k]), { email: U[k], active: true, ...x });
    await m('owner', {});
    await m('view', { scope: 'all', role: 'accountant_view' });
    await m('acct', { scope: 'all', role: 'accountant' });
    await m('cash', { scope: 'branch', branchId: 'A', branchIds: [], role: 'cashier' });
    await m('bm', { scope: 'branch', branchId: 'A', branchIds: [], role: 'branch_manager' });
    await m('bmB', { scope: 'branch', branchId: 'B', branchIds: [], role: 'branch_manager' });
    await setDoc(doc(d, 'platform', 'release'), { minCv: 400000, cutover: '2026-01-01', at: 1, by: U.owner });
    await setDoc(doc(d, 'fin_periods', 'locks'), { lockedTo: '2026-10-31', by: U.owner, at: Timestamp.now() });
  });
});
after(async () => { if (env) await env.cleanup(); });

test('POS-R1 الكاشير ينشئ فاتورة بيع مدفوعة لفرعه — لا لفرع آخر، ولا ملغاة، ولا مرتجعًا', async () => {
  await assertSucceeds(setDoc(doc(as('cash'), 'pos_orders', id('s')), po('cash')), 'بيع لفرعه');
  await assertFails(setDoc(doc(as('cash'), 'pos_orders', id('s')), po('cash', { branchId: 'B' })), 'فرع آخر');
  await assertFails(setDoc(doc(as('cash'), 'pos_orders', id('s')), po('cash', { status: 'void', voidData: '{}' })), 'لا ينشئ ملغاة');
  await assertFails(setDoc(doc(as('cash'), 'pos_orders', id('s')), po('cash', { kind: 'return', total: -57.5, vat: -7.5 })), 'المرتجع للإدارة');
  await assertSucceeds(setDoc(doc(as('bm'), 'pos_orders', id('r')), po('bm', { kind: 'return', total: -57.5, vat: -7.5 })), 'المدير يرتجع');
  await assertFails(setDoc(doc(as('view'), 'pos_orders', id('s')), po('view')), 'دور العرض لا يكتب');
  await assertFails(setDoc(doc(as('bmB'), 'pos_orders', id('s')), po('bmB')), 'مدير فرع B لا يكتب لفرع A');
});

test('POS-R2 الشكل يُفحص على الخادم: الكاتب والوقت والبصمة والحقول الزائدة', async () => {
  await assertFails(setDoc(doc(as('cash'), 'pos_orders', id('f')), po('cash', { by: U.bm })), 'باسم غيره');
  await assertFails(setDoc(doc(as('cash'), 'pos_orders', id('f')), po('cash', { at: Timestamp.fromDate(new Date('2026-11-20')) })), 'وقت من العميل');
  await assertFails(setDoc(doc(as('cash'), 'pos_orders', id('f')), po('cash', { digest: 'xyz' })), 'بصمة غير صالحة');
  await assertFails(setDoc(doc(as('cash'), 'pos_orders', id('f')), po('cash', { extra: 1 })), 'حقل زائد');
  await assertFails(setDoc(doc(as('cash'), 'pos_orders', id('f')), po('cash', { total: '115' })), 'المبلغ نص');
});

test('POS-R3 لا كتابة في فترة مقفلة — حتى من المدير', async () => {
  await assertFails(setDoc(doc(as('cash'), 'pos_orders', id('l')), po('cash', { date: '2026-10-31' })), 'الكاشير في أكتوبر المقفل');
  await assertFails(setDoc(doc(as('owner'), 'pos_orders', id('l')), po('owner', { date: '2026-10-15' })), 'ولا المدير');
  const old = id('l'); await seedPo(old, { date: '2026-10-20' });
  await assertFails(setDoc(doc(as('owner'), 'pos_orders', old), voidOf('owner', { date: '2026-10-20' })), 'ولا إلغاء فاتورة في فترة مقفلة');
});

test('POS-R4 أرقام الفاتورة لا تُعدَّل ولا تُحذف — والكاشير لا يلغي', async () => {
  const x = id('i'); await seedPo(x);
  await assertFails(setDoc(doc(as('cash'), 'pos_orders', x), po('cash', { total: 1, vat: 0 })), 'الكاشير يخفض المبلغ');
  await assertFails(setDoc(doc(as('bm'), 'pos_orders', x), po('bm', { total: 1, vat: 0 })), 'ولا المدير');
  await assertFails(setDoc(doc(as('owner'), 'pos_orders', x), po('owner', { data: '{"id":"y"}' })), 'ولا مسؤول النظام يغيّر البيانات');
  await assertFails(setDoc(doc(as('cash'), 'pos_orders', x), voidOf('cash')), 'الكاشير لا يلغي');
  await assertFails(deleteDoc(doc(as('cash'), 'pos_orders', x)), 'الكاشير لا يحذف');
  await assertFails(deleteDoc(doc(as('owner'), 'pos_orders', x)), 'ولا مسؤول النظام يحذف');
});

test('POS-R5 المدير يلغي فاتورة البيع بحقلي الحالة وبيانات الإلغاء فقط، مرة واحدة', async () => {
  const x = id('v'); await seedPo(x);
  await assertFails(setDoc(doc(as('bm'), 'pos_orders', x), { ...voidOf('bm'), total: 0 }), 'إلغاء مع تغيير المبلغ');
  { const { voidData, ...noData } = voidOf('bm'); await assertFails(setDoc(doc(as('bm'), 'pos_orders', x), noData), 'إلغاء بلا بيانات'); }
  await assertFails(setDoc(doc(as('bmB'), 'pos_orders', x), voidOf('bmB')), 'مدير فرع آخر');
  await assertSucceeds(setDoc(doc(as('bm'), 'pos_orders', x), voidOf('bm')), 'مدير الفرع يلغي');
  await assertFails(setDoc(doc(as('bm'), 'pos_orders', x), { ...voidOf('bm'), status: 'paid' }), 'لا عودة للمدفوعة');
  await assertFails(setDoc(doc(as('bm'), 'pos_orders', x), { ...voidOf('bm'), voidData: '{"by":"آخر"}' }), 'ولا إلغاء ثانٍ');
  const r = id('v'); await seedPo(r, { kind: 'return', total: -10, vat: -1.3 });
  await assertFails(setDoc(doc(as('bm'), 'pos_orders', r), voidOf('bm', { kind: 'return', total: -10, vat: -1.3 })), 'المرتجع لا يُلغى');
});

test('POS-R6 القراءة: الفرع ومركز المنشأة فقط', async () => {
  const x = id('q'); await seedPo(x);
  await assertSucceeds(getDoc(doc(as('cash'), 'pos_orders', x)), 'كاشير الفرع');
  await assertSucceeds(getDoc(doc(as('acct'), 'pos_orders', x)), 'محاسب المركز');
  await assertFails(getDoc(doc(as('bmB'), 'pos_orders', x)), 'مدير فرع آخر');
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'pos_orders', x)), 'زائر');
});

test('POS-R7 (v56.5) إصلاح سجل خاطئ: لمسؤول النظام وحده بسبب مكتوب، لنفس الفرع والنوع والتاريخ، ولا في فترة مقفلة', async () => {
  const x = id('fix'); await seedPo(x, { total: 1, vat: 0.13 });   // سجل خاطئ (مبلغ مختلف عن الفاتورة)
  const fixed = (k, x2 = {}) => ({ ...po(k), total: 115, vat: 15, repair: '{"reason":"سجل مخالف للفاتورة الأصلية"}', ...x2 });
  await assertFails(setDoc(doc(as('bm'), 'pos_orders', x), fixed('bm')), 'مدير الفرع لا يصلح');
  await assertFails(setDoc(doc(as('cash'), 'pos_orders', x), fixed('cash')), 'ولا الكاشير');
  await assertFails(setDoc(doc(as('owner'), 'pos_orders', x), { ...fixed('owner'), repair: 'قصير' }), 'بلا سبب كافٍ');
  await assertFails(setDoc(doc(as('owner'), 'pos_orders', x), fixed('owner', { branchId: 'B' })), 'لا نقل لفرع آخر');
  await assertFails(setDoc(doc(as('owner'), 'pos_orders', x), fixed('owner', { date: '2026-11-25' })), 'ولا تغيير التاريخ');
  await assertSucceeds(setDoc(doc(as('owner'), 'pos_orders', x), fixed('owner')), 'مسؤول النظام يصلح بسبب');
  await assertFails(setDoc(doc(as('owner'), 'pos_orders', x), fixed('owner')), 'إصلاح ثانٍ يحتاج سببًا جديدًا');
  await assertFails(deleteDoc(doc(as('owner'), 'pos_orders', x)), 'ولا حذف أبدًا');
  const old = id('fix'); await seedPo(old, { date: '2026-10-20' });
  await assertFails(setDoc(doc(as('owner'), 'pos_orders', old), fixed('owner', { date: '2026-10-20' })), 'لا إصلاح في فترة مقفلة');
  await assertFails(setDoc(doc(as('cash'), 'pos_orders', id('fix')), { ...po('cash'), repair: '{"reason":"إنشاء بحقل إصلاح"}' }), 'لا إنشاء بحقل إصلاح');
});

/**
 * v56.36 — الحماية على الخادم لسجلات دمج العملاء mkt_merges (تكميل ضابط التسويق M4) على محاكي Firestore.
 * يحل ملاحظة مراجعة الأمن: الضابط كان في الواجهة وحدها؛ الآن يمنع الخادم صاحب طلب التراجع من اعتماده أو رفضه، ويمنع التعديل والحذف.
 */
import { test, before, after } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

let env;
const U = { owner: 'owner@test.com', view: 'view@test.com', acct: 'acct@test.com', acct2: 'acct2@test.com', bm: 'bm@test.com' };
const as = (k) => env.authenticatedContext('u-' + k, { email: U[k] }).firestore();
const CV = 561700;
const rec = (k, x) => ({ reason: 'سبب', by: U[k], at: serverTimestamp(), cv: CV, ...x });
let n = 0; const id = (p) => p + '-' + (++n);
const put = (k, i, x) => setDoc(doc(as(k), 'mkt_merges', i), rec(k, x));
const merge = (k, i, pts = 50) => put(k, i, { kind: 'merge', ref: i, from: '500000001', to: '500000002', pts });

before(async () => {
  env = await initializeTestEnvironment({ projectId: process.env.RULES_FILE ? 'mkm-tenant-test' : 'mkm-test', firestore: { rules: fs.readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'platform', 'admins'), { emails: [U.owner] });
    const m = (k, x) => setDoc(doc(d, 'members', U[k]), { email: U[k], active: true, ...x });
    await m('owner', {});
    await m('view', { scope: 'all', role: 'accountant_view' });
    await m('acct', { scope: 'all', role: 'head_office' });
    await m('acct2', { scope: 'all', role: 'head_office' });
    await m('bm', { scope: 'branch', branchId: 'A', branchIds: [], role: 'branch_manager' });
    await setDoc(doc(d, 'platform', 'release'), { minCv: 400000, cutover: '2026-01-01', at: 1, by: U.owner });
  });
});
after(async () => { if (env) await env.cleanup(); });

test('MKM-1 الدمج: المركز يسجّله، والفرع ودور العرض لا يكتبان، ولا تعديل ولا حذف', async () => {
  const g = id('mg'); await assertSucceeds(merge('acct', g), 'المركز يسجّل دمجًا');
  await assertFails(merge('bm', id('mg')), 'مدير فرع');
  await assertFails(merge('view', id('mg')), 'دور العرض');
  await assertFails(setDoc(doc(as('acct'), 'mkt_merges', g), rec('acct', { kind: 'merge', ref: g, from: '500000001', to: '500000009', pts: 0 })), 'إعادة الكتابة');
  await assertFails(updateDoc(doc(as('owner'), 'mkt_merges', g), { pts: 0 }), 'ولا المسؤول يعدّل');
  await assertFails(deleteDoc(doc(as('owner'), 'mkt_merges', g)), 'ولا المسؤول يحذف');
});

test('MKM-2 الشكل: الكاتب والوقت من الخادم، والمرجع للدمج نفسه، والحقول الزائدة', async () => {
  await assertFails(put('acct', id('mg'), { kind: 'merge', ref: 'x', from: '500000001', to: '500000002', pts: 1 }), 'مرجع الدمج غير معرّفه');
  await assertFails(put('acct', id('mg'), { kind: 'merge', ref: 'mg-z', from: '500000001', to: '500000002', by: U.acct2 }), 'باسم غيره');
  const i = id('mg'); await assertFails(put('acct', i, { kind: 'merge', ref: i, from: '500000001', to: '500000002', at: Timestamp.fromDate(new Date('2026-01-01')) }), 'وقت من الجهاز');
  const j = id('mg'); await assertFails(put('acct', j, { kind: 'merge', ref: j, from: '500000001', to: '500000002', extra: 1 }), 'حقل زائد');
  const k = id('mg'); await assertFails(put('acct', k, { kind: 'other', ref: k }), 'نوع غير معروف');
  const l = id('mg'); await assertFails(put('acct', l, { kind: 'merge', ref: l, from: '500000001', to: '500000002', seed: true }), 'نسخ التاريخ لغير المسؤول');
});

test('MKM-3 فصل المهام على الخادم: صاحب الطلب لا يعتمد التراجع ولا يرفضه بنفسه', async () => {
  const g = id('mg'); await assertSucceeds(merge('acct', g, 80));
  const r = id('mg'); await assertSucceeds(put('acct', r, { kind: 'undoReq', ref: g }), 'طلب تراجع');
  await assertFails(put('acct', g + '-u', { kind: 'undo', ref: g, reqId: r }), 'صاحب الطلب يعتمد نفسه');
  await assertFails(put('acct', r + '-r', { kind: 'rej', ref: r }), 'صاحب الطلب يرفض نفسه');
  await assertFails(put('acct2', 'mg-nothing' + '-u', { kind: 'undo', ref: 'mg-nothing', reqId: r }), 'طلب لدمج آخر');
  await assertSucceeds(put('acct2', g + '-u', { kind: 'undo', ref: g, reqId: r }), 'شخص آخر يعتمد');
  const r2 = id('mg'); await assertSucceeds(put('acct2', r2, { kind: 'undoReq', ref: g }));
  await assertSucceeds(put('acct', r2 + '-r', { kind: 'rej', ref: r2 }), 'شخص آخر يرفض');
  await assertFails(put('acct', id('mg'), { kind: 'undoReq', ref: 'mg-missing' }), 'طلب لدمج غير موجود');
  await assertFails(put('acct2', g + '-r', { kind: 'rej', ref: g }), 'رفض ما ليس طلبًا');
});

test('MKM-4 التراجع بلا طلب: مسموح لدمج بلا نقاط فقط', async () => {
  const z = id('mg'); await assertSucceeds(merge('acct', z, 0));
  await assertSucceeds(put('acct', z + '-u', { kind: 'undo', ref: z }), 'دمج بلا نقاط');
  const p = id('mg'); await assertSucceeds(merge('acct', p, 40));
  await assertFails(put('acct', p + '-u', { kind: 'undo', ref: p }), 'دمج نقل نقاطًا بلا طلب');
  await assertFails(put('acct2', p + '-u', { kind: 'undo', ref: p }), 'ولا من غيره بلا طلب');
});

test('MKM-5 نسخ التاريخ: لمسؤول النظام وحده، ويحمل الكاتب الأصلي نصًا', async () => {
  const g = id('mg'); await assertSucceeds(put('owner', g, { kind: 'merge', ref: g, from: '500000001', to: '500000002', pts: 30, seed: true, origBy: 'a@x.com', origAt: '2026-10-01T10:00:00Z' }));
  const r = id('mg'); await assertSucceeds(put('owner', r, { kind: 'undoReq', ref: g, seed: true, origBy: 'a@x.com' }));
  await assertSucceeds(put('owner', id('mg'), { kind: 'undo', ref: g, reqId: r, seed: true, origBy: 'b@x.com' }), 'اعتماد تاريخي منسوخ');
  await assertFails(put('acct', id('mg'), { kind: 'undo', ref: g, seed: true }), 'غير المسؤول لا ينسخ');
});

test('MKM-7 الطلب المنسوخ من التاريخ: صاحبه الأصلي (origBy) لا يعتمده ولا يرفضه بعد نسخه', async () => {
  const g = id('mg'); await assertSucceeds(put('owner', g, { kind: 'merge', ref: g, from: '500000001', to: '500000002', pts: 30, seed: true, origBy: U.acct }));
  const r = id('mg'); await assertSucceeds(put('owner', r, { kind: 'undoReq', ref: g, seed: true, origBy: U.acct }));
  await assertFails(put('acct', g + '-u', { kind: 'undo', ref: g, reqId: r }), 'صاحبه الأصلي يعتمد');
  await assertFails(put('acct', r + '-r', { kind: 'rej', ref: r }), 'صاحبه الأصلي يرفض');
  await assertSucceeds(put('acct2', g + '-u', { kind: 'undo', ref: g, reqId: r }), 'غيره يعتمد');
});

test('MKM-8 القراءة تمر بفحص التحقق الثنائي حين تفرضه السياسة', async () => {
  const g = id('mg'); await assertSucceeds(merge('acct', g));
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'platform', 'security'), { roles: ['head_office'] }); });
  await assertFails(getDoc(doc(as('acct2'), 'mkt_merges', g)), 'دور مركزي بلا تحقق ثنائي');
  await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), 'platform', 'security')); });
});

test('MKM-9 (v56.39): معرّف القرار ثابت — لا يُحجز التراجع، وقرار واحد لكل طلب، وتراجع واحد لكل دمج', async () => {
  const g = id('mg'); await assertSucceeds(merge('acct', g, 20));
  await assertFails(put('acct', g + '-u', { kind: 'undoReq', ref: g }), 'حجز معرّف التراجع بطلب');
  await assertFails(put('acct', g + '-u', { kind: 'merge', ref: g + '-u', from: '500000001', to: '500000002', pts: 0 }), 'حجز معرّف التراجع بدمج');
  const r = id('mg'); await assertSucceeds(put('acct', r, { kind: 'undoReq', ref: g }));
  await assertFails(put('acct2', id('mg'), { kind: 'undo', ref: g, reqId: r }), 'تراجع بمعرّف عشوائي');
  await assertSucceeds(put('acct2', r + '-r', { kind: 'rej', ref: r }), 'رفض');
  await assertFails(put('acct', r + '-r', { kind: 'rej', ref: r }), 'رفض ثانٍ لنفس الطلب');
  const r2 = id('mg'); await assertSucceeds(put('acct', r2, { kind: 'undoReq', ref: g }));
  await assertSucceeds(put('acct2', g + '-u', { kind: 'undo', ref: g, reqId: r2 }), 'اعتماد طلب قائم');
  const r3 = id('mg'); await assertSucceeds(put('acct', r3, { kind: 'undoReq', ref: g }));
  await assertFails(put('owner', g + '-u', { kind: 'undo', ref: g, reqId: r3 }), 'تراجع ثانٍ لنفس الدمج');
  await assertFails(put('acct', r3 + '-x-r', { kind: 'undoReq', ref: g }), 'لاحقة الرفض محجوزة');
});

test('MKM-6 القراءة: المركز والمسؤول فقط', async () => {
  const g = id('mg'); await assertSucceeds(merge('acct', g));
  await assertSucceeds(getDoc(doc(as('acct2'), 'mkt_merges', g)));
  await assertSucceeds(getDoc(doc(as('owner'), 'mkt_merges', g)));
  await assertFails(getDoc(doc(as('bm'), 'mkt_merges', g)), 'الفرع لا يرى');
});

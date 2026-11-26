/**
 * v56.14 — MUKTASAB GROWTH الدفعة 2: قواعد سجلات الموافقة التسويقية mkt_consents وحركات الولاء loy_tx على محاكي Firestore.
 * يحل ملاحظة المراجعة الأمنية: موظف الفرع كان يستطيع تعديل موافقة أو حذف «إلغاء اشتراك» في مستند الفرع.
 */
import { test, before, after } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

let env;
const U = { owner: 'owner@test.com', view: 'view@test.com', cash: 'cash@test.com', bm: 'bm@test.com', bmB: 'bmb@test.com', acct: 'acct@test.com' };
const as = (k) => env.authenticatedContext('u-' + k, { email: U[k] }).firestore();
const CV = 561400;
const mc = (k, x = {}) => ({ phone: '500000001', status: 'in', ch: 'all', src: 'نقطة البيع', branchId: 'A', by: U[k], at: serverTimestamp(), cv: CV, ...x });
const ly = (k, x = {}) => ({ phone: '500000001', pts: 10, ord: 'ف1-0001', br: 'A', by: U[k], at: serverTimestamp(), cv: CV, ...x });
let n = 0; const id = (p) => p + '-' + (++n);

before(async () => {
  env = await initializeTestEnvironment({ projectId: process.env.RULES_FILE ? 'gr-tenant-test' : 'gr-test', firestore: { rules: fs.readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'platform', 'admins'), { emails: [U.owner] });
    const m = (k, x) => setDoc(doc(d, 'members', U[k]), { email: U[k], active: true, ...x });
    await m('owner', {});
    await m('view', { scope: 'all', role: 'accountant_view' });
    await m('acct', { scope: 'all', role: 'head_office' });
    await m('cash', { scope: 'branch', branchId: 'A', branchIds: [], role: 'cashier' });
    await m('bm', { scope: 'branch', branchId: 'A', branchIds: [], role: 'branch_manager' });
    await m('bmB', { scope: 'branch', branchId: 'B', branchIds: [], role: 'branch_manager' });
    await setDoc(doc(d, 'platform', 'release'), { minCv: 400000, cutover: '2026-01-01', at: 1, by: U.owner });
  });
});
after(async () => { if (env) await env.cleanup(); });

test('GR-1 الموافقة: موظف الفرع يسجّل لفرعه فقط، والمركز وحده للسجل المركزي، ودور العرض لا يكتب', async () => {
  await assertSucceeds(setDoc(doc(as('cash'), 'mkt_consents', id('c')), mc('cash')), 'الكاشير يسجّل موافقة لفرعه');
  await assertSucceeds(setDoc(doc(as('bm'), 'mkt_consents', id('c')), mc('bm', { status: 'out', ch: 'sms', note: 'طلب العميل' })), 'إلغاء اشتراك');
  await assertFails(setDoc(doc(as('bmB'), 'mkt_consents', id('c')), mc('bmB')), 'فرع آخر');
  await assertFails(setDoc(doc(as('bm'), 'mkt_consents', id('c')), mc('bm', { branchId: '' })), 'الفرع لا يكتب السجل المركزي');
  await assertSucceeds(setDoc(doc(as('acct'), 'mkt_consents', id('c')), mc('acct', { branchId: '' })), 'المركز يكتب المركزي');
  await assertFails(setDoc(doc(as('view'), 'mkt_consents', id('c')), mc('view', { branchId: '' })), 'دور العرض');
});

test('GR-2 الموافقة لا تُعدَّل ولا تُحذف أبدًا — حتى من مسؤول النظام', async () => {
  const x = id('c'); await assertSucceeds(setDoc(doc(as('bm'), 'mkt_consents', x), mc('bm', { status: 'out' })));
  await assertFails(setDoc(doc(as('bm'), 'mkt_consents', x), mc('bm', { status: 'in' })), 'قلب إلغاء الاشتراك إلى موافقة');
  await assertFails(updateDoc(doc(as('owner'), 'mkt_consents', x), { status: 'in' }), 'ولا المسؤول');
  await assertFails(deleteDoc(doc(as('bm'), 'mkt_consents', x)), 'لا حذف');
  await assertFails(deleteDoc(doc(as('owner'), 'mkt_consents', x)), 'ولا المسؤول يحذف');
});

test('GR-3 الشكل على الخادم: الكاتب والوقت والجوال والقناة والحقول الزائدة', async () => {
  await assertFails(setDoc(doc(as('bm'), 'mkt_consents', id('c')), mc('bm', { by: U.cash })), 'باسم غيره');
  await assertFails(setDoc(doc(as('bm'), 'mkt_consents', id('c')), mc('bm', { at: Timestamp.fromDate(new Date('2026-01-01')) })), 'وقت من الجهاز');
  await assertFails(setDoc(doc(as('bm'), 'mkt_consents', id('c')), mc('bm', { phone: '05abc' })), 'جوال غير صالح');
  await assertFails(setDoc(doc(as('bm'), 'mkt_consents', id('c')), mc('bm', { ch: 'fax' })), 'قناة غير معروفة');
  await assertFails(setDoc(doc(as('bm'), 'mkt_consents', id('c')), mc('bm', { extra: 1 })), 'حقل زائد');
});

test('GR-4 القراءة: الفرع يرى سجلاته فقط، والمركزي للمركز', async () => {
  const a = id('c'), z = id('c');
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'mkt_consents', a), { ...mc('bm'), at: Timestamp.now() }); await setDoc(doc(ctx.firestore(), 'mkt_consents', z), { ...mc('acct', { branchId: '' }), at: Timestamp.now() }); });
  await assertSucceeds(getDoc(doc(as('cash'), 'mkt_consents', a)));
  await assertFails(getDoc(doc(as('bmB'), 'mkt_consents', a)), 'فرع آخر');
  await assertFails(getDoc(doc(as('bm'), 'mkt_consents', z)), 'الفرع لا يرى المركزي');
  await assertSucceeds(getDoc(doc(as('acct'), 'mkt_consents', z)));
});

test('GR-5 حركة الولاء: إضافة فقط — لا تعديل للنقاط ولا حذف، والفرع لفرعه، والتعديلات اليدوية المركزية للمركز', async () => {
  const x = 'po-1:e'; await assertSucceeds(setDoc(doc(as('cash'), 'loy_tx', x), ly('cash')), 'كسب نقاط بيع الفرع');
  await assertFails(setDoc(doc(as('cash'), 'loy_tx', x), ly('cash', { pts: 1000 })), 'تعديل النقاط');
  await assertFails(deleteDoc(doc(as('owner'), 'loy_tx', x)), 'لا حذف');
  await assertFails(setDoc(doc(as('bmB'), 'loy_tx', id('t')), ly('bmB')), 'فرع آخر');
  await assertFails(setDoc(doc(as('bm'), 'loy_tx', id('t')), ly('bm', { br: '' })), 'الفرع لا يكتب حركة مركزية');
  await assertSucceeds(setDoc(doc(as('acct'), 'loy_tx', 'rw:' + id('t')), ly('acct', { br: '', pts: -200, ord: 'استبدال جائزة' })), 'المركز: استبدال');
  await assertFails(setDoc(doc(as('acct'), 'loy_tx', id('t')), ly('acct', { pts: 5000000 })), 'خارج الحد');
  await assertFails(setDoc(doc(as('acct'), 'loy_tx', id('t')), ly('acct', { pts: '10' })), 'النقاط نص');
  await assertFails(setDoc(doc(as('view'), 'loy_tx', id('t')), ly('view', { br: '' })), 'دور العرض');
  await assertSucceeds(getDoc(doc(as('bm'), 'loy_tx', x))); await assertFails(getDoc(doc(as('bmB'), 'loy_tx', x)), 'قراءة فرع آخر');
});

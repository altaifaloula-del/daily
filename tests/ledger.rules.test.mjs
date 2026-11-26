/**
 * v56.15 — MUKTASAB FINANCE D5: قواعد دفتر القيود المخزّن fin_ledger على محاكي Firestore.
 * بعد D5 الكتابة من الخادم وحده (server-ledger.js بحساب الخدمة): أي إنشاء أو تعديل أو حذف من المتصفح مرفوض — حتى للمدير
 * وحتى بقيد صحيح متوازن مع عدّاده؛ والقراءة للمدير والإدارة المركزية فقط. شروط D1 يطبّقها الخادم (tests/server-ledger.test.mjs).
 */
import { test, before, after } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';

let env;
const U = { owner: 'owner@test.com', acct: 'acct@test.com', cash: 'cash@test.com', view: 'view@test.com' };
const as = (k) => env.authenticatedContext('u-' + k, { email: U[k] }).firestore();
const HEX = 'd'.repeat(64);
const CV = 560900;
const ent = (k, seq, x = {}) => ({ no: 'JV-2026-' + String(seq).padStart(6, '0'), year: 2026, seq, date: '2026-11-20', src: 'rev:c' + seq, title: 'إيراد وردية',
  lines: '[["1101",115000,0,"A"],["4101",0,100000,"A"],["2301",0,15000,"A"]]', drH: 115000, crH: 115000, digest: HEX, ver: 1, status: 'posted', by: U[k], at: serverTimestamp(), cv: CV, ...x });
/** دفعة: القيد + العدّاد */
const post = (k, key, seq, x = {}, meta = {}) => { const d = as(k); const b = writeBatch(d);
  b.set(doc(d, 'fin_ledger', key), ent(k, seq, x)); b.set(doc(d, 'fin_ledger_meta', 'seq_' + ((x.year) || 2026)), { n: seq, last: key, ...meta }); return b.commit(); };

before(async () => {
  env = await initializeTestEnvironment({ projectId: process.env.RULES_FILE ? 'fl-tenant-test' : 'fl-test', firestore: { rules: fs.readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'platform', 'admins'), { emails: [U.owner] });
    const m = (k, x) => setDoc(doc(d, 'members', U[k]), { email: U[k], active: true, ...x });
    await m('owner', {});
    await m('acct', { scope: 'all', role: 'accountant' });
    await m('view', { scope: 'all', role: 'accountant_view' });
    await m('cash', { scope: 'branch', branchId: 'A', branchIds: [], role: 'cashier' });
    await setDoc(doc(d, 'platform', 'release'), { minCv: 400000, cutover: '2026-01-01', at: 1, by: U.owner });
    await setDoc(doc(d, 'fin_periods', 'locks'), { lockedTo: '2026-10-31', by: U.owner, at: Timestamp.now() });
  });
});
after(async () => { if (env) await env.cleanup(); });

test('FL-R1 لا كتابة من المتصفح: القيد الصحيح مع عدّاده مرفوض للمحاسب والمدير والكاشير', async () => {
  await assertFails(post('acct', 'rev_c1_v1', 1), 'المحاسب');
  await assertFails(post('owner', 'rev_c1_v1', 1), 'المدير');
  await assertFails(post('cash', 'rev_c1_v1', 1), 'الكاشير');
  await assertFails(setDoc(doc(as('owner'), 'fin_ledger', 'rev_c1_v1'), ent('owner', 1)), 'بلا عدّاد');
  await assertFails(setDoc(doc(as('owner'), 'fin_ledger_meta', 'seq_2026'), { n: 1, last: 'rev_c1_v1' }), 'العدّاد');
});

test('FL-R2 ما كتبه الخادم لا يُعدَّل ولا يُعكس ولا يُحذف من المتصفح', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { const d = ctx.firestore();
    await setDoc(doc(d, 'fin_ledger', 'rev_c1_v1'), { ...ent('acct', 1), at: Timestamp.now(), via: 'server' });
    await setDoc(doc(d, 'fin_ledger_meta', 'seq_2026'), { n: 1, last: 'rev_c1_v1' }); });
  await assertFails(updateDoc(doc(as('owner'), 'fin_ledger', 'rev_c1_v1'), { lines: '[]' }), 'السطور');
  await assertFails(updateDoc(doc(as('owner'), 'fin_ledger', 'rev_c1_v1'), { status: 'reversed', reversedBy: 'x' }), 'العكس');
  await assertFails(deleteDoc(doc(as('owner'), 'fin_ledger', 'rev_c1_v1')), 'الحذف');
  await assertFails(updateDoc(doc(as('owner'), 'fin_ledger_meta', 'seq_2026'), { n: 2 }), 'العدّاد');
  await assertFails(deleteDoc(doc(as('owner'), 'fin_ledger_meta', 'seq_2026')), 'حذف العدّاد');
});

test('FL-R6 القراءة للمدير والإدارة المركزية فقط', async () => {
  const { getDoc } = await import('firebase/firestore');
  await assertSucceeds(getDoc(doc(as('owner'), 'fin_ledger', 'rev_c1_v1')));
  await assertSucceeds(getDoc(doc(as('acct'), 'fin_ledger', 'rev_c1_v1')));
  await assertFails(getDoc(doc(as('cash'), 'fin_ledger', 'rev_c1_v1')));
});

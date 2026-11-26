/**
 * v56.9 — MUKTASAB FINANCE D1: قواعد دفتر القيود المخزّن fin_ledger على محاكي Firestore.
 * القيد يُنشأ مع العدّاد في الدفعة نفسها (+1 بالضبط)، متوازن بالهللات، لا يُعدَّل محتواه ولا يُحذف، ولا يُكتب في فترة مقفلة
 * إلا بنافذة الترحيل للمدير؛ والتغيير الوحيد «معكوس» مع قيد عكسي يشير إليه في فترة مفتوحة.
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

test('FL-R1 المحاسب يرحّل القيد مع العدّاد +1 — ولا يرحّل بلا عدّاد أو بتسلسل خاطئ، والكاشير ودور العرض لا يرحّلان', async () => {
  await assertSucceeds(post('acct', 'rev_c1_v1', 1), 'الأول: 1');
  await assertSucceeds(post('acct', 'rev_c2_v1', 2), 'الثاني: 2');
  await assertFails(setDoc(doc(as('acct'), 'fin_ledger', 'rev_c3_v1'), ent('acct', 3)), 'بلا عدّاد');
  await assertFails(post('acct', 'rev_c4_v1', 4), 'قفز تسلسل');
  await assertFails(post('acct', 'rev_c2b_v1', 2), 'تكرار رقم');
  await assertFails(post('cash', 'rev_c3_v1', 3), 'الكاشير');
  await assertFails(post('view', 'rev_c3_v1', 3), 'دور العرض');
  await assertSucceeds(post('acct', 'rev_c3_v1', 3), 'التسلسل يكمل');
});

test('FL-R2 الشكل على الخادم: التوازن بالهللات، الرقم يطابق السنة والتسلسل، والكاتب والوقت', async () => {
  await assertFails(post('acct', 'bad1_v1', 4, { crH: 114999 }), 'غير متوازن');
  await assertFails(post('acct', 'bad2_v1', 4, { drH: 0, crH: 0 }), 'صفري');
  await assertFails(post('acct', 'bad3_v1', 4, { drH: 1150.5, crH: 1150.5 }), 'ليس هللات صحيحة');
  await assertFails(post('acct', 'bad4_v1', 4, { no: 'JV-2026-000005' }), 'الرقم لا يطابق التسلسل');
  await assertFails(post('acct', 'bad5_v1', 4, { no: 'JV-2025-000004' }), 'الرقم لسنة أخرى');
  await assertFails(post('acct', 'bad6_v1', 4, { by: U.owner }), 'باسم غيره');
  await assertFails(post('acct', 'bad7_v1', 4, { at: Timestamp.fromDate(new Date('2026-11-01')) }), 'وقت من العميل');
  await assertFails(post('acct', 'bad8_v1', 4, { extra: 1 }), 'حقل زائد');
  await assertFails(post('acct', 'bad9_v1', 4, { status: 'reversed' }), 'لا يُنشأ معكوسًا');
});

test('FL-R3 لا تعديل ولا حذف: السطور والمبلغ والرقم ثابتة — حتى للمدير', async () => {
  await assertFails(updateDoc(doc(as('owner'), 'fin_ledger', 'rev_c1_v1'), { lines: '[]' }), 'السطور');
  await assertFails(updateDoc(doc(as('owner'), 'fin_ledger', 'rev_c1_v1'), { drH: 1, crH: 1 }), 'المبلغ');
  await assertFails(updateDoc(doc(as('owner'), 'fin_ledger', 'rev_c1_v1'), { status: 'reversed' }), 'معكوس بلا قيد عكسي');
  await assertFails(deleteDoc(doc(as('owner'), 'fin_ledger', 'rev_c1_v1')), 'حذف');
  await assertFails(setDoc(doc(as('owner'), 'fin_ledger_meta', 'seq_2026'), { n: 1, last: 'rev_c1_v1' }), 'إنقاص العدّاد');
  await assertFails(deleteDoc(doc(as('owner'), 'fin_ledger_meta', 'seq_2026')), 'حذف العدّاد');
});

test('FL-R4 الفترة المقفلة: ممنوعة إلا بنافذة الترحيل للمدير وبعلامة legacy', async () => {
  await assertFails(post('acct', 'old1_v1', 4, { date: '2026-10-15' }), 'المحاسب في أكتوبر المقفل');
  await assertFails(post('owner', 'old1_v1', 4, { date: '2026-10-15' }), 'المدير بلا نافذة');
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'fin_periods', 'migration'), { open: true, until: Timestamp.fromDate(new Date(Date.now() + 3600e3)), by: U.owner }));
  await assertFails(post('owner', 'old1_v1', 4, { date: '2026-10-15' }), 'بلا علامة legacy');
  await assertFails(post('acct', 'old1_v1', 4, { date: '2026-10-15', legacy: true }), 'المحاسب لا يرحّل التاريخ');
  await assertSucceeds(post('owner', 'old1_v1', 4, { date: '2026-10-15', legacy: true }), 'المدير في النافذة');
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'fin_periods', 'migration'), { open: false, until: Timestamp.now(), by: U.owner }));
});

test('FL-R5 العكس: القيد الأصلي «معكوس» مع قيد عكسي جديد يشير إليه في الدفعة نفسها — في فترة مفتوحة فقط', async () => {
  const d = as('acct'); const b = writeBatch(d);
  b.update(doc(d, 'fin_ledger', 'rev_c2_v1'), { status: 'reversed', reversedBy: 'rev_c2_r1' });
  b.set(doc(d, 'fin_ledger', 'rev_c2_r1'), ent('acct', 5, { src: 'rev:c2', reversalOf: 'rev_c2_v1', lines: '[["1101",0,115000,"A"],["4101",100000,0,"A"],["2301",15000,0,"A"]]' }));
  b.set(doc(d, 'fin_ledger_meta', 'seq_2026'), { n: 5, last: 'rev_c2_r1' });
  await assertSucceeds(b.commit(), 'عكس في فترة مفتوحة');
  const d2 = as('acct'); const b2 = writeBatch(d2);
  b2.update(doc(d2, 'fin_ledger', 'rev_c3_v1'), { status: 'reversed', reversedBy: 'rev_c1_v1' });   // يشير إلى قيد ليس عكسًا له
  await assertFails(b2.commit(), 'رابط لقيد لا يعكسه');
  const d3 = as('owner'); const b3 = writeBatch(d3);
  b3.update(doc(d3, 'fin_ledger', 'old1_v1'), { status: 'reversed', reversedBy: 'old1_r1' });
  b3.set(doc(d3, 'fin_ledger', 'old1_r1'), ent('owner', 6, { src: 'rev:old1', reversalOf: 'old1_v1' }));
  b3.set(doc(d3, 'fin_ledger_meta', 'seq_2026'), { n: 6, last: 'old1_r1' });
  await assertFails(b3.commit(), 'قرار المالك: لا عكس لقيد في فترة مقفلة');
});

test('FL-R6 القراءة للمدير والإدارة المركزية فقط', async () => {
  const { getDoc } = await import('firebase/firestore');
  await assertSucceeds(getDoc(doc(as('owner'), 'fin_ledger', 'rev_c1_v1')));
  await assertSucceeds(getDoc(doc(as('acct'), 'fin_ledger', 'rev_c1_v1')));
  await assertFails(getDoc(doc(as('cash'), 'fin_ledger', 'rev_c1_v1')));
});

/**
 * v56.45 — الدفعة 11: T1 (النقد المسلَّم قبل اعتماد أمر الصرف) وT7 (مراجعة الأوامر الماضية المكررة مع شاشاتها).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const base = { company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا', isActive: true }], taxCfg: { enabled: false } };
const org = { ...base, dsRoute: { ranges: [{ from: '2026-12-01' }] }, dsPre: { ranges: [{ from: '2026-12-01' }] } };
const ds = (id, date, category, amount, extra) => ({ id, date, category, amount, beneficiary: 'جهة', method: 'cash', by: 'أ', ...(extra || {}) });
const ent = (A, pre, id) => A.entries.find(e => e.id === pre + id);
const lines = (e) => e.lines.map(l => l.code + ':' + l.debit + '/' + l.credit).join(',');
const bal = (A, c) => Math.round(A.entries.reduce((t, e) => t + e.lines.filter(l => l.code === c).reduce((a, l) => a + l.debit - l.credit, 0), 0) * 100) / 100;

test('T1: الإعداد مطفأ ⇒ لا حساب 1402 ولا قيد تسليم، والأمر المعلّق بلا أثر كما كان', () => {
  const o = { ...base, dsRoute: org.dsRoute };
  const A = E.buildAccounting(o, { disbursements: [ds('a', '2026-12-02', 'صيانة وتشغيل', 300, { status: 'pending', cashAt: '2026-12-02' })] });
  assert.equal(ent(A, 'dsp:', 'a'), undefined); assert.equal(ent(A, 'dis:', 'a'), undefined);
  assert.equal(E.dsHanded(o, { date: '2026-12-02', cashAt: '2026-12-02' }), false);
  assert.ok(!E.buildAccounting(base, { disbursements: [] }).accounts.some(a => a.code === '1402'));
});

test('T1: معلّق سُلِّم نقده ⇒ مدين 1402 / دائن الخزينة بتاريخ التسليم؛ الاعتماد يُقفل 1402 ولا يحرّك النقد مرة ثانية', () => {
  const x = ds('a', '2026-12-02', 'صيانة وتشغيل', 300, { status: 'pending', cashAt: '2026-12-02' });
  let A = E.buildAccounting(org, { disbursements: [x] });
  assert.equal(lines(ent(A, 'dsp:', 'a')), '1402:300/0,1101:0/300'); assert.equal(ent(A, 'dsp:', 'a').date, '2026-12-02');
  assert.equal(bal(A, '1101'), -300); assert.equal(bal(A, '1402'), 300);
  A = E.buildAccounting(org, { disbursements: [{ ...x, status: 'posted', postDate: '2026-12-02', lateAppr: true }] });
  assert.equal(lines(ent(A, 'dis:', 'a')), '5901:300/0,1402:0/300');
  assert.equal(bal(A, '1101'), -300, 'النقد خرج مرة واحدة'); assert.equal(bal(A, '1402'), 0); assert.equal(bal(A, '5901'), 300);
  assert.deepEqual(E.dsCashMoves(org, { ...x, status: 'posted', postDate: '2026-12-05' }), [{ date: '2026-12-02', amt: -300, k: 'out' }]);
});

test('T1: الرفض بعد التسليم يُبقي 1402 حتى الاسترداد، والإقفال يُمنع حتى الاسترداد أو الاعتماد', () => {
  const x = ds('a', '2026-12-02', 'صيانة وتشغيل', 300, { status: 'rejected', cashAt: '2026-12-02' });
  let A = E.buildAccounting(org, { disbursements: [x] });
  assert.equal(bal(A, '1402'), 300); assert.equal(ent(A, 'dis:', 'a'), undefined);
  let ck = E.closeAutoChecks(A, { disbursements: [x] }, '2026-12', org); assert.equal(ck.find(c => c.k === 'dsunrec').ok, false);
  const y = { ...x, recAt: '2026-12-05' }; A = E.buildAccounting(org, { disbursements: [y] });
  assert.equal(lines(ent(A, 'dsr:', 'a')), '1101:300/0,1402:0/300'); assert.equal(bal(A, '1402'), 0); assert.equal(bal(A, '1101'), 0);
  ck = E.closeAutoChecks(A, { disbursements: [y] }, '2026-12', org); assert.equal(ck.find(c => c.k === 'dsunrec'), undefined);
  // معلّق سُلِّم نقده في الشهر وتاريخ أمره بعده يمنع الإقفال أيضًا
  const p = ds('b', '2027-01-03', 'صيانة وتشغيل', 50, { status: 'pending', cashAt: '2026-12-30' });
  ck = E.closeAutoChecks(E.buildAccounting(org, { disbursements: [p] }), { disbursements: [p] }, '2026-12', org); assert.equal(ck.find(c => c.k === 'pdocs').ok, false);
});

test('T1: التحقق من التسجيل — معلّق فقط، مرة واحدة، لا مستقبل ولا خارج النطاق ولا فترة مقفلة؛ وبالبنك يُقفل 1402 على البنك', () => {
  const x = ds('a', '2026-12-02', 'صيانة وتشغيل', 300, { status: 'pending' });
  assert.equal(E.dsHandCheck(org, x, '2026-12-03', '2026-12-10'), '');
  assert.match(E.dsHandCheck(org, { ...x, status: 'posted' }, '2026-12-03', '2026-12-10'), /بانتظار الاعتماد/);
  assert.match(E.dsHandCheck(org, { ...x, cashAt: '2026-12-02' }, '2026-12-03', '2026-12-10'), /سابقًا/);
  assert.match(E.dsHandCheck(org, x, '2026-12-11', '2026-12-10'), /المستقبل/);
  assert.match(E.dsHandCheck(org, x, '2026-11-30', '2026-12-10'), /خارج نطاق/);
  assert.match(E.dsHandCheck({ ...org, periodLocks: { lockedThrough: '2026-12' } }, x, '2026-12-03', '2026-12-10'), /مقفل/);
  const b = ds('c', '2026-12-02', 'صيانة وتشغيل', 80, { status: 'pending', method: 'bank_transfer', fundAcc: '1201', cashAt: '2026-12-02' });
  const A = E.buildAccounting(org, { disbursements: [b] }); assert.equal(lines(ent(A, 'dsp:', 'c')), '1402:80/0,1201:0/80');
  assert.deepEqual(E.dsCashMoves(org, b), [], 'البنك لا يمس نقد الخزينة');
  assert.equal(E.ppAssetOk ? E.ppAssetOk('1402', A) : false, false, '1402 لا يُختار أصلًا مدفوعًا مقدمًا');
});

test('T7: مراجعة التكرار — مطابقة بالمبلغ والالتزام خلال 31 يومًا، وقيد التصحيح يُعلِّم الأمر', () => {
  const o = { ...base };
  const ops = { disbursements: [ds('s', '2026-10-05', 'سداد موردين', 1000), ds('v', '2026-10-20', 'ضريبة القيمة المضافة', 700), ds('m', '2026-10-21', 'صيانة وتشغيل', 90)],
    journalManual: [{ id: 'j1', date: '2026-10-25', status: 'posted', title: 'سداد ضريبة', lines: [{ code: '2302', debit: 700, credit: 0 }, { code: '1201', debit: 0, credit: 700 }] }] };
  let R = E.dsDupScan(E.buildAccounting(o, ops), ops, o);
  assert.deepEqual(R.map(r => r.x.id), ['s', 'v'], 'البنود الثلاثة فقط');
  assert.equal(R.find(r => r.x.id === 's').matches.length, 0); assert.equal(R.find(r => r.x.id === 'v').matches.length, 1);
  assert.equal(R.find(r => r.x.id === 'v').fund, '1101');
  const ops2 = { ...ops, journalManual: [...ops.journalManual, { id: 'j2', date: '2026-11-27', status: 'pending', dsDup: 'v', lines: [{ code: '1101', debit: 700, credit: 0 }, { code: '5901', debit: 0, credit: 700 }] }] };
  R = E.dsDupScan(E.buildAccounting(o, ops2), ops2, o); assert.equal(R.find(r => r.x.id === 'v').fix.id, 'j2');
  const ops3 = { ...ops, journalManual: [...ops.journalManual, { id: 'j3', status: 'rejected', dsDup: 'v', lines: [] }] };
  assert.equal(E.dsDupScan(E.buildAccounting(o, ops3), ops3, o).find(r => r.x.id === 'v').fix, null, 'المرفوض لا يُعد تصحيحًا');
});

/**
 * v56.48 — توزيع الإهلاك وهبوط القيمة على الفروع (قرار المجلس بتفويض المالك؛ معطّل افتراضيًا).
 * أرقام وهمية: أصل فرع ب1 تكلفته 12000 على سنة (1000 شهريًا)، وأصل بلا فرع 6000 على سنة (500 شهريًا) — إهلاك يناير–ديسمبر 2025.
 */
import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const aB = { id: 'a1', name: 'فرن', cost: 12000, buyDate: '2024-12-15', lifeYears: 1, fund: '1201', branchId: 'b1' };
const aC = { id: 'a0', name: 'سيارة', cost: 6000, buyDate: '2024-12-15', lifeYears: 1, fund: '1201' };
const base = { company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'فرع أ', isActive: true }], taxCfg: { enabled: false }, assets: [aB, aC],
  customAccounts: [{ code: '1792', name: 'مجمع خسائر الهبوط', kind: 'asset' }, { code: '5806', name: 'خسارة هبوط قيمة الأصول', kind: 'exp' }], impair: { on: true, lossAcc: '5806', accAcc: '1792' } };
const on = (o, ranges) => ({ ...o, depBranch: { ranges } });
const deps = (A) => A.entries.filter(e => /^dep:/.test(e.id)).sort((x, y) => x.id.localeCompare(y.id));
const tot = (es, code) => Math.round(es.reduce((t, e) => t + e.lines.filter(l => l.code === code).reduce((a, l) => a + l.debit - l.credit, 0), 0) * 100) / 100;
const months = Array.from({ length: 12 }, (_, i) => '2025-' + String(i + 1).padStart(2, '0'));
const imp = (id, date) => ({ id, no: 'IMP-' + id, kind: 'imp', assetId: 'a1', amount: 600, date, reason: 'تلف', status: 'approved', by: 'أحمد', byId: 'u1', lossAcc: '5806', accAcc: '1792' });

test('بلا تفعيل: قيد إهلاك واحد لكل شهر على المركز الرئيسي كما كان حرفيًا، وبصمة الإقفال لا تتغير', () => {
  const A = E.buildAccounting(base, {}); const D = deps(A);
  assert.deepEqual(D.map(e => e.id), months.map(m => 'dep:' + m));
  D.forEach(e => { assert.equal(e.branchId, undefined); assert.equal(e.title, 'إهلاك شهر ' + e.date.slice(0, 7) + ' (قسط ثابت — كل الأصول)'); assert.equal(e.ref, 'dep-' + e.date.slice(0, 7));
    assert.deepEqual(e.lines.map(l => [l.code, l.debit, l.credit]), [['5701', 1500, 0], ['1791', 0, 1500]]); });
  // إعداد فارغ أو نطاق مستقبلي ⇒ القيود كلها كما هي حرفيًا
  assert.equal(JSON.stringify(E.buildAccounting(on(base, []), {}).entries), JSON.stringify(A.entries));
  assert.equal(JSON.stringify(E.buildAccounting(on(base, [{ from: '2099-01' }]), {}).entries), JSON.stringify(A.entries));
  const lk = { ...base, periodLocks: { lockedThrough: '2025-05' } };
  assert.equal(E.lockedLedgerSig(lk, {}, '2025-05'), E.lockedLedgerSig(on(lk, [{ from: '2025-06' }]), {}, '2025-05'), 'نطاق بعد الإقفال لا يمس بصمة الأشهر المقفلة');
  assert.ok(E.lockedLedgerSig(lk, {}, '2025-05').length > 0);
});

test('مع التفعيل من 2025-06: قيدان لكل شهر (المركز 500 + الفرع 1000) والإجمالي مطابق حرفيًا؛ وما قبل النطاق كما كان', () => {
  const A0 = E.buildAccounting(base, {}), A = E.buildAccounting(on(base, [{ from: '2025-06', at: 'x' }]), {});
  const D = deps(A);
  months.forEach(m => { const c = D.find(e => e.id === 'dep:' + m), b = D.find(e => e.id === 'dep:' + m + ':b1');
    if (m < '2025-06') { assert.deepEqual(c, deps(A0).find(e => e.id === 'dep:' + m), 'شهر قبل النطاق كما كان'); assert.equal(b, undefined); return; }
    assert.deepEqual(c.lines.map(l => [l.code, l.debit, l.credit]), [['5701', 500, 0], ['1791', 0, 500]]); assert.equal(c.branchId, undefined);
    assert.equal(c.title, 'إهلاك شهر ' + m + ' (قسط ثابت — أصول المركز الرئيسي)');
    assert.deepEqual(b.lines.map(l => [l.code, l.debit, l.credit]), [['5701', 1000, 0], ['1791', 0, 1000]]); assert.equal(b.branchId, 'b1'); assert.equal(b.date, m + '-28');
    assert.equal(E.flGroupOf(b.id), 4, 'مجموعة الأصول في الدفتر المخزّن'); });
  assert.equal(tot(D, '5701'), tot(deps(A0), '5701')); assert.equal(tot(D, '5701'), 18000); assert.equal(tot(D, '1791'), -18000);
  months.forEach(m => assert.equal(tot(D.filter(e => e.date.startsWith(m)), '5701'), 1500, 'إجمالي ' + m));
  // قائمة الدخل حسب الفرع تقرأ branchId على القيد: الفرع 7 أشهر × 1000، والمركز 5 × 1500 + 7 × 500
  assert.equal(E.glLedger(A, '5701', { bf: 'b1' }).debit, 7000); assert.equal(E.glLedger(A, '5701', { bf: 'central' }).debit, 11000);
  assert.equal(E.glLedger(A0, '5701', { bf: 'b1' }).debit, 0);
  const row = A.assetRows.find(r => r.id === 'a1'); assert.equal(row.accum, 12000);
});

test('نطاق مغلق: الإيقاف يعيد ما بعده إلى المركز الرئيسي، والأصل كله في الفرع لا يُنشئ قيد مركز صفري', () => {
  const A = E.buildAccounting(on({ ...base, assets: [aB] }, [{ from: '2025-03', to: '2025-04' }]), {}); const D = deps(A);
  assert.deepEqual(D.filter(e => e.date.startsWith('2025-03') || e.date.startsWith('2025-04')).map(e => e.id), ['dep:2025-03:b1', 'dep:2025-04:b1']);
  assert.deepEqual(D.filter(e => e.date.startsWith('2025-05')).map(e => [e.id, e.branchId]), [['dep:2025-05', undefined]]);
  assert.equal(tot(D, '5701'), 12000);
});

test('الهبوط والاستبعاد داخل النطاق يحملان فرع الأصل، وقبله على المركز الرئيسي؛ الميزان متوازن', () => {
  const org = on({ ...base, assets: [{ ...aB, disposedDate: '2025-09-15', salePrice: 1000, saleFund: '1201' }, aC] }, [{ from: '2025-06' }]);
  const ops = { impairDocs: [imp('i1', '2025-04-10'), imp('i2', '2025-07-10')] };
  const A = E.buildAccounting(org, ops);
  assert.equal(A.entries.find(e => e.id === 'imp:i1').branchId, undefined, 'قبل النطاق');
  assert.equal(A.entries.find(e => e.id === 'imp:i2').branchId, 'b1');
  assert.equal(A.entries.find(e => e.id === 'disp:a1').branchId, 'b1');
  const Aoff = E.buildAccounting({ ...org, depBranch: undefined }, ops);
  assert.equal(Aoff.entries.find(e => e.id === 'imp:i2').branchId, undefined); assert.equal(Aoff.entries.find(e => e.id === 'disp:a1').branchId, undefined);
  ['5701', '1791', '1792', '5806', '1701', '1201', '4201', '5801'].forEach(c => assert.equal(tot(A.entries, c), tot(Aoff.entries, c), 'الرصيد نفسه ' + c));
  assert.ok(A.entries.every(e => e.balanced), 'كل قيد متوازن');
  const dr = A.entries.reduce((t, e) => t + e.debit, 0), cr = A.entries.reduce((t, e) => t + e.credit, 0); assert.ok(Math.abs(dr - cr) < 0.01, 'الميزان متوازن');
  assert.deepEqual(deps(A).filter(e => e.date >= '2025-09').map(e => e.id), ['dep:2025-09', 'dep:2025-10', 'dep:2025-11', 'dep:2025-12'], 'لا إهلاك للفرع في شهر الاستبعاد وما بعده (المركز فقط)');
});

test('التفعيل والإيقاف (depBrToggle): من الشهر الجاري غير المقفل، وسجل لا يُمحى', () => {
  assert.deepEqual(E.depBrToggle(base, '2026-11', 't1'), { ranges: [{ from: '2026-11', at: 't1' }], on: true });
  assert.match(E.depBrToggle({ ...base, periodLocks: { lockedThrough: '2026-11' } }, '2026-11', 't').err, /مقفل/);
  const o1 = on(base, [{ from: '2026-11', at: 't1' }]); const off = E.depBrToggle(o1, '2026-12', 't2');
  assert.deepEqual(off, { ranges: [{ from: '2026-11', at: 't1', to: '2026-12', offAt: 't2' }], on: false });
  assert.match(E.depBrToggle(on(base, off.ranges), '2026-12', 't3').err, /الشهر التالي/);
  assert.deepEqual(E.depBrToggle(on(base, off.ranges), '2027-01', 't3').ranges.length, 2);
  assert.equal(E.depBrFrom(o1), '2026-11'); assert.equal(E.depBrFrom(base), '');
  assert.equal(E.depBrAt(o1, '2026-10-31'), false); assert.equal(E.depBrAt(o1, '2026-11-28'), true);
  assert.equal(E.depBrOf(o1, aB, '2026-11'), 'b1'); assert.equal(E.depBrOf(o1, aC, '2026-11'), ''); assert.equal(E.depBrOf(base, aB, '2026-11'), '');
  assert.deepEqual(E.depBrRanges({ depBranch: { ranges: [{ from: 'x' }, null, { from: '2026-01' }] } }), [{ from: '2026-01' }]);
});

test('قرار المالك — نقل الأصل بين الفروع «من شهر النقل فصاعدًا»: نقل في 2027-03 ⇒ فبراير على القديم ومارس على الجديد، والإجمالي مطابق', () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2027-06-15T10:00:00') });
  try {
    const a = { id: 'a9', name: 'ثلاجة', cost: 12000, buyDate: '2026-12-15', lifeYears: 1, fund: '1201', branchId: 'b1' };   // 1000 شهريًا من يناير 2027
    const org = on({ ...base, branches: [...base.branches, { id: 'b2', name: 'فرع ب', isActive: true }], assets: [a] }, [{ from: '2027-01' }]);
    const before0 = E.buildAccounting(org, {});
    // بلا سجل: كما كان (المركز الحالي لكل أشهر النطاق)
    assert.equal(E.assetBrAt(a, '2027-02'), 'b1'); assert.equal(E.assetBrAt({ ...a, branchId: undefined }, '2027-02'), '');
    const s = E.assetBrSave(org, a, 'b2', '2027-03');
    assert.deepEqual(s, { brHist: [{ from: '2026-12', branchId: 'b1' }, { from: '2027-03', branchId: 'b2' }] }, 'يُحفظ القديم من شهر الشراء ثم النقل');
    const moved = { ...a, branchId: 'b2', brHist: s.brHist }; const A = E.buildAccounting({ ...org, assets: [moved] }, {}); const D = deps(A);
    assert.deepEqual(D.filter(e => e.date < '2027-07').map(e => [e.id, e.branchId]),
      [['dep:2027-01:b1', 'b1'], ['dep:2027-02:b1', 'b1'], ['dep:2027-03:b2', 'b2'], ['dep:2027-04:b2', 'b2'], ['dep:2027-05:b2', 'b2'], ['dep:2027-06:b2', 'b2']]);
    assert.deepEqual(deps(before0).filter(e => e.date < '2027-03').map(e => JSON.stringify(e)), D.filter(e => e.date < '2027-03').map(e => JSON.stringify(e)), 'الأشهر السابقة لا تتغير');
    assert.equal(tot(D, '5701'), tot(deps(before0), '5701')); assert.equal(tot(D, '5701'), 6000);
    // النقل إلى المركز الرئيسي، وتغيير ثانٍ في الشهر نفسه يستبدل إدخاله
    const s2 = E.assetBrSave(org, moved, '', '2027-03'); assert.deepEqual(s2.brHist, [{ from: '2026-12', branchId: 'b1' }, { from: '2027-03', branchId: '' }]);
    assert.deepEqual(deps(E.buildAccounting({ ...org, assets: [{ ...a, branchId: undefined, brHist: s2.brHist }] }, {})).filter(e => e.date < '2027-04').map(e => e.id), ['dep:2027-01:b1', 'dep:2027-02:b1', 'dep:2027-03']);
    // الهبوط يحمل مركز شهر مستنده
    const Ai = E.buildAccounting({ ...org, assets: [moved] }, { impairDocs: [{ ...imp('j1', '2027-02-10'), assetId: 'a9' }, { ...imp('j2', '2027-04-10'), assetId: 'a9' }] });
    assert.equal(Ai.entries.find(e => e.id === 'imp:j1').branchId, 'b1'); assert.equal(Ai.entries.find(e => e.id === 'imp:j2').branchId, 'b2');
    // قيود: شهر مقفل، وبلا تغيير، وبلا توزيع ولا سجل ⇒ لا سجل (كما كان)
    assert.match(E.assetBrSave({ ...org, periodLocks: { lockedThrough: '2027-03' } }, a, 'b2', '2027-03').err, /مقفل/);
    assert.deepEqual(E.assetBrSave(org, a, 'b1', '2027-03'), {}); assert.deepEqual(E.assetBrSave(base, a, 'b2', '2027-03'), {}); assert.deepEqual(E.assetBrSave(org, null, 'b2', '2027-03'), {});
    assert.ok(A.entries.every(e => e.balanced));
  } finally { mock.timers.reset(); }
});

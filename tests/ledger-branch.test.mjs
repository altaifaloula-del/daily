/**
 * v56.49 — الفرع في دفتر القيود المخزّن، وفرع قيد شراء الأصل ast: داخل نطاق توزيع الإهلاك.
 * الفرع محفوظ في الدفتر منذ v56.9 داخل كل سطر (العنصر الرابع [رمز، مدين، دائن، فرع]) وداخل البصمة؛ هذه الاختبارات تثبّته،
 * والخادم صار يرفض فرع سطر بغير نمط المعرّف. أرقام وهمية.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
import { ledgerValidate, LEDGER_BR } from '../server-ledger.js';

let E;
before(async () => { E = await buildEngine(); });
const ent = (br) => ({ id: 'dep:2026-11' + (br ? ':' + br : ''), date: '2026-11-30', title: 'إهلاك', ...(br ? { branchId: br } : {}),
  lines: [{ code: '5701', debit: 10, credit: 0 }, { code: '1791', debit: 0, credit: 10 }] });
const posted = (R, x = {}) => ({ ...R, id: 'k_v1', no: 'JV-2026-000001', status: 'posted', ...x });

test('السجل يحمل فرع القيد في كل سطر متى وُجد، وبلا فرع يبقى السطر فارغ الفرع كما كان', () => {
  const R = E.flRecord(ent('b2'));
  assert.deepEqual(JSON.parse(R.lines), [['5701', 1000, 0, 'b2'], ['1791', 0, 1000, 'b2']]);
  assert.deepEqual(JSON.parse(E.flRecord(ent('')).lines), [['5701', 1000, 0, ''], ['1791', 0, 1000, '']]);
  assert.equal(R.branchId, undefined, 'لا حقل جديد على السجل — الفرع في السطور (فلا تغيير في القواعد)');
});

test('القراءة من الدفتر المخزّن (flEntriesOf) تعيد الفرع إلى القيد، وبلا فرع يعود فارغًا', () => {
  assert.equal(E.flEntriesOf([posted(E.flRecord(ent('b2')))])[0].branchId, 'b2');
  assert.equal(E.flEntriesOf([posted(E.flRecord(ent('')))])[0].branchId, '');
});

test('المطابقة: سجل مخزّن بلا فرع لقيد بلا فرع = مطابق؛ فرع مختلف = مختلف؛ والمبالغ تُكشف كما كانت', () => {
  const e0 = ent(''), r0 = posted(E.flRecord(e0));
  let C = E.flCompare([e0], [r0]); assert.equal(C.ok, true); assert.equal(C.differ.length, 0);
  const e1 = { ...ent('b1'), id: 'x:1' }, r2 = posted(E.flRecord({ ...e1, branchId: 'b2' }));
  C = E.flCompare([e1], [r2]); assert.equal(C.ok, false); assert.deepEqual(C.differ.map(e => e.id), ['x:1'], 'فرع مختلف يُكشف');
  const amt = { ...e0, lines: [{ code: '5701', debit: 11, credit: 0 }, { code: '1791', debit: 0, credit: 11 }] };
  C = E.flCompare([amt], [r0]); assert.deepEqual(C.differ.map(e => e.id), [e0.id], 'المبلغ يُكشف');
  const acc = { ...e0, lines: [{ code: '5702', debit: 10, credit: 0 }, { code: '1791', debit: 0, credit: 10 }] };
  C = E.flCompare([acc], [r0]); assert.deepEqual(C.differ.map(e => e.id), [e0.id], 'الحساب يُكشف');
});

test('الخادم: يقبل فرعًا فارغًا أو بنمط المعرّف ويخزّنه في السطور، ويرفض غيره', () => {
  const it = (br) => ({ key: 'k_v1', rec: { date: '2026-11-20', src: 'dep:2026-11', title: 'إهلاك', ver: 1, lines: JSON.stringify([['5701', 1000, 0, br], ['1791', 0, 1000, br]]) } });
  ['', 'b1', 'b-a1b2c3d', 'BR_9'].forEach(br => { const v = ledgerValidate(it(br)); assert.equal(v.err, undefined, br); assert.equal(JSON.parse(v.rec.lines)[0][3], br); });
  ['b 1', 'ب1', 'b1/../x', "b1'", 'b1\n'].forEach(br => assert.match(ledgerValidate(it(br)).err, /فرع السطر غير صالح/, JSON.stringify(br)));
  assert.match(ledgerValidate(it(5)).err, /سطر غير صالح/, 'غير النص مرفوض كما كان');
  assert.match(ledgerValidate(it('a'.repeat(101))).err, /سطر غير صالح/, 'الطول فوق 100 مرفوض كما كان');
  assert.equal(LEDGER_BR.test(''), true);
});

/* البند 2 — قيد شراء الأصل ast: */
const aB = { id: 'a1', name: 'فرن', cost: 12000, buyDate: '2025-07-10', lifeYears: 1, fund: '1201', branchId: 'b1' };
const aC = { id: 'a0', name: 'سيارة', cost: 6000, buyDate: '2025-07-10', lifeYears: 1, fund: '1101' };
const aOld = { id: 'a2', name: 'ثلاجة', cost: 3000, buyDate: '2025-05-20', lifeYears: 1, fund: '1201', branchId: 'b1' };
const base = { company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'فرع أ', isActive: true }, { id: 'b2', name: 'فرع ب', isActive: true }], taxCfg: { enabled: false }, assets: [aB, aC, aOld] };
const on = (o, ranges) => ({ ...o, depBranch: { ranges } });
const ast = (A, id) => A.entries.find(e => e.id === 'ast:' + id);

test('ast: بلا تفعيل كما كان حرفيًا (بلا فرع)، وكل القيود مطابقة', () => {
  const A = E.buildAccounting(base, {});
  ['a1', 'a0', 'a2'].forEach(id => assert.equal(ast(A, id).branchId, undefined));
  assert.equal(JSON.stringify(E.buildAccounting(on(base, []), {}).entries), JSON.stringify(A.entries));
  assert.equal(JSON.stringify(E.buildAccounting(on(base, [{ from: '2099-01' }]), {}).entries), JSON.stringify(A.entries));
});

test('ast: داخل النطاق بتاريخ الشراء يحمل فرع الأصل في شهر الشراء؛ خارج النطاق وبلا فرع كما هو حرفيًا', () => {
  const A0 = E.buildAccounting(base, {}), A = E.buildAccounting(on(base, [{ from: '2025-06', at: 'x' }]), {});
  const x = ast(A, 'a1'); assert.equal(x.branchId, 'b1');
  const { branchId, ...rest } = x; assert.deepEqual(rest, ast(A0, 'a1'), 'السطور والعنوان والتاريخ كما هي');
  assert.deepEqual(x.lines.map(l => [l.code, l.debit, l.credit]), [['1701', 12000, 0], ['1201', 0, 12000]]);
  assert.deepEqual(ast(A, 'a0'), ast(A0, 'a0'), 'أصل بلا فرع كما هو');
  assert.deepEqual(ast(A, 'a2'), ast(A0, 'a2'), 'شراء قبل النطاق كما هو حرفيًا');
  // نطاق مغلق قبل شهر الشراء ⇒ كما هو
  assert.deepEqual(ast(E.buildAccounting(on(base, [{ from: '2025-05', to: '2025-06' }]), {}), 'a1'), ast(A0, 'a1'));
});

test('ast: الأصل المنقول يحمل فرعه في شهر الشراء لا فرعه الحالي، والدفتر المخزّن يعيده', () => {
  const moved = { ...aB, branchId: 'b2', brHist: [{ from: '2025-07', branchId: 'b1' }, { from: '2025-10', branchId: 'b2' }] };
  const A = E.buildAccounting(on({ ...base, assets: [moved] }, [{ from: '2025-06' }]), {});
  const x = ast(A, 'a1'); assert.equal(x.branchId, 'b1');
  assert.equal(E.flEntriesOf([posted(E.flRecord(x))])[0].branchId, 'b1');
});

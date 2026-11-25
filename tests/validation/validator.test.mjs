/**
 * اختبارات محرك التحقق المحاسبي المستقل — تعمل بلا أي اعتماديات (node --test tests/validation/).
 * تثبت أمرين: (1) الدفتر الصحيح يمر بالأرقام المتوقعة يدويًا، (2) كل خطأ متعمد يُكتشف بالفحص الصحيح.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLedger, trialBalance, computeBalances, checkBankRec, checkDepreciation, straightLineAccum, checkInventory, weightedAverage, checkSourceVsReport, toH } from './ledger-validator.mjs';
import { baseLedger, EXPECTED, MUTATIONS, REPORT_MUTATIONS } from './scenarios.mjs';

const checks = (r) => r.findings.map(f => f.check);

test('الدفتر الصحيح: لا ملاحظات، والأرصدة تطابق المحسوب يدويًا', () => {
  const lg = baseLedger();
  const r = validateLedger(lg, { reported: { balances: EXPECTED.balances, subledger: EXPECTED.subledger, statements: EXPECTED.statements }, expected: EXPECTED.entries });
  assert.deepEqual(r.findings, []);
  assert.equal(r.ok, true);
  assert.equal(r.tb.balanced, true);
  assert.equal(r.tb.totalDr, EXPECTED.totalDr);
  assert.equal(r.tb.totalCr, EXPECTED.totalDr);
});

test('المسودة والملغى لا يدخلان الأرصدة، والقيد المعكوس يلغي أثره', () => {
  const { bal } = computeBalances(baseLedger());
  assert.equal(bal['5201'] / 100, 3000, 'الإيجار = 3000 فقط (لا 999 المسودة ولا 777 الملغى ولا 500 المعكوس)');
  assert.equal(bal['1101'] / 100, 1150);
});

for (const m of MUTATIONS) {
  test(`خطأ متعمد يُكتشف: ${m.name} ⇐ ${m.expect}`, () => {
    const lg = baseLedger(); m.apply(lg);
    const r = validateLedger(lg);
    assert.ok(checks(r).includes(m.expect), `لم يُكتشف ${m.expect}؛ الموجود: ${checks(r).join(', ') || 'لا شيء'}`);
    assert.equal(r.ok, false, 'يجب ألا يُعتمد الدفتر');
  });
}

for (const m of REPORT_MUTATIONS) {
  test(`تقرير معلن خاطئ يُكتشف: ${m.name} ⇐ ${m.expect}`, () => {
    const r = validateLedger(baseLedger(), { reported: m.reported() });
    assert.ok(checks(r).includes(m.expect), checks(r).join(', '));
    assert.equal(r.ok, false);
  });
}

test('توازن القيد وحده ليس دليل صحة: إيراد يشمل الضريبة متوازن لكنه خاطئ', () => {
  const lg = baseLedger();
  const e3 = lg.entries.find(e => e.id === 'e3');
  e3.lines = [{ acc: '1101', dr: 1150, cr: 0 }, { acc: '4101', dr: 0, cr: 1150 }];   // متوازن تمامًا
  const noExp = validateLedger(lg);
  assert.ok(!checks(noExp).some(c => c.startsWith('balance')), 'التوازن سليم');
  const withExp = validateLedger(lg, { expected: EXPECTED.entries });
  assert.ok(checks(withExp).includes('expected.entry'), 'المقارنة بالقيد المتوقع تكشفه');
  assert.equal(withExp.ok, false);
});

test('القيد المتوقع غائب ⇐ expected.missing', () => {
  const lg = baseLedger(); lg.entries = lg.entries.filter(e => e.id !== 'e4');
  assert.ok(checks(validateLedger(lg, { expected: EXPECTED.entries })).includes('expected.missing'));
});

test('تعدد العملات الصحيح: 100 دولار × 3.75 = 375 بلا ملاحظات', () => {
  const lg = baseLedger();
  lg.entries.push({ id: 'fx', date: '2026-02-07', tenant: 't1', status: 'posted', currency: 'USD', rate: 3.75, source: { type: 'inv', id: 'fx' }, lines: [{ acc: '5201', dr: 375, cr: 0, fc: 100 }, { acc: '2101', dr: 0, cr: 375, fc: 100, party: 's3' }] });
  assert.deepEqual(validateLedger(lg).findings, []);
});

test('الكسور والتقريب: الضريبة 4.1745 تُقرب إلى 4.17 والقيد بالهللات متوازن', () => {
  assert.equal(toH(4.17).exact, true); assert.equal(toH(4.1745).exact, false);
  const lg = baseLedger();
  lg.entries.push({ id: 'r', date: '2026-02-08', tenant: 't1', status: 'posted', source: { type: 'closing', id: 'r' }, lines: [{ acc: '1101', dr: 32, cr: 0 }, { acc: '4101', dr: 0, cr: 27.83 }, { acc: '2301', dr: 0, cr: 4.17 }] });
  assert.deepEqual(validateLedger(lg).findings, []);
});

test('تعدد المنشآت: دفتر منشأتين منفصلين يمر، والخلط يُرفض', () => {
  const a = baseLedger(); const b = baseLedger(); b.tenant = 't2'; b.entries.forEach(e => { e.tenant = 't2'; });
  assert.equal(validateLedger(a).ok, true); assert.equal(validateLedger(b).ok, true);
  a.entries.push({ ...b.entries[0], id: 'x-t2' });
  assert.ok(checks(validateLedger(a)).includes('tenant.isolation'));
});

test('إقفال السنة: حسابات النتيجة صفرية بعد قيد الإقفال، وبدونه تُكتشف', () => {
  const lg = baseLedger();
  lg.entries = lg.entries.map(e => ({ ...e, date: e.date.replace('2026', '2025'), postedAt: undefined }));
  const open = validateLedger(lg, { closedYear: 2025 });
  assert.ok(checks(open).includes('period.close'));
  lg.entries.push({ id: 'close', date: '2025-12-31', tenant: 't1', status: 'posted', source: { type: 'close', id: '2025' }, lines: [
    { acc: '4101', dr: 3000, cr: 0 }, { acc: '5101', dr: 0, cr: 276 }, { acc: '5201', dr: 0, cr: 3000 }, { acc: '5301', dr: 0, cr: 166.67 }, { acc: '3101', dr: 442.67, cr: 0 }] });
  assert.ok(!checks(validateLedger(lg, { closedYear: 2025 })).includes('period.close'));
});

test('التسوية البنكية: 48,200 + 3,000 − 1,500 = 50,050 − 350 = 49,700', () => {
  const r = { statementBalance: 48200, depositsInTransit: 3000, outstanding: 1500, bookBalance: 50050, unrecordedCharges: 350, reportedAdjusted: 49700 };
  assert.deepEqual(checkBankRec(r), []);
  assert.equal(checkBankRec({ ...r, reportedAdjusted: 49650 })[0].check, 'bank.reported');
  assert.equal(checkBankRec({ ...r, unrecordedCharges: 0 })[0].check, 'bank.reconcile');
});

test('الإهلاك بالقسط الثابت: 10,000 على 60 شهرًا ⇐ 3 أشهر = 500.01، والعمر الكامل = 10,000 بالضبط', () => {
  const a = { cost: 10000, lifeMonths: 60, startDate: '2026-01-01', asOf: '2026-03-31' };
  assert.equal(straightLineAccum(a), 500.01);
  assert.equal(straightLineAccum({ ...a, asOf: '2031-06-30' }), 10000);
  assert.deepEqual(checkDepreciation({ ...a, reportedAccum: 500.01 }), []);
  assert.equal(checkDepreciation({ ...a, reportedAccum: 500 })[0].check, 'depreciation');
});

test('المخزون بالمتوسط المرجّح: 10×20 ثم 30×24 ⇐ 23.00؛ صرف 12 ⇐ 28 بقيمة 644', () => {
  const mv = [{ qty: 10, unitCost: 20 }, { qty: 30, unitCost: 24 }, { qty: -12, kind: 'out' }];
  assert.deepEqual(weightedAverage(mv), { qty: 28, value: 644, avg: 23 });
  assert.deepEqual(checkInventory(mv, { qty: 28, value: 644 }), []);
  assert.equal(checkInventory(mv, { qty: 28, value: 650 })[0].check, 'inventory.value');
  assert.equal(checkInventory([...mv, { qty: -50, kind: 'out' }], {})[0].check, 'inventory.negative');
});

test('مطابقة مصدر البيانات مع التقرير', () => {
  const closings = [{ total: 1150 }, { total: 2300.5 }, { total: 0.1 }];
  assert.deepEqual(checkSourceVsReport(closings, 'total', 3450.6), []);
  assert.equal(checkSourceVsReport(closings, 'total', 3450.5)[0].check, 'source-vs-report');
});

test('ميزان المراجعة المستقل مجموعاه متساويان', () => {
  const t = trialBalance(baseLedger());
  assert.equal(t.balanced, true);
});

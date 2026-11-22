/* v53.1 — استيراد فواتير المصروفات من كشف Excel: التعرّف على الأعمدة، الحساب، الفحص قبل الحفظ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();
const org = { taxCfg: { enabled: true, rate: 15 }, branches: [{ id: 'b1', name: 'فرع طيبة' }, { id: 'b2', name: 'النسيم' }],
  suppliers: [{ id: 's1', name: 'شركة الكهرباء', vatNo: '300000000000003' }, { id: 's2', name: 'محطة الوقود' }], fin: {} };
const accounts = [{ code: '5105', name: 'كهرباء ومياه' }, { code: '5198', name: 'مصروفات متنوعة' }, { code: '5110', name: 'وقود ومحروقات' }];

test('التعرّف على صف العناوين والأعمدة حتى بعد أسطر عنوان', () => {
  const g = [['كشف مصروفات نوفمبر'], [], ['تاريخ الفاتورة', 'اسم المورد', 'الرقم الضريبي', 'رقم الفاتورة', 'الفرع', 'البيان', 'نوع المصروف', 'المبلغ قبل الضريبة', 'الضريبة', 'الإجمالي', 'طريقة الدفع']];
  const d = E.xiDetect(g); assert.equal(d.header, 2);
  assert.deepEqual(d.map, { vatNo: 2, date: 0, no: 3, supplier: 1, branch: 4, acc: 6, desc: 5, pay: 10, net: 7, total: 9, vat: 8 });
  assert.equal(E.xiDetect([['أ', 'ب'], [1, 2]]), null);
  assert.equal(E.xiNum('١٬٢٣٤٫٥٠'), 1234.5); assert.equal(E.xiNum('(50)'), -50); assert.equal(E.xiNum(''), null);
});

test('الخطة: الصالح والأخطاء والتكرار والموردون الجدد وطرق حساب الضريبة', () => {
  const g = [E.XI_TEMPLATE[0],
    ['2026-11-01', 'شركة الكهرباء', '', 'E-1', 'طيبة', 'كهرباء أكتوبر', 'كهرباء', 1000, 150, '', 'آجل'],          // 1 صالح (الإجمالي محسوب)
    ['01/11/2026', 'محطة الوقود', '', 'F-9', 'النسيم', 'وقود', '5110', '', '', 230, 'نقدي'],                       // 2 صالح: إجمالي فقط بلا ضريبة
    ['2026-11-03', 'مورد جديد', '310000000000003', 'N-1', '', 'صيانة', 'متنوعة', 100, 15, 115, 'تحويل بنكي'],      // 3 مورد جديد
    ['2026-11-04', 'محطة الوقود', '', 'F-10', 'النسيم', 'وقود', 'وقود', 100, 15, 115, ''],                       // 4 ضريبة بلا رقم ضريبي
    ['2026-11-05', 'شركة الكهرباء', '', 'E-1', 'طيبة', 'مكرر', 'كهرباء', 50, 0, 50, ''],                          // 5 مكرر في الملف
    ['2099-01-01', 'شركة الكهرباء', '', 'E-2', 'طيبة', 'x', 'كهرباء', 50, 0, 50, ''],                             // 6 مستقبلي
    ['2026-11-06', 'شركة الكهرباء', '', 'E-3', 'فرع مجهول', 'x', 'حساب لا يوجد', 50, 0, 50, ''],               // 7 فرع وحساب
    ['', '', '', '', '', '', '', '', '', '', ''],
  ];
  const ops = { invoices: [{ supplierId: 's1', invoiceNo: 'E-OLD' }] };
  const P = E.xiPlan(g, E.xiDetect(g), { org, ops, opts: { accounts, createSup: true } });
  assert.deepEqual(P.rows.map(r => r.ok), [true, true, true, false, false, false, false]);
  const [a, b, c, d, e, f, h] = P.rows;
  assert.deepEqual([a.total, a.branch.id, a.acc.code, a.pm], [1150, 'b1', '5105', 'credit']);
  assert.deepEqual([b.date, b.net, b.vat, b.total, b.acc.code, b.pm], ['2026-11-01', 230, 0, 230, '5110', 'cash']);
  assert.equal(c.sp._new, true); assert.equal(c.pm, 'bank'); assert.equal(P.newSup.length, 1);
  assert.match(d.err.join(), /رقم ضريبي/); assert.match(e.err.join(), /مكررة في الملف/); assert.match(f.err.join(), /مستقبلي/);
  assert.match(h.err.join(), /فرع غير معروف/); assert.match(h.err.join(), /حساب المصروف/);
  assert.equal(P.ok, 3); assert.equal(P.sum, 1150 + 230 + 115);
  // بلا إنشاء موردين: الجديد خطأ
  assert.match(E.xiPlan(g, E.xiDetect(g), { org, ops, opts: { accounts } }).rows[2].err.join(), /مورد غير موجود/);
  // المسجّلة سابقًا
  const g2 = [E.XI_TEMPLATE[0], ['2026-11-01', 'شركة الكهرباء', '', 'E-OLD', '', '', 'كهرباء', 10, 0, 10, '']];
  assert.match(E.xiPlan(g2, E.xiDetect(g2), { org, ops, opts: { accounts } }).rows[0].err.join(), /مسجّلة سابقًا/);
  // إجمالي شامل الضريبة بلا عمود ضريبة
  const g3 = [['التاريخ', 'المورد', 'الإجمالي'], ['2026-11-01', 'محطة الوقود', 115]];
  const r3 = E.xiPlan(g3, E.xiDetect(g3), { org, ops, opts: { accounts, defAcc: '5198', inclVat: true } }).rows[0];
  assert.deepEqual([r3.net, r3.vat, r3.ok], [100, 15, false], 'ضريبة بلا رقم ضريبي لمحطة الوقود');
});

test('السجلات: فاتورة مصروفات بحسابها، ومدفوعة نقدًا من الصندوق، والآجل بلا دفعة، وترقيم تلقائي لما بلا رقم', () => {
  const g = [E.XI_TEMPLATE[0], ['2026-11-01', 'شركة الكهرباء', '', '', 'طيبة', 'كهرباء', 'كهرباء', 100, 15, 115, 'آجل'], ['2026-11-01', 'محطة الوقود', '', '', '', 'وقود', 'وقود', 50, 0, 50, 'نقدي']];
  const P = E.xiPlan(g, E.xiDetect(g), { org, ops: {}, opts: { accounts } });
  const R = E.xiRecords(P, { me: { name: 'مجاهد' }, batch: 'XB1' });
  assert.equal(R.length, 2);
  assert.deepEqual([R[0].kind, R[0].supplierId, R[0].amount, R[0].vatAmt, R[0].paidAmount, R[0].expLines[0].accCode, R[0].branchId], ['svc', 's1', 115, 15, 0, '5105', 'b1']);
  assert.deepEqual([R[1].paidAmount, R[1].payments[0].fund, R[1].branchName], [50, '1101', 'المركز الرئيسي']);
  assert.match(R[0].invoiceNo, /^XI-261101-001$/); assert.notEqual(R[0].invoiceNo, R[1].invoiceNo);
  assert.equal(R[0].importBatch, 'XB1');
});

test('v53.2 كشف قيود بأعمدة متعددة: «رمز حساب المدين» يتقدّم على «التصنيف»، ورقم القيد يُحفظ، والحسابات الجديدة تُنشأ عند الطلب', () => {
  const H = ['رقم القيد', 'التاريخ', 'المورد', 'الرقم الضريبي', 'رقم فاتورة المورد', 'البيان', 'التصنيف', 'نوع المصروف في الكشف', 'رمز حساب المدين', 'قبل الضريبة', 'ضريبة المدخلات (1501)', 'الإجمالي — دائن 2101', 'المرفق', 'اسم حساب المدين'];
  const g = [H, ['PUR-2026-01-0001', 46023, 'شركة الكهرباء', 300000000000003, '226-16', 'فاتورة مشتريات', 'منتجات (مخزون)', 'مشتريات مواد غذائيه', '5116', 892, 119.4, 1011.4, 'x.pdf', 'مواد التغليف والتعبئة'],
    ['PUR-2026-01-0002', 46023, 'شركة الكهرباء', 300000000000003, '226-17', 'ب', 'مصروف', 'x', '4101', 10, 1.5, 11.5, '', 'إيراد']];
  const d = E.xiDetect(g);
  assert.deepEqual([d.map.acc, d.map.accName, d.map.no, d.map.ref, d.map.vat, d.map.total, d.map.net], [8, 13, 4, 0, 10, 11, 9]);
  const P0 = E.xiPlan(g, d, { org, ops: {}, opts: { accounts } });
  assert.match(P0.rows[0].err.join(), /حساب غير موجود في الدليل: 5116/);
  const P = E.xiPlan(g, d, { org, ops: {}, opts: { accounts, createAcc: true } });
  assert.equal(P.rows[0].ok, true); assert.equal(P.rows[0].date, '2026-01-01'); assert.deepEqual(P.newAcc, [{ code: '5116', name: 'مواد التغليف والتعبئة', kind: 'exp' }]);
  assert.match(P.rows[1].err.join(), /4101/, 'لا يُنشأ حساب خارج المصروفات والتكاليف');
  assert.equal(P.vatSum, 119.4);
  const R = E.xiRecords(P, { me: { name: 'م' }, batch: 'b' }); assert.equal(R[0].extRef, 'PUR-2026-01-0001'); assert.equal(R[0].expLines[0].accCode, '5116');
});

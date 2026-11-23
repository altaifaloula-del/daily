/* v53.4 — تفنيد المشتريات من المصروفات: تصنيف الفاتورة والحساب من عمود «التصنيف» وأثره على قائمة الدخل */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();
const org = { taxCfg: { enabled: true, rate: 15 }, branches: [], suppliers: [{ id: 's1', name: 'مكين', vatNo: '311135091100003' }], fin: {} };
const accounts = [{ code: '5101', name: 'مشتريات مواد خام' }, { code: '5134', name: 'مواد البناء والتشطيبات' }, { code: '5111', name: 'مواد تنظيف ومطهرات' }, { code: '1701', name: 'الأصول الثابتة' }];
const H = ['رقم القيد', 'التاريخ', 'المورد', 'الرقم الضريبي', 'رقم فاتورة المورد', 'البيان', 'التصنيف', 'نوع المصروف في الكشف', 'رمز حساب المدين', 'قبل الضريبة', 'ضريبة المدخلات (1501)', 'الإجمالي — دائن 2101', 'اسم حساب المدين', 'أساس التصنيف'];
const R = (no, cls, acc, net) => ['PUR-' + no, '2026-01-0' + (no % 9 + 1), 'مكين', '311135091100003', 'F' + no, 'x', cls, 'مشتريات مواد غذائيه', acc, net, net * 0.15, net * 1.15, 'n', 'أساس'];

test('عمود «التصنيف» يُقرأ مستقلًا عن عمود الحساب ويُصنّف الفواتير والحسابات', () => {
  const g = [H, R(1, 'منتجات (مخزون)', '5101', 100), R(2, 'مصروف', '5134', 200), R(3, 'منتجات (مخزون)', '5111', 50), R(4, 'أصل ثابت', '1701', 1000), R(5, 'مصروف', '5101', 10)];
  const d = E.xiDetect(g); assert.equal(d.map.acc, 8); assert.equal(d.map.cls, 6);
  const P = E.xiPlan(g, d, { org, ops: { invoices: [] }, opts: { accounts } });
  assert.deepEqual(P.rows.map(r => r.cls), ['pur', 'exp', 'pur', 'asset', 'exp']);
  assert.deepEqual(P.accCls, { 5134: 'exp', 5111: 'pur', 1701: 'asset' }); assert.deepEqual(P.accMixed, ['5101']);
  assert.equal(P.clsSum.pur, 172.5); assert.equal(P.clsSum.asset, 1150);
  const recs = E.xiRecords(P, { me: { name: 'م' }, batch: 'xb' }); assert.equal(recs[0].cls, 'pur'); assert.equal(recs[1].cls, 'exp');
});

test('إعادة رفع الملف المسجّل سابقًا تعطي تصنيف الحسابات رغم أن الأسطر مكررة', () => {
  const g = [H, R(1, 'مصروف', '5134', 200)];
  const P = E.xiPlan(g, E.xiDetect(g), { org, ops: { invoices: [{ supplierId: 's1', invoiceNo: 'F1' }] }, opts: { accounts } });
  assert.equal(P.ok, 0); assert.equal(P.dupN, 1); assert.deepEqual(P.accCls, { 5134: 'exp' });
  const P2 = E.xiPlan(g, E.xiDetect(g), { org: { ...org, accCls: { 5134: 'exp' } }, ops: { invoices: [] }, opts: { accounts } });
  assert.deepEqual(P2.accCls, {}, 'المصنّف مسبقًا لا يتكرر');
});

test('تصنيف الفاتورة: المحفوظ ← حساب البند ← نوعها', () => {
  const o = { accCls: { 5130: 'exp', 5110: 'pur' } };
  assert.equal(E.invCls(o, { cls: 'asset', kind: 'svc' }), 'asset');
  assert.equal(E.invCls(o, { kind: 'svc', expLines: [{ accCode: '5110' }] }), 'pur');
  assert.equal(E.invCls(o, { kind: 'svc', expLines: [{ accCode: '5130' }] }), 'exp');
  assert.equal(E.invCls({}, { kind: 'svc', expLines: [{ accCode: '1701' }] }), 'asset');
  assert.equal(E.invCls({}, { lines: [] }), 'pur');
  assert.equal(E.XI_CLS('منتجات (مخزون)'), 'pur'); assert.equal(E.XI_CLS('مصروف'), 'exp'); assert.equal(E.XI_CLS('أصل ثابت'), 'asset');
});

test('قائمة الدخل: تصنيف الحساب يتقدّم على قاعدة الاسم (مواد البناء مصروف تشغيل لا تكلفة مبيعات)', () => {
  const accs = [{ code: '5134', name: 'مواد البناء والتشطيبات', kind: 'exp' }, { code: '5110', name: 'مستهلكات تشغيل', kind: 'exp' }];
  const bal = () => 100;
  const Y0 = E.isLayout(accs, bal); assert.deepEqual(Y0.cogs.map(l => l.code), ['5134']);
  const Y1 = E.isLayout([{ ...accs[0], cls: 'exp' }, { ...accs[1], cls: 'pur' }], bal); assert.deepEqual(Y1.cogs.map(l => l.code), ['5110']);
  const A = E.buildAccounting({ ...org, accCls: { 5198: 'pur' } }, { invoices: [] }, [], {});
  assert.equal(A.accounts.find(a => a.code === '5198').cls, 'pur');
});

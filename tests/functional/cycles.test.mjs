/**
 * اختبارات الترابط الوظيفي بين الوحدات (MITHQAL Functional Audit — v46.8).
 * تُشغَّل: node --test tests/functional/cycles.test.mjs — الأرقام المتوقعة محسوبة يدويًا.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let E;
before(async () => {
  const cache = path.join(root, 'tests', '.cache'); fs.mkdirSync(cache, { recursive: true });
  const tag = process.pid + '-' + Math.random().toString(36).slice(2, 8);
  const entry = path.join(cache, 'Cycles-' + tag + '.jsx'), out = path.join(cache, 'cycles-' + tag + '.mjs');
  fs.writeFileSync(entry, "export { buildAccounting, periodLocked, lockedLedgerChanged, countedClosing } from '../../App.jsx';\nexport { integrityChecks } from '../../mods/admin/SystemMaintenance.jsx';\n");
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', loader: { '.js': 'jsx' }, define: { 'import.meta.env': '{}' }, jsx: 'automatic',
    external: ['react', 'react-dom', 'react-dom/*', 'lucide-react', 'recharts', 'firebase/*', 'jsbarcode'] });
  try { E = await import(out); } finally { for (const f of [entry, out]) { try { fs.unlinkSync(f); } catch { } } }
});

const r2 = (x) => Math.round(x * 100) / 100;
const tb = (A, pred = () => true) => { const t = {}; A.entries.filter(pred).forEach(e => e.lines.forEach(l => { t[l.code] = r2((t[l.code] || 0) + l.debit - l.credit); })); return t; };
const near = (a, b, msg) => assert.ok(Math.abs((a || 0) - b) < 0.011, (msg || '') + ` — المتوقع ${b} والفعلي ${a}`);
const baseOrg = (x = {}) => ({ company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'طيبة', isActive: true }], taxCfg: { enabled: true, rate: 15 }, ...x });
const closing = (x = {}) => ({ id: 'c1', branchId: 'b1', branchName: 'طيبة', date: '2026-03-10', status: 'approved', totalRevenue: 1150, cashSales: 690, cardSales: 460,
  deliverySales: [], expenses: [], totalExpenses: 0, variance: 0, actualCashCount: 690, expectedCashInSafe: 690, transferredToMainTreasury: 0, supplierPayments: [], ...x });

test('دورة المبيعات عبر الإغلاق: 1150 شاملة (نقد 690 + شبكة 460) ← إيراد 1000 + ضريبة مخرجات 150، والميزان متوازن', () => {
  const A = E.buildAccounting(baseOrg(), { closings: [closing()] });
  assert.equal(A.balanced, true, 'الميزان متوازن');
  const t = tb(A);
  const rev = Object.entries(t).filter(([c]) => c.startsWith('4')).reduce((s, [, v]) => s + v, 0);
  near(-rev, 1000, 'الإيراد الصافي'); near(-(t['2301'] || 0), 150, 'ضريبة المخرجات 2301');
  const assets = Object.entries(t).filter(([c]) => c.startsWith('1')).reduce((s, [, v]) => s + v, 0);
  near(assets, 1150, 'النقد + الشبكة');
});

test('الإغلاق غير المعتمد (مسودة) لا يُرحَّل للدفاتر، والمرسَل والمعتمد يُرحَّلان', () => {
  assert.equal(E.countedClosing(closing({ status: 'draft' })), false);
  assert.equal(E.countedClosing(closing({ status: 'submitted' })), true);
  const A = E.buildAccounting(baseOrg(), { closings: [closing({ status: 'draft' })] });
  assert.equal(A.entries.filter(e => e.lines.some(l => l.code.startsWith('4'))).length, 0, 'لا إيراد من مسودة');
});

test('الإغلاقات المكررة: فحص سلامة البيانات يكشف نفس المعرّف مرتين، وإغلاقين لنفس الفرع واليوم، ويتجاهل المرفوض', () => {
  const chk = (cls) => E.integrityChecks(baseOrg(), { closings: cls }).find(x => x.id === 'dupclose');
  assert.equal(chk([closing()]).st, 'ok');
  assert.equal(chk([closing(), closing()]).st, 'bad', 'نفس المعرّف (يضاعف الإيراد في القيود)');
  assert.equal(chk([closing(), closing({ id: 'c2' })]).st, 'bad', 'فرع ويوم مكرران');
  assert.equal(chk([closing(), closing({ id: 'c2', status: 'rejected' })]).st, 'ok', 'المرفوض لا يُعد تكرارًا');
  assert.equal(chk([closing(), closing({ id: 'c2', date: '2026-03-11' })]).st, 'ok', 'يومان مختلفان');
});

test('دورة الأصول: شراء 12,000 بعمر سنة من البنك ← إهلاك 1,000 شهريًا ← بيع بـ 8,000 بعد 5 أقساط ← ربح 1,000، والميزان متوازن', () => {
  const org = baseOrg({ assets: [{ id: 'a1', name: 'فرن', cost: 12000, lifeYears: 1, buyDate: '2026-01-15', fund: '1201', disposedDate: '2026-07-10', salePrice: 8000, saleFund: '1201' }] });
  const A = E.buildAccounting(org, {});
  assert.equal(A.balanced, true);
  const t = tb(A);
  near(t['1701'] || 0, 0, 'الأصل خرج بتكلفته');
  near(t['1791'] || 0, 0, 'مجمّع الإهلاك أُقفل');
  near(-(t['4201'] || 0), 1000, 'ربح البيع = 8000 − (12000 − 5×1000)');
  near(t['1201'] || 0, -4000, 'البنك: −12000 + 8000');
  const dep = Object.entries(t).filter(([c]) => c.startsWith('5') && c !== '5801').reduce((s, [, v]) => s + v, 0);
  near(dep, 5000, 'مصروف الإهلاك فبراير–يونيو');
});

test('دورة الأصول: الاستبعاد بلا بيع ← خسارة بالقيمة الدفترية (سياسة الإهلاك: من الشهر التالي للشراء)', () => {
  const org = baseOrg({ assets: [{ id: 'a1', name: 'ثلاجة', cost: 6000, lifeYears: 1, buyDate: '2026-01-01', fund: '1201', disposedDate: '2026-04-05', salePrice: 0 }] });
  const A = E.buildAccounting(org, {}); assert.equal(A.balanced, true);
  near(tb(A)['5801'] || 0, 5000, 'الخسارة = 6000 − 2×500 (الإهلاك يبدأ من الشهر التالي للشراء: فبراير ومارس، ولا إهلاك في شهر الاستبعاد)');
});

test('القيد اليدوي غير المتوازن إذا وصل للبيانات مباشرة (تجاوز الواجهة) يُكشف ولا يمر صامتًا', () => {
  const A = E.buildAccounting(baseOrg(), { journalManual: [{ id: 'jx', date: '2026-03-06', title: 'مدسوس', lines: [{ code: '5901', debit: 100, credit: 0 }, { code: '1201', debit: 0, credit: 90 }] }] });
  assert.equal(A.balanced, false, 'المحرك يعلن عدم التوازن');
});

test('إقفال الفترة: شهر مقفل يُرفض فيه أي تغيير على القيود، والشهر المفتوح مسموح', () => {
  const org = baseOrg({ periodLocks: { lockedThrough: '2026-03' } });
  assert.equal(E.periodLocked(org, '2026-03-31'), true); assert.equal(E.periodLocked(org, '2026-04-01'), false);
  const ops = { closings: [closing()] };
  const jm = (d) => ({ ...ops, journalManual: [{ id: 'j', date: d, title: 'ت', lines: [{ code: '5901', debit: 10, credit: 0 }, { code: '1201', debit: 0, credit: 10 }] }] });
  assert.equal(E.lockedLedgerChanged(org, ops, org, jm('2026-03-20')), true, 'قيد في مارس المقفل يُكتشف');
  assert.equal(E.lockedLedgerChanged(org, ops, org, jm('2026-04-02')), false, 'قيد في أبريل مسموح');
  assert.equal(E.lockedLedgerChanged(org, ops, org, { closings: [closing({ cashSales: 700, totalRevenue: 1160, actualCashCount: 700 })] }), true, 'تعديل إغلاق في شهر مقفل يُكتشف');
});

test('دورة الرواتب: استحقاق 10,000 ← سلفة 500 من البنك ← صرف 8,950 (بعد السلفة 500 وحصة الموظف في التأمينات 550) + حصة صاحب العمل 1,180 ← الدفاتر', () => {
  const org = baseOrg({ employees: [{ id: 'e1', name: 'أ', branchId: 'b1' }] });
  const ops = {
    advances: [{ id: 'a1', employeeId: 'e1', employeeName: 'أ', branchId: 'b1', month: '2026-03', date: '2026-03-10', type: 'advance', amount: 500, paymentMethod: 'bank' }],
    ledgerEntries: [
      { id: 'acc', kind: 'salary_accrual', month: '2026-03', date: '2026-03-28', credit: 10000 },
      { id: 'pay', kind: 'salary_payout', month: '2026-03', date: '2026-03-30', debit: 8950, gosi: 550, gosiEr: 1180, fund: '1201' }] };
  const A = E.buildAccounting(org, ops); assert.equal(A.balanced, true);
  const t = tb(A);
  near(t['5201'] || 0, 10000, 'مصروف الرواتب');
  near(t['5202'] || 0, 1180, 'تأمينات صاحب العمل');
  near(t['2201'] || 0, 0, 'الرواتب المستحقة أُقفلت (10000 − 8950 − 1050)');
  near(t['1401'] || 0, 0, 'السلفة استُردّت من الراتب');
  near(-(t['2202'] || 0), 1730, 'التأمينات المستحقة = 550 + 1180');
  near(t['1201'] || 0, -9450, 'البنك = −500 سلفة − 8950 صافي');
});

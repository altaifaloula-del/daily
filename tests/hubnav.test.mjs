/* v54.9 — كل قسم في المراكز المدمجة قابل للوصول: لا عودة إلى الرئيسية عند اختيار قسم جديد */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();
test('كل أقسام المراكز تبويبات معروفة، ومنها أقسام الذكاء المالي الجديدة', () => {
  for (const [h, cfg] of Object.entries(E.HUBS)) { if (h === 'hr') continue;
    for (const v of cfg.views) assert.ok(E.hubTabs(h).includes(v.id) || E.HR_TABS.includes(v.id), h + ':' + v.id); }
  ['cfo', 'finintel', 'cases', 'recs', 'refs', 'profitmx'].forEach(id => assert.ok(E.hubTabs('analytics').includes(id), id));
  assert.ok(E.hubTabs('purchasing').includes('rfq')); assert.ok(E.HR_TABS.includes('hrmaster'));
});
test('الشاشة الرئيسية تعرض المراكز وتسمح بأقسامها من HUBS لا من قوائم يدوية', () => {
  const src = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  ['analytics', 'reporting', 'purchasing', 'finhub', 'docshub'].forEach(h => assert.match(src, new RegExp("hubTabs\\('" + h + "'\\)\\.includes\\(safeTab\\) && <Hub hubId=\"" + h + "\"")));
  assert.match(src, /Object\.entries\(HUB_BASE\)\.forEach\(\(\[h, b\]\) => \{ if \(h !== 'closehub' && NAV\.some/);
});

test('v55.0 شارات المهام على التطبيقات: كل تبويب مهمة يُنسب لتطبيقه، والمتأخر عاجل', () => {
  assert.equal(E.appOfTab('acct'), 'acct'); assert.equal(E.appOfTab('approve'), E.appOfTab('approve'));
  assert.ok(E.appOfTab('cases'), 'أقسام المراكز تُنسب لتطبيق المركز'); assert.equal(E.appOfTab('zzz'), null);
  const B = E.appTaskBadges([{ id: 'a', tab: 'acct', title: 'قيد بانتظار' }, { id: 'b', tab: 'acct', title: 'فاتورة متأخرة' }, { id: 'c', tab: 'nope', title: 'x' }]);
  assert.deepEqual(B.acct, { n: 2, late: true }); assert.equal(Object.keys(B).length, 1);
  assert.equal(E.isLateWork({ id: 'act:1:late', title: 'x' }), true); assert.equal(E.isLateWork({ id: 'q', title: 'جديد' }), false);
});
test('v55.0 أرقام اليوم: حسب صلاحية الدور، وكل رقم يفتح شاشته', () => {
  const td = '2026-11-25'; const org = { branches: [{ id: 'b1', name: 'طيبة' }] };
  const ops = { closings: [{ id: 'c1', branchId: 'b1', date: td, status: 'approved', totalRevenue: 1200 }, { id: 'c2', branchId: 'b1', date: td, status: 'submitted', totalRevenue: 0 }],
    invoices: [{ id: 'i1', amount: 100, paidAmount: 0, dueDate: '2026-11-20' }, { id: 'i2', amount: 50, paidAmount: 50, dueDate: '2026-11-20' }] };
  const K = E.homeKpis(org, ops, ops, org.branches, { role: 'system_admin' }, td); const by = Object.fromEntries(K.map(k => [k.id, k]));
  assert.equal(by.pend.v, '1'); assert.equal(by.pend.tab, 'approve'); assert.equal(by.due.v, '1'); assert.equal(by.due.tab, 'suppliers'); assert.match(by.sales.v, /1,?200/);
  const C = E.homeKpis(org, ops, ops, org.branches, { role: 'cashier' }, td); assert.ok(!C.some(k => k.id === 'due' || k.id === 'crit'), 'الكاشير لا يرى أرقام المالية');
});

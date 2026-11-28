/* v52.6 — MQ-204 اختبارات الأداء: حسابات التقارير والتسويق على حجم واقعي، وقياس حجم الطلب في مستند الفرع (BUG-00-11) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();
const prods = Array.from({ length: 60 }, (_, i) => ({ id: 'p' + i, name: 'صنف رقم ' + i, sellPrice: 10 + i, parts: [{ itemId: 'm' + (i % 10), qty: 0.2 }] }));
const org = { taxCfg: { enabled: true, rate: 15 }, branches: [{ id: 'b1', name: 'طيبة' }, { id: 'b2', name: 'النسيم' }, { id: 'b3', name: 'كيلو 14' }],
  items: Array.from({ length: 10 }, (_, i) => ({ id: 'm' + i, name: 'خامة ' + i, unit: 'كجم', cost: 20 + i })), products: prods };
// طلب بالشكل الذي تكتبه نقطة البيع (أسطر، دفع، بصمة وسلسلة ZATCA، ولاء لثلث الطلبات)
function gen(perDay, days) { const os = []; const t0 = Date.parse('2026-11-19T12:00:00Z'); let k = 0;
  for (let d = 0; d < days; d++) { const date = new Date(t0 - d * 864e5).toISOString().slice(0, 10);
    for (const b of org.branches) for (let j = 0; j < perDay; j++) { k++; const lines = Array.from({ length: 1 + (k % 4) }, (_, x) => { const p = prods[(k * 7 + x * 13) % 60]; return { productId: p.id, name: p.name, qty: 1 + (x % 2), price: p.sellPrice }; });
      const total = lines.reduce((a, l) => a + l.qty * l.price, 0);
      os.push({ id: 'po_' + k.toString(36) + 'abcdef', no: 'ف1-261119-A-' + String(j).padStart(4, '0'), branchId: b.id, dev: 'A', shiftId: 'sh_x', date, at: date + 'T1' + (j % 10) + ':20:00.000Z', by: 'كاشير الفرع', channel: 'takeaway', lines,
        gross: total, disc: 0, manualDisc: 0, total, vat: Math.round(total * 15 / 115 * 100) / 100, net: total, rate: 15, payments: [{ m: 'card', amount: total }], change: 0, status: 'paid', icv: k, pih: 'f'.repeat(64), hash: 'a'.repeat(64),
        ...(k % 3 === 0 ? { loyalty: { phone: '5' + String(10000000 + (k % 4000)), name: 'عميل', earned: 5, redeemed: 0, redeemAmt: 0, balAfter: 50 } } : {}) }); } }
  return os; }
const OS = gen(100, 90);   // 3 فروع × 100 طلب يوميًا × 90 يومًا = 27,000 طلب
const ms = (f) => { const a = performance.now(); f(); return performance.now() - a; };

test('الأداء: تقارير الفروع والتسويق والتوصيات على 27 ألف طلب أسرع من ثانية لكلٍّ منها', () => {
  const ops = { posOrders: OS };
  const T = { brReport: ms(() => E.brReport(org, ops, { from: '2026-10-21', to: '2026-11-19', avg: {} })), recIndex: ms(() => E.recIndex(OS, { to: '2026-11-19', days: 60, branchId: 'b1' })),
    crmBuild: ms(() => E.crmBuild(org, ops, { members: {}, tx: [] }, {})), mktKpis: ms(() => E.mktKpis(org, ops, [], { from: '2026-10-21', to: '2026-11-19' })), recStats: ms(() => E.recStats(OS, { from: '2026-10-21', to: '2026-11-19' })) };
  for (const [k, v] of Object.entries(T)) assert.ok(v < 1000, k + ' استغرق ' + Math.round(v) + 'ms');
});

test('BUG-00-11 (قياس): الطلب ≈ 700 بايت، وفرع بـ150 طلبًا يوميًا يبلغ ≈ 38MB في سنة داخل مستند الفرع الواحد', () => {
  const per = Buffer.byteLength(JSON.stringify(OS)) / OS.length;
  assert.ok(per > 500 && per < 1000, 'حجم الطلب ' + Math.round(per));
  const yearMB = per * 150 * 365 / 1e6;
  assert.ok(yearMB > 25, 'الإسقاط السنوي ' + yearMB.toFixed(1) + 'MB — يتجاوز ما يصلح لإعادة رفعه مع كل حفظ (انظر G3_POS_ORDERS_SPLIT)');
});

/* ===== المرحلة H (v56.60) — الأداء بحجم منشأة كبيرة (بيانات اصطناعية حتمية: tests/fixtures/scale-data.mjs) =====
   20 فرعًا × 365 يومًا من الإغلاقات (7,300)، 200 ألف فاتورة نقطة بيع، 50 ألف فاتورة مورد، 5 آلاف أصل، 500 موظف برواتب 12 شهرًا،
   1,000 عميل آجل بـ 5 آلاف فاتورة مبيعات. الحد لكل دالة ≈ 5 أضعاف زمنها المقاس محليًا (docs/testing/PHASE_H_REPORT.md):
   يمرّ على CI أبطأ بمرتين، ويكشف أي تراجع بخمسة أضعاف (مثل عودة مسح كل الفواتير لكل إغلاق). */
import { scaleData } from './fixtures/scale-data.mjs';
const BIG = scaleData();
const BUDGET = { buildAccounting: 4000, buildAccountingPosGl: 5000, posGlCheck: 1500, trialBalance: 600, incomeStatement: 200, equityStatement: 800, glLedger: 3000, monthLedger: 400,
  buildPartners: 5000, aging: 300, posDaySummary: 150, posOrdersStatsMonth: 200, payrollRowsOf: 150, salesDays: 100, vatRegister: 1200, supplierPurchReport: 1200, brReport: 400, finPicture: 12000, cfoDash: 16000 };

test('الأداء (H): المحرك المحاسبي والقوائم والتقارير على حجم منشأة كبيرة — كل دالة تحت حدها، والميزان متوازن', () => {
  const { org, ops, months, first, last } = BIG; const ids = org.branches.map(b => b.id); const T = {};
  assert.equal(ops.closings.length, 7300); assert.equal(ops.posOrders.length, 200000); assert.equal(ops.invoices.length, 50000); assert.equal(org.assets.length, 5000); assert.equal(org.employees.length, 500);
  let A; T.buildAccounting = ms(() => { A = E.buildAccounting(org, ops); });
  assert.equal(A.balanced, true, 'الميزان متوازن على الحجم الكبير'); assert.ok(A.entries.length > 100000, 'قيود ' + A.entries.length);
  const orgGl = { ...org, posGl: { on: true, from: first } }; let G;
  T.buildAccountingPosGl = ms(() => { G = E.buildAccounting(orgGl, ops); });
  assert.equal(G.balanced, true);
  assert.ok(G.entries.some(e => (e.lines || []).some(l => l.code === '2106')), 'أثر فواتير نقطة البيع (التزام الولاء) ظاهر — الإغلاقات طابقت فواتيرها');
  let chk; T.posGlCheck = ms(() => { chk = E.posGlCheck(orgGl, ops); });
  assert.equal(chk.length, 7300); assert.equal(chk.filter(x => x.ok).length, 7300, 'كل إغلاق يطابق مجموع فواتير يومه');
  T.trialBalance = ms(() => E.acctActivity(A, { from: first, to: last }));
  T.incomeStatement = ms(() => E.computeIncome(org, ops, ops.closings, ids, first, last));
  T.equityStatement = ms(() => E.equityStatement(A, first, last));
  T.glLedger = ms(() => E.glLedger(A, '1201', { from: months[6] + '-01', to: last }));
  T.monthLedger = ms(() => E.monthLedger(A, months[6]));
  let P; T.buildPartners = ms(() => { P = E.buildPartners(org, ops); });
  assert.equal(P.filter(p => p.type === 'supplier').length, 300);
  T.aging = ms(() => P.forEach(p => E.customerAging(p, last, true)));
  T.posDaySummary = ms(() => E.posDaySummary(ops.posOrders, 'b3', last));
  const mo = ops.posOrders.filter(o => o.date.slice(0, 7) === months[11]);
  T.posOrdersStatsMonth = ms(() => E.posOrdersStats(mo));
  let pr; T.payrollRowsOf = ms(() => { pr = E.payrollRowsOf(org, ops.advances, org.employees, months[6]); }); assert.equal(pr.length, 500);
  T.salesDays = ms(() => E.salesDays(ops, {}));
  T.vatRegister = ms(() => E.vatRegister(org, ops, { A, from: first, to: last }));
  T.supplierPurchReport = ms(() => E.supplierPurchReport(org, ops, { A, from: first, to: last }));
  T.brReport = ms(() => E.brReport(org, ops, { from: months[11] + '-01', to: last, avg: {} }));
  T.finPicture = ms(() => E.finPicture(org, ops, A, last));
  T.cfoDash = ms(() => E.cfoDash(org, ops, { from: first, to: last, today: last }, A));
  const over = Object.entries(T).filter(([k, v]) => v > BUDGET[k]).map(([k, v]) => k + ' ' + Math.round(v) + 'ms > ' + BUDGET[k]);
  console.log('# PERF-H ' + JSON.stringify(Object.fromEntries(Object.entries(T).map(([k, v]) => [k, Math.round(v)]))));
  assert.deepEqual(over, [], 'تجاوز الحد: ' + over.join(' · '));
});

test('PERF-H-01 (إصلاح v56.60): فهرس posGlIndex يطابق المسح الكامل حرفيًا — مرتجعات بقيمة نقطة الأصل، ملغاة، معرّف مكرر، فرع آخر، عناصر فارغة', () => {
  const D = '2026-11-10', D2 = '2026-11-11';
  const O = [null, { id: 'a', branchId: 'b1', date: D, status: 'paid', total: 115, vat: 15, rate: 15, loyalty: { earned: 10, redeemAmt: 5, pv: 0.2 }, lines: [{ qty: 1, price: 115 }] },
    { id: 'r1', kind: 'return', refId: 'a', branchId: 'b1', date: D, status: 'paid', total: -57.5, vat: -7.5, loyalty: { ded: 5 } },
    { id: 'r2', kind: 'return', refId: 'z', branchId: 'b1', date: D2, status: 'paid', total: -23, vat: -3, loyalty: { ded: 2 } },
    { id: 'v', branchId: 'b1', date: D, status: 'void', total: 999, vat: 1 }, { id: 'x', branchId: 'b2', date: D, status: 'paid', total: 46, vat: 6 },
    { id: 'z', branchId: 'b2', date: D, status: 'paid', total: 23, vat: 3, loyalty: { pv: 0.5 } }, { id: 'z', branchId: 'b2', date: D2, status: 'paid', total: 11.5, vat: 1.5, loyalty: { pv: 0.7, earned: 3 } },
    { branchId: 'b1', date: D2, status: 'paid', total: 10, vat: 1.3, disc: 2, lines: [{ qty: 1, price: 12, disc: 2 }] }, undefined, { id: 'n', date: D, status: 'paid', total: 5, vat: 0.65 }];
  const ix = E.posGlIndex(O);
  for (const b of ['b1', 'b2', 'b9', undefined]) for (const d of [D, D2, '2026-01-01']) for (const pv of [0, 0.1]) for (const rate of [0, 15])
    assert.deepEqual(E.posGlDay(O, b, d, pv, rate, ix), E.posGlDay(O, b, d, pv, rate), 'فرع ' + b + ' يوم ' + d + ' قيمة نقطة ' + pv + ' نسبة ' + rate);
  // على الحجم الكبير: عيّنة من (فرع، يوم) — الفهرس والمسح الكامل متطابقان
  const { ops } = BIG; const big = E.posGlIndex(ops.posOrders);
  for (let k = 0; k < 7300; k += 731) { const c = ops.closings[k]; assert.deepEqual(E.posGlDay(ops.posOrders, c.branchId, c.date, 0.1, 15, big), E.posGlDay(ops.posOrders, c.branchId, c.date, 0.1, 15)); }
});

test('PERF-H-01 (انحدار): buildAccounting مع posGl لا يعود تربيعيًا — 1,200 إغلاق × 60 ألف فاتورة كان ≈ 10 ثوانٍ قبل v56.60', () => {
  const S = scaleData({ branches: 10, days: 120, orders: 60000, invoices: 0, assets: 0, employees: 0, suppliers: 1, customers: 0, salesInvoices: 0 });
  const org = { ...S.org, posGl: { on: true, from: S.first } }; let A;
  const t = ms(() => { A = E.buildAccounting(org, S.ops); });
  assert.equal(A.balanced, true); assert.ok(t < 1500, 'استغرق ' + Math.round(t) + 'ms');
});

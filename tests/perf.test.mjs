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

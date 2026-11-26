/**
 * v56.19 — MUKTASAB FINANCE E1: قائمة التغيرات في حقوق الملكية (IFRS for SMEs 6.3 — قرار المالك).
 * الأرقام المتوقعة محسوبة يدويًا. فحص الربط: الختامي = حقوق الملكية + أرباح الفترة غير المقفلة في المركز المالي.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const org = (x = {}) => ({ company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا', isActive: true }], taxCfg: { enabled: false }, ...x });
// افتتاحي 2026-01-01: نقد 50,000 ⇒ رأس مال 50,000 · مبيعات فبراير 12,000 (إغلاق) · مسحوبات مارس 3,000 · مصروف مارس 2,000
const ops = { closings: [{ id: 'c1', branchId: 'b1', branchName: 'العليا', date: '2026-02-10', status: 'approved', cashSales: 12000 }],
  journalManual: [{ id: 'j1', date: '2026-03-05', title: 'مسحوبات المالك', lines: [{ code: '3301', debit: 3000, credit: 0 }, { code: '1101', debit: 0, credit: 3000 }] },
    { id: 'j2', date: '2026-03-06', title: 'رسوم', lines: [{ code: '5901', debit: 2000, credit: 0 }, { code: '1201', debit: 0, credit: 2000 }] }] };
const o = org({ openingBalances: { asOf: '2026-01-01', lines: [{ code: '1101', debit: 50000, credit: 0 }] } });

test('E1: الصفوف والأعمدة — رأس المال والربح والمسحوبات، والختامي = المجموع', () => {
  const A = E.buildAccounting(o, ops);
  const S = E.equityStatement(A, '2026-01-01', '2026-12-31');
  assert.equal(S.rows.cap['3101'], 50000, 'القيد الافتتاحي في رأس المال');
  assert.equal(S.rows.profit.P, 10000, 'ربح الفترة 12,000 − 2,000');
  assert.equal(S.rows.draw['3301'], -3000);
  assert.equal(S.total.close, 57000);
  assert.equal(S.total.open, 0);
});

test('E1: الفترة الثانية تبدأ بختامي الأولى، وربح ما قبلها في عمود الأرباح غير المقفلة', () => {
  const A = E.buildAccounting(o, ops);
  const S = E.equityStatement(A, '2026-03-01', '2026-03-31');
  assert.equal(S.rows.open['3101'], 50000); assert.equal(S.rows.open.P, 12000);
  assert.equal(S.rows.profit.P, -2000); assert.equal(S.rows.draw['3301'], -3000);
  assert.equal(S.total.close, 57000);
});

test('E1: فحص الربط مع المركز المالي — الختامي = الأصول − الخصوم', () => {
  const A = E.buildAccounting(o, ops); const S = E.equityStatement(A, '', '2026-12-31');
  const bal = {}; A.entries.forEach(e => e.lines.forEach(l => { bal[l.code] = (bal[l.code] || 0) + l.debit - l.credit; }));
  const kind = {}; A.accounts.forEach(a => { kind[a.code] = a.kind; });
  const assets = Object.keys(bal).filter(c => kind[c] === 'asset').reduce((t, c) => t + bal[c], 0);
  const liab = Object.keys(bal).filter(c => kind[c] === 'liab').reduce((t, c) => t - bal[c], 0);
  assert.equal(Math.round((assets - liab) * 100) / 100, S.total.close);
});

test('E1: إقفال السنة نقل بين عمودين فقط — لا يتضاعف الربح', () => {
  const closeE = { id: 'yc', date: '2026-12-31', closing: true, lines: [{ code: '4101', debit: 12000, credit: 0 }, { code: '5901', debit: 0, credit: 2000 }, { code: '3201', debit: 0, credit: 10000 }] };
  const A = E.buildAccounting(o, ops); A.entries.push(closeE);
  const S = E.equityStatement(A, '2026-01-01', '2026-12-31');
  assert.equal(S.rows.yclose['3201'], 10000); assert.equal(S.rows.yclose.P, -10000); assert.equal(S.total.yclose, 0);
  assert.equal(S.rows.close.P, 0); assert.equal(S.rows.close['3201'], 10000); assert.equal(S.total.close, 57000);
});

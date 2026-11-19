/* v52.6 — BUG-00-12: فحص سلامة النقاط والكوبونات (رقابة كاشفة) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();

test('كل حركة نقاط تطابق مصدرها، وما لا مصدر له يُبرز', () => {
  const ops = { posOrders: [
    { id: 'o1', date: '2026-11-10', status: 'paid', loyalty: { phone: '5', earned: 10, redeemed: 20 } },
    { id: 'o2', date: '2026-11-11', status: 'void', loyalty: { phone: '5', earned: 4 } },
    { id: 'r1', date: '2026-11-12', kind: 'return' },
  ], mktMerges: [{ id: 'mg1' }] };
  const doc = { tx: [
    { id: 'o1:e', phone: '5', pts: 10 }, { id: 'o1:r', phone: '5', pts: -20 }, { id: 'o2:e', phone: '5', pts: 4 }, { id: 'o2:ve', phone: '5', pts: -4 }, { id: 'r1:rd', phone: '5', pts: -2 },
    { id: 'mg1:o', phone: '5', pts: -3 }, { id: 'mg1:i', phone: '6', pts: 3 }, { id: 'rw:x', phone: '5', pts: -50 }, { id: 'ex:5:2026-11', phone: '5', pts: -1 }, { id: 'la_1', phone: '5', pts: 7, ord: 'تعديل: خطأ — أحمد' },
    // مخالفات
    { id: 'o1:e', phone: '5', pts: 10 }, { id: 'zz:e', phone: '9', pts: 500, at: '2026-11-15T10:00:00Z' }, { id: 'o3:x', phone: '9', pts: 100 }, { id: 'mgX:i', phone: '9', pts: 40 },
  ] };
  const A = E.loyAudit(doc, ops);
  assert.deepEqual(A.flags.map(f => [f.id, f.why]), [['o1:e', 'dup'], ['zz:e', 'noOrder'], ['o3:x', 'unknown'], ['mgX:i', 'noMerge']]);
  assert.deepEqual([A.manual.n, A.manual.pts], [1, 7]); assert.equal(A.ok, false);
  const B = E.loyAudit({ tx: [{ id: 'o1:e', pts: 99 }, { id: 'o1:ve', pts: -10 }] }, ops);
  assert.deepEqual(B.flags.map(f => [f.why, f.expected]), [['mismatch', 10], ['notVoid', undefined]]);
});

test('الأقدم من الفواتير المحمّلة (مؤرشف) لا يُبلَّغ عنه، وحجز الكوبون بلا فاتورة بعد يوم سماح', () => {
  const ops = { posOrders: [{ id: 'o1', date: '2026-11-01', status: 'paid' }, { id: 'o2', date: '2026-11-02', status: 'void' }] };
  const now = Date.parse('2026-11-20T12:00:00Z');
  const doc = { tx: [{ id: 'old:e', pts: 5, at: '2025-01-01T00:00:00Z' }], cpn: { HI: [
    { id: 'o1', phone: '5', at: '2026-11-01T10:00:00Z' }, { id: 'gone', phone: '6', at: '2026-11-05T10:00:00Z' }, { id: 'o2', at: '2026-11-02T10:00:00Z' },
    { id: 'fresh', at: '2026-11-20T08:00:00Z' }, { id: 'rel', at: '2026-11-05T10:00:00Z', rel: '2026-11-05T11:00:00Z' } ] } };
  const A = E.loyAudit(doc, ops, { now });
  assert.equal(A.outOfRange, 1); assert.deepEqual(A.flags, []);
  assert.deepEqual(A.cpn.map(c => c.id), ['gone', 'o2']);
  assert.equal(E.loyAudit({ tx: [], cpn: {} }, ops).ok, true);
});

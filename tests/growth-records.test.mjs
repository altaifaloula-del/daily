/**
 * v56.17 — MUKTASAB GROWTH الدفعة 2: سجلات الموافقة التسويقية وحركات الولاء المحمية (نسخ موازٍ) — المحرك.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

test('شكل سجل الموافقة: حقول محددة، والقناة والحالة من قائمة مغلقة، والجوال أرقام فقط', () => {
  assert.deepEqual(E.mkcRecord({ id: 'mc-1', phone: '500000001', status: 'out', ch: 'sms', src: 'نقطة البيع', by: 'خالد', at: 'x', byId: 'u3', branchId: 'b1' }),
    { phone: '500000001', status: 'out', ch: 'sms', src: 'نقطة البيع', branchId: 'b1', byName: 'خالد' });
  const r = E.mkcRecord({ phone: '05-00', status: 'x', ch: 'fax' });
  assert.equal(r.phone, ''); assert.equal(r.status, 'in'); assert.equal(r.ch, 'all'); assert.equal(r.branchId, '');
});

test('الجديد فقط يُنسخ: ما عُدّل أو حُذف من المصدر لا يمس السجل', () => {
  const a = { id: 'mc-1', phone: '500000001', status: 'in' }, b = { id: 'mc-2', phone: '500000002', status: 'out' };
  assert.deepEqual(E.mkcDiff([a], [a, b]).map(x => x.id), ['mc-2']);
  assert.deepEqual(E.mkcDiff([a, b], [b]), [], 'الحذف من المصدر لا يُنسخ');
  assert.deepEqual(E.mkcDiff([], [{ id: 'bad/id', phone: '500000001' }, { id: 'mc-3', phone: '' }]), [], 'معرّف أو جوال غير صالح');
});

test('مطابقة الموافقات: ناقص ومختلف وزائد (السجل الزائد بلا أصل يستحق المراجعة)', () => {
  const src = [{ id: 'm1', phone: '500000001', status: 'in', ch: 'all' }, { id: 'm2', phone: '500000002', status: 'out', ch: 'sms', branchId: 'b1' }, { id: 'm3', phone: '500000003', status: 'in' }];
  const recs = [{ id: 'm1', phone: '500000001', status: 'in', ch: 'all', branchId: '' }, { id: 'm2', phone: '500000002', status: 'in', ch: 'sms', branchId: 'b1' }, { id: 'zz', phone: '500000009', status: 'in', ch: 'all', branchId: '' }];
  const R = E.mkcCompare(src, recs);
  assert.deepEqual([R.missing.map(x => x.id), R.differ.map(x => x.id), R.extra.map(x => x.id), R.ok], [['m3'], ['m2'], ['zz'], false]);
  assert.equal(E.mkcCompare(src.slice(0, 1), recs.slice(0, 1)).ok, true);
});

test('حركات الولاء: معرّف السجل آمن، والمطابقة بالجوال والنقاط', () => {
  assert.equal(E.lytDocId('po-1:ve'), 'po-1:ve');
  assert.match(E.lytDocId('bd/2026/500'), /^h_[0-9a-f]{48}$/, 'معرّف فيه «/» يُحوَّل لبصمة ثابتة');
  assert.equal(E.lytDocId('bd/2026/500'), E.lytDocId('bd/2026/500'));
  assert.deepEqual(E.lytRecord({ id: 'x', phone: '500000001', pts: 12.345, ord: 'ف1', br: 'b1', name: 'أحمد', at: 'y' }), { phone: '500000001', pts: 12.35, ord: 'ف1', br: 'b1', name: 'أحمد' });
  const tx = [{ id: 't1', phone: '500000001', pts: 10 }, { id: 't2', phone: '500000001', pts: -5 }, { id: 'a/b', phone: '500000002', pts: 3 }];
  const R = E.lytCompare(tx, [{ id: 't1', phone: '500000001', pts: 10 }, { id: 't2', phone: '500000001', pts: -50 }, { id: E.lytDocId('a/b'), phone: '500000002', pts: 3 }]);
  assert.deepEqual([R.missing.length, R.differ.map(x => x.id), R.extra.length], [0, ['t2'], 0]);
});

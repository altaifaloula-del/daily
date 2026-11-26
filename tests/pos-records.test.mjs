/**
 * v56.4 — MUKTASAB POS الدفعة 2a: محرك نسخ فواتير نقطة البيع إلى سجلاتها المحمية pos_orders (docs/pos/POS_DATABASE_DESIGN.md).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

const sale = (x = {}) => ({ id: 'po-1', no: 'ف1-261126-AB-0001', branchId: 'b1', dev: 'AB', date: '2026-11-26', status: 'paid', total: 115, vat: 15, net: 100,
  lines: [{ productId: 'p1', name: 'شاورما', qty: 2, price: 57.5 }], payments: [{ m: 'cash', amount: 115 }], icv: 1, hash: 'h1', ...x });

test('2a: مفتاح النسخ معطّل افتراضيًا', () => {
  assert.equal(E.posrOn({}), false); assert.equal(E.posrOn({ posRecords: {} }), false);
  assert.equal(E.posrOn({ posRecords: { on: true } }), true);
});

test('2a: شكل السجل كما تفحصه القواعد — والبصمة لا تتغير بالإلغاء ولا بعلامة الطابور', () => {
  const r = E.posrRecord(sale(), false);
  assert.deepEqual(Object.keys(r).sort(), ['branchId', 'data', 'date', 'dev', 'digest', 'kind', 'no', 'status', 'total', 'vat'].sort());
  assert.equal(r.kind, 'sale'); assert.equal(r.status, 'paid'); assert.match(r.digest, /^[0-9a-f]{64}$/); assert.equal(r.digest, E.sha256Hex(r.data));
  const v = E.posrRecord(sale({ status: 'void', voidBy: 'م', voidAt: '2026-11-26T10:00', voidReason: 'خطأ', voidNote: { no: 'م1-261126-AB-0001' } }), true);
  assert.equal(v.status, 'void'); assert.equal(v.digest, r.digest, 'الإلغاء لا يغيّر بصمة الفاتورة'); assert.match(v.voidData, /خطأ/);
  assert.equal(E.posrRecord(sale({ pending: true }), false).digest, r.digest, 'علامة الطابور لا تدخل البصمة');
  assert.notEqual(E.posrRecord(sale({ total: 1 }), false).digest, r.digest, 'تغيير المبلغ يغيّر البصمة');
  assert.equal(E.posrRecord(sale({ kind: 'return', total: -57.5 }), false).kind, 'return');
});

test('2a: الفرق — جديد يُنشأ، وأُلغي يُحدَّث، والحذف من المستند (أرشفة) لا يحذف السجل', () => {
  const a = sale(), b = sale({ id: 'po-2', no: 'ف1-261126-AB-0002' });
  assert.deepEqual(E.posrDiff([a], [a, b]).map(x => [x.o.id, x.mode]), [['po-2', 'create']]);
  assert.deepEqual(E.posrDiff([a, b], [{ ...a, status: 'void' }, b]).map(x => [x.o.id, x.mode]), [['po-1', 'void']]);
  assert.deepEqual(E.posrDiff([], [{ ...a, status: 'void' }]).map(x => x.mode), ['both'], 'وصلت ملغاة: إنشاء ثم إلغاء');
  assert.deepEqual(E.posrDiff([a, b], [b]), [], 'الأرشفة لا تحذف');
  assert.deepEqual(E.posrDiff([a], [a]), []);
  assert.deepEqual(E.posrDiff([], [{ ...a, id: 'bad id!' }]), [], 'معرّف غير صالح يُتخطى');
});

test('2a: المطابقة — ناقص، مختلف بالبصمة أو الحالة، وزائد بعد الأرشفة لا يُفشلها', () => {
  const a = sale(), b = sale({ id: 'po-2', no: 'ف1-261126-AB-0002' });
  const rec = (o, voided) => ({ id: o.id, ...E.posrRecord(o, voided) });
  let c = E.posrCompare([a, b], [rec(a)]); assert.equal(c.ok, false); assert.deepEqual(c.missing.map(o => o.id), ['po-2']);
  c = E.posrCompare([a], [{ ...rec(a), digest: 'f'.repeat(64) }]); assert.deepEqual(c.differ.map(o => o.id), ['po-1'], 'تلاعب بالأرقام');
  c = E.posrCompare([{ ...a, status: 'void' }], [rec(a)]); assert.deepEqual(c.differ.map(o => o.id), ['po-1'], 'إلغاء لم يُنسخ');
  c = E.posrCompare([{ ...a, status: 'void', voidBy: 'م' }], [rec({ ...a, status: 'void', voidBy: 'م' }, true)]); assert.equal(c.ok, true);
  c = E.posrCompare([a], [rec(a), rec(b)]); assert.equal(c.ok, true, 'زائد (مؤرشف) لا يُفشل'); assert.equal(c.extra.length, 1);
});

/**
 * v56.2 — MUKTASAB POS الدفعة 1: إصلاح عيوب نقطة البيع الموثقة في docs/pos/POS_AUDIT_REPORT.md (القسم 7).
 * B1 لا إلغاء بعد مرتجع · B4 لا رقم مكرر بعد فقد التخزين المحلي · B5 يوم مرتجعات فقط · B6 لا إلغاء بعد إغلاق الوردية · B7 حساب الطاولة.
 * الأرقام المتوقعة محسوبة يدويًا.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

const sale = (x = {}) => ({ id: 'po-1', no: 'ف1-261126-AB-0003', branchId: 'b1', dev: 'AB', shiftId: 'ps-1', date: '2026-11-26', status: 'paid', total: 115, vat: 15, net: 100,
  lines: [{ productId: 'p1', name: 'شاورما', qty: 2, price: 57.5 }], payments: [{ m: 'cash', amount: 115 }], icv: 7, hash: 'h7', ...x });
const ret = (x = {}) => ({ id: 'pr-1', kind: 'return', refId: 'po-1', no: 'م1-261126-AB-0001', branchId: 'b1', dev: 'AB', date: '2026-11-26', status: 'paid', total: -57.5, vat: -7.5, net: -50,
  retLines: [{ i: 0, qty: 1 }], payments: [{ m: 'cash', amount: -57.5 }], icv: 8, hash: 'h8', ...x });

test('B1: فاتورة لها مرتجع لا تُلغى (كان المرتجع يُخصم من مبيعات اليوم مرة ثانية)', () => {
  const o = sale(); const ops = { posOrders: [o, ret()], posShifts: [{ id: 'ps-1', status: 'open' }] };
  assert.match(E.posVoidBlock(ops, o), /مرتجع/);
  // وأثر العيب لو حدث الإلغاء: الأصل يُستبعد والمرتجع يبقى ⇒ مبيعات اليوم −57.5 بدل 0
  const bad = E.posDaySummary([{ ...o, status: 'void' }, ret()], 'b1', '2026-11-26');
  assert.equal(bad.total, -57.5, 'هذا ما كان يحدث — والحارس يمنعه');
  // مرتجع ملغى لا يمنع الإلغاء
  assert.equal(E.posVoidBlock({ posOrders: [o, ret({ status: 'void' })], posShifts: [{ id: 'ps-1', status: 'open' }] }, o), '');
});

test('B6: لا إلغاء بعد إغلاق وردية الفاتورة (تقرير Z يختل) — والمرتجع والفاتورة الملغاة لا يُلغيان', () => {
  const o = sale();
  assert.match(E.posVoidBlock({ posOrders: [o], posShifts: [{ id: 'ps-1', status: 'closed' }] }, o), /وردية/);
  assert.equal(E.posVoidBlock({ posOrders: [o], posShifts: [{ id: 'ps-1', status: 'open' }] }, o), '');
  assert.match(E.posVoidBlock({ posOrders: [] }, { ...o, status: 'void' }), /ملغاة/);
  assert.match(E.posVoidBlock({ posOrders: [] }, ret()), /المرتجع/);
});

test('B4: التسلسل وسلسلة البصمات يُستكملان من الفواتير المعروفة إن مُسح التخزين المحلي', () => {
  const known = [sale(), ret(), sale({ id: 'po-x', no: 'ف1-261126-ZZ-0009', dev: 'ZZ', icv: 99, hash: 'hz' }), sale({ id: 'po-old', no: 'ف1-261125-AB-0050', date: '2026-11-25', icv: 3, hash: 'h3' })];
  // التخزين المحلي ممسوح (0، بلا سلسلة): التالي بعد أعلى رقم لهذا الجهاز في اليوم نفسه، والحلقة من أعلى icv لهذا الجهاز
  let r = E.posNextNo(0, null, known, 'b1', 'AB', '2026-11-26', 'ف');
  assert.equal(r.seq, 4); assert.deepEqual(r.prev, { icv: 8, hash: 'h8' });
  // المرتجعات ترقيمها مستقل
  assert.equal(E.posNextNo(0, null, known, 'b1', 'AB', '2026-11-26', 'م').seq, 2);
  // المحلي الأحدث يُقدَّم (لا يرجع الرقم أبدًا)
  r = E.posNextNo(10, { icv: 20, hash: 'h20' }, known, 'b1', 'AB', '2026-11-26', 'ف');
  assert.equal(r.seq, 11); assert.deepEqual(r.prev, { icv: 20, hash: 'h20' });
  // إشعار الإلغاء داخل الفاتورة يُحتسب في ترقيم «م» وفي السلسلة
  const v = sale({ status: 'void', voidNote: { no: 'م1-261126-AB-0005', date: '2026-11-26', icv: 12, hash: 'h12' } });
  r = E.posNextNo(0, null, [v], 'b1', 'AB', '2026-11-26', 'م');
  assert.equal(r.seq, 6); assert.deepEqual(r.prev, { icv: 12, hash: 'h12' });
  // جهاز بلا فواتير: يبدأ من 1 وسلسلة فارغة
  assert.deepEqual(E.posNextNo(0, null, known, 'b1', 'NEW1', '2026-11-26', 'ف'), { seq: 1, prev: { icv: 0, hash: '0' } });
});

test('B5: يوم فيه مرتجعات فقط يبقى مصدره نقطة البيع في تعبئة الإغلاق', () => {
  const src = E.salesDaySource({ posOrders: [ret()], posImports: [] }, 'b1', '2026-11-26');
  assert.equal(src.src, 'pos'); assert.equal(src.retN, 1); assert.equal(src.total, -57.5); assert.equal(src.cash, -57.5);
  assert.deepEqual(E.salesDaySource({ posOrders: [], posImports: [] }, 'b1', '2026-11-26'), { n: 0 });
});

test('B7: نقص صنف أُرسل للمطبخ عند دفع الطاولة يُكشف (الزيادة والصنف الجديد مسموحان)', () => {
  const sent = [{ productId: 'p1', name: 'شاورما', qty: 3 }, { productId: 'p2', name: 'بطاطس', qty: 1, note: 'بدون ملح' }];
  assert.deepEqual(E.posTabCuts(sent, [{ productId: 'p1', qty: 3 }, { productId: 'p2', qty: 1, note: 'بدون ملح ' }, { productId: 'p9', qty: 2 }]), []);
  assert.deepEqual(E.posTabCuts(sent, [{ productId: 'p1', qty: 4 }, { productId: 'p2', qty: 1, note: 'بدون ملح' }]), []);
  assert.deepEqual(E.posTabCuts(sent, [{ productId: 'p1', qty: 2 }]), [
    { productId: 'p1', name: 'شاورما', sent: 3, now: 2 }, { productId: 'p2', name: 'بطاطس', sent: 1, now: 0 }]);
  assert.deepEqual(E.posTabCuts(null, [{ productId: 'p1', qty: 1 }]), []);
});

test('B3: إشعار الإلغاء يُطبع بعنوان «إلغاء فاتورة» ولا يغيّر عنوان المرتجع العادي', () => {
  const org = { company: { name: 'اختبار' }, posCfg: {} }; const br = { id: 'b1', name: 'طيبة' };
  const base = { no: 'م1-261126-AB-0002', at: '2026-11-26T10:00:00', refNo: 'ف1-261126-AB-0003', retLines: [{ name: 'شاورما', qty: 2, amount: 115 }], total: -115, vat: -15, net: -100, payments: [{ m: 'cash', amount: -115 }], reason: 'other', note: 'خطأ إدخال' };
  assert.match(E.posReturnHtml(org, { ...base, cancel: true }, br), /إشعار دائن — إلغاء فاتورة/);
  assert.match(E.posReturnHtml(org, base, br), /إشعار دائن — مرتجع/);
});

/**
 * v56.12 — MUKTASAB GROWTH الدفعة 1 (الأساس): إصلاح G1 وG3 وG4 وG5 وG6 في docs/growth/GROWTH_AUDIT_REPORT.md.
 * الأرقام المتوقعة محسوبة يدويًا.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

test('G1: سجلات التسويق برقم الفرع تذهب لمستند الفرع، والقديمة بلا فرع تبقى مركزية، والقراءة تجمعهما', () => {
  const ops = { mktConsents: [{ id: 'old', phone: '500000001', status: 'in' }, { id: 'n1', branchId: 'b1', phone: '500000002', status: 'out' }], mktProfiles: [], mktReferrals: [{ id: 'r1', branchId: 'b2', referrer: 'a', referred: 'b' }] };
  const { core, br } = E.splitOps(ops, ['b1', 'b2']);
  assert.deepEqual(core.mktConsents.map(x => x.id), ['old'], 'القديم يبقى في المركزي');
  assert.deepEqual(br.b1.mktConsents.map(x => x.id), ['n1']); assert.deepEqual(br.b2.mktReferrals.map(x => x.id), ['r1']);
  const back = E.composeOps(core, br);
  assert.deepEqual(back.mktConsents.map(x => x.id).sort(), ['n1', 'old']); assert.equal(back.mktReferrals.length, 1);
  // مدير الفرع لا يرى المستند المركزي ⇒ يرى سجلات فرعه فقط
  assert.deepEqual(E.composeOps({}, { b1: br.b1 }).mktConsents.map(x => x.id), ['n1']);
  // الحملات والدمج تبقى مركزية
  const src = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const core0 = /const CORE_COLS = \[([\s\S]*?)\];/.exec(src)[1];
  assert.ok(core0.includes("'mktMerges'") && core0.includes("'mktCampaigns'") && !core0.includes("'mktConsents'"));
});

test('G1: رقم الفرع — المفتاح المعطّل لا يضيف شيئًا، والمركز يكتب لفرع العميل، والفرع لفرعه دائمًا', () => {
  const c = { phone: '5', branches: [{ id: 'b2', n: 3 }, { id: 'b1', n: 1 }] };
  assert.equal(E.mktRecBranch(false, false, c, ['b1']), '', 'معطّل ⇒ السلوك السابق');
  assert.equal(E.mktRecBranch(true, true, c, null), 'b2', 'المركز: فرع العميل الأكثر زيارة');
  assert.equal(E.mktRecBranch(true, true, { branches: [] }, null), '', 'عميل بلا فرع ⇒ مركزي');
  assert.equal(E.mktRecBranch(true, false, c, ['b1']), 'b1', 'الفرع لا يكتب لفرع آخر');
  assert.equal(E.mktRecBranch(true, false, c, ['b1', 'b2']), 'b2');
  assert.equal(E.mktBrOn({}), false); assert.equal(E.mktBrOn({ mktBranch: { on: true } }), true);
  assert.equal(E.MKT_BR_CV, 561200, 'يساوي رقم هذا الإصدار v56.12');
  // الفرع لا يستطيع إنشاء سجل تسويق بلا فرعه (يُرفض قبل الحفظ)
  assert.equal(E.outOfScopeRecords({ mktConsents: [{ id: 'x', phone: '5' }] }, {}, ['b1']).length, 1);
  assert.equal(E.outOfScopeRecords({ mktConsents: [{ id: 'x', phone: '5', branchId: 'b1' }] }, {}, ['b1']).length, 0);
});

test('G3: نتائج الحملة تحتسب الرقم المدموج لعميله', () => {
  const org = { posPromos: [{ id: 'p1', code: 'WIN' }] };
  const ops = { mktMerges: [{ id: 'm1', from: '500000009', to: '500000001' }], posOrders: [
    { id: 'a', date: '2026-11-05', branchId: 'b1', coupon: 'WIN', total: 100, lines: [], loyalty: { phone: '0500000009' } }] };
  const list = [{ phone: '500000001', tags: ['churn'], first: '2026-11-05' }];
  const S = E.campStats(org, ops, list, { promoIds: ['p1'], from: '2026-11-01', to: '2026-11-30', segment: 'churn' });
  assert.equal(S.responders, 1, 'كان 0 قبل الإصلاح'); assert.equal(S.newCustomers, 1);
  // بعد التراجع عن الدمج لا يُحتسب
  const S2 = E.campStats(org, { ...ops, mktMerges: [...ops.mktMerges, { id: 'u1', undoOf: 'm1' }] }, list, { promoIds: ['p1'], from: '2026-11-01', to: '2026-11-30', segment: 'churn' });
  assert.equal(S2.responders, 0);
});

test('G4: التكرار بالاسم أو البريد الواحد، والتراجع عن الدمج بسجل إلحاق', () => {
  const L = [{ id: '1', phone: '500000001', name: 'محمد علي', n: 5 }, { id: '2', phone: '500000002', name: 'محمد  علي', n: 1 },
    { id: '3', phone: '500000003', name: 'سارة', n: 2 }, { id: '4', phone: '500000004', name: 'Sara A', n: 7 }];
  const g = E.crmDupes(L, { 500000003: { email: 'S@x.com' }, 500000004: { email: 's@x.com ' } });
  assert.equal(g.length, 2);
  const em = g.find(x => x.why === 'email'); assert.deepEqual(em.items.map(c => c.id), ['4', '3'], 'الأكثر زيارة أولًا');
  assert.equal(g.find(x => x.why === 'name').items.length, 2);
  // مجموعة مكررة بنفس الأعضاء لا تظهر مرتين
  assert.equal(E.crmDupes([L[0], L[1]], { 500000001: { email: 'a@b.co' }, 500000002: { email: 'a@b.co' } }).length, 1);
  const M = [{ id: 'm1', from: 'x', to: 'y' }, { id: 'm2', from: 'p', to: 'q' }, { id: 'u', undoOf: 'm2' }];
  assert.deepEqual(E.mktMergesLive({ mktMerges: M }).map(x => x.id), ['m1']);
  const A = E.mktAlias({ mktMerges: M }); assert.equal(A('x'), 'y'); assert.equal(A('p'), 'p', 'الدمج الملغى لا يُطبق');
});

test('G5: الاستبدال المعلّق — كوبونه صدر ⇒ تم، لم يصدر بعد دقيقة ⇒ إرجاع النقاط بمعرّف ثابت', () => {
  const now = Date.parse('2026-11-26T12:00:00Z');
  const P = [{ txid: 'rw:1', code: 'RWAAA', phone: '5', pts: 200, at: '2026-11-26T11:00:00Z' }, { txid: 'rw:2', code: 'RWBBB', phone: '6', pts: 50, at: '2026-11-26T11:00:00Z' },
    { txid: 'rw:3', code: 'RWCCC', phone: '7', pts: 10, at: '2026-11-26T11:59:30Z' }];
  const tx = [{ id: 'rw:2', phone: '6', pts: -50 }, { id: 'rw:3', phone: '7', pts: -10 }];
  const r = E.rwPendSplit(P, [{ code: 'rwaaa' }], now, tx);
  assert.deepEqual(r.done.map(x => x.txid), ['rw:1']); assert.deepEqual(r.refund.map(x => x.txid), ['rw:2']); assert.deepEqual(r.wait.map(x => x.txid), ['rw:3'], 'أقل من دقيقة: ينتظر');
  // مراجعة الأمن 7 / المراقب 1: لا إرجاع لخصم لم يحدث، ولا لخصم أُرجع، ولا لحركة لا تطابق الجوال والقيمة
  assert.equal(E.rwPendSplit([P[1]], [], now, []).refund.length, 0, 'لم يُخصم ⇒ لا نقاط مجانية');
  assert.equal(E.rwPendSplit([P[1]], [], now, [...tx, { id: 'rw:2:undo', phone: '6', pts: 50 }]).refund.length, 0, 'أُرجع من قبل');
  assert.equal(E.rwPendSplit([P[1]], [], now, [{ id: 'rw:2', phone: '9', pts: -50 }]).refund.length, 0, 'جوال آخر');
  assert.equal(E.rwPendSplit([{ ...P[1], pts: 5000 }], [], now, tx).refund.length, 0, 'قيمة معدّلة على الجهاز');
  // الكوبون يحمل رقم حركة الخصم ⇒ يُعرف ولو تغيّر رمزه
  assert.deepEqual(E.rwPendSplit([P[1]], [{ code: 'X', rwTx: 'rw:2' }], now, tx).done.map(x => x.txid), ['rw:2']);
  const u = E.rwUndoTx(P[1], '2026-11-26T12:00:00Z');
  assert.equal(u.id, 'rw:2:undo', 'نفس معرّف الإرجاع في الاستبدال ⇒ لا يتكرر في دفتر الولاء'); assert.equal(u.pts, 50); assert.equal(u.phone, '6');
});

test('G6 وG5: التصدير يُسجَّل في سجل التدقيق، والاستبدال يحفظ المعلّق قبل خصم النقاط', () => {
  const src = fs.readFileSync(new URL('../mods/mkt/MktGrowth.jsx', import.meta.url), 'utf8');
  const exp = /const exp = \(k, onlyOk\) => \{[\s\S]*?dl\(/.exec(src)[0]; assert.match(exp, /return logAudit\(\{ actionType: 'export'/); assert.match(exp, /ok === false\) return say/, 'لا تنزيل إن فشل التسجيل');
  const rd = /const redeem = async \(\) => \{[\s\S]*?\n  \};/.exec(src)[0];
  assert.ok(rd.indexOf('rwPendSet([...rwPend(), pend])') < rd.indexOf('await loyPost('), 'المعلّق يُحفظ قبل الخصم');
  assert.ok(!/ok === false\) \{ const back/.test(rd), 'لا إرجاع فوري عند خطأ غير مؤكد (قد يكون الكوبون حُفظ)');
  assert.match(rd, /rewardCoupon\(R0, c\.phone, today\(\), code, txid\)/, 'الكوبون يحمل رقم حركة الخصم');
});

test('المراقب 3: التراجع عن الدمج يُمنع إن صُرفت النقاط المنقولة أو تلاه دمج يمس الرقمين', () => {
  const x = { id: 'm1', from: 'A', to: 'B', pts: 200, at: '2026-11-20T10:00:00Z' };
  const tx = [{ phone: 'B', pts: 100 }, { phone: 'B', pts: 200 }];
  assert.equal(E.mktUnmergeBlock({ mktMerges: [x] }, tx, x), '', 'الرصيد يكفي');
  assert.match(E.mktUnmergeBlock({ mktMerges: [x] }, [...tx, { phone: 'B', pts: -150 }], x), /صُرف/, '300−150=150 < 200');
  const y = { id: 'm2', from: 'B', to: 'C', pts: 300, at: '2026-11-21T10:00:00Z' };
  assert.match(E.mktUnmergeBlock({ mktMerges: [x, y] }, tx, x), /الأحدث/);
  assert.equal(E.mktUnmergeBlock({ mktMerges: [x, y, { id: 'u', undoOf: 'm2' }] }, tx, x), '', 'بعد التراجع عن الأحدث');
});

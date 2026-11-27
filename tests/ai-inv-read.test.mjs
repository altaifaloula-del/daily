/**
 * v56.55 — البند F: قراءة فاتورة المورد بالذكاء الاصطناعي كمقترح (docs/finance/07-AI-INVOICE-READ.md).
 * الأرقام وهمية ومحسوبة يدويًا: صافي 1,000 + ضريبة 15% = 150 ⇒ إجمالي 1,150. الأرقام الضريبية وهمية بصيغة صحيحة (3…3).
 * لا نداء لـ Anthropic: دالة الذكاء الاصطناعي محقونة، وحراسات المسار تُختبر وحدها.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildEngine } from './build-engine.mjs';
import { AI_INV_ROLES as SRV_ROLES, AI_INV_MAX_BYTES, aiInvInput, aiInvClean, mountAiInvoice, AI_INV_SYSTEM } from '../server-aiinv.js';

let E;
before(async () => { E = await buildEngine(); });

const VAT_A = '300000000000003', VAT_B = '311111111111113';
const SUPS = [{ id: 's1', name: 'مؤسسة الأغذية الطازجة للتجارة', vatNo: VAT_A }, { id: 's2', name: 'شركة الخضار والفواكه', tax: VAT_B }, { id: 's3', name: 'مخبز النخبة' }];
const ctx = (x = {}) => ({ suppliers: SUPS, invoices: [], taxRate: 15, today: '2026-03-15', lockedThrough: '', ...x });
const read = (x = {}) => ({ supplierName: 'مؤسسة الأغذية الطازجة', supplierVatNo: VAT_A, invoiceNo: 'F-100', date: '2026-03-10', currency: 'SAR', subtotal: 1000, vat: 150, total: 1150,
  lines: [{ desc: 'لحم', qty: 10, price: 60, amount: 600 }, { desc: 'دجاج', qty: 20, price: 20, amount: 400 }], confidence: { invoiceNo: 0.95, total: 0.9 }, notes: null, ...x });
const codes = (r) => r.warnings.map(w => w.code).sort();

/* ===== المحرك: aiInvCheck ===== */
test('فاتورة سليمة: المورد يُطابَق برقمه الضريبي التام، ولا تحذيرات', () => {
  const r = E.aiInvCheck(read(), ctx());
  assert.equal(r.supplierId, 's1'); assert.deepEqual(r.supplierCandidates, []); assert.deepEqual(r.warnings, []);
  assert.deepEqual([r.fields.subtotal, r.fields.vat, r.fields.total, r.fields.invoiceNo, r.fields.date, r.fields.currency], [1000, 150, 1150, 'F-100', '2026-03-10', 'SAR']);
});

test('المطابقة بالرقم الضريبي وحده: المسافات والأرقام العربية تُطبَّع، وحقل tax في بطاقة المورد معتبر', () => {
  assert.equal(E.aiInvCheck(read({ supplierVatNo: '٣٠٠ ٠٠٠ ٠٠٠ ٠٠٠ ٠٠٣' }), ctx()).supplierId, 's1');
  assert.equal(E.aiInvCheck(read({ supplierName: 'أي اسم', supplierVatNo: VAT_B }), ctx()).supplierId, 's2');
  // الاسم مطابق تمامًا لكن الرقم مختلف ⇒ لا اختيار آلي، مرشّحون فقط
  const r = E.aiInvCheck(read({ supplierName: 'مخبز النخبة', supplierVatNo: '322222222222223' }), ctx());
  assert.equal(r.supplierId, null); assert.equal(r.supplierCandidates[0].id, 's3'); assert.equal(r.supplierCandidates[0].score, 1);
  assert.ok(codes(r).includes('supplier_unmatched'));
});

test('بلا رقم ضريبي مطابق: قائمة مرشّحين بتشابه الاسم مرتبة (لا اختيار آلي ولا إنشاء مورد)', () => {
  const r = E.aiInvCheck(read({ supplierVatNo: null, supplierName: 'الخضار والفواكه' }), ctx());
  assert.equal(r.supplierId, null);
  assert.deepEqual(r.supplierCandidates.map(c => c.id), ['s2']);
  assert.ok(r.supplierCandidates[0].score >= 0.34);
  assert.ok(codes(r).includes('supplier_unmatched'));
  const none = E.aiInvCheck(read({ supplierVatNo: null, supplierName: 'مورد غير معروف إطلاقًا' }), ctx());
  assert.deepEqual(none.supplierCandidates, []);
  assert.equal(E.aiInvSim('مؤسسة الأغذية', 'مؤسسة الاغذية'), 1, 'الهمزات تُوحَّد');
});

test('رقم ضريبي مكرر بين موردَين: لا اختيار آلي، والمرشّحان بالرقم نفسه', () => {
  const r = E.aiInvCheck(read(), ctx({ suppliers: [...SUPS, { id: 's9', name: 'فرع آخر', vatNo: VAT_A }] }));
  assert.equal(r.supplierId, null); assert.deepEqual(r.supplierCandidates.map(c => c.id).sort(), ['s1', 's9']); assert.ok(codes(r).includes('vat_multi'));
});

test('المورد الموقوف لا يُطابَق', () => {
  const r = E.aiInvCheck(read(), ctx({ suppliers: [{ ...SUPS[0], active: false }] }));
  assert.equal(r.supplierId, null);
});

test('تحذير: رقم ضريبي غير صالح', () => {
  const r = E.aiInvCheck(read({ supplierVatNo: '123456789012345' }), ctx());
  assert.ok(codes(r).includes('vat_no_invalid')); assert.equal(r.supplierId, null);
});

test('تحذير: الصافي + الضريبة ≠ الإجمالي (فوق 0.05 فقط)', () => {
  assert.ok(codes(E.aiInvCheck(read({ total: 1150.06 }), ctx())).includes('sum_mismatch'));
  assert.ok(!codes(E.aiInvCheck(read({ total: 1150.05 }), ctx())).includes('sum_mismatch'));
});

test('تحذير: الضريبة ≠ النسبة × الصافي (الحد الأكبر بين 0.05 و0.5%)', () => {
  // المتوقع 150: الحد 0.75
  assert.ok(!codes(E.aiInvCheck(read({ vat: 150.7, total: 1150.7 }), ctx())).includes('vat_rate'));
  assert.ok(codes(E.aiInvCheck(read({ vat: 151, total: 1151 }), ctx())).includes('vat_rate'));
  // صافي صغير: الحد 0.05
  const s = read({ subtotal: 2, vat: 0.36, total: 2.36, lines: [] });
  assert.ok(codes(E.aiInvCheck(s, ctx())).includes('vat_rate'));
  assert.ok(!codes(E.aiInvCheck(read({ subtotal: 2, vat: 0.3, total: 2.3, lines: [] }), ctx())).includes('vat_rate'));
  // الضريبة غير مفعّلة في المنشأة ⇒ لا فحص للنسبة
  assert.ok(!codes(E.aiInvCheck(read({ vat: 151, total: 1151 }), ctx({ taxOn: false }))).includes('vat_rate'));
  // نسبة أخرى من الإعداد
  assert.ok(!codes(E.aiInvCheck(read({ vat: 50, total: 1050 }), ctx({ taxRate: 5 }))).includes('vat_rate'));
});

test('تحذير: تاريخ بعد اليوم', () => {
  assert.ok(codes(E.aiInvCheck(read({ date: '2026-03-16' }), ctx())).includes('future_date'));
  assert.ok(!codes(E.aiInvCheck(read({ date: '2026-03-15' }), ctx())).includes('future_date'));
});

test('تحذير: تاريخ في فترة مقفلة (periodLocks.lockedThrough بالشهر كما في periodLocked)', () => {
  assert.ok(codes(E.aiInvCheck(read({ date: '2026-02-28' }), ctx({ lockedThrough: '2026-02' }))).includes('locked_period'));
  assert.ok(!codes(E.aiInvCheck(read({ date: '2026-03-01' }), ctx({ lockedThrough: '2026-02' }))).includes('locked_period'));
});

test('تحذير: رقم فاتورة مكرر للمورد المطابَق (بمنطق purKey نفسه: تطبيع الرقم)', () => {
  const inv = [{ id: 'v1', supplierId: 's1', invoiceNo: 'f-100', date: '2026-01-02', amount: 10 }];
  assert.ok(codes(E.aiInvCheck(read(), ctx({ invoices: inv }))).includes('dup_invoice'));
  assert.ok(!codes(E.aiInvCheck(read(), ctx({ invoices: [{ ...inv[0], supplierId: 's2' }] }))).includes('dup_invoice'), 'مورد آخر');
  assert.ok(!codes(E.aiInvCheck(read(), ctx({ invoices: [{ ...inv[0], creditNote: true }] }))).includes('dup_invoice'), 'إشعار دائن ليس فاتورة');
  assert.equal(E.purKey({ supplierId: 's1', invoiceNo: 'F-100' }), E.purKey(inv[0]));
});

test('تحذير: عملة غير الريال (والصيغ العربية للريال تُعدّ ريالًا)', () => {
  assert.ok(codes(E.aiInvCheck(read({ currency: 'usd' }), ctx())).includes('currency'));
  for (const c of ['ر.س', 'ريال', 'SR', 'sar']) assert.ok(!codes(E.aiInvCheck(read({ currency: c }), ctx())).includes('currency'), c);
});

test('تحذير: ثقة منخفضة (< 0.6) يذكر الحقول بالعربية', () => {
  const r = E.aiInvCheck(read({ confidence: { invoiceNo: 0.59, total: 0.6, date: 0.2 } }), ctx());
  const w = r.warnings.find(x => x.code === 'low_conf'); assert.ok(w); assert.match(w.text, /رقم الفاتورة/); assert.match(w.text, /التاريخ/); assert.doesNotMatch(w.text, /الإجمالي/);
});

test('تحذير: مجموع البنود ≠ الصافي (الكمية × السعر حين يغيب المبلغ)', () => {
  assert.ok(codes(E.aiInvCheck(read({ lines: [{ qty: 10, price: 60 }, { amount: 399.9 }] }), ctx())).includes('lines_sum'));
  assert.ok(!codes(E.aiInvCheck(read({ lines: [{ qty: 10, price: 60 }, { amount: 400 }] }), ctx())).includes('lines_sum'));
  assert.ok(!codes(E.aiInvCheck(read({ lines: [{ desc: 'غير مقروء' }, { amount: 1 }] }), ctx())).includes('lines_sum'), 'بند غير مكتمل ⇒ لا فحص');
});

test('مدخلات تالفة أو فارغة: لا انهيار، حقول null، وتحذير «لم يُقرأ شيء»', () => {
  for (const bad of [null, undefined, 'نص', 42, [], { subtotal: 'abc', total: Infinity, date: '2026-02-30', lines: 'x', confidence: 'x' }]) {
    const r = E.aiInvCheck(bad, null);
    assert.equal(r.supplierId, null); assert.deepEqual(r.supplierCandidates, []);
    assert.equal(r.fields.subtotal, null); assert.equal(r.fields.total, null); assert.equal(r.fields.date, null); assert.deepEqual(r.fields.lines, []);
    assert.ok(codes(r).includes('empty'), JSON.stringify(bad));
  }
  const r = E.aiInvCheck({ total: '1,150.50', lines: Array.from({ length: 150 }, () => ({ amount: 1 })) }, ctx());
  assert.equal(r.fields.total, 1150.5); assert.equal(r.fields.lines.length, 100);
});

test('حتمية: النتيجة نفسها للمدخلات نفسها', () => {
  assert.deepEqual(E.aiInvCheck(read({ supplierVatNo: null }), ctx()), E.aiInvCheck(read({ supplierVatNo: null }), ctx()));
});

test('aiInvEdited: الحقول المطبّقة التي تغيّرت قيمتها بعد التطبيق', () => {
  assert.deepEqual(E.aiInvEdited(['invoiceNo', 'date', 'supplierId'], { invoiceNo: 'F-1', date: '2026-03-10', supplierId: 's1' }, { invoiceNo: 'F-1 ', date: '2026-03-10', supplierId: 's2' }), ['invoiceNo', 'supplierId']);
  assert.deepEqual(E.aiInvEdited(null, null, null), []);
});

test('المفتاح مطفأ افتراضيًا: aiInvOn للمنشأة القديمة بلا الحقل false', () => {
  assert.equal(E.aiInvOn({}), false); assert.equal(E.aiInvOn({ purchaseCfg: { inspect: true } }), false); assert.equal(E.aiInvOn({ purchaseCfg: { aiRead: true } }), true); assert.equal(E.aiInvOn(null), false);
});

test('انجراف الأدوار: قائمة الخادم = قائمة المحرك = من يفتح نموذج فاتورة التوريد (المشتريات، نطاق كامل، ليس عرضًا فقط)', () => {
  assert.deepEqual([...SRV_ROLES].sort(), [...E.AI_INV_ROLES].sort());
  const derived = Object.keys(E.ROLES).filter(r => { const R = E.ROLES[r]; return (R.tabs || []).includes('purchasing') && R.scope === 'all' && !R.readOnly; }).sort();
  assert.deepEqual(derived, [...E.AI_INV_ROLES].sort());
});

/* ===== الخادم: التنقية والتحقق من المدخلات ===== */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const IMG = 'data:image/png;base64,' + PNG;

test('aiInvInput: الصيغ المقبولة فقط، والحقول غير المتوقعة مرفوضة، والحجم 413', () => {
  assert.equal(aiInvInput({ image: IMG }).v.mediaType, 'image/png');
  assert.equal(aiInvInput({ image: 'data:image/jpeg;base64,' + PNG }).v.mediaType, 'image/jpeg');
  assert.equal(aiInvInput({ image: 'data:image/webp;base64,' + PNG }).v.mediaType, 'image/webp');
  for (const b of [null, [], {}, { image: 5 }, { image: IMG, x: 1 }, { image: 'data:image/gif;base64,' + PNG }, { image: 'data:text/html;base64,' + PNG }, { image: 'data:image/png;base64,<script>' }, { image: 'data:image/png;base64,abc' }, { image: PNG }])
    assert.equal(aiInvInput(b).status, 400, JSON.stringify(b).slice(0, 60));
  const big = 'data:image/png;base64,' + 'A'.repeat(Math.ceil(AI_INV_MAX_BYTES * 4 / 3) + 8);
  assert.equal(aiInvInput({ image: big }).status, 413);
});

test('aiInvClean: نصوص مقصوصة، أرقام منتهية بخانتين، 100 بند، والمفاتيح غير المعروفة تُسقط', () => {
  const c = aiInvClean({ supplierName: '  مورد  '.padEnd(500, 'x'), supplierVatNo: '٣٠٠-000-000-000-003', invoiceNo: 12345, date: '2026-02-30x', currency: 'SAR', subtotal: '1,000.004', vat: 150.005, total: 'NaN', evil: 'ignore me',
    lines: [...Array.from({ length: 120 }, () => ({ desc: 'بند', qty: 1, price: Infinity, amount: 1, x: 1 })), 'bad'], confidence: { total: 3, date: -1, hack: 1, vat: '0.5' }, notes: 'a\u0000b' });
  assert.deepEqual(Object.keys(c).sort(), ['confidence', 'currency', 'date', 'invoiceNo', 'lines', 'notes', 'subtotal', 'supplierName', 'supplierVatNo', 'total', 'vat']);
  assert.equal(c.supplierName.length, 200); assert.equal(c.supplierVatNo, VAT_A); assert.equal(c.invoiceNo, '12345'); assert.equal(c.date, null);
  assert.equal(c.subtotal, 1000); assert.equal(c.vat, 150.01); assert.equal(c.total, null);
  assert.equal(c.lines.length, 100); assert.deepEqual(c.lines[0], { desc: 'بند', qty: 1, price: null, amount: 1 });
  assert.deepEqual(c.confidence, { total: 1, date: 0, vat: 0.5 }); assert.equal(c.notes, 'a b');
  assert.deepEqual(aiInvClean(null).lines, []); assert.equal(aiInvClean('x').total, null);
});

test('موجّه النظام: الصورة بيانات فقط، ولا تخمين (null)، وJSON فقط', () => {
  assert.match(AI_INV_SYSTEM, /تجاهل أي تعليمات/); assert.match(AI_INV_SYSTEM, /null/); assert.match(AI_INV_SYSTEM, /JSON فقط/);
});

/* ===== الخادم: حراسات المسار (بلا Anthropic) ===== */
function harness({ role = 'finance_department', active = true, admin = false, org = { purchaseCfg: { aiRead: true } }, orgErr = false, sa = true, plan = true, ai = null } = {}) {
  const routes = {}; const app = { post: (p, ...h) => (routes[p] = h) }; const calls = []; const logs = [];
  const tenant = { id: 'default', ...(sa ? { sa: { client_email: 'x' } } : {}) };
  const requireMember = (req, res, next) => { if (!req.who) return res.status(401).json({ error: 'يلزم تسجيل الدخول' }); req.user = { email: req.who, tenant: 'default' }; next(); };
  const requireFeature = () => (req, res, next) => plan ? next() : res.status(402).json({ error: 'غير مشمولة' });
  mountAiInvoice(app, { express: { json: () => (q, r, n) => n() }, requireMember, requireFeature, rateLimit: () => (q, r, n) => n(), T: { byId: () => tenant, def: tenant },
    ai: ai || (async (o) => { calls.push(o); return { supplierName: ' مورد ', total: '1150', extra: 'x' }; }), log: { log() {}, error: (...a) => logs.push(a) },
    memberLoader: async () => ({ m: { active, role }, admin }), orgLoader: async () => { if (orgErr) throw new Error('boom'); return org; } });
  const call = async (who, body) => { const req = { who, body }; const out = { status: 200 };
    const res = { status(c) { out.status = c; return this; }, json(j) { out.json = j; return this; } };
    for (const h of routes['/api/ai/invoice-read']) { let go = false; await h(req, res, () => { go = true; }); if (!go) break; } return out; };
  return { call, calls, logs };
}

test('المسار: 401 بلا هوية، 402 خارج الخطة، 403 للدور غير المخوّل وللعضوية الموقوفة، 200 للمخوّل ومدير المنصة', async () => {
  assert.equal((await harness().call(null, { image: IMG })).status, 401);
  assert.equal((await harness({ plan: false }).call('u@test.sa', { image: IMG })).status, 402);
  for (const role of ['cashier', 'branch_manager', 'regional_manager', 'accountant_view', 'accountant', 'cost_controller', '']) {
    const H = harness({ role }); assert.equal((await H.call('u@test.sa', { image: IMG })).status, 403, role); assert.equal(H.calls.length, 0);
  }
  assert.equal((await harness({ active: false }).call('u@test.sa', { image: IMG })).status, 403, 'موقوف');
  for (const role of SRV_ROLES) assert.equal((await harness({ role }).call('u@test.sa', { image: IMG })).status, 200, role);
  assert.equal((await harness({ role: '', admin: true }).call('a@test.sa', { image: IMG })).status, 200, 'مدير المنصة');
});

test('المسار: 403 حين المفتاح مطفأ أو مستند المنشأة غير مقروء أو بلا حساب خدمة (فشل مغلق) — ولا نداء للذكاء الاصطناعي', async () => {
  for (const o of [{ org: {} }, { org: { purchaseCfg: {} } }, { org: { purchaseCfg: { aiRead: 'true' } } }, { org: null }, { orgErr: true }, { sa: false }]) {
    const H = harness(o); const r = await H.call('u@test.sa', { image: IMG }); assert.equal(r.status, 403, JSON.stringify(o)); assert.equal(H.calls.length, 0);
  }
});

test('المسار: 400 لصورة خاطئة و413 للكبيرة، قبل أي نداء', async () => {
  const H = harness();
  assert.equal((await H.call('u@test.sa', { image: 'data:image/gif;base64,' + PNG })).status, 400);
  assert.equal((await H.call('u@test.sa', { img: IMG })).status, 400);
  assert.equal((await H.call('u@test.sa', { image: 'data:image/png;base64,' + 'A'.repeat(3600000) })).status, 413);
  assert.equal(H.calls.length, 0);
});

test('المسار: الصورة تُرسل كتلة محتوى مع النص، والرد يُنقّى، والخطأ يُسجَّل بلا محتوى', async () => {
  const H = harness(); const r = await H.call('u@test.sa', { image: IMG });
  assert.equal(r.status, 200); assert.equal(r.json.result.supplierName, 'مورد'); assert.equal(r.json.result.total, 1150); assert.equal('extra' in r.json.result, false);
  const u = H.calls[0].user; assert.ok(Array.isArray(u)); assert.deepEqual(u[0], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG } }); assert.equal(u[1].type, 'text');
  const Hx = harness({ ai: async () => { const e = new Error('مزود الذكاء الاصطناعي مشغول'); e.status = 429; throw e; } });
  const rx = await Hx.call('u@test.sa', { image: IMG }); assert.equal(rx.status, 429);
  assert.ok(!JSON.stringify(Hx.logs).includes(PNG.slice(0, 20)), 'لا صورة في السجل');
});

test('المسار بالمحمّلات الافتراضية: تعذّر قراءة مستند المنشأة من Firestore ⇒ 403 (فشل مغلق)', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
  const sa = { client_email: 'ops@test-prod.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'test-prod' };
  const tenant = { id: 'default', projectId: 'test-prod', sa };
  const F = (o) => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'boolean' ? { booleanValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(x => ({ stringValue: x })) } } : { stringValue: String(v) }])) });
  const mk = (orgDoc) => { const routes = {}; let ai = 0;
    const fetchImpl = async (u) => { const ok = (j) => ({ ok: true, status: 200, json: async () => j });
      if (u.includes('oauth2')) return ok({ access_token: 'AT', expires_in: 3600 });
      if (u.includes('/members/')) return ok(F({ active: true, role: 'finance_department' }));
      if (u.endsWith('/platform/admins')) return ok(F({ emails: [] }));
      if (u.endsWith('/platform/rms8_org')) return orgDoc ? ok(orgDoc) : { ok: false, status: 500, json: async () => ({}) };
      return { ok: false, status: 404, json: async () => ({}) }; };
    mountAiInvoice({ post: (p, ...h) => (routes[p] = h) }, { express: { json: () => (q, r, n) => n() }, requireMember: (q, r, n) => { q.user = { email: 'f@test.sa', tenant: 'default' }; n(); }, requireFeature: () => (q, r, n) => n(),
      rateLimit: () => (q, r, n) => n(), T: { byId: () => tenant, def: tenant }, fetchImpl, log: { log() {}, error() {} }, ai: async () => { ai++; return {}; } });
    return async () => { const out = { status: 200 }; const res = { status(c) { out.status = c; return this; }, json(j) { out.json = j; return this; } };
      for (const h of routes['/api/ai/invoice-read']) { let go = false; await h({ body: { image: IMG } }, res, () => { go = true; }); if (!go) break; } return { ...out, ai }; }; };
  assert.equal((await (mk(null))()).status, 403, 'خطأ قراءة');
  assert.equal((await (mk({ fields: {} }))()).status, 403, 'مستند فارغ');
  assert.equal((await (mk(F({ parts: '1', value: JSON.stringify({ purchaseCfg: { aiRead: false } }) })))()).status, 403, 'مطفأ');
  const ok = await (mk(F({ parts: '1', value: JSON.stringify({ purchaseCfg: { aiRead: true } }) })))(); assert.equal(ok.status, 200); assert.equal(ok.ai, 1);
});

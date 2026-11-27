/**
 * v56.50 — إرسال الرسائل للعملاء: الجمهور (حملة/ولاء/آجل)، الاعتماد بغير المنشئ، والخادم (/api/comms/send بالمحوّل التجريبي).
 * كل الأرقام والأسماء وهمية. الوقت الثابت: 2026-03-10 الساعة 12:00 بتوقيت الرياض (09:00Z).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildEngine } from './build-engine.mjs';
import { mountComms, commsSendInput, commsJobCheck, commsAdapter, COMMS_ADAPTERS, COMMS_KEEP } from '../server-comms.js';
import { loadTenants } from '../tenants.js';

let E;
before(async () => { E = await buildEngine(); });
const NOW = Date.parse('2026-03-10T09:00:00Z');
const TPL = [{ id: 't1', name: 'حملة', ch: 'sms', body: 'مرحبا {name} رصيدك {points}' }, { id: 't2', name: 'آجل', ch: 'sms', body: 'عميلنا {name} مستحق {amount} في {due}' }, { id: 'tw', name: 'واتساب', ch: 'whatsapp', body: 'hello there' }];
const org = (x = {}) => ({ company: { name: 'منشأة اختبار' }, branches: [{ id: 'b1', name: 'فرع 1' }], mkt: { comms: { sendOn: true, maxPerMonth: 2, optOutText: 'إيقاف: أرسل 0', templates: TPL }, loy: { expireMonths: 12 } },
  partners: [{ id: 'c1', type: 'customer', name: 'شركة أ', phone: '0551111111' }, { id: 'c2', type: 'customer', name: 'شركة ب', phone: '0552222222' }, { id: 'c3', type: 'customer', name: 'شركة ج' },
    { id: 'c4', type: 'customer', name: 'عميل كاشير', phone: '0554444444', posCredit: true, creditLimit: 1000, terms: 30 }, { id: 'c5', type: 'customer', name: 'شركة هـ', phone: '0555555555' }, { id: 'c6', type: 'customer', name: 'شركة و', phone: '0556666666' }], ...x });
const cs = (phone, status, ch, at) => ({ id: 'mc_' + phone + at, phone, status, ch, src: 'نقطة البيع', by: 'x', at });
const consents = [cs('501111111', 'in', 'all', '2026-01-01T10:00:00Z'), cs('502222222', 'in', 'sms', '2026-01-01T10:00:00Z'), cs('502222222', 'out', 'all', '2026-02-01T10:00:00Z'),
  cs('503333333', 'in', 'whatsapp', '2026-01-01T10:00:00Z'), cs('504444444', 'in', 'all', '2026-01-01T10:00:00Z'), cs('12345', 'in', 'all', '2026-01-01T10:00:00Z'),
  cs('505555555', 'in', 'all', '2026-01-01T10:00:00Z'), cs('506666666', 'out', 'all', '2026-01-02T10:00:00Z'), cs('507777777', 'in', 'sms', '2026-01-01T10:00:00Z'), cs('555555555', 'out', 'all', '2026-01-01T10:00:00Z')];
const merges = [{ id: 'mm1', from: '506666666', to: '505555555', pts: 0, at: '2026-01-05T10:00:00Z', by: 'x', reason: 'نفس العميل' }];
const sentJob = (id, at, rcpt, dry) => ({ id, kind: 'campaign', status: 'sent', sentAt: at, result: { n: rcpt.length, ok: rcpt.length, fail: 0, ...(dry ? { dry: true } : {}), rcpt } });
const loy = { members: { 501111111: { name: 'سارة' }, 503333333: { name: 'منى' }, 507777777: { name: 'ليلى' } },
  tx: [{ id: 'a:e', phone: '501111111', pts: 100, at: '2025-02-01T10:00:00Z' }, { id: 'b:e', phone: '507777777', pts: 50, at: '2026-03-01T10:00:00Z' }] };
const si = (id, key, dueDate, total, paid = 0) => ({ id, no: 'INV-' + id, kind: 'invoice', terms: 'credit', customerKey: key, date: '2026-01-20', dueDate, total, receipts: paid ? [{ date: '2026-02-01', amount: paid }] : [] });
const posSale = { id: 'o1', no: 'ف1-0001', branchId: 'b1', date: '2026-02-10', status: 'paid', total: 1150, vat: 150, net: 1000, lines: [], payments: [{ m: 'cash', amount: 690 }, { m: 'credit', amount: 460, custKey: 'cust:c4', custName: 'عميل كاشير' }], ar: { key: 'cust:c4', name: 'عميل كاشير', dueDate: '2026-03-11' } };
const clo = { id: 'cl1', branchId: 'b1', branchName: 'فرع 1', date: '2026-02-10', status: 'submitted', cashSales: 690, cardSales: 0, bankTransferSales: 0, deliverySales: [], expenses: [], creditSales: 460, creditRows: [{ customerKey: 'cust:c4', name: 'عميل كاشير', amount: 460, n: 1 }] };
const ops = (x = {}) => ({ mktConsents: consents, mktMerges: merges, mktProfiles: [{ id: 'p1', phone: '507777777', bday: '03-10', at: '2026-01-01T00:00:00Z' }],
  commsJobs: [sentJob('s1', '2026-03-02T10:00:00Z', [], false), sentJob('s2', '2026-03-03T10:00:00Z', [], false), sentJob('s3', '2026-03-04T10:00:00Z', [], true), sentJob('s0', '2026-02-20T10:00:00Z', [], false)],
  salesInvoices: [si('1', 'cust:c1', '2026-03-12', 1150, 150), si('2', 'cust:c2', '2026-02-01', 500), si('3', 'cust:c3', '2026-02-15', 200), si('4', 'cust:c6', '2026-03-30', 300), si('5', 'cust:c5', '2026-02-20', 80), si('6', 'cust:c1', '2026-03-01', 40, 40)],
  posOrders: [posSale], closings: [clo], ...x });
const withCap = (o) => { const k = E.commsKey('504444444'); o.commsJobs = o.commsJobs.map(j => j.id === 's0' ? j : { ...j, result: { ...j.result, rcpt: [k] } }); return o; };
const job = (x = {}) => ({ id: 'j1', no: 'MSG-0001', kind: 'campaign', ch: 'sms', tplId: 't1', filter: {}, status: 'approved', by: 'منشئ', byId: 'u-mk', approvedBy: 'المالك', approvedById: 'u-own', ...x });

test('الحملة: الموافقون صراحةً على SMS وحدهم، الإيقاف (ومنه الرقم المدموج)، الحد الشهري من الإرسال الفعلي لا التجريبي، والرقم غير الصالح', () => {
  const A = E.commsAudience(org(), withCap(ops()), loy, job(), NOW);
  assert.deepEqual(A.list.map(x => x.phone), ['501111111', '507777777'], 'ليلى موافقة على SMS');
  assert.deepEqual(A.skipped, { noConsent: 1, optOut: 3, cap: 1, invalid: 1, noPhone: 0 }, 'الإيقاف: 502 و505 (عبر المدموج 506) و555');
  assert.equal(A.list[0].text, 'مرحبا سارة رصيدك 100\nإيقاف: أرسل 0', 'نص الإيقاف مُلحق');
  assert.equal(A.n, 2); assert.equal(A.parts, E.smsParts(A.list[0].text).parts + E.smsParts(A.list[1].text).parts);
  assert.deepEqual(A.sample, [{ m: '50•••••11', name: 'سارة', parts: 1 }, { m: '50•••••77', name: 'ليلى', parts: 1 }], 'العيّنة مقنّعة');
  assert.ok(!JSON.stringify(A.sample).includes('501111111'));
  // بلا إرسال فعلي سابق: 504444444 ضمن الحد (التجريبي s3 لا يُحتسب حتى لو حمل بصمات)
  const o2 = ops(); o2.commsJobs = o2.commsJobs.map(j => j.id === 's3' ? { ...j, result: { ...j.result, rcpt: [E.commsKey('504444444'), E.commsKey('504444444'), E.commsKey('504444444')] } } : j);
  assert.deepEqual(E.commsAudience(org(), o2, loy, job(), NOW).list.map(x => x.phone), ['501111111', '504444444', '507777777']);
  // الشهر السابق لا يُحتسب، والحد صفر يمنع الحملات
  const o3 = ops(); o3.commsJobs = [sentJob('p', '2026-02-27T10:00:00Z', [E.commsKey('504444444'), E.commsKey('504444444')], false)];
  assert.equal(E.commsAudience(org(), o3, loy, job(), NOW).n, 3);
  const z = org(); z.mkt.comms.maxPerMonth = 0; assert.equal(E.commsAudience(z, ops(), loy, job(), NOW).n, 0);
  // آخر حالة هي المعتمدة: إلغاء ثم موافقة جديدة ⇒ يعود
  const o4 = ops({ mktConsents: [...consents, cs('502222222', 'in', 'all', '2026-03-01T10:00:00Z')] });
  assert.ok(E.commsAudience(org(), o4, loy, job(), NOW).list.some(x => x.phone === '502222222'));
});

test('الولاء: الموافقون فقط بمرشّح الرصيد، والنقاط المنتهية خلال ن يومًا، وميلاد اليوم', () => {
  const L = (filter) => E.commsAudience(org(), ops(), loy, job({ kind: 'loy', filter }), NOW);
  const all = L({}); assert.deepEqual(all.list.map(x => x.phone), ['501111111', '507777777']); assert.equal(all.skipped.noConsent, 1, 'منى موافقة على واتساب فقط');
  assert.deepEqual(L({ minPts: 60 }).list.map(x => x.phone), ['501111111']);
  assert.deepEqual(L({ expDays: 30 }).list.map(x => x.phone), ['501111111'], '100 نقطة من 2025-02-01 تنتهي قبل 2026-04-09 بصلاحية 12 شهرًا');
  assert.deepEqual(L({ bday: true }).list.map(x => x.phone), ['507777777']);
  // قرار المجلس: الحد الشهري للحملات والولاء معًا — حملة فعلية + إشعار ولاء فعلي لسارة هذا الشهر = 2 ⇒ بلغت الحد (2)
  const k = E.commsKey('501111111'); const capped = ops({ commsJobs: [sentJob('c1', '2026-03-02T10:00:00Z', [k], false), { ...sentJob('l1', '2026-03-03T10:00:00Z', [k], false), kind: 'loy' }, { ...sentJob('l0', '2026-03-04T10:00:00Z', [k, k], true), kind: 'loy' }] });
  const LC = E.commsAudience(org(), capped, loy, job({ kind: 'loy' }), NOW); assert.deepEqual(LC.list.map(x => x.phone), ['507777777']); assert.equal(LC.skipped.cap, 1);
  assert.equal(E.commsAudience(org(), capped, loy, job(), NOW).list.some(x => x.phone === '501111111'), false, 'إشعار الولاء يُحتسب في حد الحملة أيضًا');
  const z0 = org(); z0.mkt.comms.maxPerMonth = 0; assert.equal(E.commsAudience(z0, ops(), loy, job({ kind: 'loy' }), NOW).n, 0, 'الحد 0 = لا رسائل تسويقية');
  const noExp = org(); noExp.mkt.loy = {}; assert.equal(E.commsAudience(noExp, ops(), loy, job({ kind: 'loy', filter: { expDays: 30 } }), NOW).n, 0, 'بلا صلاحية للنقاط لا انتهاء');
});

test('الآجل: المستحق خلال ن يومًا أو المتأخر برصيد > 0 من فواتير المبيعات ومستندات الكاشير المرحّلة؛ خدمية بلا موافقة لكن تحترم الإيقاف', () => {
  const A = E.commsAudience(org(), ops(), loy, job({ kind: 'ar', tplId: 't2', filter: { dueDays: 3 } }), NOW);
  assert.deepEqual(A.list.map(x => [x.phone, x.text.split('\n')[0]]), [['551111111', 'عميلنا شركة أ مستحق 1000.00 في 2026-03-12'], ['552222222', 'عميلنا شركة ب مستحق 500.00 في 2026-02-01'], ['554444444', 'عميلنا عميل كاشير مستحق 460.00 في 2026-03-11']]);
  assert.equal(A.skipped.optOut, 1, 'شركة هـ طلبت الإيقاف'); assert.equal(A.skipped.noPhone, 1, 'شركة ج بلا جوال'); assert.equal(A.skipped.noConsent, 0, 'لا تُشترط موافقة تسويقية');
  assert.deepEqual(E.commsAudience(org(), ops(), loy, job({ kind: 'ar', tplId: 't2', filter: { overdueOnly: true } }), NOW).list.map(x => x.phone), ['552222222']);
  assert.equal(E.commsAudience(org(), ops(), loy, job({ kind: 'ar', tplId: 't2', filter: { dueDays: 30 } }), NOW).n, 4, 'شركة و مستحقة 2026-03-30');
  // التذكير خدمي: لا يخضع للحد الشهري (ولا للحد 0)، ولا يُحسب عليه
  const z = org(); z.mkt.comms.maxPerMonth = 0; assert.equal(E.commsAudience(z, ops(), loy, job({ kind: 'ar', tplId: 't2' }), NOW).n, 3);
  // سُدّدت ⇒ لا تذكير
  const paid = ops(); paid.salesInvoices = paid.salesInvoices.map(x => x.id === '2' ? { ...x, receipts: [{ date: '2026-02-05', amount: 500 }] } : x);
  assert.ok(!E.commsAudience(org(), paid, loy, job({ kind: 'ar', tplId: 't2' }), NOW).list.some(x => x.phone === '552222222'));
  // فاتورة كاشير لم يُرحّل إغلاقها لا تُذكَّر
  assert.ok(!E.commsAudience(org(), ops({ closings: [] }), loy, job({ kind: 'ar', tplId: 't2' }), NOW).list.some(x => x.phone === '554444444'));
});

test('ساعات الهدوء بتوقيت الرياض (لا بتوقيت الخادم)، والفحوص والمفتاح الافتراضي', () => {
  const C = E.commsCfgOf(org());
  assert.equal(E.commsQuietRiy(C, Date.parse('2026-03-10T20:00:00Z')), true, '23:00 بالرياض');
  assert.equal(E.commsQuietRiy(C, Date.parse('2026-03-10T05:59:00Z')), true, '08:59 بالرياض');
  assert.equal(E.commsQuietRiy(C, Date.parse('2026-03-10T06:00:00Z')), false, '09:00 بالرياض');
  assert.equal(E.commsQuietRiy(C, NOW), false);
  assert.equal(E.commsAudience(org(), ops(), loy, job(), Date.parse('2026-03-10T20:00:00Z')).quiet, true);
  assert.equal(E.commsSendOn({}), false, 'معطّل افتراضيًا'); assert.equal(E.commsCfgOf({}).sendOn, false); assert.equal(E.commsCfgOf(org()).sendingEnabled, false);
  assert.equal(E.commsJobErr(org(), { kind: 'campaign', ch: 'sms', tplId: 'tw' }), 'القالب ليس لقناة SMS');
  assert.match(E.commsJobErr(org(), { kind: 'campaign', ch: 'whatsapp', tplId: 't1' }), /SMS/);
  assert.equal(E.commsJobErr(org(), { kind: 'x', ch: 'sms', tplId: 't1' }), 'اختر نوع الرسائل');
  assert.equal(E.commsJobErr(org(), { kind: 'ar', ch: 'sms', tplId: 't2' }), '');
  assert.equal(E.commsNextNo({ commsJobs: [{ no: 'MSG-0007' }, { no: 'MSG-0002' }] }), 'MSG-0008');
  assert.deepEqual(E.commsFilterOf('ar', {}), { dueDays: 3, overdueOnly: false });
  assert.equal(E.commsFilterOf('loy', { minPts: -5 }).minPts, null);
  assert.equal(E.commsPhoneOk('501111111'), true); assert.equal(E.commsPhoneOk('0501111111'), false);
});

test('الاعتماد: المالك أو المدير العام، ولا يعتمد المنشئ دفعته؛ والانتقالات المسموحة فقط', () => {
  const own = { id: 'u-own', name: 'المالك', role: 'system_admin' }, gm = { id: 'u-gm', name: 'المدير', role: 'general_management' }, ho = { id: 'u-ho', name: 'مكتب', role: 'head_office' }, fin = { id: 'u-f', name: 'مالية', role: 'finance_department' };
  const d = job({ status: 'draft', byId: 'u-own', by: 'المالك', approvedBy: undefined, approvedById: undefined });
  const p = E.commsJobMove(d, 'pending', own, 'T').next; assert.equal(p.status, 'pending');
  assert.match(E.commsJobMove(p, 'approved', own, 'T').err, /لا يعتمد المنشئ/);
  assert.match(E.commsJobMove(p, 'approved', ho, 'T').err, /المالك أو المدير العام/);
  assert.match(E.commsJobMove(p, 'approved', fin, 'T').err, /المالك أو المدير العام/);
  const a = E.commsJobMove(p, 'approved', gm, 'T').next; assert.deepEqual([a.status, a.approvedBy, a.approvedById, a.approvedAt], ['approved', 'المدير', 'u-gm', 'T']);
  const r = E.commsJobMove(p, 'rejected', gm, 'T').next; assert.deepEqual([r.status, r.rejected], ['cancelled', true]);
  assert.ok(E.commsJobMove(d, 'approved', gm, 'T').err, 'لا اعتماد لمسودة');
  assert.ok(E.commsJobMove(a, 'sent', gm, 'T').err, 'الإرسال من الخادم وحده');
  assert.ok(E.commsJobMove(job({ status: 'sent' }), 'cancelled', gm, 'T').err);
  assert.equal(E.commsCanApprove(gm), true); assert.equal(E.commsCanApprove(ho), false);
  assert.equal(commsJobCheck(job()), null);
  assert.match(commsJobCheck(job({ approvedById: 'u-mk' })).err, /لا يعتمد المنشئ/);
  assert.equal(commsJobCheck(job({ status: 'pending' })).code, 409); assert.equal(commsJobCheck(undefined).code, 404); assert.equal(commsJobCheck(job({ ch: 'whatsapp' })).code, 400);
});

/* ===== المسار /api/comms/send — Firestore وهمي ===== */
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
const SA = JSON.stringify({ client_email: 'ops@test-prod.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'test-prod' });
const ENV = { FIREBASE_API_KEY: 'AIzaSy' + 'a'.repeat(33), FIREBASE_PROJECT_ID: 'test-prod', FIREBASE_SERVICE_ACCOUNT: SA };
function harness({ data = null, now = NOW, env = {}, tenv = ENV } = {}) {
  let loads = 0; const urls = [];
  const routes = {}; const app = { post: (p, ...h) => (routes[p] = h) };
  const users = { own: { email: 'own@test.sa', role: 'system_admin', tenant: 'default' }, gm: { email: 'gm@test.sa', role: 'general_management', tenant: 'default' }, ho: { email: 'ho@test.sa', role: 'head_office', tenant: 'default' }, cash: { email: 'c@test.sa', role: 'cashier', tenant: 'default' } };
  const requireMember = (req, res, next) => { const u = users[req.who]; if (!u) return res.status(401).json({ error: 'يلزم تسجيل الدخول' }); req.user = u; next(); };
  const F = (o) => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'boolean' ? { booleanValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(x => ({ stringValue: x })) } } : { stringValue: String(v) }])) });
  const db = { 'members/own@test.sa': F({ active: true, scope: 'all', role: 'system_admin' }), 'members/gm@test.sa': F({ active: true, scope: 'all', role: 'general_management' }),
    'members/ho@test.sa': F({ active: true, scope: 'all', role: 'head_office' }), 'members/c@test.sa': F({ active: true, branchId: 'b1', role: 'cashier' }), 'platform/admins': F({ emails: [] }) };
  const fetchImpl = async (u, i = {}) => { urls.push(u);
    const ok = (j) => ({ ok: true, status: 200, json: async () => j });
    if (u.includes('oauth2')) return ok({ access_token: 'AT', expires_in: 3600 });
    if (u.endsWith(':commit')) { const b = JSON.parse(i.body);
      for (const w of b.writes) { const k = w.update.name.split('/documents/')[1];
        if (w.currentDocument && w.currentDocument.exists === false && db[k]) return { ok: false, status: 409, json: async () => ({ error: { status: 'ALREADY_EXISTS' } }) };
        db[k] = { fields: { ...((w.updateMask && db[k]) ? db[k].fields : {}), ...w.update.fields, ...(w.updateTransforms ? { at: { timestampValue: 'NOW' } } : {}) } }; } return ok({}); }
    const k = decodeURIComponent((u.split('/documents/')[1] || '').split('?')[0]);
    return db[k] ? ok(db[k]) : { ok: false, status: 404, json: async () => ({}) };
  };
  const D = data || { org: org(), ops: ops({ commsJobs: [job({ est: { n: 999, parts: 999 } }), job({ id: 'j2', status: 'pending' }), job({ id: 'j3', approvedById: 'u-mk' })] }), loy };
  mountComms(app, { express: { json: () => (q, r, n) => n() }, requireMember, rateLimit: () => (q, r, n) => n(), T: loadTenants(tenv), fetchImpl, log: { log() {}, error() {} }, engine: E, env,
    loader: async () => { loads++; return D; }, orgLoader: async () => D.org, now: () => now });
  const call = async (who, body) => { const req = { who, body }; const out = { status: 200 };
    const res = { status(c) { out.status = c; return this; }, json(j) { out.json = j; return this; } };
    for (const h of routes['/api/comms/send']) { let go = false; await h(req, res, () => { go = true; }); if (!go) break; } return out; };
  return { call, db, urls, loads: () => loads };
}

test('المسار: 401 بلا هوية، 400 لمدخل خاطئ أو قائمة من المتصفح، 403 لغير المالك والمدير العام، 409 مطفأ قبل التحميل، 404/409 للدفعة', async () => {
  const H = harness();
  assert.equal((await H.call('nobody', { jobId: 'j1' })).status, 401);
  assert.equal((await H.call('own', { jobId: 'a/b' })).status, 400);
  assert.equal((await H.call('own', { jobId: 'j1', list: ['501111111'] })).status, 400, 'لا يُقبل جمهور من المتصفح');
  assert.equal((await H.call('ho', { jobId: 'j1' })).status, 403);
  assert.equal((await H.call('cash', { jobId: 'j1' })).status, 403);
  assert.equal(H.loads(), 0);
  { const off = org(); off.mkt.comms.sendOn = false; const Ho = harness({ data: { org: off, ops: ops(), loy } }); const r = await Ho.call('own', { jobId: 'j1' }); assert.equal(r.status, 409); assert.equal(r.json.code, 'off'); assert.equal(Ho.loads(), 0, 'الرفض قبل التحميل الثقيل'); }
  { const o0 = org(); delete o0.mkt.comms.sendOn; assert.equal((await harness({ data: { org: o0, ops: ops(), loy } }).call('own', { jobId: 'j1' })).status, 409, 'بلا الحقل = مطفأ'); }
  assert.equal((await H.call('own', { jobId: 'zz' })).status, 404);
  assert.equal((await H.call('own', { jobId: 'j2' })).status, 409, 'غير معتمدة');
  assert.equal((await H.call('own', { jobId: 'j3' })).status, 409, 'اعتمدها منشئها');
  assert.equal((await harness({ env: { COMMS_ADAPTER: 'unifonic' } }).call('own', { jobId: 'j1' })).status, 409, 'محوّل غير متاح');
  assert.equal((await harness({ tenv: { FIREBASE_API_KEY: ENV.FIREBASE_API_KEY, FIREBASE_PROJECT_ID: 'test-prod' } }).call('own', { jobId: 'j1' })).status, 409, 'بلا حساب خدمة');
  const q = await harness({ now: Date.parse('2026-03-10T20:00:00Z') }).call('gm', { jobId: 'j1' }); assert.equal(q.status, 409); assert.equal(q.json.code, 'quiet');
  assert.deepEqual(commsSendInput({ jobId: 'j1' }).v, { jobId: 'j1' }); assert.ok(commsSendInput([]).err);
});

test('المسار: المحوّل التجريبي لا يرسل شيئًا — الجمهور يُعاد حسابه من بيانات الخادم، والسجل مرة واحدة بلا أرقام كاملة', async () => {
  const H = harness(); const r = await H.call('gm', { jobId: 'j1' });
  assert.equal(r.status, 200);
  assert.deepEqual([r.json.result.n, r.json.result.ok, r.json.result.fail, r.json.result.dry, r.json.result.adapter], [3, 3, 0, true, 'dryrun'], 'n من الخادم (3) لا من تقدير المتصفح (999)');
  assert.equal(r.json.result.rcpt, undefined, 'التجريبي لا يحمل بصمات ولا يُحتسب في الحد');
  assert.deepEqual(r.json.sample.map(x => x.m), ['50•••••11', '50•••••44', '50•••••77']);
  // لا اتصال بغير Firestore وخدمة الرمز — لا مزوّد
  assert.ok(H.urls.every(u => /firestore\.googleapis\.com|oauth2/.test(u)), H.urls.join('\n'));
  const L = H.db['comms_log/j1']; assert.ok(L); assert.equal(L.fields.state.stringValue, 'done'); assert.equal(L.fields.dry.booleanValue, true); assert.equal(L.fields.n.integerValue, '3'); assert.equal(L.fields.ok.integerValue, '3');
  assert.equal(L.fields.by.stringValue, 'gm@test.sa'); assert.equal(L.fields.at.timestampValue, 'NOW');
  assert.ok(!/50[0-9]{7}/.test(JSON.stringify(L)), 'لا رقم كامل في السجل');
  const again = await H.call('gm', { jobId: 'j1' }); assert.equal(again.status, 409); assert.equal(again.json.code, 'dup');
  assert.deepEqual(await COMMS_ADAPTERS.dryrun.send([{ to: '966501111111', text: 'x' }]), [{ ok: true, dry: true }]);
  assert.equal(commsAdapter({}).name, 'dryrun'); assert.equal(commsAdapter({ COMMS_ADAPTER: 'x' }), null);
  assert.deepEqual(COMMS_KEEP, ['mktConsents', 'mktMerges', 'mktProfiles', 'commsJobs']);
});

test('تحميل بيانات الإرسال: الأعمدة الإضافية ودفتر الولاء مع opts، والسلوك الافتراضي للموصل كما هو', async () => {
  const { loadPlatformData } = await import('../server-mcp.js');
  const enc = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? { integerValue: String(v) } : { stringValue: String(v) }]));
  const M = { rms8_org: { parts: 1, value: JSON.stringify({ branches: [{ id: 'b1' }] }) }, rms8_core: { parts: 1, value: JSON.stringify({ commsJobs: [{ id: 'j' }], mktMerges: [], salesInvoices: [] }) },
    rms8_br_b1: { parts: 1, value: JSON.stringify({ mktConsents: [{ id: 'c' }], closings: [] }) }, rms8_loy: { parts: 1, value: JSON.stringify({ members: { 5: {} }, tx: [{ id: 't' }] }) } };
  const get = async (u, i) => ({ ok: true, status: 200, j: JSON.parse(i.body).documents.map(n => { const id = n.split('/').pop(); return M[id] ? { found: { name: n, fields: enc(M[id]) } } : { missing: n }; }) });
  const base = 'https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents';
  const D = await loadPlatformData(base, get, Date.now, { keep: COMMS_KEEP, loy: true });
  assert.deepEqual(D.ops.commsJobs, [{ id: 'j' }]); assert.deepEqual(D.ops.mktConsents, [{ id: 'c' }]); assert.deepEqual(D.loy.tx, [{ id: 't' }]);
  const D0 = await loadPlatformData(base, get);
  assert.equal(D0.ops.commsJobs, undefined); assert.equal(D0.ops.mktConsents, undefined); assert.equal(D0.loy, undefined, 'الموصل كما كان');
});

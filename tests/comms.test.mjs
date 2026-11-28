/**
 * v56.50 — إرسال الرسائل للعملاء: الجمهور (حملة/ولاء/آجل)، الاعتماد بغير المنشئ، والخادم (/api/comms/send بالمحوّل التجريبي).
 * كل الأرقام والأسماء وهمية. الوقت الثابت: 2026-03-10 الساعة 12:00 بتوقيت الرياض (09:00Z).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildEngine } from './build-engine.mjs';
import { mountComms, commsSendInput, commsJobCheck, commsApprCheck, commsAdapter, commsScrub, commsRcptKey, commsSubCheck, COMMS_SUBMIT_ROLES, COMMS_ADAPTERS, COMMS_KEEP, COMMS_MAX_RCPT } from '../server-comms.js';
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
// المراجعة الأمنية: عدّاد الشهر يمرّره الخادم من comms_log (بصمة ⇒ عدد)؛ هنا بصمة اختبار بسيطة
const keyOf = (ph) => 'k' + ph; const used = (m) => ({ used: m, keyOf });
const loy = { members: { 501111111: { name: 'سارة' }, 503333333: { name: 'منى' }, 507777777: { name: 'ليلى' } },
  tx: [{ id: 'a:e', phone: '501111111', pts: 100, at: '2025-02-01T10:00:00Z' }, { id: 'b:e', phone: '507777777', pts: 50, at: '2026-03-01T10:00:00Z' }] };
const si = (id, key, dueDate, total, paid = 0) => ({ id, no: 'INV-' + id, kind: 'invoice', terms: 'credit', customerKey: key, date: '2026-01-20', dueDate, total, receipts: paid ? [{ date: '2026-02-01', amount: paid }] : [] });
const posSale = { id: 'o1', no: 'ف1-0001', branchId: 'b1', date: '2026-02-10', status: 'paid', total: 1150, vat: 150, net: 1000, lines: [], payments: [{ m: 'cash', amount: 690 }, { m: 'credit', amount: 460, custKey: 'cust:c4', custName: 'عميل كاشير' }], ar: { key: 'cust:c4', name: 'عميل كاشير', dueDate: '2026-03-11' } };
const clo = { id: 'cl1', branchId: 'b1', branchName: 'فرع 1', date: '2026-02-10', status: 'submitted', cashSales: 690, cardSales: 0, bankTransferSales: 0, deliverySales: [], expenses: [], creditSales: 460, creditRows: [{ customerKey: 'cust:c4', name: 'عميل كاشير', amount: 460, n: 1 }] };
const ops = (x = {}) => ({ mktConsents: consents, mktMerges: merges, mktProfiles: [{ id: 'p1', phone: '507777777', bday: '03-10', at: '2026-01-01T00:00:00Z' }],
  commsJobs: [],
  salesInvoices: [si('1', 'cust:c1', '2026-03-12', 1150, 150), si('2', 'cust:c2', '2026-02-01', 500), si('3', 'cust:c3', '2026-02-15', 200), si('4', 'cust:c6', '2026-03-30', 300), si('5', 'cust:c5', '2026-02-20', 80), si('6', 'cust:c1', '2026-03-01', 40, 40)],
  posOrders: [posSale], closings: [clo], ...x });
const job = (x = {}) => ({ id: 'j1', no: 'MSG-0001', kind: 'campaign', ch: 'sms', tplId: 't1', filter: {}, status: 'approved', by: 'منشئ', byId: 'u-mk', byEmail: 'mk@test.sa', approvedBy: 'المالك', approvedById: 'u-own', ...x });

test('الحملة: الموافقون صراحةً على SMS وحدهم، الإيقاف (ومنه الرقم المدموج)، الحد الشهري من عدّاد الخادم لا من المستند، والرقم غير الصالح', () => {
  const A = E.commsAudience(org(), ops(), loy, job(), NOW, used({ k504444444: 2 }));
  assert.deepEqual(A.list.map(x => x.phone), ['501111111', '507777777'], 'ليلى موافقة على SMS');
  assert.deepEqual(A.skipped, { noConsent: 1, optOut: 3, cap: 1, invalid: 1, noPhone: 0 }, 'الإيقاف: 502 و505 (عبر المدموج 506) و555');
  assert.equal(A.capChecked, true);
  assert.equal(A.list[0].text, 'مرحبا سارة رصيدك 100\nإيقاف: أرسل 0', 'نص الإيقاف مُلحق');
  assert.equal(A.n, 2); assert.equal(A.parts, E.smsParts(A.list[0].text).parts + E.smsParts(A.list[1].text).parts);
  assert.deepEqual(A.sample, [{ m: '50•••••11', name: 'سارة', parts: 1 }, { m: '50•••••77', name: 'ليلى', parts: 1 }], 'العيّنة مقنّعة');
  assert.ok(!JSON.stringify(A.sample).includes('501111111'));
  // ما يكتبه المتصفح في المستند لا يُعتدّ به في الحد: بصمات مزوّرة في result.rcpt بلا أثر
  const forged = ops({ commsJobs: [{ id: 's', kind: 'campaign', status: 'sent', sentAt: '2026-03-02T10:00:00Z', result: { rcpt: ['k501111111', 'k501111111', 'k501111111'] } }] });
  assert.ok(E.commsAudience(org(), forged, loy, job(), NOW, used({})).list.some(x => x.phone === '501111111'));
  // تحت الحد ⇒ يُرسل؛ ومعاينة المتصفح بلا عدّاد لا تطبّق الحد وتعلن ذلك
  assert.deepEqual(E.commsAudience(org(), ops(), loy, job(), NOW, used({ k504444444: 1 })).list.map(x => x.phone), ['501111111', '504444444', '507777777']);
  const pv = E.commsAudience(org(), ops(), loy, job(), NOW); assert.equal(pv.n, 3); assert.equal(pv.capChecked, false);
  const z = org(); z.mkt.comms.maxPerMonth = 0; assert.equal(E.commsAudience(z, ops(), loy, job(), NOW).n, 0, 'الحد 0 يُطبَّق حتى بلا عدّاد');
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
  const LC = E.commsAudience(org(), ops(), loy, job({ kind: 'loy' }), NOW, used({ k501111111: 2 })); assert.deepEqual(LC.list.map(x => x.phone), ['507777777']); assert.equal(LC.skipped.cap, 1);
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
  const z = org(); z.mkt.comms.maxPerMonth = 0; assert.equal(E.commsAudience(z, ops(), loy, job({ kind: 'ar', tplId: 't2' }), NOW, used({ k551111111: 9 })).n, 3);
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
  // سجل الاعتماد الخادمي: غيابه، أو المعتمد هو المنشئ، أو تغيّر المحتوى ⇒ رفض
  const h = 'H'; const sub = { email: 'mk@test.sa', hash: h }; const ap = { email: 'own@test.sa', creatorEmail: 'mk@test.sa', hash: h };
  assert.equal(commsSubCheck(sub, 'gm@test.sa', h), null); assert.equal(commsSubCheck(null, 'gm@test.sa', h).why, 'nosub');
  assert.equal(commsSubCheck(sub, 'MK@test.sa', h).code, 403); assert.equal(commsSubCheck(sub, 'gm@test.sa', 'H2').why, 'changed');
  assert.equal(commsApprCheck(ap, sub, h), null);
  assert.equal(commsApprCheck(null, sub, h).why, 'noappr'); assert.equal(commsApprCheck(ap, null, h).why, 'nosub');
  assert.equal(commsApprCheck({ ...ap, email: 'mk@test.sa' }, sub, h).why, 'self');
  assert.equal(commsApprCheck({ ...ap, creatorEmail: 'zz@test.sa' }, sub, h).why, 'changed');
  assert.equal(commsApprCheck(ap, sub, 'H2').why, 'changed');
  assert.deepEqual(COMMS_SUBMIT_ROLES, ['system_admin', 'general_management', 'head_office']);
  // البصمة تشمل القناة ونص الإيقاف واسم المرسل
  const o1 = org(), o2 = org(); o2.mkt.comms.optOutText = ''; const o3 = org(); o3.mkt.comms.senderName = 'BRAND';
  assert.notEqual(E.commsApprCanon(o1, job()), E.commsApprCanon(o2, job())); assert.notEqual(E.commsApprCanon(o1, job()), E.commsApprCanon(o3, job()));
  assert.notEqual(E.commsApprCanon(o1, job()), E.commsApprCanon(o1, job({ ch: 'whatsapp' })));
  assert.notEqual(E.commsApprCanon(org(), job()), E.commsApprCanon(org(), job({ filter: { x: 1 }, kind: 'loy' })));
  assert.equal(commsJobCheck(job({ status: 'pending' })).code, 409); assert.equal(commsJobCheck(undefined).code, 404); assert.equal(commsJobCheck(job({ ch: 'whatsapp' })).code, 400);
});

/* ===== المساران /api/comms/approve و/api/comms/send — Firestore وهمي ===== */
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
const SA = JSON.stringify({ client_email: 'ops@test-prod.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'test-prod' });
const ENV = { FIREBASE_API_KEY: 'AIzaSy' + 'a'.repeat(33), FIREBASE_PROJECT_ID: 'test-prod', FIREBASE_SERVICE_ACCOUNT: SA };
const USERS = [{ id: 'u-own', email: 'own@test.sa', name: 'المالك' }, { id: 'u-gm', email: 'gm@test.sa', name: 'المدير' }, { id: 'u-mk', email: 'mk@test.sa', name: 'منشئ' }];
const sorg = (x) => org({ users: USERS, ...(x || {}) });
const pend = (x = {}) => job({ status: 'pending', approvedBy: undefined, approvedById: undefined, ...x });
function harness({ data = null, now = NOW, env = {}, tenv = ENV, adapterMs } = {}) {
  let loads = 0; const urls = [];
  const routes = {}; const app = { post: (p, ...h) => (routes[p] = h) };
  const users = { own: { email: 'own@test.sa', role: 'system_admin', tenant: 'default' }, gm: { email: 'gm@test.sa', role: 'general_management', tenant: 'default' }, mk: { email: 'mk@test.sa', role: 'general_management', tenant: 'default' },
    ho: { email: 'ho@test.sa', role: 'head_office', tenant: 'default' }, cash: { email: 'c@test.sa', role: 'cashier', tenant: 'default' } };
  const requireMember = (req, res, next) => { const u = users[req.who]; if (!u) return res.status(401).json({ error: 'يلزم تسجيل الدخول' }); req.user = u; next(); };
  const F = (o) => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'boolean' ? { booleanValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(x => ({ stringValue: x })) } } : { stringValue: String(v) }])) });
  const db = { 'members/own@test.sa': F({ active: true, scope: 'all', role: 'system_admin' }), 'members/gm@test.sa': F({ active: true, scope: 'all', role: 'general_management' }), 'members/mk@test.sa': F({ active: true, scope: 'all', role: 'general_management' }),
    'members/ho@test.sa': F({ active: true, scope: 'all', role: 'head_office' }), 'members/c@test.sa': F({ active: true, branchId: 'b1', role: 'cashier' }), 'platform/admins': F({ emails: [] }) };
  const fetchImpl = async (u, i = {}) => { urls.push(u);
    const ok = (j) => ({ ok: true, status: 200, json: async () => j });
    if (u.includes('oauth2')) return ok({ access_token: 'AT', expires_in: 3600 });
    if (u.endsWith(':runQuery')) { const q = JSON.parse(i.body).structuredQuery; const ym = q.where.fieldFilter.value.stringValue;
      return ok(Object.entries(db).filter(([k, d]) => k.startsWith(q.from[0].collectionId + '/') && d.fields.ym && d.fields.ym.stringValue === ym).map(([k, d]) => ({ document: { name: 'x/documents/' + k, fields: d.fields } }))); }
    if (u.endsWith(':commit')) { const b = JSON.parse(i.body);
      for (const w of b.writes) { const k = w.update.name.split('/documents/')[1];
        if (w.currentDocument && w.currentDocument.exists === false && db[k]) return { ok: false, status: 409, json: async () => ({ error: { status: 'ALREADY_EXISTS' } }) };
        db[k] = { fields: { ...((w.updateMask && db[k]) ? db[k].fields : {}), ...w.update.fields, ...(w.updateTransforms ? { at: { timestampValue: 'NOW' } } : {}) } }; } return ok({}); }
    const k = decodeURIComponent((u.split('/documents/')[1] || '').split('?')[0]);
    return db[k] ? ok(db[k]) : { ok: false, status: 404, json: async () => ({}) };
  };
  const D = data || { org: sorg(), ops: ops({ commsJobs: [pend({ est: { n: 999, parts: 999 } }), job({ id: 'j2' }), pend({ id: 'j3', byId: 'u-gm', byEmail: 'gm@test.sa' })] }), loy };
  mountComms(app, { express: { json: () => (q, r, n) => n() }, requireMember, rateLimit: () => (q, r, n) => n(), T: loadTenants(tenv), fetchImpl, log: { log() {}, error() {} }, engine: E, env, ...(adapterMs ? { adapterMs } : {}),
    loader: async () => { loads++; return D; }, orgLoader: async () => D.org, now: () => now });
  const call = async (who, body, route = 'send') => { const req = { who, body }; const out = { status: 200 };
    const res = { status(c) { out.status = c; return this; }, json(j) { out.json = j; return this; } };
    for (const h of routes['/api/comms/' + route]) { let go = false; await h(req, res, () => { go = true; }); if (!go) break; } return out; };
  // بعد اعتماد الخادم يحدّث المتصفح الحالة في المستند (محاكاة)
  const markApproved = (id) => { D.ops.commsJobs = D.ops.commsJobs.map(j => j.id === id ? { ...j, status: 'approved', approvedById: 'u-gm', approvedBy: 'المدير' } : j); };
  // الدورة الكاملة في الخادم: mk يرسل للاعتماد ثم gm يعتمد ثم يحدّث المتصفح الحالة
  const ready = async (id = 'j1', by = 'mk', appr = 'gm') => { const a = await call(by, { jobId: id }, 'submit'); const b = await call(appr, { jobId: id }, 'approve'); markApproved(id); return [a.status, b.status]; };
  return { call, db, urls, D, markApproved, ready, loads: () => loads };
}

test('المساران: 401 بلا هوية، 400 لمدخل خاطئ أو قائمة من المتصفح، 403 لغير المالك والمدير العام، 409 مطفأ قبل التحميل، 404 للدفعة', async () => {
  const H = harness();
  assert.equal((await H.call('cash', { jobId: 'j1' }, 'submit')).status, 403, 'الكاشير لا يرسل للاعتماد');
  assert.equal((await H.call('ho', { jobId: 'j1' }, 'submit')).status, 200, 'المكتب الرئيسي ينشئ ويرسل للاعتماد');
  for (const r of ['submit', 'approve', 'send']) {
    assert.equal((await H.call('nobody', { jobId: 'j1' }, r)).status, 401);
    assert.equal((await H.call('own', { jobId: 'a/b' }, r)).status, 400);
    assert.equal((await H.call('own', { jobId: 'j1', list: ['501111111'] }, r)).status, 400, 'لا يُقبل جمهور من المتصفح');
    if (r !== 'submit') assert.equal((await H.call('ho', { jobId: 'j1' }, r)).status, 403);
    assert.equal((await H.call('cash', { jobId: 'j1' }, r)).status, 403);
    assert.equal((await H.call('own', { jobId: 'zz' }, r)).status, 404);
  }
  { const off = sorg(); off.mkt.comms.sendOn = false; const Ho = harness({ data: { org: off, ops: ops(), loy } });
    for (const r of ['submit', 'approve', 'send']) { const x = await Ho.call('own', { jobId: 'j1' }, r); assert.equal(x.status, 409); assert.equal(x.json.code, 'off'); } assert.equal(Ho.loads(), 0, 'الرفض قبل التحميل الثقيل'); }
  { const o0 = sorg(); delete o0.mkt.comms.sendOn; assert.equal((await harness({ data: { org: o0, ops: ops(), loy } }).call('own', { jobId: 'j1' })).status, 409, 'بلا الحقل = مطفأ'); }
  assert.equal((await harness({ env: { COMMS_ADAPTER: 'unifonic' } }).call('own', { jobId: 'j1' })).status, 409, 'محوّل غير متاح');
  assert.equal((await harness({ tenv: { FIREBASE_API_KEY: ENV.FIREBASE_API_KEY, FIREBASE_PROJECT_ID: 'test-prod' } }).call('own', { jobId: 'j1' })).status, 409, 'بلا حساب خدمة');
  assert.deepEqual(commsSendInput({ jobId: 'j1' }).v, { jobId: 'j1' }); assert.ok(commsSendInput([]).err);
});

test('الهوية من سجلي الخادم: من أرسل للاعتماد لا يعتمد (ولو زُوّر المنشئ في المستند) ⇐ 403؛ اعتماد مزوّر ⇐ 409؛ تعديل القالب أو المرشّح أو نص الإيقاف بعده ⇐ 409', async () => {
  const H = harness();
  let r = await H.call('gm', { jobId: 'j1' }, 'approve'); assert.equal(r.status, 409); assert.equal(r.json.code, 'nosub', 'لا اعتماد بلا إرسال للاعتماد عبر الخادم');
  // الدفعة تحمل byId/byEmail لشخص آخر (mk) لكن gm هو من أرسلها للاعتماد ⇒ لا يعتمدها gm
  assert.equal((await H.call('gm', { jobId: 'j1' }, 'submit')).status, 200);
  const S0 = H.db['comms_sub/j1'].fields; assert.equal(S0.email.stringValue, 'gm@test.sa'); assert.equal(S0.at.timestampValue, 'NOW');
  assert.equal(S0.hash.stringValue, crypto.createHash('sha256').update(E.commsApprCanon(sorg(), pend())).digest('hex'));
  assert.equal((await H.call('mk', { jobId: 'j1' }, 'submit')).json.code, 'dup', 'سجل الإرسال للاعتماد مرة واحدة');
  r = await H.call('gm', { jobId: 'j1' }, 'approve'); assert.equal(r.status, 403); assert.equal(r.json.code, 'self');
  // المحتوى تغيّر بين الإرسال للاعتماد والاعتماد ⇐ 409
  const t0 = H.D.org.mkt.comms.optOutText; H.D.org.mkt.comms.optOutText = '';
  r = await H.call('own', { jobId: 'j1' }, 'approve'); assert.equal(r.status, 409); assert.equal(r.json.code, 'changed');
  H.D.org.mkt.comms.optOutText = t0;
  r = await H.call('own', { jobId: 'j1' }, 'approve'); assert.equal(r.status, 200); assert.equal(r.json.approvedBy, 'المالك', 'الاسم للعرض فقط');
  const A = H.db['comms_appr/j1'].fields; assert.equal(A.email.stringValue, 'own@test.sa'); assert.equal(A.creatorEmail.stringValue, 'gm@test.sa'); assert.equal(A.hash.stringValue, S0.hash.stringValue);
  assert.equal((await H.call('gm', { jobId: 'j1' }, 'approve')).status, 403, 'من أرسل للاعتماد لا يعتمد');
  r = await H.call('mk', { jobId: 'j1' }, 'approve'); assert.equal(r.json.code, 'dup', 'الاعتماد مرة واحدة');
  r = await H.call('gm', { jobId: 'j2' }, 'approve'); assert.equal(r.status, 409, 'ليست بانتظار الاعتماد');
  // اعتماد مزوّر: الحالة «معتمدة» في المستند بلا سجل خادمي
  r = await H.call('own', { jobId: 'j2' }); assert.equal(r.status, 409); assert.equal(r.json.code, 'noappr');
  assert.equal((await H.call('own', { jobId: 'j1' })).status, 409, 'قبل تحديث الحالة في المستند لا إرسال');
  H.markApproved('j1');
  // بعد الاعتماد: القالب، ثم النوع والمرشّح، ثم حذف نص الإيقاف ⇐ 409 changed؛ وإعادتها ⇐ يُقبل
  const body0 = H.D.org.mkt.comms.templates[0].body; H.D.org.mkt.comms.templates[0].body = body0 + ' عرض جديد';
  r = await H.call('own', { jobId: 'j1' }); assert.equal(r.status, 409); assert.equal(r.json.code, 'changed');
  H.D.org.mkt.comms.templates[0].body = body0;
  H.D.ops.commsJobs = H.D.ops.commsJobs.map(j => j.id === 'j1' ? { ...j, filter: { minPts: 1 }, kind: 'loy' } : j);
  r = await H.call('own', { jobId: 'j1' }); assert.equal(r.json.code, 'changed', 'تغيّر النوع والمرشّح');
  H.D.ops.commsJobs = H.D.ops.commsJobs.map(j => j.id === 'j1' ? { ...j, filter: {}, kind: 'campaign' } : j);
  H.D.org.mkt.comms.optOutText = '';
  r = await H.call('own', { jobId: 'j1' }); assert.equal(r.status, 409); assert.equal(r.json.code, 'changed', 'حذف نص الإيقاف بعد الاعتماد');
  H.D.org.mkt.comms.optOutText = t0;
  // تزوير المنشئ في المستند لا أثر له (الهوية من السجلين)
  H.D.ops.commsJobs = H.D.ops.commsJobs.map(j => j.id === 'j1' ? { ...j, byId: 'u-own', byEmail: 'own@test.sa' } : j);
  assert.equal((await H.call('own', { jobId: 'j1' })).status, 200);
});

test('الإرسال التجريبي لا يرسل شيئًا — الجمهور من بيانات الخادم، والسجل مرة واحدة بلا أرقام كاملة، وساعات الهدوء', async () => {
  const H = harness(); assert.deepEqual(await H.ready(), [200, 200]);
  const q = await H.call('gm', { jobId: 'j1' }); assert.equal(q.status, 200);
  assert.deepEqual([q.json.result.n, q.json.result.ok, q.json.result.fail, q.json.result.dry, q.json.result.adapter], [3, 3, 0, true, 'dryrun'], 'n من الخادم (3) لا من تقدير المتصفح (999)');
  assert.equal(q.json.result.rcpt, undefined, 'لا بصمات في الرد');
  assert.deepEqual(q.json.sample.map(x => x.m), ['50•••••11', '50•••••44', '50•••••77']);
  assert.ok(H.urls.every(u => /firestore\.googleapis\.com|oauth2/.test(u)), H.urls.join('\n'));
  const L = H.db['comms_log/j1']; assert.equal(L.fields.state.stringValue, 'done'); assert.equal(L.fields.dry.booleanValue, true); assert.equal(L.fields.n.integerValue, '3');
  assert.equal(L.fields.ym.stringValue, '2026-03'); assert.equal(L.fields.rcpt.stringValue, '[]', 'التجريبي لا يُحتسب في الحد'); assert.equal(L.fields.by.stringValue, 'gm@test.sa');
  assert.ok(!/50[0-9]{7}/.test(JSON.stringify(L)), 'لا رقم كامل في السجل');
  const again = await H.call('gm', { jobId: 'j1' }); assert.equal(again.status, 409); assert.equal(again.json.code, 'dup');
  const H2 = harness({ now: Date.parse('2026-03-10T20:00:00Z') }); await H2.ready();
  const qq = await H2.call('gm', { jobId: 'j1' }); assert.equal(qq.status, 409); assert.equal(qq.json.code, 'quiet'); assert.equal(H2.db['comms_log/j1'], undefined, 'لا سجل في ساعات الهدوء');
  assert.deepEqual(await COMMS_ADAPTERS.dryrun.send([{ to: '966501111111', text: 'x' }]), [{ ok: true, dry: true }]);
  assert.equal(commsAdapter({}).name, 'dryrun'); assert.equal(commsAdapter({ COMMS_ADAPTER: 'x' }), null);
  assert.deepEqual(COMMS_KEEP, ['mktConsents', 'mktMerges', 'mktProfiles', 'commsJobs']);
});

test('الحد الشهري من comms_log (يكتبه الخادم وحده) ببصمات HMAC: الفعلي للشهر يُحتسب، والتجريبي والشهر السابق لا', async () => {
  const env = { COMMS_HMAC_KEY: 'test-key-only' }; const H = harness({ env }); const k = commsRcptKey('test-key-only', '504444444');
  assert.match(k, /^[0-9a-f]{32}$/); assert.notEqual(k, commsRcptKey('other', '504444444'));
  const lg = (ym, dry, kind, rcpt) => ({ fields: { ym: { stringValue: ym }, dry: { booleanValue: dry }, kind: { stringValue: kind }, rcpt: { stringValue: JSON.stringify(rcpt) } } });
  H.db['comms_log/a'] = lg('2026-03', false, 'campaign', [k]); H.db['comms_log/b'] = lg('2026-03', false, 'loy', [k]);
  H.db['comms_log/c'] = lg('2026-03', true, 'campaign', [k, k]); H.db['comms_log/d'] = lg('2026-02', false, 'campaign', [k, k]); H.db['comms_log/e'] = lg('2026-03', false, 'ar', [k, k]);
  assert.deepEqual(await H.ready(), [200, 200]);
  const r = await H.call('gm', { jobId: 'j1' }); assert.equal(r.status, 200);
  assert.equal(r.json.result.n, 2, '504444444 بلغ الحد (حملة + ولاء فعليان هذا الشهر = 2)');
});

test('تهيئة المزوّد: الفعلي يتطلب COMMS_HMAC_KEY، دفعات من 100 بمهلة، فشل دفعة لا يوقف الباقي، وتنقية الأرقام من الخطأ، وسقف 5000 (413)', async () => {
  const many = Array.from({ length: 150 }, (_, i) => cs('5100' + String(i).padStart(5, '0'), 'in', 'sms', '2026-01-01T10:00:00Z'));
  const parts = []; COMMS_ADAPTERS.fakeT = { name: 'fakeT', dry: false, async send(b) { parts.push(b.length); if (parts.length === 1) throw new Error('رفض الرقم ' + b[0].to + ' و+966 50 111 1111'); return b.map(() => ({ ok: true })); } };
  COMMS_ADAPTERS.slowT = { name: 'slowT', dry: false, send: () => new Promise(() => {}) };
  try {
    assert.equal((await harness({ env: { COMMS_ADAPTER: 'fakeT' } }).call('gm', { jobId: 'j1' })).json.code, 'hmac');
    const D = { org: sorg(), ops: ops({ mktConsents: many, commsJobs: [pend()] }), loy: { members: {}, tx: [] } };
    const H = harness({ data: D, env: { COMMS_ADAPTER: 'fakeT', COMMS_HMAC_KEY: 'kk' } }); assert.deepEqual(await H.ready(), [200, 200]);
    const r = await H.call('gm', { jobId: 'j1' }); assert.equal(r.status, 200);
    assert.deepEqual(parts, [100, 50]); assert.deepEqual([r.json.result.n, r.json.result.ok, r.json.result.fail, r.json.result.dry], [150, 50, 100, false]);
    assert.ok(!/\d{7,}/.test(r.json.result.err) && !/50 111/.test(r.json.result.err), r.json.result.err); assert.match(r.json.result.err, /\*{7}/);
    const L = H.db['comms_log/j1'].fields; assert.equal(JSON.parse(L.rcpt.stringValue).length, 50, 'بصمات الناجحين فقط'); assert.ok(!/\d{7,}/.test(L.err.stringValue));
    const Hs = harness({ data: { org: sorg(), ops: ops({ commsJobs: [pend()] }), loy }, env: { COMMS_ADAPTER: 'slowT', COMMS_HMAC_KEY: 'kk' }, adapterMs: 30 });
    await Hs.ready();
    const s = await Hs.call('gm', { jobId: 'j1' }); assert.equal(s.status, 502); assert.match(s.json.result.err, /مهلة/); assert.equal(Hs.db['comms_log/j1'].fields.state.stringValue, 'failed');
    const big = Array.from({ length: COMMS_MAX_RCPT + 1 }, (_, i) => cs('52' + String(i).padStart(7, '0'), 'in', 'all', '2026-01-01T10:00:00Z'));
    const Hb = harness({ data: { org: sorg(), ops: ops({ mktConsents: big, commsJobs: [pend()] }), loy: { members: {}, tx: [] } } }); await Hb.ready();
    const b = await Hb.call('gm', { jobId: 'j1' }); assert.equal(b.status, 413); assert.equal(Hb.db['comms_log/j1'], undefined, 'لا حجز ولا إرسال');
  } finally { delete COMMS_ADAPTERS.fakeT; delete COMMS_ADAPTERS.slowT; }
  assert.equal(commsScrub('err 0501234567 and 966-50-123-4567 code 12345'), 'err ******* and ******* code 12345');
});

test('بصمات المستلمين المقصودين في حجز comms_log قبل الإرسال (تعطل الإكمال لا يُنقص العدّاد)، ثم الإكمال بالناجحين', async () => {
  let H = null, seen = null; COMMS_ADAPTERS.peekT = { name: 'peekT', dry: false, async send(b) { seen = JSON.parse(H.db['comms_log/j1'].fields.rcpt.stringValue).length; return b.map((x, i) => ({ ok: i > 0 })); } };
  try {
    H = harness({ env: { COMMS_ADAPTER: 'peekT', COMMS_HMAC_KEY: 'kk' } }); assert.deepEqual(await H.ready(), [200, 200]);
    const r = await H.call('gm', { jobId: 'j1' }); assert.equal(r.status, 200);
    assert.equal(seen, 3, 'أثناء الإرسال: كل المقصودين محجوزون'); assert.equal(JSON.parse(H.db['comms_log/j1'].fields.rcpt.stringValue).length, 2, 'بعد الإكمال: الناجحون');
    assert.equal(H.db['comms_log/j1'].fields.submittedBy.stringValue, 'mk@test.sa');
  } finally { delete COMMS_ADAPTERS.peekT; }
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

/* ===== المرحلة H (v56.59) — التزامن: اعتماد وإرسال متزامنان للدفعة نفسها ===== */
test('التزامن (H): اعتمادان متزامنان من المالك والمدير العام للدفعة نفسها ⇒ يُقبل واحد و«اعتُمدت سابقًا» للآخر، وسجل اعتماد واحد', async () => {
  const H = harness();
  assert.equal((await H.call('mk', { jobId: 'j1' }, 'submit')).status, 200);
  const rs = await Promise.all([H.call('own', { jobId: 'j1' }, 'approve'), H.call('gm', { jobId: 'j1' }, 'approve')]);
  assert.deepEqual(rs.map(r => r.status).sort(), [200, 409]); assert.equal(rs.find(r => r.status === 409).json.code, 'dup');
  const ap = H.db['comms_appr/j1']; assert.ok(ap); assert.equal(ap.fields.email.stringValue, rs[0].status === 200 ? 'own@test.sa' : 'gm@test.sa', 'السجل لمن قُبل اعتماده');
  // إرسالان متزامنان للاعتماد نفسه (قبل الاعتماد) ⇒ سجل إرسال واحد
  const H2 = harness(); const ss = await Promise.all([H2.call('mk', { jobId: 'j1' }, 'submit'), H2.call('mk', { jobId: 'j1' }, 'submit')]);
  assert.deepEqual(ss.map(r => r.status).sort(), [200, 409]);
});

test('التزامن (H): نقرتا «إرسال» متزامنتان (أو جهازان) ⇒ دفعة واحدة تصل للمحوّل مرة واحدة، والأخرى 409 dup، والسجل واحد', async () => {
  const H = harness(); assert.deepEqual(await H.ready(), [200, 200]);
  const orig = COMMS_ADAPTERS.dryrun.send; let calls = 0, msgs = 0;
  COMMS_ADAPTERS.dryrun.send = async (batch, o) => { calls++; msgs += (batch || []).length; return orig(batch, o); };
  try {
    const rs = await Promise.all([H.call('gm', { jobId: 'j1' }), H.call('own', { jobId: 'j1' }), H.call('gm', { jobId: 'j1' })]);
    assert.deepEqual(rs.map(r => r.status).sort(), [200, 409, 409]); rs.filter(r => r.status === 409).forEach(r => assert.equal(r.json.code, 'dup'));
    assert.equal(calls, 1, 'المحوّل استُدعي مرة واحدة'); assert.equal(msgs, rs.find(r => r.status === 200).json.result.n, 'كل مستلم مرة واحدة');
    assert.equal(Object.keys(H.db).filter(k => k.startsWith('comms_log/')).length, 1);
  } finally { COMMS_ADAPTERS.dryrun.send = orig; }
});

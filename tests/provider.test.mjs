/* v51.5 — المرحلة 07 / S6: لوحة مزوّد مِثقال والتسجيل العام — الصلاحية على الخادم، ولا أسرار للواجهة */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { providerConfig, mountProvider, validateSignup, suggestId, isProvider, writeTenantStatus } from '../server-provider.js';
import { memoryStore } from '../server-billing.js';
import { buildInvoice, parsePrices } from '../billing.js';
import { loadTenants } from '../tenants.js';

const tok = (claims) => 'Bearer h.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.s';
const MFA = { firebase: { sign_in_second_factor: 'totp' } };
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
const SA = JSON.stringify({ client_email: 'ops@mithqal-c2.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'mithqal-c2' });
const ENV = { FIREBASE_API_KEY: 'AIzaSy' + 'a'.repeat(33), FIREBASE_PROJECT_ID: 'altaif-prod', FB_C2: 'AIzaSy' + 'b'.repeat(33), FB_C3: 'AIzaSy' + 'c'.repeat(33), SA_C2: SA,
  MQ_TENANTS_JSON: JSON.stringify([{ id: 'c2', projectId: 'mithqal-c2', apiKeyEnv: 'FB_C2', plan: 'pro', saEnv: 'SA_C2' }, { id: 'c3', projectId: 'mithqal-c3', apiKeyEnv: 'FB_C3', plan: 'basic' }]) };

function harness({ env = { MQ_PROVIDER_ADMINS: 'boss@mithqal.sa' }, controlReady = true } = {}) {
  const routes = {}; const app = { get: (p, ...h) => (routes['GET ' + p] = h), post: (p, ...h) => (routes['POST ' + p] = h) };
  const users = { boss: { email: 'boss@mithqal.sa', tenant: 'default', role: 'system_admin' }, bossC2: { email: 'boss@mithqal.sa', tenant: 'c2', role: 'system_admin' }, taif: { email: 'o@altaif.sa', tenant: 'default', role: 'system_admin' } };
  const requireMember = (req, res, next) => { const u = users[req.who]; if (!u) return res.status(401).json({}); req.user = u; next(); };
  const store = memoryStore(), T = loadTenants(ENV), fetched = [];
  const fetchImpl = async (u, i) => { fetched.push(i.method + ' ' + u);
    if (u.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 'AT', expires_in: 3600 }) };
    return { ok: true, status: 200, json: async () => ({}) }; };
  mountProvider(app, { express: { json: () => (q, r, n) => n() }, requireMember, rateLimit: () => (q, r, n) => n(), T, cfg: providerConfig(env), store, controlReady,
    registry: () => ({ c2: { id: 'c2', name: 'مطعم س', plan: 'pro', status: 'active' }, c9: { id: 'c9', name: 'غير مهيأة', plan: 'basic', status: 'active', firebase: { projectId: 'mithqal-c9' } } }), now: () => Date.parse('2026-11-19T09:00:00Z'), fetchImpl });
  const call = async (key, { who, mfa = true, body, query } = {}) => {
    const req = { who, body: body || {}, query: query || {}, params: {}, headers: { authorization: tok(mfa ? MFA : {}) }, ip: '1.1.1.1' }; const out = { status: 200 };
    const res = { status(c) { out.status = c; return this; }, json(j) { out.json = j; return this; } };
    for (const h of routes[key]) { let go = false; await h(req, res, () => { go = true; }); if (!go) break; } return out;
  };
  return { call, store, fetched };
}

test('اللوحة لمزوّد مِثقال وحده: بريده، ومن المنشأة الرئيسية، وبجلسة بخطوتين — كله على الخادم', async () => {
  const H = harness();
  assert.equal((await H.call('GET /api/provider/me', { who: 'boss' })).json.provider, true);
  assert.equal((await H.call('GET /api/provider/me', { who: 'boss', mfa: false })).json.provider, false, 'بلا خطوة ثانية');
  assert.equal((await H.call('GET /api/provider/me', { who: 'bossC2' })).json.provider, false, 'نفس البريد من منشأة عميل لا يكفي');
  assert.equal((await H.call('GET /api/provider/me', { who: 'taif' })).json.provider, false, 'مدير الطيف ليس مزوّدًا');
  for (const k of ['GET /api/provider/tenants', 'GET /api/provider/signups', 'POST /api/provider/trial', 'POST /api/provider/status', 'POST /api/provider/invoice/confirm'])
    assert.equal((await H.call(k, { who: 'taif', body: { tenant: 'c2', status: 'active' } })).status, 403, k);
  assert.equal(providerConfig({}).admins.length, 0, 'بلا قائمة ⇒ لا مزوّد');
  assert.equal(providerConfig({ MQ_PROVIDER_ADMINS: 'x, bad , a@b.sa' }).admins.join(), 'a@b.sa');
  assert.equal((await harness({ controlReady: false }).call('GET /api/provider/tenants', { who: 'boss' })).status, 503);
});

test('قائمة المنشآت: الحالة والتوصية من الفوترة، والمفاتيح «مضبوط/لا» فقط بلا أي سر', async () => {
  const H = harness();
  await H.store.putSub('c3', { paidThrough: '2026-11-01', plan: 'basic' });
  const r = (await H.call('GET /api/provider/tenants', { who: 'boss' })).json;
  assert.deepEqual(r.tenants.map(t => t.id), ['c2', 'c3', 'c9']);
  const c2 = r.tenants[0], c3 = r.tenants[1], c9 = r.tenants[2];
  assert.equal(c2.name, 'مطعم س'); assert.equal(c2.state, 'unpaid'); assert.deepEqual(c2.keys, { web: true, zatca: false, ops: true });
  assert.equal(c3.state, 'overdue'); assert.equal(c3.recommend, 'readonly'); assert.equal(c9.state, 'unconfigured', 'في السجل وغير مهيأة على الخادم');
  const txt = JSON.stringify(r); for (const secret of ['AIzaSy', 'PRIVATE KEY', 'ops@mithqal']) assert.ok(!txt.includes(secret), secret);
});

test('حالة الاشتراك: تُكتب في قاعدة المنشأة بحساب خدمتها وبشرط وجود مستند الإصدار، وإلا يُعاد الأمر اليدوي', async () => {
  const H = harness();
  const ok = await H.call('POST /api/provider/status', { who: 'boss', body: { tenant: 'c2', status: 'readonly' } });
  assert.equal(ok.json.ok, true);
  const w = H.fetched.find(u => u.startsWith('PATCH')); assert.match(w, /projects\/mithqal-c2\/databases\/\(default\)\/documents\/platform\/release\?updateMask\.fieldPaths=sub&currentDocument\.exists=true$/);
  const no = await H.call('POST /api/provider/status', { who: 'boss', body: { tenant: 'c3', status: 'readonly' } });
  assert.equal(no.status, 409); assert.equal(no.json.cmd, 'node scripts/tenant-provision.mjs status --id c3 --set readonly');
  assert.equal((await H.call('POST /api/provider/status', { who: 'boss', body: { tenant: 'default', status: 'readonly' } })).status, 404, 'لا يمس الطيف');
  assert.equal((await H.call('POST /api/provider/status', { who: 'boss', body: { tenant: 'c2', status: 'paused' } })).status, 400);
  await assert.rejects(writeTenantStatus({ tenant: { projectId: 'p' }, status: 'active', tokenFor: async () => 'x', fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }) }), /مستند الإصدار غير موجود/);
});

test('التجربة والتحويل البنكي من اللوحة', async () => {
  const H = harness();
  const t = (await H.call('POST /api/provider/trial', { who: 'boss', body: { tenant: 'c2', days: 14 } })).json; assert.equal(t.paidThrough, '2026-12-02');
  assert.equal((await H.store.getSub('c2')).trial, true);
  assert.equal((await H.call('POST /api/provider/trial', { who: 'boss', body: { tenant: 'c2', days: 14 } })).status, 409, 'لا تجربة ثانية');
  const SELLER = { name: 'مِثقال', vatNo: '311111111100003' };
  const inv = { ...buildInvoice({ seq: 1, issuedAt: '2026-11-19T00:00:00Z', tenant: 'c3', plan: 'basic', period: 'monthly', start: '2026-11-19', prices: parsePrices('{"basic":{"monthly":99}}').prices, seller: SELLER }), status: 'pending_transfer' };
  await H.store.putInvoice(inv);
  assert.equal((await H.call('POST /api/provider/invoice/confirm', { who: 'boss', body: { no: inv.no, ref: 'TRX9', amount: '100' } })).status, 409, 'مبلغ مختلف');
  const c = (await H.call('POST /api/provider/invoice/confirm', { who: 'boss', body: { no: inv.no, ref: 'TRX9', amount: '113.85' } })).json; assert.equal(c.status, 'paid');
  assert.equal((await H.store.getSub('c3')).paidThrough, inv.end); assert.equal((await H.store.getInvoice(inv.no)).confirmedBy, 'boss@mithqal.sa');
  assert.equal((await H.call('POST /api/provider/invoice/void', { who: 'boss', body: { no: inv.no } })).status, 409, 'لا تُلغى المدفوعة');
  const list = (await H.call('GET /api/provider/invoices', { who: 'boss', query: { tenant: 'c3' } })).json.invoices; assert.equal(list.length, 1);
});

test('التسجيل العام: تحقق المدخلات، الروبوت لا يُحفظ، لا تكرار، والقرار يعيد أمر التهيئة', async () => {
  assert.match(validateSignup({ company: 'مطعم', contact: 'أحمد علي', email: 'x', phone: '0501234567' }).error, /البريد/);
  assert.match(validateSignup({ company: 'مطعم ب', contact: 'أحمد علي', email: 'a@b.sa', phone: '123' }).error, /الجوال/);
  assert.match(validateSignup({ company: 'مطعم ب', contact: 'أحمد علي', email: 'a@b.sa', phone: '0501234567', vatNo: '123' }).error, /الضريبي/);
  assert.equal(validateSignup({ company: 'مطعم ب', contact: 'أحمد علي', email: 'A@B.sa', phone: '050 123 4567', plan: 'gold' }).v.plan, 'basic');
  assert.equal(suggestId('Burger House!', 7), 'burger-house-007'); assert.equal(suggestId('مطعم', 12), 'org-012');
  const H = harness(); const B = { company: 'Burger House', contact: 'أحمد علي', email: 'own@bh.sa', phone: '0501234567', plan: 'pro', branches: 3 };
  assert.deepEqual((await H.call('POST /api/signup', { body: { ...B, website: 'http://spam' } })).json, { ok: true }); assert.equal((await H.store.listSignups()).length, 0, 'الروبوت لا يُحفظ');
  const r1 = (await H.call('POST /api/signup', { body: B })).json; assert.equal(r1.id, 'S00001');
  assert.equal((await H.call('POST /api/signup', { body: B })).json.dup, true); assert.equal((await H.store.listSignups()).length, 1);
  assert.equal((await harness({ controlReady: false }).call('POST /api/signup', { body: B })).status, 503);
  const d = (await H.call('POST /api/provider/signups/decide', { who: 'boss', body: { id: 'S00001', status: 'approved' } })).json;
  assert.equal(d.signup.tenantId, 'burger-house-001'); assert.equal(d.cmd, 'node scripts/tenant-provision.mjs plan --id burger-house-001 --name "Burger House" --plan pro --owner own@bh.sa');
  assert.equal((await H.call('POST /api/provider/signups/decide', { who: 'boss', body: { id: 'S00001', status: 'rejected' } })).status, 409, 'قرار واحد');
  const evil = { ...B, email: 'e@bh.sa', company: 'X"; rm -rf / `id` $(x)' }; const r2 = (await H.call('POST /api/signup', { body: evil })).json;
  const d2 = (await H.call('POST /api/provider/signups/decide', { who: 'boss', body: { id: r2.id, status: 'approved' } })).json; assert.doesNotMatch(d2.cmd, /[`$]|"; /, 'الأمر المقترح لا يحمل حقنًا');
});

test('حساب الخدمة التشغيلي: يُقبل لمشروعه فقط', () => {
  const T = loadTenants({ ...ENV, SA_C2: JSON.stringify({ client_email: 'x@y', private_key: 'k', project_id: 'other' }) });
  assert.equal(T.byId('c2').sa, null); assert.match(T.errors.join(), /لا يطابق المشروع/);
  assert.equal(isProvider({ admins: ['a@b.sa'], mfa: false }, { user: { email: 'A@b.sa', tenant: 'default' }, headers: {} }), true);
});

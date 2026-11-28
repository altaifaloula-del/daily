/* v52.9 — إدارة حسابات الدخول من التطبيق: لمسؤول النظام، في منشأته، ولا يمس مسؤولًا آخر، وكلمة السر لا تُسجَّل */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mountUserAdmin, accountSummary, validatePassword } from '../server-users.js';
import { loadTenants } from '../tenants.js';

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
const SA = JSON.stringify({ client_email: 'ops@demo-prod.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'demo-prod' });
const ENV = { FIREBASE_API_KEY: 'AIzaSy' + 'a'.repeat(33), FIREBASE_PROJECT_ID: 'demo-prod', FIREBASE_SERVICE_ACCOUNT: SA };

function harness({ env = ENV, accounts = { 'acc@example.sa': { localId: 'L1', email: 'acc@example.sa', lastLoginAt: '1763000000000', passwordUpdatedAt: '1762000000000' } }, members = { 'acc@example.sa': 'accountant', 'admin2@example.sa': 'system_admin', 'new@example.sa': 'branch_manager' }, admins = null, adminsFail = false, adminsNoField = false } = {}) {
  const routes = {}; const app = { post: (p, ...h) => (routes[p] = h) };
  const users = { owner: { email: 'o@example.sa', role: 'system_admin', tenant: 'default' }, acct: { email: 'acc@example.sa', role: 'accountant', tenant: 'default' } };
  const requireMember = (req, res, next) => { const u = users[req.who]; if (!u) return res.status(401).json({}); req.user = u; next(); };
  const sent = []; const logs = [];
  const fetchImpl = async (u, i = {}) => { let b = null; try { b = i.body ? JSON.parse(i.body) : null; } catch { b = i.body; } sent.push({ u, body: b });
    if (u.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 'AT', expires_in: 3600 }) };
    if (u.includes('/documents/members/')) { const em = decodeURIComponent(u.split('/members/')[1]); return members[em] ? { ok: true, status: 200, json: async () => ({ fields: { role: { stringValue: members[em] }, active: { booleanValue: true } } }) } : { ok: false, status: 404, json: async () => ({}) }; }
    if (u.endsWith('/documents/platform/admins')) { if (adminsFail) return { ok: false, status: 503, json: async () => ({}) }; if (adminsNoField) return { ok: true, status: 200, json: async () => ({ fields: { at: { integerValue: '1' } } }) }; return admins ? { ok: true, status: 200, json: async () => ({ fields: { emails: { arrayValue: { values: admins.map(e => ({ stringValue: e })) } } } }) } : { ok: false, status: 404, json: async () => ({}) }; }
    if (u.endsWith('/accounts:lookup')) { const em = JSON.parse(i.body).email[0]; return { ok: true, json: async () => (accounts[em] ? { users: [accounts[em]] } : {}) }; }
    return { ok: true, json: async () => ({}) }; };
  mountUserAdmin(app, { express: { json: () => (q, r, n) => n() }, requireMember, rateLimit: () => (q, r, n) => n(), T: loadTenants(env), env, fetchImpl, log: { log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) } });
  const call = async (path, who, body) => { const req = { who, body }; const out = { status: 200 };
    const res = { status(c) { out.status = c; return this; }, json(j) { out.json = j; return this; } };
    for (const h of routes[path]) { let go = false; await h(req, res, () => { go = true; }); if (!go) break; } return out; };
  return { call, sent, logs };
}

test('الحالة: مسؤول النظام يرى وجود الحساب وآخر دخول وآخر تغيير لكلمة السر', async () => {
  const H = harness(); const r = await H.call('/api/users/status', 'owner', { email: 'ACC@example.sa ' });
  assert.equal(r.status, 200); assert.equal(r.json.account.exists, true); assert.match(r.json.account.lastLoginAt, /^2025-/); assert.ok(r.json.account.passwordUpdatedAt);
  assert.ok(H.sent.some(s => s.u === 'https://identitytoolkit.googleapis.com/v1/projects/demo-prod/accounts:lookup'));
  assert.deepEqual(accountSummary(null), { exists: false });
});

test('تعيين كلمة السر: يحدّث الحساب الموجود أو ينشئ المفقود — ولا تظهر كلمة السر في السجل ولا الرد', async () => {
  const H = harness();
  const r = await H.call('/api/users/password', 'owner', { email: 'acc@example.sa', password: 'Taif2026x' });
  assert.equal(r.status, 200); assert.deepEqual(r.json, { ok: true, created: false });
  const up = H.sent.find(s => s.u.endsWith('/accounts:update')); assert.deepEqual(up.body, { localId: 'L1', password: 'Taif2026x' });
  const c = await H.call('/api/users/password', 'owner', { email: 'new@example.sa', password: 'Branch2026' });
  assert.deepEqual(c.json, { ok: true, created: true }); assert.ok(H.sent.some(s => s.u.endsWith('/accounts') && s.body.email === 'new@example.sa'));
  assert.ok(!H.logs.join('\n').includes('Taif2026x') && !H.logs.join('\n').includes('Branch2026'));
});

test('الحدود: غير المسؤول، وغير العضو، ومسؤول آخر، والنفس، وكلمة سر ضعيفة، وبلا حساب خدمة', async () => {
  const H = harness();
  assert.equal((await H.call('/api/users/password', 'acct', { email: 'new@example.sa', password: 'Branch2026' })).status, 403);
  assert.equal((await H.call('/api/users/password', 'owner', { email: 'stranger@x.sa', password: 'Branch2026' })).status, 404);
  assert.equal((await H.call('/api/users/password', 'owner', { email: 'admin2@example.sa', password: 'Branch2026' })).status, 403);
  assert.equal((await H.call('/api/users/password', 'owner', { email: 'o@example.sa', password: 'Branch2026' })).status, 400);
  assert.equal((await H.call('/api/users/password', 'owner', { email: 'acc@example.sa', password: '1234567' })).status, 400);
  assert.equal(validatePassword('abcdefgh'), 'كلمة السر تجمع أرقامًا وحروفًا'); assert.equal(validatePassword('abcd1234'), '');
  const N = harness({ env: { ...ENV, FIREBASE_SERVICE_ACCOUNT: '' } });
  const r = await N.call('/api/users/status', 'owner', { email: 'acc@example.sa' }); assert.equal(r.status, 409); assert.equal(r.json.code, 'no-sa');
  const W = harness({ env: { ...ENV, FIREBASE_SERVICE_ACCOUNT: SA.replace('demo-prod"', 'other-proj"') } });
  assert.equal((await W.call('/api/users/status', 'owner', { email: 'acc@example.sa' })).status, 409, 'حساب خدمة لمشروع آخر مرفوض');
});

test('v56.59 — مسؤول النظام لا يغيّر كلمة سر ولا يستعلم حالة بريد من مدراء المنصة (platform/admins) — وتعذّر القراءة يرفض', async () => {
  const H = harness({ admins: ['other@example.sa', 'ACC@example.sa '] });
  const p = await H.call('/api/users/password', 'owner', { email: 'acc@example.sa', password: 'Branch2026', enable: true });
  assert.equal(p.status, 403); assert.ok(!H.sent.some(s => s.u.includes('/accounts:update') || s.u.endsWith('/accounts')), 'لا استدعاء لخدمة الدخول');
  assert.equal((await H.call('/api/users/status', 'owner', { email: 'acc@example.sa' })).status, 403);
  assert.equal((await H.call('/api/users/password', 'owner', { email: 'new@example.sa', password: 'Branch2026' })).status, 200, 'غير المدير يُدار كالمعتاد');
  const F = harness({ adminsFail: true });
  const f = await F.call('/api/users/password', 'owner', { email: 'new@example.sa', password: 'Branch2026' });
  assert.equal(f.status, 502); assert.ok(!F.sent.some(s => s.u.includes('identitytoolkit')), 'فشل مغلق قبل أي تعديل');
});

test('v56.59 — مدراء لوحة المزوّد (MQ_PROVIDER_ADMINS) محميون كذلك، ومستند المدراء بلا emails ⇒ 502 (فشل مغلق)', async () => {
  const H = harness({ env: { ...ENV, MQ_PROVIDER_ADMINS: 'x@y.sa, ACC@example.sa' } });
  assert.equal((await H.call('/api/users/password', 'owner', { email: 'acc@example.sa', password: 'Branch2026' })).status, 403);
  assert.equal((await H.call('/api/users/status', 'owner', { email: 'acc@example.sa' })).status, 403);
  assert.ok(!H.sent.some(s => s.u.includes('identitytoolkit')), 'لا نداء لخدمة الدخول');
  assert.equal((await H.call('/api/users/password', 'owner', { email: 'new@example.sa', password: 'Branch2026' })).status, 200);
  const N = harness({ adminsNoField: true });
  assert.equal((await N.call('/api/users/password', 'owner', { email: 'new@example.sa', password: 'Branch2026' })).status, 502);
  assert.ok(!N.sent.some(s => s.u.includes('identitytoolkit')));
  const E0 = harness({ admins: [] });
  assert.equal((await E0.call('/api/users/password', 'owner', { email: 'new@example.sa', password: 'Branch2026' })).status, 200, 'قائمة فارغة صالحة');
});

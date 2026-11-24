/* v54.6 — المرحلة 7: الحوكمة — سجل الذكاء الاصطناعي (ai_log) ومزامنة رقم الإصدار */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { mountAiLog, aiLogKind } from '../server-ailog.js';
import { loadTenants } from '../tenants.js';

test('رقم إصدار package.json مطابق لإصدار التطبيق', () => {
  const pk = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url))).version; const app = /const APP_VER = 'v(\d+)\.(\d+)'/.exec(fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8'));
  assert.ok(app); assert.equal(pk.split('.').slice(0, 2).join('.'), app[1] + '.' + app[2]);
});
test('تصنيف الطلبات: القراءة لا تُسجَّل، والذكاء الاصطناعي والمراجع والمراجعة والمقترحات تُسجَّل', () => {
  assert.equal(aiLogKind('GET', '/api/refs'), null); assert.deepEqual(aiLogKind('POST', '/api/ai/analyze'), { kind: 'ai', name: 'analyze' });
  assert.deepEqual(aiLogKind('POST', '/api/refs/review'), { kind: 'review', name: 'refs_review' }); assert.deepEqual(aiLogKind('POST', '/api/refs/search'), { kind: 'refs', name: 'search' });
  assert.deepEqual(aiLogKind('POST', '/api/mcp/proposals/decide'), { kind: 'proposal', name: 'decide' }); assert.equal(aiLogKind('POST', '/api/billing/checkout'), null);
});
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
const SA = JSON.stringify({ client_email: 'ops@p.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'p1' });
test('الكتابة بحساب الخدمة دون محتوى الطلب، القراءة لمسؤول النظام فقط، وفشل السجل لا يعطل الطلب', async () => {
  const routes = {}, uses = []; const app = { get: (p, ...h) => { routes['GET ' + p] = h; }, use: (p, h) => uses.push([p, h]) }; const store = {}; let fail = false; const errs = [];
  const fetchImpl = async (u, i = {}) => { const J = (s, j) => ({ ok: s < 300, status: s, json: async () => j }); if (u.includes('oauth2')) return J(200, { access_token: 'AT', expires_in: 3600 });
    if (i.method === 'POST') { if (fail) return J(500, {}); const id = /documentId=([^&]+)/.exec(u)[1]; store[id] = JSON.parse(i.body).fields; return J(200, {}); }
    return J(200, { documents: Object.entries(store).map(([k, f]) => ({ name: 'x/ai_log/' + k, fields: f })) }); };
  let role = 'accountant'; const requireMember = (req, res, next) => { req.user = { email: 'a@x.sa', role, tenant: 'default' }; next(); };
  const env = { FIREBASE_API_KEY: 'AIzaSy' + 'a'.repeat(33), FIREBASE_SERVICE_ACCOUNT: SA };
  const L = mountAiLog(app, { requireMember, rateLimit: () => (q, r, n) => n(), T: loadTenants(env), fetchImpl, log: { log() { }, error: (...a) => errs.push(a.join(' ')) } });
  // الوسيط: طلب مراجعة ينتهي ⇒ سطر بلا محتوى الحالات
  const mw = uses[0][1]; let fin; const req = { method: 'POST', baseUrl: '/api', path: '/refs/review', body: { cases: [{ title: 'سر', evidence: 'مبلغ 999' }] } }; const res = { statusCode: 200, on: (e, f) => { fin = f; } };
  mw(req, res, () => { }); req.user = { email: 'a@x.sa', role: 'accountant', tenant: 'default' }; fin(); await new Promise(r => setTimeout(r, 20));
  const rows = Object.values(store); assert.equal(rows.length, 1); assert.equal(rows[0].kind.stringValue, 'review'); assert.equal(rows[0].detail.stringValue, '1 حالة'); assert.ok(!JSON.stringify(rows).includes('999'), 'لا محتوى مالي');
  await L.write('default', { by: 'mcp', kind: 'mcp', name: 'trial_balance', ok: true, ms: 12 });
  const call = async () => { const o = { status: 200 }; const r = { status(c) { o.status = c; return this; }, json(j) { o.json = j; return this; } }; const q = {}; for (const h of routes['GET /api/ai/log']) { let go = false; await h(q, r, () => { go = true; }); if (!go) break; } return o; };
  assert.equal((await call()).status, 403); role = 'system_admin'; const G = await call(); assert.equal(G.json.log.length, 2); assert.ok(G.json.log.some(x => x.name === 'trial_balance' && x.ok === true));
  fail = true; assert.equal(await L.write('default', { kind: 'ai' }), false, 'الفشل لا يرمي'); assert.ok(errs.some(e => /ai_log/.test(e)));
  assert.equal(await L.write('nope', { kind: 'ai' }) !== undefined, true);
});

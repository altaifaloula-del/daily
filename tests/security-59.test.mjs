/**
 * v56.59 — تدقيق الأمان (المرحلة H): الاستنزاف (الهوية قبل الجسم الكبير + حد لكل عنوان)، وكلفة الذكاء الاصطناعي
 * (حد للمنشأة مجتمعة + التحليل والنمو للأدوار المركزية)، وفحص الإعدادات (deep لمدير المنصة وحده).
 * خادم Express حقيقي بمحلّل JSON الحقيقي — لا نداء لـ Google ولا Anthropic (كلها محقونة). البيانات وهمية.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { buildEngine } from './build-engine.mjs';
import { mountRefs } from '../server-refs.js';
import { mountLedger } from '../server-ledger.js';
import { mountAiRoutes, AI_CENTRAL_ROLES } from '../server-ai.js';
import { healthAdmin, healthRedact } from '../server-health.js';
import { loadTenants } from '../tenants.js';

let E;
before(async () => { E = await buildEngine(); });

// حد معدل بسيط كالذي في server.js (مفتاح ⇒ عداد)
const realLimit = () => { const B = new Map(); return ({ max, keyFn }) => (req, res, next) => { const k = (keyFn ? keyFn(req) : '') || req.ip || 'anon'; const n = (B.get(k) || 0) + 1; B.set(k, n); if (n > max) return res.status(429).json({ error: 'طلبات كثيرة' }); next(); }; };
const USERS = { 'tok-admin': { email: 'admin@example.sa', role: 'system_admin', tenant: 'default' }, 'tok-acc': { email: 'acc@example.sa', role: 'accountant', tenant: 'default' },
  'tok-reg': { email: 'reg@example.sa', role: 'regional_manager', tenant: 'default' }, 'tok-reg2': { email: 'reg2@example.sa', role: 'regional_manager', tenant: 'default' },
  'tok-bm': { email: 'bm@example.sa', role: 'branch_manager', tenant: 'default' }, 'tok-cash': { email: 'c@example.sa', role: 'cashier', tenant: 'default' } };
const requireMember = (req, res, next) => { const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '')); if (!m) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
  const u = USERS[m[1]]; if (!u) return res.status(403).json({ error: 'لا صلاحية' }); req.user = u; next(); };
const T = loadTenants({ FIREBASE_API_KEY: 'AIzaSy' + 'a'.repeat(33), FIREBASE_PROJECT_ID: 'demo-prod' });

async function serve(mount) {
  const app = express(); mount(app);
  app.use((err, _req, res, _next) => { if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'كبير' }); if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON' }); res.status(500).json({}); });
  const srv = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = 'http://127.0.0.1:' + srv.address().port;
  const post = async (path, body, tok) => { const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body });
    return { status: r.status, json: await r.json().catch(() => null) }; };
  return { post, close: () => new Promise(r => { srv.closeAllConnections && srv.closeAllConnections(); srv.close(r); }) };
}
const BIG = (mb) => '{"x":"' + 'A'.repeat(mb * 1024 * 1024) + '"}';
const BAD = '{{{ ليس JSON';

test('الاستنزاف: بلا هوية ⇒ 401 دون تحليل الجسم (جسم أكبر من الحد أو JSON تالف لا يصل للمحلّل) — المراجع والدفتر والذكاء الاصطناعي', async () => {
  const S = await serve((app) => {
    mountRefs(app, { express, requireMember, rateLimit: realLimit(), T, fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }), aiClient: null, log: { log() {}, error() {} } });
    mountLedger(app, { express, requireMember, rateLimit: realLimit(), T, cv: 1, fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }), log: { log() {}, error() {} } });
    mountAiRoutes(app, { express, requireMember, requireFeature: () => (q, r, n) => n(), rateLimit: realLimit(), tenantOf: () => T.def, ai: async () => ({}), env: {} });
  });
  try {
    const big = { '/api/refs/upload': 41, '/api/ledger/post': 3, '/api/ai/analyze': 2, '/api/ai/feedback': 2, '/api/ai/growth': 2, '/api/refs/review': 1, '/api/refs/search': 1, '/api/refs/update': 1 };
    for (const [p, mb] of Object.entries(big)) {
      assert.equal((await S.post(p, BIG(mb))).status, 401, p + ': جسم ' + mb + 'MB بلا هوية');
      assert.equal((await S.post(p, BAD)).status, 401, p + ': JSON تالف بلا هوية لا يُحلَّل');
    }
    // المصادَق يُحلَّل جسمه (الحد ما زال مفروضًا)
    assert.equal((await S.post('/api/ledger/post', BAD, 'tok-acc')).status, 400, 'المصادَق: JSON تالف ⇒ 400 من المحلّل');
    assert.equal((await S.post('/api/ledger/post', BIG(3), 'tok-acc')).status, 413, 'المصادَق: فوق 2MB ⇒ 413');
    // رفع المراجع: غير مسؤول النظام يُرفض قبل قراءة 40MB
    assert.equal((await S.post('/api/refs/upload', BAD, 'tok-acc')).status, 403);
    assert.equal((await S.post('/api/refs/upload', BAD, 'tok-admin')).status, 400, 'مسؤول النظام يصل المحلّل');
  } finally { await S.close(); }
});

test('الاستنزاف: حد لكل عنوان IP قبل الهوية على مسار الرفع الكبير — الطلب 21 خلال 10 دقائق ⇒ 429 حتى بلا رمز', async () => {
  const S = await serve((app) => mountRefs(app, { express, requireMember, rateLimit: realLimit(), T, fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }), aiClient: null, log: { log() {}, error() {} } }));
  try {
    for (let i = 0; i < 20; i++) assert.equal((await S.post('/api/refs/upload', BAD)).status, 401);
    assert.equal((await S.post('/api/refs/upload', BAD)).status, 429);
  } finally { await S.close(); }
});

/* ===== كلفة الذكاء الاصطناعي ===== */
function aiHarness({ env = {}, admin = () => false } = {}) {
  const routes = {}; const app = { post: (p, ...h) => (routes[p] = h) }; const calls = []; let parsed = 0;
  mountAiRoutes(app, { express: { json: () => (q, r, n) => { parsed++; n(); } }, requireMember: (req, res, next) => { const u = USERS[req.tok]; if (!u) return res.status(401).json({}); req.user = u; next(); },
    requireFeature: () => (q, r, n) => n(), rateLimit: realLimit(), tenantOf: (req) => ({ id: (req.user && req.user.tenant) || 'default' }), ai: async (o) => { calls.push(o); return { results: [], answer: 'ok' }; },
    adminCheck: async (req) => admin(req), env });
  const call = async (path, tok, body, ip = '10.0.0.1') => { const req = { tok, body, ip, headers: {} }; const out = { status: 200 };
    const res = { status(c) { out.status = c; return this; }, json(j) { out.json = j; return this; } };
    for (const h of routes[path]) { let go = false; await h(req, res, () => { go = true; }); if (!go) break; } return out; };
  return { call, calls, parsed: () => parsed };
}
const DIG = { digest: { sales: 1000 }, question: 'ما أفضل فرع؟' };
const FB = { items: [{ id: 'f1', comment: 'ممتاز' }] };

test('كلفة الذكاء الاصطناعي: حد للمنشأة مجتمعة (AI_TENANT_PER_HOUR) مشترك بين التحليل والتعليقات والنمو — فوق حد المستخدم', async () => {
  const H = aiHarness({ env: { AI_TENANT_PER_HOUR: '4', AI_RATE_LIMIT_PER_HOUR: '3' } });
  assert.equal((await H.call('/api/ai/analyze', 'tok-acc', DIG)).status, 200);
  assert.equal((await H.call('/api/ai/growth', 'tok-acc', DIG)).status, 200);
  assert.equal((await H.call('/api/ai/feedback', 'tok-acc', FB)).status, 200);
  assert.equal((await H.call('/api/ai/feedback', 'tok-acc', FB)).status, 429, 'حد المستخدم 3');
  assert.equal((await H.call('/api/ai/feedback', 'tok-bm', FB)).status, 200, 'الرابع للمنشأة من مستخدم آخر');
  assert.equal((await H.call('/api/ai/analyze', 'tok-admin', DIG)).status, 429, 'الخامس للمنشأة يتجاوز 4 مهما كان المستخدم والمسار');
  assert.equal(H.calls.length, 4);
  const D = aiHarness(); for (let i = 0; i < 30; i++) assert.equal((await D.call('/api/ai/feedback', 'tok-acc', FB)).status, 200);
  assert.equal((await D.call('/api/ai/feedback', 'tok-acc', FB)).status, 429, 'الافتراضي: 30 لكل مستخدم');
  const D2 = aiHarness({ env: { AI_RATE_LIMIT_PER_HOUR: '1000' } }); const who = Object.keys(USERS); let ok = 0;
  for (let i = 0; i < 125; i++) if ((await D2.call('/api/ai/feedback', who[i % who.length], FB)).status === 200) ok++;
  assert.equal(ok, 120, 'الافتراضي: 120 للمنشأة في الساعة');
});

test('كلفة الذكاء الاصطناعي: التحليل المالي ومساعد النمو للأدوار المركزية ومدير المنصة فقط؛ التعليقات كما كانت', async () => {
  const H = aiHarness({ admin: (req) => req.user.email === 'reg2@example.sa' });
  for (const tok of ['tok-reg', 'tok-bm', 'tok-cash']) {
    assert.equal((await H.call('/api/ai/analyze', tok, DIG)).status, 403, tok + ' analyze');
    assert.equal((await H.call('/api/ai/growth', tok, DIG)).status, 403, tok + ' growth');
    assert.equal((await H.call('/api/ai/feedback', tok, FB)).status, 200, tok + ' feedback كما هو');
  }
  assert.equal(H.parsed(), 3, 'المرفوض لا يُقرأ جسمه');
  assert.equal((await H.call('/api/ai/analyze', 'tok-acc', DIG)).status, 200);
  assert.equal((await H.call('/api/ai/growth', 'tok-admin', DIG)).status, 200);
  assert.equal((await H.call('/api/ai/growth', 'tok-reg2', DIG)).status, 200, 'مدير المنصة (platform/admins) بدور فرعي يمر');
  assert.equal((await H.call('/api/ai/analyze', null, DIG)).status, 401);
  assert.equal((await H.call('/api/ai/analyze', 'tok-acc', {})).status, 400);
});

test('انجراف: الأدوار المركزية للذكاء الاصطناعي = كل دور نطاقه «all» في ROLES', () => {
  const central = Object.entries(E.ROLES).filter(([, r]) => r.scope === 'all').map(([k]) => k).sort();
  assert.deepEqual([...AI_CENTRAL_ROLES].sort(), central);
  assert.ok(!AI_CENTRAL_ROLES.includes('regional_manager') && !AI_CENTRAL_ROLES.includes('branch_manager'));
});

/* ===== فحص الإعدادات ===== */
test('فحص الإعدادات: deep لمدير المنصة الموثّق في المنشأة الرئيسية وحده، والمخرج العام بلا معرّف المشروع', async () => {
  const verify = async (t) => ({ 'tok-admin': USERS['tok-admin'], 'tok-acc': USERS['tok-acc'], 'tok-other': { email: 'x@c2.sa', role: 'system_admin', tenant: 'client2' }, 'tok-mfa': { blocked: 'mfa', email: 'admin@example.sa', tenant: 'default' } })[t] || null;
  const adminCheck = async (req) => ['admin@example.sa', 'x@c2.sa'].includes(req.user.email);
  const H = (a) => ({ headers: a ? { authorization: 'Bearer ' + a } : {} });
  assert.equal(await healthAdmin(H('tok-admin'), { verify, adminCheck }), true);
  for (const t of [null, 'tok-acc', 'tok-other', 'tok-mfa', 'tok-bad']) assert.equal(await healthAdmin(H(t), { verify, adminCheck }), false, String(t));
  assert.equal(await healthAdmin(H('tok-admin'), { verify: async () => { throw new Error('x'); }, adminCheck }), false, 'خطأ ⇒ لا');
  const out = { ok: true, serviceAccount: { set: true, project: 'demo-prod', projectIdEnv: 'demo-prod', readsData: true } };
  assert.deepEqual(healthRedact(out, false).serviceAccount, { set: true, readsData: true });
  assert.equal(healthRedact(out, true).serviceAccount.project, 'demo-prod');
  assert.equal(out.serviceAccount.project, 'demo-prod', 'لا يُعدَّل الأصل');
});

/* v54.4 — المرحلة 5: مكتبة المراجع — الاستخراج بصفحاته، البحث والاستشهاد بالصفحة الفعلية، الإصدارات والحالة والتوثيق، الصلاحيات، واستخراج PDF بـ Claude */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { refChunk, refSearch, refStdRefs, refExcerpt } from '../ref-lib.mjs';
import { mountRefs, refMetaClean, refPdfPages } from '../server-refs.js';
import { loadTenants } from '../tenants.js';

const DOCS = [{ id: 'd15', title: 'IFRS 15 — الإيراد من العقود مع العملاء', family: 'IFRS 15', cat: 'ifrs', authority: 'official', status: 'active', verified: true, effFrom: '2018-01-01' },
  { id: 'd15old', title: 'IAS 18 الإيراد (ملغى)', family: 'IAS 18', cat: 'ias', authority: 'official', status: 'superseded' },
  { id: 'pol', title: 'سياسة الاعتراف بالإيراد — شركة الطيف', family: '', cat: 'policy', authority: 'internal', status: 'active', verified: false }];
const PAGES15 = [{ page: 31, text: 'الفقرة 31: تعترف المنشأة بالإيراد عندما (أو كلما) تفي بالتزام أداء بتحويل سلعة أو خدمة متعهد بها إلى العميل.\n\nالفقرة 32: لكل التزام أداء تحدد المنشأة ما إذا كانت تفي به على مدى زمني أو في نقطة زمنية.' },
  { page: 12, text: 'نطاق المعيار: ينطبق على جميع العقود مع العملاء باستثناء عقود الإيجار.' }];
const CH = [...refChunk(PAGES15).map(c => ({ ...c, doc: 'd15' })), { doc: 'd15old', page: 4, para: 1, text: 'يعترف بالإيراد عند تحويل المخاطر والمنافع' }, { doc: 'pol', page: 2, para: 1, text: 'تعترف الشركة بإيراد المطعم عند تسليم الطلب للعميل.' }];

test('البحث: الاستشهاد بالصفحة الفعلية، تعزيز رقم المعيار والفقرة، واستبعاد الملغى افتراضيًا', () => {
  const H = refSearch(CH, DOCS, 'متى تعترف المنشأة بالإيراد IFRS 15 فقرة 31');
  assert.equal(H[0].doc, 'd15'); assert.equal(H[0].page, 31); assert.match(H[0].excerpt, /الفقرة 31/); assert.equal(H[0].authority, 'official');
  assert.ok(!H.some(h => h.doc === 'd15old'), 'الملغى لا يظهر افتراضيًا');
  assert.ok(refSearch(CH, DOCS, 'الإيراد', { includeInactive: true }).some(h => h.doc === 'd15old'));
  const P = refSearch(CH, DOCS, 'تسليم الطلب'); assert.equal(P[0].doc, 'pol'); assert.equal(P[0].authorityLabel, 'سياسة داخلية للمنشأة'); assert.equal(P[0].verified, false);
  assert.deepEqual(refSearch(CH, DOCS, 'الإيراد', { cat: 'policy' }).map(h => h.doc), ['pol']);
  assert.deepEqual(refSearch(CH, DOCS, 'مخزون الهدر الزراعي'), [], 'لا نتائج مختلقة');
  assert.deepEqual(refStdRefs('IAS 16 ومعيار التقرير المالي الدولي رقم 9'), ['ias 16', 'ifrs 9']);
  assert.ok(refExcerpt('x'.repeat(5000), ['x']).length <= 422, 'المقتطف محدود');
});

test('البيانات الوصفية: التصنيف والحجية والتواريخ والحالة تُتحقق', () => {
  assert.throws(() => refMetaClean({}), /العنوان|عنوان/); assert.throws(() => refMetaClean({ title: 'x', cat: 'zzz' }), /تصنيف/);
  assert.throws(() => refMetaClean({ title: 'x', effFrom: '2026/01/01' }), /YYYY/);
  assert.deepEqual(refMetaClean({ title: 'x' }), { cat: 'other', authority: 'other', status: 'active', title: 'x' });
});

test('استخراج PDF بـ Claude صفحةً صفحة على دفعات، ورفض ما يتجاوز الحد', async () => {
  const calls = []; const ai = { messages: { create: async (p) => { calls.push(p); const m = /من (\d+) إلى (\d+)/.exec(p.messages[0].content[1].text); const a = +m[1], b = Math.min(+m[2], 20);
    return { content: [{ type: 'text', text: JSON.stringify({ total_pages: 20, pages: Array.from({ length: b - a + 1 }, (_, i) => ({ page: a + i, text: 'صفحة ' + (a + i) })) }) }] }; } } };
  const P = await refPdfPages(ai, 'claude-haiku-5-5', 'QUJD', { batch: 15 }); assert.equal(P.length, 20); assert.equal(P[19].text, 'صفحة 20'); assert.equal(calls.length, 2);
  assert.equal(calls[0].messages[0].content[0].type, 'document');
  const big = { messages: { create: async () => ({ content: [{ type: 'text', text: '{"total_pages": 300, "pages": []}' }] }) } };
  await assert.rejects(refPdfPages(big, 'm', 'x'), /قسّمه/);
});

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
const SA = JSON.stringify({ client_email: 'ops@p.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'p1' });
function harness({ role = 'system_admin', sa = SA } = {}) {
  const routes = {}; const reg = (m) => (p, ...h) => { routes[m + ' ' + p] = h; }; const app = { get: reg('GET'), post: reg('POST') };
  const store = { ref_docs: {}, ref_chunks: {} };
  const enc = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) } : { stringValue: String(v) }]));
  const dec = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, 'booleanValue' in v ? v.booleanValue : 'integerValue' in v ? Number(v.integerValue) : v.stringValue]));
  const fetchImpl = async (u, i = {}) => { const J = (s, j) => ({ ok: s < 300, status: s, json: async () => j }); if (u.includes('oauth2')) return J(200, { access_token: 'AT', expires_in: 3600 });
    if (u.endsWith(':commit')) { JSON.parse(i.body).writes.forEach(w => { const [col, id] = w.update.name.split('/').slice(-2); store[col][id] = dec(w.update.fields); }); return J(200, {}); }
    const m = /\/documents\/([^?]+)/.exec(u); const [col, id] = decodeURIComponent(m[1]).split('/');
    if (!id) return J(200, { documents: Object.entries(store[col]).map(([k, f]) => ({ name: 'x/' + col + '/' + k, fields: enc(f) })) });
    if (i.method === 'PATCH') { store[col][id] = { ...store[col][id], ...dec(JSON.parse(i.body).fields) }; return J(200, {}); }
    return store[col][id] ? J(200, { fields: enc(store[col][id]) }) : J(404, {}); };
  const requireMember = (req, res, next) => { req.user = { email: 'o@x.sa', role, tenant: 'default' }; next(); };
  const env = { FIREBASE_API_KEY: 'AIzaSy' + 'a'.repeat(33), ...(sa ? { FIREBASE_SERVICE_ACCOUNT: sa } : {}) };
  const ai = () => ({ messages: { create: async (p) => ({ content: [{ type: 'text', text: '{"order":[1,0]}' }] }) } });
  const M = mountRefs(app, { express: { json: () => (q, r, n) => n() }, requireMember, rateLimit: () => (q, r, n) => n(), T: loadTenants(env), fetchImpl, aiClient: ai, log: { log() { }, error() { } } });
  const call = async (key, { body, params = {} } = {}) => { const req = { body, params, user: null }; const o = { status: 200 }; const res = { status(c) { o.status = c; return this; }, json(j) { o.json = j; return this; } };
    for (const h of routes[key]) { let go = false; await h(req, res, () => { go = true; }); if (!go) break; } return o; };
  return { call, store, M };
}

test('الخادم: الرفع لمسؤول النظام، غير موثّق افتراضيًا، البحث بالصفحة، التوثيق والحالة، والعزل', async () => {
  const H = harness();
  const up = await H.call('POST /api/refs/upload', { body: { meta: { title: 'IFRS 15', family: 'IFRS 15', cat: 'ifrs', authority: 'official', version: '2014', effFrom: '2018-01-01' }, pages: PAGES15 } });
  assert.ok(up.json.job); await new Promise(r => setTimeout(r, 30)); const job = (await H.call('GET /api/refs/job/:id', { params: { id: up.json.job } })).json;
  assert.equal(job.state, 'done'); assert.equal(job.pages, 2);
  const d = H.store.ref_docs[up.json.job]; assert.equal(d.verified, false); assert.equal(d.status, 'active'); assert.ok(Object.keys(H.store.ref_chunks).every(k => k.startsWith(up.json.job + '__')));
  const s = await H.call('POST /api/refs/search', { body: { q: 'الاعتراف بالإيراد فقرة 31' } }); assert.equal(s.json.hits[0].page, 31); assert.equal(s.json.hits[0].verified, false);
  const rr = await H.call('POST /api/refs/search', { body: { q: 'الإيراد العقود', rerank: true } }); assert.equal(rr.json.ranked, true);
  await H.call('POST /api/refs/update', { body: { id: up.json.job, verify: true, meta: { status: 'superseded' } } }); H.M.cache.clear();
  assert.equal(H.store.ref_docs[up.json.job].verified, true); assert.equal((await H.call('POST /api/refs/search', { body: { q: 'الإيراد' } })).json.hits.length, 0, 'الملغى خارج البحث الافتراضي');
  assert.equal((await harness({ role: 'accountant' }).call('POST /api/refs/upload', { body: { meta: { title: 'x' }, pages: PAGES15 } })).status, 403);
  assert.equal((await harness({ sa: '' }).call('GET /api/refs')).status, 409);
});

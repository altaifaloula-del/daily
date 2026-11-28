/* v56.15 — MUKTASAB FINANCE D5: الترحيل إلى الدفتر المخزّن من الخادم وحده (server-ledger.js).
   الخادم يجمع السطور بالهللات بنفسه، ويتحقق من الدور والفترة، ويرقّم في معاملة، ويعكس الأصل في الكتابة نفسها. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mountLedger, ledgerValidate, ledgerPeriodOk, LEDGER_FIN_ROLES } from '../server-ledger.js';
import { loadTenants } from '../tenants.js';

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
const SA = JSON.stringify({ client_email: 'ops@demo-prod.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'demo-prod' });
const ENV = { FIREBASE_API_KEY: 'AIzaSy' + 'a'.repeat(33), FIREBASE_PROJECT_ID: 'demo-prod', FIREBASE_SERVICE_ACCOUNT: SA };
const LINES = JSON.stringify([['1101', 115000, 0, 'b1'], ['4101', 0, 100000, 'b1'], ['2301', 0, 15000, 'b1']]);
const item = (key, x = {}) => ({ key, rec: { date: '2026-11-20', src: 'rev:' + key, title: 'إيراد', lines: LINES, ver: 1, ...(x.rec || {}) }, ...x, ...(x.rec ? { rec: { date: '2026-11-20', src: 'rev:' + key, title: 'إيراد', lines: LINES, ver: 1, ...x.rec } } : {}) });

/** خادم Firestore REST وهمي في الذاكرة يحترم المعاملة: currentDocument.exists والتحويل REQUEST_TIME */
function harness({ env = ENV, locks = '2026-10-31', mig = null, admins = ['o@example.sa'], docs = {} } = {}) {
  const routes = {}; const app = { post: (p, ...h) => (routes[p] = h) };
  const users = { owner: { email: 'o@example.sa', role: 'system_admin', tenant: 'default' }, acct: { email: 'acc@example.sa', role: 'accountant', tenant: 'default' },
    cash: { email: 'c@example.sa', role: 'cashier', tenant: 'default' }, boss: { email: 'boss@example.sa', role: 'cashier', tenant: 'default' } };
  const requireMember = (req, res, next) => { const u = users[req.who]; if (!u) return res.status(401).json({}); req.user = u; next(); };
  const db = { 'fin_periods/locks': { fields: { lockedTo: { stringValue: locks } } }, 'platform/admins': { fields: { emails: { arrayValue: { values: admins.map(e => ({ stringValue: e })) } } } },
    ...(mig ? { 'fin_periods/migration': { fields: { open: { booleanValue: true }, until: { timestampValue: new Date(Date.now() + 3600e3).toISOString() } } } } : {}), ...docs };
  const commits = [];
  const fetchImpl = async (u, i = {}) => {
    const ok = (j) => ({ ok: true, status: 200, json: async () => j });
    if (u.includes('oauth2')) return ok({ access_token: 'AT', expires_in: 3600 });
    if (u.endsWith(':beginTransaction')) return ok({ transaction: 'TX' });
    if (u.endsWith(':rollback')) return ok({});
    if (u.endsWith(':commit')) { const b = JSON.parse(i.body); commits.push(b);
      for (const w of b.writes) { const k = w.update.name.split('/documents/')[1]; if (w.currentDocument && w.currentDocument.exists === false && db[k]) return { ok: false, status: 409, json: async () => ({ error: { status: 'ALREADY_EXISTS' } }) }; }
      for (const w of b.writes) { const k = w.update.name.split('/documents/')[1]; db[k] = w.updateMask ? { fields: { ...(db[k] || {}).fields, ...w.update.fields } } : { fields: { ...w.update.fields, ...(w.updateTransforms ? { at: { timestampValue: 'NOW' } } : {}) } }; }
      return ok({}); }
    const k = decodeURIComponent(u.split('/documents/')[1] || '').split('?')[0];
    return db[k] ? ok(db[k]) : { ok: false, status: 404, json: async () => ({}) };
  };
  const logs = [];
  mountLedger(app, { express: { json: () => (q, r, n) => n() }, requireMember, rateLimit: () => (q, r, n) => n(), T: loadTenants(env), cv: 561400, fetchImpl, log: { log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push('E ' + a.join(' ')) } });
  const call = async (who, items) => { const req = { who, body: { items } }; const out = { status: 200 };
    const res = { status(c) { out.status = c; return this; }, json(j) { out.json = j; return this; } };
    for (const h of routes['/api/ledger/post']) { let go = false; await h(req, res, () => { go = true; }); if (!go) break; } return out; };
  const F = (k) => { const d = db[k]; if (!d) return null; const o = {}; Object.entries(d.fields).forEach(([n, f]) => { o[n] = f.stringValue ?? (f.integerValue != null ? Number(f.integerValue) : f.booleanValue ?? f.timestampValue); }); return o; };
  return { call, db, F, commits, logs };
}

test('التحقق النقي: الخادم يجمع السطور بالهللات ويرفض غير المتوازن والكسور والسالب، والبصمة SHA-256 للتاريخ والسطور', () => {
  const v = ledgerValidate(item('k1')); assert.equal(v.err, undefined);
  assert.equal(v.rec.drH, 115000); assert.equal(v.rec.crH, 115000);
  assert.equal(v.rec.digest, crypto.createHash('sha256').update(JSON.stringify(['2026-11-20', JSON.parse(LINES)])).digest('hex'));
  const bad = (lines) => ledgerValidate(item('k', { rec: { lines: JSON.stringify(lines) } })).err;
  assert.match(bad([['1101', 115000, 0, ''], ['4101', 0, 114999, '']]), /غير متوازن/);
  assert.match(bad([['1101', 1150.5, 0, ''], ['4101', 0, 1150.5, '']]), /هللات صحيحة/);
  assert.match(bad([['1101', -5, 0, ''], ['4101', 0, -5, '']]), /غير سالبة/);
  assert.match(bad([['1101', 0, 0, ''], ['4101', 0, 0, '']]), /غير متوازن/);
  assert.match(bad([['1101', 5, 0, '']]), /عدد السطور/);
  assert.match(ledgerValidate({ key: 'a/b', rec: {} }).err, /مفتاح/);
  assert.match(ledgerValidate(item('k', { rec: { date: '2026-1-1' } })).err, /تاريخ/);
  assert.match(ledgerValidate(item('k', { reverseId: 'x_v1', rec: { reversalOf: 'y_v1' } })).err, /الأصل نفسه/);
});

test('الفترة: بعد القفل مسموح؛ المقفلة فقط قيدًا تاريخيًا لمدير المنصة في نافذة ترحيل مفتوحة', () => {
  assert.equal(ledgerPeriodOk('2026-11-01', { lockedTo: '2026-10-31' }), true);
  assert.equal(ledgerPeriodOk('2026-10-31', { lockedTo: '2026-10-31' }), false);
  assert.equal(ledgerPeriodOk('2026-10-15', { lockedTo: '2026-10-31', legacy: true, admin: true, migOpen: false }), false);
  assert.equal(ledgerPeriodOk('2026-10-15', { lockedTo: '2026-10-31', legacy: true, admin: false, migOpen: true }), false);
  assert.equal(ledgerPeriodOk('2026-10-15', { lockedTo: '2026-10-31', legacy: true, admin: true, migOpen: true }), true);
  assert.ok(LEDGER_FIN_ROLES.includes('accountant') && !LEDGER_FIN_ROLES.includes('cashier'));
});

test('الترحيل: المحاسب يرحّل بأرقام متتالية من العدّاد في معاملة؛ المكرر يُتجاوز؛ الكاشير ممنوع؛ الفترة المقفلة مرفوضة', async () => {
  const H = harness();
  let r = await H.call('acct', [item('a_v1'), item('b_v1')]);
  assert.equal(r.status, 200); assert.deepEqual(r.json.results.map(x => x.no), ['JV-2026-000001', 'JV-2026-000002']);
  const A = H.F('fin_ledger/a_v1');
  assert.equal(A.no, 'JV-2026-000001'); assert.equal(A.seq, 1); assert.equal(A.year, 2026); assert.equal(A.drH, 115000); assert.equal(A.status, 'posted');
  assert.equal(A.by, 'acc@example.sa'); assert.equal(A.via, 'server'); assert.equal(A.at, 'NOW', 'وقت الخادم لا العميل'); assert.equal(A.cv, 561400);
  assert.deepEqual(H.F('fin_ledger_meta/seq_2026'), { n: 2, last: 'b_v1' });
  r = await H.call('acct', [item('a_v1')]); assert.equal(r.json.results[0].skip, 'exists', 'لا تكرار');
  assert.equal((await H.call('cash', [item('c_v1')])).status, 403);
  r = await H.call('acct', [item('old_v1', { rec: { date: '2026-10-15' } })]); assert.match(r.json.results[0].err, /الفترة مقفلة/);
  r = await H.call('acct', [item('bad_v1', { rec: { lines: JSON.stringify([['1101', 10, 0, ''], ['4101', 0, 9, '']]) } })]); assert.match(r.json.results[0].err, /غير متوازن/);
  assert.equal(H.F('fin_ledger/bad_v1'), null, 'لا كتابة لغير المتوازن');
  assert.equal((await H.call('acct', [])).status, 400);
  assert.equal((await H.call('acct', Array.from({ length: 51 }, (_, i) => item('x' + i)))).status, 400);
});

test('التاريخي: مدير المنصة في نافذة الترحيل يرحّل قيدًا مقفلًا بعلامة legacy؛ وبلا نافذة يُرفض', async () => {
  let H = harness(); let r = await H.call('owner', [item('o_v1', { legacy: true, rec: { date: '2026-01-01' } })]); assert.match(r.json.results[0].err, /نافذة الترحيل/);
  H = harness({ mig: true }); r = await H.call('owner', [item('o_v1', { legacy: true, rec: { date: '2026-01-01' } })]);
  assert.equal(r.json.results[0].no, 'JV-2026-000001'); assert.equal(H.F('fin_ledger/o_v1').legacy, true);
  r = await H.call('acct', [item('o2_v1', { legacy: true, rec: { date: '2026-01-02' } })]); assert.match(r.json.results[0].err, /مقفلة/, 'المحاسب لا يرحّل التاريخي');
});

test('العكس والإصدار التالي: الأصل «معكوس» في الكتابة نفسها، والجديد لا يُرحَّل إن تعذّر العكس، ولا عكس في فترة مقفلة', async () => {
  const H = harness(); await H.call('acct', [item('a_v1')]);
  const rev = JSON.stringify([['1101', 0, 115000, 'b1'], ['4101', 100000, 0, 'b1'], ['2301', 15000, 0, 'b1']]);
  let r = await H.call('acct', [item('a_v1r', { reverseId: 'a_v1', rec: { src: 'rev:a', lines: rev, reversalOf: 'a_v1' } }), item('a_v2', { after: 'a_v1r', rec: { src: 'rev:a', ver: 2 } })]);
  assert.deepEqual(r.json.results.map(x => x.no), ['JV-2026-000002', 'JV-2026-000003']);
  assert.equal(H.F('fin_ledger/a_v1').status, 'reversed'); assert.equal(H.F('fin_ledger/a_v1').reversedBy, 'a_v1r'); assert.equal(H.F('fin_ledger/a_v1').drH, 115000, 'المحتوى لم يتغير');
  assert.equal(H.F('fin_ledger/a_v1r').reversalOf, 'a_v1');
  r = await H.call('acct', [item('a_v1r2', { reverseId: 'a_v1', rec: { src: 'rev:a', lines: rev, reversalOf: 'a_v1' } }), item('a_v3', { after: 'a_v1r2', rec: { src: 'rev:a', ver: 3 } })]);
  assert.match(r.json.results[0].err, /ليس مرحّلًا/, 'لا يُعكس مرتين'); assert.match(r.json.results[1].err, /لم يُرحَّل العكس/); assert.equal(H.F('fin_ledger/a_v3'), null);
  const L = harness({ docs: { 'fin_ledger/old_v1': { fields: { status: { stringValue: 'posted' }, date: { stringValue: '2026-10-10' } } } } });
  r = await L.call('acct', [item('old_v1r', { reverseId: 'old_v1', rec: { src: 'rev:old', lines: rev, reversalOf: 'old_v1' } })]);
  assert.match(r.json.results[0].err, /فترة مقفلة/, 'قرار المالك');
});

test('بلا حساب خدمة: 409 برسالة واضحة', async () => {
  const H = harness({ env: { FIREBASE_API_KEY: ENV.FIREBASE_API_KEY, FIREBASE_PROJECT_ID: 'demo-prod' } });
  const r = await H.call('acct', [item('a_v1')]); assert.equal(r.status, 409); assert.match(r.json.error, /FIREBASE_SERVICE_ACCOUNT/);
});
